import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Download, Printer } from "lucide-react";

export function QrDisplay({
  token,
  studentName,
  studentCode,
  size = 240,
}: {
  token: string;
  studentName?: string;
  studentCode?: string;
  size?: number;
}) {
  const [dataUrl, setDataUrl] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(token, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: size * 2,
      color: { dark: "#0f172a", light: "#ffffff" },
    }).then((url) => {
      if (!cancelled) setDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [token, size]);

  const download = () => {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${studentCode ?? "student"}-qr.png`;
    a.click();
  };

  const print = () => {
    if (!dataUrl) return;
    const w = window.open("", "_blank", "width=480,height=640");
    if (!w) return;
    w.document.write(`
      <html dir="rtl" lang="ar"><head><title>بطاقة QR — ${studentCode ?? ""}</title>
      <style>
        body{font-family:system-ui,-apple-system,'Cairo',sans-serif;text-align:center;padding:32px}
        h2{margin:16px 0 4px}
        code{font-family:ui-monospace,monospace;font-size:18px;letter-spacing:2px}
        .card{border:2px solid #0f172a;border-radius:16px;padding:24px;display:inline-block}
        img{display:block;margin:0 auto}
      </style></head>
      <body>
        <div class="card">
          <img src="${dataUrl}" width="${size}" height="${size}" alt="QR" />
          <h2>${studentName ?? ""}</h2>
          <code dir="ltr">${studentCode ?? ""}</code>
          <p style="color:#64748b;font-size:12px;margin-top:12px">مركز الأحياء التعليمي</p>
        </div>
        <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),500)}</script>
      </body></html>`);
    w.document.close();
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="rounded-lg border border-border bg-white p-3">
        {dataUrl ? (
          <img src={dataUrl} width={size} height={size} alt="QR Code" />
        ) : (
          <div style={{ width: size, height: size }} className="grid place-items-center text-xs text-muted-foreground">
            جارٍ التوليد...
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={download}>
          <Download className="ms-2 size-4" /> تنزيل
        </Button>
        <Button size="sm" variant="outline" onClick={print}>
          <Printer className="ms-2 size-4" /> طباعة البطاقة
        </Button>
      </div>
    </div>
  );
}
