// src/print/usePrintHtml.js
import { useCallback } from "react";

export function usePrintHtml() {
  const open = useCallback((html) => {
    // create a hidden iframe and print from there (reliable on Chrome/Edge)
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
