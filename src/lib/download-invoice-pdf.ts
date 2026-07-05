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

  // Build a fixed-width render shell. Mobile browsers still evaluate Tailwind's
  // responsive CSS against the phone viewport, so width alone is not enough: the
  // injected `.pdf-render-root` rules below force the desktop invoice structure
  // in the cloned subtree before html2canvas measures it.
  const style = document.createElement("style");
  style.textContent = `
    .pdf-render-root {
      width: ${PDF_RENDER_WIDTH_PX}px !important;
      min-width: ${PDF_RENDER_WIDTH_PX}px !important;
      max-width: none !important;
      overflow: visible !important;
      box-sizing: border-box !important;
    }
    .pdf-render-root, .pdf-render-root * {
      box-sizing: border-box !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .pdf-render-root .pdf-invoice-body {
      padding: 40px !important;
    }
    .pdf-render-root .pdf-invoice-header {
      display: flex !important;
      flex-direction: row !important;
      flex-wrap: nowrap !important;
      align-items: flex-start !important;
      justify-content: space-between !important;
      gap: 40px !important;
      margin-bottom: 40px !important;
    }
    .pdf-render-root .pdf-brand-block,
    .pdf-render-root .pdf-meta-block {
      width: calc(50% - 20px) !important;
      min-width: 0 !important;
      max-width: calc(50% - 20px) !important;
      flex: 0 0 calc(50% - 20px) !important;
    }
    .pdf-render-root .pdf-brand-block { text-align: start !important; }
    .pdf-render-root .pdf-meta-block { text-align: end !important; }
    .pdf-render-root .pdf-brand-logo-wrap {
      display: flex !important;
      justify-content: flex-start !important;
    }
    .pdf-render-root .pdf-brand-logo {
      max-width: 100% !important;
      object-fit: contain !important;
    }
    .pdf-render-root .pdf-table-wrap {
      margin-left: 0 !important;
      margin-right: 0 !important;
      overflow: visible !important;
    }
    .pdf-render-root .pdf-line-items {
      width: 100% !important;
      min-width: 0 !important;
    }
    .pdf-render-root .pdf-totals-row {
      display: flex !important;
      justify-content: flex-start !important;
      direction: ltr !important;
    }
    .pdf-render-root .pdf-totals-block {
      width: 288px !important;
      max-width: 288px !important;
      flex: 0 0 288px !important;
    }
  `;

  const wrapper = document.createElement("div");
  wrapper.style.position = "fixed";
  wrapper.style.top = "0";
  wrapper.style.left = "0";
  wrapper.style.zIndex = "-1";
  wrapper.style.pointerEvents = "none";
  wrapper.style.opacity = "1";
  wrapper.style.width = `${PDF_RENDER_WIDTH_PX}px`;
  wrapper.style.minWidth = `${PDF_RENDER_WIDTH_PX}px`;
  wrapper.style.maxWidth = `${PDF_RENDER_WIDTH_PX}px`;
  wrapper.style.overflow = "visible";
  wrapper.style.background = "#ffffff";
  // Preserve RTL/LTR from the source subtree so the Arabic layout mirrors correctly.
  const sourceDir =
    element.getAttribute("dir") ||
    element.closest("[dir]")?.getAttribute("dir") ||
    document.documentElement.getAttribute("dir") ||
    "ltr";
  wrapper.setAttribute("dir", sourceDir);

  const clone = element.cloneNode(true) as HTMLElement;
  clone.classList.add("pdf-render-root");
  // Ensure the clone itself fills the fixed-width wrapper so inner responsive
  // classes (sm:*, flex-col on small screens) resolve against a desktop width.
  clone.style.width = `${PDF_RENDER_WIDTH_PX}px`;
  clone.style.maxWidth = "none";
  clone.style.minWidth = `${PDF_RENDER_WIDTH_PX}px`;
  clone.style.margin = "0";

  wrapper.appendChild(style);
  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);

  try {
    // Give the browser a tick to lay out the cloned subtree at the forced width.
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    await document.fonts?.ready.catch(() => undefined);
    await Promise.all(
      Array.from(clone.querySelectorAll("img")).map((img) => {
        if (img.complete) return Promise.resolve();
        return new Promise<void>((resolve) => {
          img.addEventListener("load", () => resolve(), { once: true });
          img.addEventListener("error", () => resolve(), { once: true });
        });
      }),
    );

    const canvas = await html2canvas(clone, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
      windowWidth: PDF_RENDER_WIDTH_PX,
      windowHeight: Math.max(clone.scrollHeight, 1200),
      width: PDF_RENDER_WIDTH_PX,
      height: clone.scrollHeight,
      scrollX: 0,
      scrollY: 0,
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
