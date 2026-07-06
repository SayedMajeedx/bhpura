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
        <BarcodeSvg value={data.code} height={50} width={1.6} fontSize={14} />
      </div>
      {data.price != null && <div className="label-price">{formatMoney(Number(data.price))}</div>}
    </div>
  );
}

/**
 * Opens a new window with the given labels formatted for printing, then triggers print.
 * Using a separate window avoids fighting the app's print styles.
 */
export function printLabels(labels: LabelData[]) {
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return;

  // Render barcodes off-DOM as SVG strings using a temp svg element in the current doc.
  const svgs = labels.map((l) => {
    const tmp = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    try {
      JsBarcode(tmp, l.code, {
        format: "CODE128",
        height: 60,
        width: 1.8,
        fontSize: 14,
        displayValue: true,
        margin: 4,
        background: "#ffffff",
        lineColor: "#000000",
      });
    } catch {
      // skip
    }
    return tmp.outerHTML;
  });

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Barcode labels</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; padding: 12mm; background: #fff; color: #000; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6mm; }
  .label {
    border: 1px dashed #ccc;
    padding: 4mm;
    page-break-inside: avoid;
    break-inside: avoid;
    text-align: center;
    background: #fff;
  }
  .biz { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #666; margin-bottom: 2mm; }
  .name { font-size: 12px; font-weight: 600; margin-bottom: 1mm; }
  .meta { font-size: 10px; color: #444; margin-bottom: 2mm; }
  .price { font-size: 12px; font-weight: 700; margin-top: 2mm; }
  svg { max-width: 100%; height: auto; }
  @media print {
    body { padding: 8mm; }
    .no-print { display: none; }
    @page { margin: 8mm; }
  }
</style>
</head>
<body>
  <div class="no-print" style="text-align:right; margin-bottom:8px;">
    <button onclick="window.print()" style="padding:8px 16px; font-size:14px; cursor:pointer;">Print</button>
  </div>
  <div class="grid">
    ${labels
      .map(
        (l, i) => `
      <div class="label">
        ${l.businessName ? `<div class="biz">${escapeHtml(l.businessName)}</div>` : ""}
        ${l.productName ? `<div class="name">${escapeHtml(l.productName)}</div>` : ""}
        ${
          [l.size, l.color].filter(Boolean).length
            ? `<div class="meta">${escapeHtml([l.size, l.color].filter(Boolean).join(" · "))}</div>`
            : ""
        }
        <div>${svgs[i] ?? ""}</div>
        ${l.price != null ? `<div class="price">${escapeHtml(formatMoney(Number(l.price)))}</div>` : ""}
      </div>`
      )
      .join("")}
  </div>
  <script>
    window.addEventListener('load', function(){ setTimeout(function(){ window.print(); }, 300); });
  </script>
</body>
</html>`;

  w.document.open();
  w.document.write(html);
  w.document.close();
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
