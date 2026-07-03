import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export interface ReceiptData {
  receipt_no: string;
  student_name: string;
  student_code: string;
  amount: number;
  discount: number;
  remaining: number;
  method_ar: string;
  paid_at: string;
  employee: string;
  period_label?: string | null;
  notes?: string | null;
}

export function Receipt({ data }: { data: ReceiptData }) {
  const [qr, setQr] = useState<string>("");
  const payload = useMemo(() => `receipt:${data.receipt_no}`, [data.receipt_no]);

  useEffect(() => {
    QRCode.toDataURL(payload, { margin: 1, width: 140 }).then(setQr).catch(() => setQr(""));
  }, [payload]);

  const date = new Date(data.paid_at);
  const fmt = (n: number) =>
    new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 2 })
      .format(n);

  return (
    <div>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .receipt-print, .receipt-print * { visibility: visible; }
          .receipt-print { position: absolute; inset: 0; margin: 0; padding: 20px; }
          .no-print { display: none !important; }
        }
      `}</style>
      <div className="receipt-print mx-auto max-w-md border border-border rounded-lg bg-white text-black p-6 text-sm" dir="rtl">
        <div className="flex items-center justify-between border-b border-gray-300 pb-3 mb-3">
          <div>
            <div className="text-lg font-bold">مركز الأحياء التعليمي</div>
            <div className="text-xs text-gray-600">إيصال دفع رسمي</div>
          </div>
          <div className="text-left">
            <div className="text-xs text-gray-600">رقم الإيصال</div>
            <div className="font-mono font-semibold" dir="ltr">{data.receipt_no}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs mb-3">
          <Row label="اسم الطالب" value={data.student_name} />
          <Row label="رقم الطالب" value={data.student_code} ltr />
          <Row label="التاريخ" value={date.toLocaleDateString("ar-EG")} />
          <Row label="الوقت" value={date.toLocaleTimeString("ar-EG")} />
          <Row label="طريقة الدفع" value={data.method_ar} />
          <Row label="الموظف" value={data.employee} />
          {data.period_label && <Row label="عن شهر" value={data.period_label} />}
        </div>

        <div className="border-t border-b border-gray-300 py-3 my-3 space-y-1">
          <div className="flex justify-between"><span>المبلغ المدفوع</span><span className="font-semibold">{fmt(data.amount)}</span></div>
          {data.discount > 0 && (
            <div className="flex justify-between text-emerald-700"><span>الخصم</span><span>{fmt(data.discount)}</span></div>
          )}
          <div className="flex justify-between"><span>المتبقي</span><span className={data.remaining > 0 ? "text-red-600 font-semibold" : "text-emerald-700 font-semibold"}>{fmt(data.remaining)}</span></div>
        </div>

        {data.notes && (
          <div className="text-xs mb-3"><span className="text-gray-600">ملاحظات: </span>{data.notes}</div>
        )}

        <div className="flex items-end justify-between mt-4">
          <div className="text-[10px] text-gray-500 max-w-[60%]">
            هذا الإيصال دليل رسمي للدفع. يرجى الاحتفاظ به. QR يمكن مسحه للتحقق من رقم الإيصال.
          </div>
          {qr && <img src={qr} alt="qr" className="size-24" />}
        </div>
      </div>
      <div className="no-print mt-4 flex justify-end">
        <Button onClick={() => window.print()} variant="outline">
          <Printer className="ms-2 size-4" /> طباعة
        </Button>
      </div>
    </div>
  );
}

function Row({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div>
      <div className="text-gray-500">{label}</div>
      <div className="font-medium" dir={ltr ? "ltr" : undefined}>{value}</div>
    </div>
  );
}
