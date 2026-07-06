import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { formatMoney } from "@/lib/format";

type BarcodeSvgProps = {
  value: string;
  height?: number;
  width?: number;
  fontSize?: number;
  displayValue?: boolean;
  margin?: number;
};

export function BarcodeSvg({
  value,
  height = 40,
  width = 1.4,
  fontSize = 12,
  displayValue = true,
  margin = 2,
}: BarcodeSvgProps) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!ref.current || !value) return;
    try {
      JsBarcode(ref.current, value, {
        format: "CODE128",
        height,
        width,
        fontSize,
        displayValue,
        margin,
        background: "#ffffff",
        lineColor: "#000000",
      });
    } catch {
      // invalid value; ignore
    }
  }, [value, height, width, fontSize, displayValue, margin]);
  return <svg ref={ref} />;
}

export type LabelData = {
  code: string;
  productName?: string | null;
  size?: string | null;
  color?: string | null;
  price?: number | null;
  businessName?: string | null;
};

export function PrintableLabel({ data }: { data: LabelData }) {
  const meta = [data.size, data.color].filter(Boolean).join(" · ");
  return (
    <div className="label-card">
      {data.businessName && <div className="label-biz">{data.businessName}</div>}
      {data.productName && <div className="label-name">{data.productName}</div>}
      {meta && <div className="label-meta">{meta}</div>}
      <div className="label-barcode">
        <BarcodeSvg value={data.code} height={70} width={2.2} fontSize={14} margin={8} />
      </div>
      {data.price != null && <div className="label-price">{formatMoney(Number(data.price))}</div>}
    </div>
  );
}

/**
 * Prints one or more sticker labels using an isolated hidden iframe so the
 * dashboard chrome (sidebar, header, backgrounds) is NEVER included in the
 * print output. Each label prints on its own 50mm × 30mm page.
 */
export function printLabels(labels: LabelData[]) {
  if (!labels.length) return;

  // Render barcodes off-DOM as SVG strings using a temp svg element in the current doc.
  const svgs = labels.map((l) => {
    const tmp = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    try {
      JsBarcode(tmp, l.code, {
        format: "CODE128",
        height: 60,
        width: 2,
        fontSize: 12,
        displayValue: true,
        margin: 4,
        background: "#ffffff",
        lineColor: "#000000",
      });
    } catch {
      /* skip invalid codes */
    }
    return tmp.outerHTML;
  });

  const labelHtml = labels
    .map((l, i) => {
      const bits = [l.productName, l.size, l.color].filter(Boolean) as string[];
      const priceStr = l.price != null ? `${formatMoney(Number(l.price))}` : "";
      const info = [bits.join(" - "), priceStr].filter(Boolean).join(" - ");
      return `<div class="label">
        <div class="bc">${svgs[i] ?? ""}</div>
        ${info ? `<div class="info">${escapeHtml(info)}</div>` : ""}
      </div>`;
    })
    .join("");

  const styles = `
    @page { size: 50mm 30mm; margin: 0; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #000;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      font-family: system-ui, -apple-system, "Segoe UI", Arial, sans-serif;
    }
    .label {
      width: 50mm;
      height: 30mm;
      margin: 0;
      padding: 5px;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      overflow: hidden;
      page-break-after: always;
      break-after: page;
    }
    .label:last-child { page-break-after: auto; break-after: auto; }
    .bc { line-height: 0; }
    .bc svg { width: 44mm; height: 16mm; display: block; }
    .info {
      margin-top: 1mm;
      font-size: 7pt;
      font-weight: 600;
      line-height: 1.15;
      max-width: 46mm;
      word-break: break-word;
    }
  `;

  const html = `<!doctype html><html><head><meta charset="utf-8" /><title>Label</title><style>${styles}</style></head><body>${labelHtml}</body></html>`;

  // Remove any previous print iframe still in the DOM.
  document.querySelectorAll("iframe[data-print-labels]").forEach((n) => n.remove());

  const iframe = document.createElement("iframe");
  iframe.setAttribute("data-print-labels", "1");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";
  document.body.appendChild(iframe);

  const triggerPrint = () => {
    try {
      const win = iframe.contentWindow;
      if (!win) return;
      win.focus();
      win.print();
    } catch {
      /* noop */
    }
  };

  iframe.onload = () => {
    // Give the browser a tick to lay out SVG barcodes before printing.
    setTimeout(triggerPrint, 300);
  };

  const doc = iframe.contentDocument;
  if (!doc) return;
  doc.open();
  doc.write(html);
  doc.close();

  // Clean up after the print dialog has had time to open/close.
  setTimeout(() => {
    try {
      iframe.remove();
    } catch {
      /* noop */
    }
  }, 60_000);
}


function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function PrintLabelButton({
  data,
  label,
}: {
  data: LabelData;
  label?: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-7 px-2"
      onClick={() => printLabels([data])}
      title={label ?? "Print"}
    >
      <Printer className="h-3 w-3" />
    </Button>
  );
}
