// src/print/usePrintHtml.js
import { useCallback } from "react";

function isLikelyMobileBrowser() {
  const ua = navigator.userAgent || "";
  return /Android|iPhone|iPad|iPod|Mobile|IEMobile|Opera Mini/i.test(ua);
}

function ensureHtmlDocument(html) {
  const src = String(html || "");
  if (/<html[\s>]/i.test(src)) return src;
  return `<!doctype html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head><body>${src}</body></html>`;
}

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => (
    {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;",
    }[c]
  ));
}

function withDocumentTitle(htmlDoc, title) {
  const t = String(title || "").trim();
  if (!t) return htmlDoc;
  const safeTitle = escapeHtml(t);

  if (/<title[\s>]/i.test(htmlDoc)) {
    return htmlDoc.replace(/<title[^>]*>[\s\S]*?<\/title>/i, `<title>${safeTitle}</title>`);
  }

  if (/<\/head>/i.test(htmlDoc)) {
    return htmlDoc.replace(/<\/head>/i, `<title>${safeTitle}</title></head>`);
  }

  return htmlDoc;
}

function writeHtmlToWindow(w, htmlDoc) {
  try {
    w.document.open();
    w.document.write(htmlDoc);
    w.document.close();
    return true;
  } catch (_) {
    try {
      const blob = new Blob([htmlDoc], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      w.location.replace(url);
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      return true;
    } catch (_) {
      return false;
    }
  }
}

function printViaIframe(htmlDoc, documentTitle = "") {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    throw new Error("Unable to initialize print iframe");
  }

  const originalTitle = document.title;
  const desiredTitle = String(documentTitle || "").trim();
  if (desiredTitle) document.title = desiredTitle;

  doc.open();
  doc.write(htmlDoc);
  doc.close();
  if (desiredTitle) {
    try { doc.title = desiredTitle; } catch (_) {}
  }

  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => {
      if (document.body.contains(iframe)) document.body.removeChild(iframe);
      if (desiredTitle) document.title = originalTitle;
    }, 800);
  }, 120);
}

function printViaNewWindow(htmlDoc, existingWindow = null) {
  const w = existingWindow || window.open("about:blank", "_blank");
  if (!w) {
    throw new Error("Popup blocked. Please allow popups to print on mobile.");
  }

  const rendered = writeHtmlToWindow(w, htmlDoc);
  if (!rendered) {
    throw new Error("Unable to render printable document in popup window.");
  }

  // On mobile browsers, printing from a dedicated tab is more reliable than iframe print.
  setTimeout(() => {
    try {
      w.focus();
      w.print();
    } catch (_) {
      // Some mobile browsers block programmatic print; user can use browser menu -> Print.
    }
  }, 250);

  return w;
}

export function usePrintHtml() {
  const prepare = useCallback(() => {
    if (!isLikelyMobileBrowser()) return null;

    const w = window.open("about:blank", "_blank");
    if (!w) return null;

    writeHtmlToWindow(
      w,
      `<!doctype html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head><body style="font-family:sans-serif;padding:16px;">Preparing printable document...</body></html>`,
    );

    return w;
  }, []);

  const open = useCallback((html, opts = {}) => {
    const { targetWindow = null, documentTitle = "" } = opts;
    const htmlDoc = withDocumentTitle(ensureHtmlDocument(html), documentTitle);

    if (isLikelyMobileBrowser()) {
      printViaNewWindow(htmlDoc, targetWindow || null);
      return;
    }

    printViaIframe(htmlDoc, documentTitle);
  }, []);

  return { open, prepare };
}
