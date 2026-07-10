import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

const InviteStaffInput = z.object({
  email: z.string().trim().email().max(255),
  full_name: z.string().trim().min(1).max(120),
  role: z.enum(["teacher", "secretary", "admin"]),
  specialization: z.string().trim().max(120).optional().nullable(),
});

const AcceptInviteInput = z.object({
  token: z.string().min(20).max(200),
  password: z.string().min(8).max(200),
});

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomToken(bytes = 32): string {
  const b = new Uint8Array(bytes);
  crypto.getRandomValues(b);
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export const inviteStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => InviteStaffInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden: admin only");

    const resendKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.INVITE_FROM_EMAIL;
    const siteUrl = process.env.PUBLIC_SITE_URL;
    if (!resendKey || !fromEmail || !siteUrl) {
      throw new Error("Email service not configured (RESEND_API_KEY / INVITE_FROM_EMAIL / PUBLIC_SITE_URL).");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const token = randomToken(32);
    const token_hash = await sha256Hex(token);

    const { data: inv, error: invErr } = await supabaseAdmin
      .from("staff_invites")
      .insert({
        email: data.email.toLowerCase(),
        full_name: data.full_name,
        role: data.role,
        specialization: data.role === "teacher" ? data.specialization || null : null,
        token_hash,
        invited_by: userId,
      })
      .select("id, expires_at")
      .single();
    if (invErr || !inv) throw new Error(invErr?.message ?? "Failed to create invite");

    const acceptUrl = `${siteUrl.replace(/\/$/, "")}/accept-invite?token=${encodeURIComponent(token)}`;

    // Send via Resend REST API directly (no gateway dependency).
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [data.email],
        subject: "دعوة للانضمام إلى فريق مركز الأحياء",
        html: `
          <div style="font-family:system-ui,sans-serif;line-height:1.6;direction:rtl;text-align:right">
            <h2>مرحباً ${escapeHtml(data.full_name)}</h2>
            <p>تمت دعوتك للانضمام كـ <strong>${roleLabel(data.role)}</strong> إلى نظام إدارة الطلاب.</p>
            <p>اضغط الرابط التالي لتفعيل حسابك وتعيين كلمة المرور:</p>
            <p><a href="${acceptUrl}" style="background:#0d9488;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">تفعيل الحساب</a></p>
            <p style="color:#666;font-size:12px">الرابط صالح لمدة 7 أيام. إذا لم تكن تتوقع هذه الدعوة، تجاهل هذه الرسالة.</p>
            <p style="color:#666;font-size:12px" dir="ltr">${escapeHtml(acceptUrl)}</p>
          </div>
        `,
      }),
    });
    if (!emailRes.ok) {
      const body = await emailRes.text();
      // Roll back invite so it can be re-sent cleanly.
      await supabaseAdmin.from("staff_invites").delete().eq("id", inv.id);
      throw new Error(`Failed to send invite email [${emailRes.status}]: ${body}`);
    }

    await supabaseAdmin.from("activity_log").insert({
      user_id: userId,
      action: "staff.invite",
      entity_type: data.role,
      entity_id: null,
      metadata: { email: data.email, full_name: data.full_name, invite_id: inv.id },
    });

    return { invite_id: inv.id, expires_at: inv.expires_at };
  });

export const acceptInvite = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => AcceptInviteInput.parse(raw))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const token_hash = await sha256Hex(data.token);

    const { data: inv, error: invErr } = await supabaseAdmin
      .from("staff_invites")
      .select("id, email, full_name, role, specialization, expires_at, accepted_at")
      .eq("token_hash", token_hash)
      .maybeSingle();
    if (invErr) throw new Error(invErr.message);
    if (!inv) throw new Error("Invitation not found or invalid token.");
    if (inv.accepted_at) throw new Error("This invitation has already been used.");
    if (new Date(inv.expires_at) < new Date()) throw new Error("This invitation has expired.");

    // Create auth user via isolated anon-key signUp (no auth.admin.* calls).
    const anonClient = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );

    const { data: signUpData, error: signUpErr } = await anonClient.auth.signUp({
      email: inv.email,
      password: data.password,
      options: { data: { full_name: inv.full_name, invited_role: inv.role } },
    });
    if (signUpErr || !signUpData.user) {
      throw new Error(signUpErr?.message ?? "Failed to create account");
    }
    const newId = signUpData.user.id;

    await supabaseAdmin.from("profiles").upsert({ id: newId, full_name: inv.full_name });

    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: newId, role: inv.role });
    if (roleErr && !roleErr.message.includes("duplicate")) throw new Error(roleErr.message);

    if (inv.role === "teacher") {
      await supabaseAdmin
        .from("teachers")
        .insert({ user_id: newId, specialization: inv.specialization || null });
    } else if (inv.role === "secretary") {
      await supabaseAdmin.from("secretaries").insert({ user_id: newId });
    }

    await supabaseAdmin
      .from("staff_invites")
      .update({ accepted_at: new Date().toISOString(), accepted_user_id: newId })
      .eq("id", inv.id);

    await supabaseAdmin.from("activity_log").insert({
      user_id: newId,
      action: "staff.accept_invite",
      entity_type: inv.role,
      entity_id: newId,
      metadata: { email: inv.email, invite_id: inv.id },
    });

    // Return email only — do NOT try to hand a server-side session to the browser.
    return { email: inv.email };
  });

const BroadcastInput = z.object({
  student_user_id: z.string().uuid(),
});

export const broadcastScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => BroadcastInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const [a, s] = await Promise.all([
      supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
      supabase.rpc("has_role", { _user_id: userId, _role: "secretary" }),
    ]);
    if (!a.data && !s.data) throw new Error("Forbidden: staff only");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const channel = supabaseAdmin.channel("reception");
    await channel.send({
      type: "broadcast",
      event: "student_scanned",
      payload: { student_user_id: data.student_user_id, at: new Date().toISOString() },
    });
    await supabaseAdmin.removeChannel(channel);
    return { ok: true };
  });

export const clearMustChangePassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("profiles")
      .update({ must_change_password: false })
      .eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function roleLabel(r: "admin" | "secretary" | "teacher"): string {
  return r === "admin" ? "مشرف" : r === "secretary" ? "سكرتير(ة)" : "معلم(ة)";
}
