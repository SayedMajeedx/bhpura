// Client-only helper: renders an on-screen invoice element into a downloadable
// PDF that mirrors the live preview exactly (colors, fonts, RTL layout).
//
// Uses html2canvas-pro (supports modern CSS color functions like oklch()
// emitted by Tailwind v4) + jsPDF to paginate onto A4.
//
// Mobile fix: on phones the source element renders at the phone's viewport
// width (often ~360px), which makes html2canvas capture a compressed / broken
// layout and forces the PDF into multiple cramped pages. To make the PDF look
// identical on desktop, iOS and Android we clone the element into an
// off-screen container with a FIXED desktop width (800px) before capturing.

const PDF_RENDER_WIDTH_PX = 800;

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

  // Build an off-screen wrapper that forces the desktop layout width. We deep-
  // clone the invoice node so styles/images/fonts are preserved, then place it
  // inside a fixed-width container appended to <body> (off-screen but visible
  // to html2canvas — display:none would prevent rendering).
  const wrapper = document.createElement("div");
  wrapper.style.position = "fixed";
  wrapper.style.top = "0";
  wrapper.style.left = "0";
  wrapper.style.zIndex = "-1";
  wrapper.style.pointerEvents = "none";
  wrapper.style.opacity = "0";
  wrapper.style.width = `${PDF_RENDER_WIDTH_PX}px`;
  wrapper.style.background = "#ffffff";
  // Preserve RTL/LTR from the source subtree so the Arabic layout mirrors correctly.
  const sourceDir =
    element.getAttribute("dir") ||
    element.closest("[dir]")?.getAttribute("dir") ||
    document.documentElement.getAttribute("dir") ||
    "ltr";
  wrapper.setAttribute("dir", sourceDir);

  const clone = element.cloneNode(true) as HTMLElement;
  // Ensure the clone itself fills the fixed-width wrapper so inner responsive
  // classes (sm:*, flex-col on small screens) resolve against a desktop width.
  clone.style.width = `${PDF_RENDER_WIDTH_PX}px`;
  clone.style.maxWidth = "none";
  clone.style.margin = "0";

  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);

  try {
    // Give the browser a tick to lay out the cloned subtree at the forced width.
    await new Promise((r) => requestAnimationFrame(() => r(null)));

    const canvas = await html2canvas(clone, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
      windowWidth: PDF_RENDER_WIDTH_PX,
      width: PDF_RENDER_WIDTH_PX,
    });

    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 8;
    const contentW = pageW - margin * 2;
    const contentH = pageH - margin * 2;

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
  } finally {
    if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
  }
}
