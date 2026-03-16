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

function printViaIframe(htmlDoc) {
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

  doc.open();
  doc.write(htmlDoc);
  doc.close();

  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => {
      if (document.body.contains(iframe)) document.body.removeChild(iframe);
    }, 800);
  }, 120);
}

function printViaNewWindow(htmlDoc) {
  const w = window.open("", "_blank", "noopener,noreferrer");
  if (!w) {
    throw new Error("Popup blocked. Please allow popups to print on mobile.");
  }

  w.document.open();
  w.document.write(htmlDoc);
  w.document.close();

  // On mobile browsers, printing from a dedicated tab is more reliable than iframe print.
  setTimeout(() => {
    try {
      w.focus();
      w.print();
    } catch (_) {
      // Some mobile browsers block programmatic print; user can use browser menu -> Print.
    }
  }, 250);
}

export function usePrintHtml() {
  const open = useCallback((html) => {
    const htmlDoc = ensureHtmlDocument(html);

    if (isLikelyMobileBrowser()) {
      printViaNewWindow(htmlDoc);
      return;
    }

    printViaIframe(htmlDoc);
  }, []);

  return { open };
}
