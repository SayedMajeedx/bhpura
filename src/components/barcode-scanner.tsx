import { useCallback, useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { Camera, Upload, X } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDetected: (code: string) => void;
  cameraStreamPromise?: Promise<MediaStream> | null;
};

const SUPPORTED_FORMATS = [
  Html5QrcodeSupportedFormats.QR_CODE,
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.CODE_93,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.ITF,
  Html5QrcodeSupportedFormats.CODABAR,
];

const DECODE_REGION_ID = "barcode-scanner-decode-region";

export function BarcodeScanner({ open, onOpenChange, onDetected, cameraStreamPromise }: Props) {
  const { lang } = useI18n();
  const isAr = lang === "ar";
  const decoderRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const stoppedRef = useRef(false);

  const getDecoder = useCallback(() => {
    if (!decoderRef.current) {
      decoderRef.current = new Html5Qrcode(DECODE_REGION_ID, {
        verbose: false,
        formatsToSupport: SUPPORTED_FORMATS,
      });
    }
    return decoderRef.current;
  }, []);

  const stopCamera = useCallback(async () => {
    stoppedRef.current = true;
    const decoder = decoderRef.current;
    decoderRef.current = null;
    if (decoder) {
      try {
        if (decoder.isScanning) await decoder.stop();
      } catch {
        /* noop */
      }
      try {
        await decoder.clear();
      } catch {
        /* noop */
      }
    }
  }, []);

  const handleCameraError = useCallback((e: any) => {
    const raw = String(e?.message || e || "");
    const name = e?.name;
    if (name === "NotAllowedError" || name === "PermissionDeniedError" || raw.includes("Permission denied")) {
      setError(
        isAr
          ? "تم رفض إذن الكاميرا. فعّل الإذن من إعدادات المتصفح، أو استخدم زر التقاط صورة الكود."
          : "Camera permission denied. Enable it in your browser settings, or use the Upload/Take Photo option.",
      );
    } else if (name === "NotFoundError" || name === "DevicesNotFoundError" || name === "OverconstrainedError") {
      setError(
        isAr
          ? "لم يتم العثور على كاميرا مناسبة. استخدم زر التقاط صورة الكود."
          : "No suitable camera found. Use the Upload/Take Photo option.",
      );
    } else if (name === "NotReadableError" || name === "TrackStartError") {
      setError(
        isAr
          ? "الكاميرا مستخدمة من تطبيق آخر. أغلق التطبيقات الأخرى أو استخدم زر التقاط صورة الكود."
          : "The camera is already in use. Close other camera apps or use the Upload/Take Photo option.",
      );
    } else {
      setError(
        isAr
          ? "تعذر تشغيل الكاميرا. جرّب التقاط صورة الكود."
          : "Unable to start the camera. Try the Upload/Take Photo option.",
      );
    }
  }, [isAr]);

  useEffect(() => {
    if (!open) return;
    stoppedRef.current = false;
    setError(null);
    setStarting(true);

    let cancelled = false;

    const start = async () => {
      try {
        // Release the pre-warmed probe stream from the click handler; html5-qrcode
        // will open its own stream and would otherwise hit NotReadableError.
        let deviceId: string | undefined;
        if (cameraStreamPromise) {
          try {
            const probe = await cameraStreamPromise;
            const track = probe.getVideoTracks()[0];
            deviceId = track?.getSettings?.().deviceId;
            probe.getTracks().forEach((t) => t.stop());
          } catch {
            /* fall through — html5-qrcode will request its own */
          }
        }

        // Ensure the decode region div is mounted.
        await new Promise((r) => requestAnimationFrame(() => r(null)));
        if (cancelled) return;

        const decoder = getDecoder();

        const cameraConfig: MediaTrackConstraints = deviceId
          ? {
              deviceId: { exact: deviceId },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
              frameRate: { ideal: 30 },
            }
          : {
              facingMode: { ideal: "environment" },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
              frameRate: { ideal: 30 },
            };

        const config = {
          fps: 15,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => ({
            width: Math.floor(viewfinderWidth * 0.9),
            height: Math.floor(viewfinderHeight * 0.45),
          }),
          aspectRatio: 1,
          disableFlip: false,
          formatsToSupport: SUPPORTED_FORMATS,
          videoConstraints: cameraConfig,
          experimentalFeatures: { useBarCodeDetectorIfSupported: true },
        };

        const applyContinuousFocus = () => {
          try {
            const region = document.getElementById(DECODE_REGION_ID);
            const video = region?.querySelector("video") as HTMLVideoElement | null;
            const track = (video?.srcObject as MediaStream | null)?.getVideoTracks?.()[0];
            if (!track) return;
            const caps: any = track.getCapabilities?.() ?? {};
            const advanced: any[] = [];
            if (caps.focusMode?.includes?.("continuous")) advanced.push({ focusMode: "continuous" });
            if (caps.exposureMode?.includes?.("continuous")) advanced.push({ exposureMode: "continuous" });
            if (caps.whiteBalanceMode?.includes?.("continuous")) advanced.push({ whiteBalanceMode: "continuous" });
            if (advanced.length) void track.applyConstraints({ advanced } as any).catch(() => {});
          } catch { /* noop */ }
        };

        const onSuccess = (decodedText: string) => {
          if (stoppedRef.current) return;
          stoppedRef.current = true;
          onDetected(decodedText.trim());
          void stopCamera();
          onOpenChange(false);
        };

        const onFrameFail = () => {
          /* per-frame no-match — ignore */
        };

        try {
          await decoder.start(cameraConfig as any, config, onSuccess, onFrameFail);
        } catch (err) {
          // Retry with a looser facingMode fallback if exact deviceId failed.
          if (deviceId) {
            await decoder.start(
              { facingMode: { ideal: "environment" } } as any,
              config,
              onSuccess,
              onFrameFail,
            );
          } else {
            throw err;
          }
        }

        // Give the video element a tick to attach, then enable continuous autofocus.
        setTimeout(applyContinuousFocus, 600);

        if (cancelled) {
          await stopCamera();
          return;
        }
        setStarting(false);
      } catch (e: any) {
        setStarting(false);
        handleCameraError(e);
      }
    };

    void start();

    return () => {
      cancelled = true;
      void stopCamera();
    };
  }, [cameraStreamPromise, getDecoder, handleCameraError, onDetected, onOpenChange, open, stopCamera]);

  const downscaleImage = async (file: File, maxEdge = 1600): Promise<File> => {
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
      if (scale >= 1) return file;
      const w = Math.round(bitmap.width * scale);
      const h = Math.round(bitmap.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return file;
      ctx.drawImage(bitmap, 0, 0, w, h);
      const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.92));
      if (!blob) return file;
      return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
    } catch {
      return file;
    }
  };

  const handleFile = async (file: File) => {
    setError(null);
    await stopCamera();
    const prepared = await downscaleImage(file);
    // Use a fresh decoder instance for scanFile so it doesn't conflict with live scanning.
    const scanDecoder = new Html5Qrcode(DECODE_REGION_ID, {
      verbose: false,
      formatsToSupport: SUPPORTED_FORMATS,
    });
    try {
      let text: string | null = null;
      try {
        text = await scanDecoder.scanFile(prepared, true);
      } catch {
        try {
          text = await scanDecoder.scanFile(prepared, false);
        } catch {
          text = null;
        }
      }
      if (text) {
        stoppedRef.current = true;
        onDetected(text.trim());
        onOpenChange(false);
        return;
      }
      setError(
        isAr
          ? "تعذر قراءة الباركود من الصورة. حاول التقاط صورة أوضح وأقرب."
          : "Could not read the barcode from that image. Try a clearer, closer photo.",
      );
    } finally {
      try {
        await scanDecoder.clear();
      } catch {
        /* noop */
      }
    }
  };

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
          <div className="relative w-full aspect-square bg-black rounded-md overflow-hidden">
            <div id={DECODE_REGION_ID} className="absolute inset-0 [&_video]:h-full [&_video]:w-full [&_video]:object-cover" />
            <div className="pointer-events-none absolute inset-x-[6%] top-1/2 h-[40%] -translate-y-1/2 rounded-md border-2 border-primary/80" />
          </div>
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
              ? "وجّه الكاميرا نحو الباركود بحيث يملأ الإطار."
              : "Point the camera so the barcode fills the framed area."}
          </p>

          <div className="flex items-center gap-2 pt-1">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {isAr ? "أو" : "or"}
            </span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="w-full gap-2"
            onClick={() => fileInputRef.current?.click()}
          >
            <Camera className="h-4 w-4" />
            <Upload className="h-4 w-4 -ms-1" />
            {isAr ? "التقاط صورة الكود" : "Upload or Take Photo"}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
              e.target.value = "";
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
