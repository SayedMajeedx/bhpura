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
 * Opens a new window with the given labels formatted for printing, then triggers print.
 * Using a separate window avoids fighting the app's print styles.
 */
export function printLabels(labels: LabelData[]) {
  // Render barcodes off-DOM as SVG strings using a temp svg element in the current doc.
  const svgs = labels.map((l) => {
    const tmp = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    try {
      JsBarcode(tmp, l.code, {
        format: "CODE128",
        height: 70,
        width: 2.2,
        fontSize: 14,
        displayValue: true,
        margin: 8,
        background: "#ffffff",
        lineColor: "#000000",
      });
    } catch {
      // skip
    }
    return tmp.outerHTML;
  });

  const bodyHtml = `
  <div class="sheet">
    ${labels
      .map(
        (l, i) => `
      <div class="label">
        ${l.productName ? `<div class="name">${escapeHtml(l.productName)}</div>` : ""}
        ${
          [l.size, l.color].filter(Boolean).length
            ? `<div class="meta">${escapeHtml([l.size, l.color].filter(Boolean).join(" · "))}</div>`
            : ""
        }
        <div class="bc">${svgs[i] ?? ""}</div>
        ${l.price != null ? `<div class="price">${escapeHtml(formatMoney(Number(l.price)))}</div>` : ""}
      </div>`
      )
      .join("")}
  </div>`;

  // Sticker sheet — one label per page at 50mm × 30mm, no page margins,
  // so the browser prints ONLY the tag (no dashboard chrome, no headers).
  const styles = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: #fff; color: #000; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; }
  .sheet { display: block; }
  .label {
    width: 50mm; height: 30mm;
    padding: 1mm 1.5mm;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    text-align: center; overflow: hidden;
    page-break-after: always; break-after: page;
  }
  .label:last-child { page-break-after: auto; break-after: auto; }
  .name { font-size: 7pt; font-weight: 700; line-height: 1.1; max-height: 2.4em; overflow: hidden; }
  .meta { font-size: 6pt; color: #222; margin-top: 0.4mm; }
  .bc { margin-top: 0.6mm; line-height: 0; }
  .bc svg { width: 46mm; height: 14mm; display: block; }
  .price { font-size: 7pt; font-weight: 700; margin-top: 0.4mm; }
  .toolbar { position: fixed; top: 0; left: 0; right: 0; padding: 10px 12px; background: #fff; border-bottom: 1px solid #eee; display: flex; gap: 8px; justify-content: flex-end; z-index: 10; }
  .toolbar button { padding: 10px 16px; font-size: 14px; cursor: pointer; border-radius: 6px; border: 1px solid #ddd; background: #f8f8f8; }
  .toolbar button.primary { background: #111; color: #fff; border-color: #111; }
  .content { padding-top: 56px; }
  @page { size: 50mm 30mm; margin: 0; }
  @media print {
    .toolbar { display: none !important; }
    .content { padding-top: 0 !important; }
    html, body { width: 50mm; }
  }`;

  const html = `<!doctype html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Barcode labels</title><style>${styles}</style></head><body><div class="toolbar"><button onclick="window.close && window.close()">Close</button><button class="primary" onclick="window.focus();window.print()">Print</button></div><div class="content">${bodyHtml}</div><script>window.addEventListener('load',function(){setTimeout(function(){try{window.focus();window.print();}catch(e){}} ,400);});</script></body></html>`;

  // Mobile browsers (iOS Safari, Android Chrome) frequently block window.open
  // outside a strict user gesture, and even when a popup opens, window.print()
  // inside it is unreliable. Use a hidden iframe as the primary strategy — it
  // works in-page without popup permission, and prints the current tab.
  const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  const printViaIframe = () => {
    // Clean up any previous print iframe.
    document.querySelectorAll("iframe[data-print-labels]").forEach((n) => n.remove());
    const iframe = document.createElement("iframe");
    iframe.setAttribute("data-print-labels", "1");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.setAttribute("aria-hidden", "true");
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
      // Give the browser a tick to layout SVG barcodes before printing.
      setTimeout(triggerPrint, 350);
    };

    const doc = iframe.contentDocument;
    if (!doc) return;
    doc.open();
    doc.write(html);
    doc.close();

    // Remove iframe after print dialog interaction on desktop.
    setTimeout(() => {
      try {
        iframe.remove();
      } catch {
        /* noop */
      }
    }, 60_000);
  };

  if (isMobile) {
    printViaIframe();
    return;
  }

  // Desktop: try popup first for a nicer preview; fall back to iframe if blocked.
  try {
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) {
      printViaIframe();
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
  } catch {
    printViaIframe();
  }
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
