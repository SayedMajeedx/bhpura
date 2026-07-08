import { useCallback, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";

type Props = {
  open: boolean;
  imageSrc: string | null;
  /** width / height ratio — defaults to 3/4 to match storefront product cards */
  aspect?: number;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void | Promise<void>;
  busy?: boolean;
};

async function getCroppedBlob(imageSrc: string, area: Area): Promise<Blob> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = imageSrc;
  });
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(area.width);
  canvas.height = Math.round(area.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported");
  ctx.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, area.width, area.height);
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Failed to encode image"))), "image/jpeg", 0.92);
  });
}

export function ImageCropperDialog({ open, imageSrc, aspect = 3 / 4, onCancel, onConfirm, busy }: Props) {
  const { lang } = useI18n();
  const isAr = lang === "ar";
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);

  const onCropComplete = useCallback((_: Area, pixels: Area) => setArea(pixels), []);

  const handleConfirm = async () => {
    if (!imageSrc || !area) return;
    const blob = await getCroppedBlob(imageSrc, area);
    await onConfirm(blob);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !busy) onCancel(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isAr ? "قص الصورة" : "Crop image"}</DialogTitle>
        </DialogHeader>
        <div className="relative w-full h-[420px] bg-muted rounded-md overflow-hidden">
          {imageSrc && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              objectFit="contain"
            />
          )}
        </div>
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">{isAr ? "التكبير" : "Zoom"}</label>
          <Slider min={1} max={4} step={0.05} value={[zoom]} onValueChange={(v) => setZoom(v[0] ?? 1)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={busy}>{isAr ? "إلغاء" : "Cancel"}</Button>
          <Button onClick={handleConfirm} disabled={busy || !area}>
            {busy && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
            {isAr ? "تأكيد القص" : "Confirm crop"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
