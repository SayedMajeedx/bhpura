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
 * Prints one or more sticker labels using an in-page print section. This avoids
 * mobile popup blockers while print CSS hides the rest of the dashboard.
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
      const info = buildLabelInfo(l);
      return `<div class="barcode-card">
        <div class="barcode-image">${svgs[i] ?? ""}</div>
        <div class="barcode-text">${escapeHtml(info)}</div>
      </div>`;
    })
    .join("");

  const styles = `
    @page { size: 50mm 30mm; margin: 0; }
    #print-section {
      position: fixed;
      left: 0;
      top: 0;
      width: 50mm !important;
      min-height: 30mm !important;
      margin: 0 !important;
      padding: 0 !important;
      background: #fff !important;
      color: #000 !important;
      opacity: 0;
      pointer-events: none;
      z-index: -1;
    }
    #print-section, #print-section * {
      box-sizing: border-box !important;
      -webkit-text-size-adjust: none !important;
      text-size-adjust: none !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      font-family: system-ui, -apple-system, "Segoe UI", Arial, sans-serif;
    }
    #print-section .barcode-card {
      width: 50mm !important;
      height: 30mm !important;
      min-width: 50mm !important;
      max-width: 50mm !important;
      min-height: 30mm !important;
      max-height: 30mm !important;
      margin: 0 !important;
      padding: 5px !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      justify-content: center !important;
      text-align: center !important;
      overflow: hidden !important;
      page-break-after: always !important;
      break-after: page !important;
    }
    #print-section .barcode-image {
      width: 40mm !important;
      height: auto !important;
      line-height: 0 !important;
      flex: 0 0 auto !important;
    }
    #print-section .barcode-image svg {
      width: 40mm !important;
      height: auto !important;
      max-width: 40mm !important;
      display: block !important;
    }
    #print-section .barcode-text {
      margin-top: 2px !important;
      font-size: 10px !important;
      font-weight: bold !important;
      line-height: 1.15 !important;
      max-width: 47mm !important;
      color: #000 !important;
      word-break: break-word;
      overflow: hidden !important;
    }
    @media print {
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        background: #fff !important;
        overflow: visible !important;
        position: static !important;
        height: auto !important;
        width: auto !important;
        min-height: 0 !important;
      }
      body { padding-right: 0 !important; }
      body * { visibility: hidden !important; }
      [data-radix-portal], [data-radix-popper-content-wrapper],
      [role="dialog"], [data-radix-dialog-overlay], [data-radix-dialog-content],
      [data-sonner-toaster], [data-radix-toast-viewport] {
        display: none !important;
        visibility: hidden !important;
      }
      #print-section, #print-section * { visibility: visible !important; }
      #print-section {
        position: absolute !important;
        left: 0 !important;
        top: 0 !important;
        width: 100% !important;
        min-width: 50mm !important;
        opacity: 1 !important;
        pointer-events: auto !important;
        z-index: 2147483647 !important;
        display: block !important;
      }
      #print-section .barcode-card {
        width: 50mm !important;
        height: 30mm !important;
        page-break-after: always !important;
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        justify-content: center !important;
        text-align: center !important;
        box-sizing: border-box !important;
        padding: 5px !important;
      }
      #print-section .barcode-image { width: 40mm !important; height: auto !important; display: block !important; }
      #print-section .barcode-image svg { width: 40mm !important; height: auto !important; display: block !important; }
      #print-section .barcode-text { font-size: 10px !important; font-weight: bold !important; margin-top: 2px !important; display: block !important; }
    }
  `;

  const styleId = "barcode-print-style";
  const sectionId = "print-section";
  document.getElementById(styleId)?.remove();
  document.getElementById(sectionId)?.remove();

  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = styles;

  const section = document.createElement("div");
  section.id = sectionId;
  section.innerHTML = labelHtml;

  document.head.appendChild(style);
  document.body.appendChild(section);

  // Radix Dialog locks the body (overflow:hidden, padding-right, pointer-events).
  // Temporarily neutralize the inline styles so the print layout isn't clipped,
  // then restore them after printing.
  const body = document.body;
  const html = document.documentElement;
  const savedBody = body.getAttribute("style") ?? "";
  const savedHtml = html.getAttribute("style") ?? "";
  body.style.setProperty("overflow", "visible", "important");
  body.style.setProperty("pointer-events", "auto", "important");
  body.style.setProperty("padding-right", "0", "important");
  html.style.setProperty("overflow", "visible", "important");

  const cleanup = () => {
    section.remove();
    style.remove();
    if (savedBody) body.setAttribute("style", savedBody); else body.removeAttribute("style");
    if (savedHtml) html.setAttribute("style", savedHtml); else html.removeAttribute("style");
    window.removeEventListener("afterprint", cleanup);
  };

  window.addEventListener("afterprint", cleanup, { once: true });
  setTimeout(() => {
    try {
      window.print();
      setTimeout(cleanup, 1_000);
    } catch {
      cleanup();
    }
  }, 150);
}


function buildLabelInfo(label: LabelData) {
  const model = String(label.productName || "Product").trim();
  const size = String(label.size || "-").trim();
  const color = String(label.color || "-").trim();
  const price = label.price != null ? formatMoney(Number(label.price)) : "BHD 0.00";
  return `${model} - ${size} - ${color} - ${price}`;
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
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        printLabels([data]);
      }}
      title={label ?? "Print"}
    >
      <Printer className="h-3 w-3" />
    </Button>
  );
}
