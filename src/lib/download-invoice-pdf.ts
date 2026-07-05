// Client-only helper: renders an on-screen invoice element into a downloadable
// PDF that mirrors the live preview exactly (colors, fonts, RTL layout).
//
// Uses html2canvas-pro (supports modern CSS color functions like oklch()
// emitted by Tailwind v4 — the original html2canvas throws on them, which
// made the previous html2pdf.js pipeline silently fail with "nothing happens"
// when the user clicked Download PDF) + jsPDF to paginate onto A4.

export async function downloadInvoicePdf(
  element: HTMLElement | null,
  filename: string,
) {
  if (!element || typeof window === "undefined") return;

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas-pro"),
    import("jspdf"),
  ]);

  const safeName = filename.replace(/[^a-zA-Z0-9-_\.\u0600-\u06FF]+/g, "_");
  const finalName = safeName.toLowerCase().endsWith(".pdf")
    ? safeName
    : `${safeName}.pdf`;

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
  });

  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 8;
  const contentW = pageW - margin * 2;
  const contentH = pageH - margin * 2;

  // Scale canvas width to fit the printable area, then paginate vertically by
  // slicing the source canvas one page-height at a time.
  const pxPerMm = canvas.width / contentW;
  const pageHeightPx = Math.floor(contentH * pxPerMm);

  let renderedPx = 0;
  let pageIndex = 0;
  while (renderedPx < canvas.height) {
    const sliceHeightPx = Math.min(pageHeightPx, canvas.height - renderedPx);
    const pageCanvas = document.createElement("canvas");
    pageCanvas.width = canvas.width;
    pageCanvas.height = sliceHeightPx;
    const ctx = pageCanvas.getContext("2d");
    if (!ctx) break;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
    ctx.drawImage(
      canvas,
      0,
      renderedPx,
      canvas.width,
      sliceHeightPx,
      0,
      0,
      canvas.width,
      sliceHeightPx,
    );
    const imgData = pageCanvas.toDataURL("image/jpeg", 0.95);
    const imgHeightMm = sliceHeightPx / pxPerMm;
    if (pageIndex > 0) pdf.addPage();
    pdf.addImage(imgData, "JPEG", margin, margin, contentW, imgHeightMm);
    renderedPx += sliceHeightPx;
    pageIndex += 1;
  }

  pdf.save(finalName);
}
