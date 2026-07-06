import { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { X } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDetected: (code: string) => void;
};

export function BarcodeScanner({ open, onOpenChange, onDetected }: Props) {
  const { lang } = useI18n();
  const isAr = lang === "ar";
  const containerId = "barcode-scanner-region";
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const stoppedRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    stoppedRef.current = false;
    setError(null);
    setStarting(true);

    const start = async () => {
      try {
        const el = document.getElementById(containerId);
        if (!el) return;
        const scanner = new Html5Qrcode(containerId, {
          verbose: false,
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.ITF,
          ],
        });
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: (w, h) => {
              const min = Math.min(w, h);
              const size = Math.floor(min * 0.75);
              return { width: size, height: Math.floor(size * 0.6) };
            },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            if (stoppedRef.current) return;
            stoppedRef.current = true;
            onDetected(decodedText.trim());
            stop().finally(() => onOpenChange(false));
          },
          () => { /* ignore per-frame decode errors */ },
        );
        setStarting(false);
      } catch (e: any) {
        setStarting(false);
        setError(
          e?.message ||
            (isAr
              ? "تعذر الوصول إلى الكاميرا. تأكد من السماح بالوصول."
              : "Unable to access the camera. Please grant permission."),
        );
      }
    };

    const stop = async () => {
      const s = scannerRef.current;
      scannerRef.current = null;
      if (!s) return;
      try {
        if (s.isScanning) await s.stop();
        await s.clear();
      } catch {
        /* noop */
      }
    };

    void start();

    return () => {
      stoppedRef.current = true;
      void stop();
    };
  }, [open, isAr, onDetected, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2 flex-row items-center justify-between">
          <DialogTitle>{isAr ? "مسح الباركود" : "Scan barcode"}</DialogTitle>
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} aria-label="close">
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>
        <div className="p-4 pt-0 space-y-3">
          <div
            id={containerId}
            className="w-full aspect-square bg-black rounded-md overflow-hidden"
          />
          {starting && !error && (
            <p className="text-xs text-muted-foreground text-center">
              {isAr ? "جارٍ تشغيل الكاميرا..." : "Starting camera..."}
            </p>
          )}
          {error && (
            <p className="text-xs text-destructive text-center">{error}</p>
          )}
          <p className="text-xs text-muted-foreground text-center">
            {isAr
              ? "وجّه الكاميرا نحو الباركود الموجود على القطعة."
              : "Point the camera at the item's barcode."}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
