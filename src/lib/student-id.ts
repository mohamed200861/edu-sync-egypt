// Bidirectional mapping between Student ID (BIO-000042) and the synthetic
// Supabase Auth email used behind the scenes for student accounts.
const DOMAIN = "students.local";

export function studentCodeToEmail(code: string): string {
  return `${code.trim().toLowerCase()}@${DOMAIN}`;
}

export function emailToStudentCode(email: string): string | null {
  const [local, domain] = email.split("@");
  if (domain !== DOMAIN) return null;
  return local.toUpperCase();
}

export function generateTempPassword(): string {
  // Human-friendly temporary password (10 chars, alphanumeric).
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  const arr = new Uint32Array(10);
  crypto.getRandomValues(arr);
  for (let i = 0; i < arr.length; i++) s += chars[arr[i] % chars.length];
  return s;
}
