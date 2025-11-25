// src/print/usePrintHtml.js
import { useCallback } from "react";

export function usePrintHtml() {
  const open = useCallback((html) => {
    const isMobile = /android|iphone|ipad|ipod/i.test(navigator.userAgent || "");

    if (isMobile) {
      // On mobile browsers, printing from a hidden iframe often prints the parent page.
      // Open a new tab, write the print HTML, and invoke print there.
      const win = window.open("", "_blank");
      if (!win) return; // popup blocked
      win.document.open();
      win.document.write(html || "<!doctype html><html><body></body></html>");
      win.document.close();
      // Give the browser a moment to render before printing
      setTimeout(() => {
        win.focus();
        win.print();
      }, 100);
      return;
    }

    // Desktop: create a hidden iframe and print from there (reliable on Chrome/Edge)
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    doc.open();
    doc.write(html || "<!doctype html><html><body></body></html>");
    doc.close();

    // wait a tick for styles to apply
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      // cleanup after print
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 500);
    }, 50);
  }, []);

  return { open };
}
