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
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.ITF,
];

const requestEnvironmentCamera = () => {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Camera access is not supported by this browser.");
  }
  return navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: "environment" } },
    audio: false,
  });
};

const delay = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

export function BarcodeScanner({ open, onOpenChange, onDetected, cameraStreamPromise }: Props) {
  const { lang } = useI18n();
  const isAr = lang === "ar";
  const decodeContainerId = "barcode-scanner-decode-region";
  const decoderRef = useRef<Html5Qrcode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const stoppedRef = useRef(false);

  const getDecoder = useCallback(() => {
    if (!decoderRef.current) {
      decoderRef.current = new Html5Qrcode(decodeContainerId, {
        verbose: false,
        formatsToSupport: SUPPORTED_FORMATS,
      });
    }
    return decoderRef.current;
  }, []);

  const stopCamera = useCallback(async () => {
    stoppedRef.current = true;
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.srcObject = null;
    }
    const stream = streamRef.current;
    streamRef.current = null;
    stream?.getTracks().forEach((track) => track.stop());
    const decoder = decoderRef.current;
    decoderRef.current = null;
    if (decoder) {
      try {
        if (decoder.isScanning) await decoder.stop();
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
          ? "لم يتم العثور على كاميرا خلفية. استخدم زر التقاط صورة الكود."
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

  const decodeCanvas = useCallback(async (canvas: HTMLCanvasElement) => {
    const NativeBarcodeDetector = (window as any).BarcodeDetector;
    if (NativeBarcodeDetector) {
      try {
        const formats = await NativeBarcodeDetector.getSupportedFormats?.();
        const wantedFormats = ["code_128", "code_39", "ean_13", "ean_8", "upc_a", "upc_e", "itf", "qr_code"];
        const supported = Array.isArray(formats)
          ? wantedFormats.filter((format) => formats.includes(format))
          : wantedFormats;
        if (supported.length > 0) {
          const detector = new NativeBarcodeDetector({ formats: supported });
          const results = await detector.detect(canvas);
          const rawValue = results?.[0]?.rawValue;
          if (rawValue) return String(rawValue);
        }
      } catch {
        /* Fall through to html5-qrcode image decoding. */
      }
    }

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    if (!blob) return null;
    const file = new File([blob], "barcode-frame.jpg", { type: "image/jpeg" });
    try {
      return await getDecoder().scanFile(file, false);
    } catch {
      return null;
    }
  }, [getDecoder]);

  useEffect(() => {
    if (!open) return;
    stoppedRef.current = false;
    setError(null);
    setStarting(true);

    let cancelled = false;

    const start = async () => {
      try {
        // Prefer the stream requested directly by the Scan Barcode click handler.
        const stream = cameraStreamPromise ? await cameraStreamPromise : await requestEnvironmentCamera();
        if (cancelled) return;
        streamRef.current = stream;

        await new Promise((r) => requestAnimationFrame(() => r(null)));
        const video = videoRef.current;
        if (!video || cancelled) return;

        video.setAttribute("playsinline", "true");
        video.setAttribute("webkit-playsinline", "true");
        video.muted = true;
        video.srcObject = stream;
        await video.play();

        setStarting(false);

        const canvas = canvasRef.current ?? document.createElement("canvas");
        canvasRef.current = canvas;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) throw new Error("Unable to prepare barcode scanner.");

        while (!cancelled && !stoppedRef.current) {
          if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const decodedText = await decodeCanvas(canvas);
            if (decodedText?.trim() && !cancelled && !stoppedRef.current) {
              stoppedRef.current = true;
              onDetected(decodedText.trim());
              await stopCamera();
              onOpenChange(false);
              return;
            }
          }
          await delay(450);
        }
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
  }, [cameraStreamPromise, decodeCanvas, handleCameraError, onDetected, onOpenChange, open, stopCamera]);

  const handleFile = async (file: File) => {
    setError(null);
    const stream = streamRef.current;
    streamRef.current = null;
    stream?.getTracks().forEach((track) => track.stop());
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.srcObject = null;
    }
    try {
      const text = await getDecoder().scanFile(file, true);
      if (text) {
        stoppedRef.current = true;
        onDetected(text.trim());
        await stopCamera();
        onOpenChange(false);
      }
    } catch (e: any) {
      setError(
        isAr
          ? "تعذر قراءة الباركود من الصورة. حاول التقاط صورة أوضح وأقرب."
          : "Could not read the barcode from that image. Try a clearer, closer photo.",
      );
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
          <div
            className="relative w-full aspect-square bg-muted rounded-md overflow-hidden"
          >
            <video
              ref={videoRef}
              className="h-full w-full object-cover"
              muted
              playsInline
              autoPlay
            />
            <div className="pointer-events-none absolute inset-x-[12%] top-1/2 h-[34%] -translate-y-1/2 rounded-md border-2 border-primary/80 shadow-[0_0_0_999px_hsl(var(--background)/0.45)]" />
          </div>
          <div id={decodeContainerId} className="hidden" />
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
