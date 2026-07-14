import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { Button } from "@/components/ui/button";
import { Camera, CameraOff, Keyboard } from "lucide-react";

type Device = "mobile" | "webcam" | "usb";

/** Unified scanner:
 *  - camera (mobile/webcam) via ZXing
 *  - USB HID readers (act as keyboard) via hidden input capturing rapid keystrokes
 */
export function QrScanner({
  onDetected,
  active = true,
}: {
  onDetected: (token: string, device: Device) => void;
  active?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const lastFireRef = useRef<{ token: string; at: number } | null>(null);
  const [cameraOn, setCameraOn] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fire = (raw: string, device: Device) => {
    const token = raw.trim();
    if (!token) return;
    const now = Date.now();
    // Debounce identical scans within 2s
    if (
      lastFireRef.current &&
      lastFireRef.current.token === token &&
      now - lastFireRef.current.at < 2000
    )
      return;
    lastFireRef.current = { token, at: now };
    onDetected(token, device);
  };

  // Camera
  useEffect(() => {
    if (!active || !cameraOn) return;
    let cancelled = false;
    const reader = new BrowserMultiFormatReader();

    const start = async () => {
      try {
        // Ask for camera permission FIRST — enumerateDevices() returns empty/unlabeled
        // results until getUserMedia() has been granted at least once.
        let permissionStream: MediaStream | null = null;
        try {
          permissionStream = await navigator.mediaDevices.getUserMedia({ video: true });
        } catch (permErr) {
          throw new Error(
            (permErr as Error).name === "NotAllowedError"
              ? "تم رفض إذن الكاميرا. فعّل إذن الكاميرا من إعدادات المتصفح."
              : "تعذّر الوصول إلى الكاميرا."
          );
        } finally {
          permissionStream?.getTracks().forEach((t) => t.stop());
        }

        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        // Prefer rear camera when available
        const rear = devices.find((d) => /back|rear|environment/i.test(d.label));
        const deviceId = rear?.deviceId ?? devices[0]?.deviceId;
        if (!deviceId) throw new Error("لا توجد كاميرا متاحة.");
        if (!videoRef.current || cancelled) return;
        const controls = await reader.decodeFromVideoDevice(
          deviceId,
          videoRef.current,
          (result) => {
            if (result) {
              const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
              fire(result.getText(), isMobile ? "mobile" : "webcam");
            }
          },
        );
        controlsRef.current = controls;
      } catch (e) {
        setError((e as Error).message || "تعذّر تشغيل الكاميرا.");
      }
    };
    start();
    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, cameraOn]);

  // USB HID reader: capture rapid keystrokes anywhere on the page, terminated by Enter.
  useEffect(() => {
    if (!active) return;
    let buffer = "";
    let firstAt = 0;
    const onKey = (e: KeyboardEvent) => {
      // Skip when user is typing in a normal field (unless it's our hidden input)
      const target = e.target as HTMLElement | null;
      if (target && target !== inputRef.current) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) return;
      }
      const now = Date.now();
      if (e.key === "Enter") {
        if (buffer && now - firstAt < 1000) fire(buffer, "usb");
        buffer = "";
        return;
      }
      if (e.key.length !== 1) return;
      if (!buffer) firstAt = now;
      buffer += e.key;
      // Guard: if slow typing, reset
      if (now - firstAt > 1500) {
        buffer = e.key;
        firstAt = now;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-lg border border-border bg-black">
        {cameraOn ? (
          <video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline />
        ) : (
          <div className="grid aspect-video place-items-center text-sm text-muted-foreground">
            الكاميرا متوقفة — يمكنك استخدام قارئ USB.
          </div>
        )}
      </div>
      {error && (
        <p className="text-xs text-destructive">
          {error} — يمكنك استخدام قارئ USB بدل الكاميرا.
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <Keyboard className="size-4" /> يعمل تلقائيًا مع قارئات USB
        </div>
        <Button size="sm" variant="outline" onClick={() => setCameraOn((v) => !v)}>
          {cameraOn ? (
            <>
              <CameraOff className="ms-2 size-4" /> إيقاف الكاميرا
            </>
          ) : (
            <>
              <Camera className="ms-2 size-4" /> تشغيل الكاميرا
            </>
          )}
        </Button>
      </div>
      {/* Hidden focus-target so keyboard focus doesn't disturb the page */}
      <input
        ref={inputRef}
        aria-hidden
        tabIndex={-1}
        className="sr-only"
        onKeyDown={(e) => e.stopPropagation()}
      />
    </div>
  );
}
