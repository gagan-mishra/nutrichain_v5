import { useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { autoUpdate, computePosition, flip, hide, offset, shift, size } from "@floating-ui/dom";

export function Popover({ open, onClose, anchorRef, widthPx = 288, placement = widthPx ? "bottom-end" : "bottom-start", fitContent = false, compact = false, scrollPanel = true, children, id }) {
  const panelRef = useRef(null);

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    const panel = panelRef.current;
    if (!open || !anchor || !panel) return;

    let version = 0;
    const update = async () => {
      const request = ++version;
      const { x, y, middlewareData } = await computePosition(anchor, panel, {
        strategy: "fixed",
        placement,
        middleware: [
          offset(6), flip({ padding: 8 }), shift({ padding: 8 }),
          size({
            padding: 8,
            apply({ availableWidth, availableHeight, rects }) {
              if (request !== version) return;
              const limit = Math.max(0, availableWidth);
              panel.style.width = fitContent ? "max-content" : Math.min(widthPx || rects.reference.width, limit) + "px";
              panel.style.minWidth = fitContent ? Math.min(rects.reference.width, limit) + "px" : "";
              panel.style.maxWidth = fitContent ? limit + "px" : "";
              panel.style.maxHeight = Math.max(0, availableHeight) + "px";
            },
          }),
          hide(),
        ],
      });
      if (request !== version) return;
      Object.assign(panel.style, {
        left: x + "px", top: y + "px", opacity: 1,
        visibility: middlewareData.hide?.referenceHidden ? "hidden" : "visible",
      });
    };
    const stop = autoUpdate(anchor, panel, update);
    return () => { version++; stop(); };
  }, [anchorRef, open, widthPx, placement, fitContent]);

  useEffect(() => {
    if (!open) return;
    function outside(event) {
      if (!panelRef.current?.contains(event.target) && !anchorRef.current?.contains(event.target)) onClose();
    }
    function escape(event) {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      onClose();
      anchorRef.current?.focus({ preventScroll: true });
    }
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("focusin", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("focusin", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open, onClose, anchorRef]);

  return open && createPortal(
    <div ref={panelRef} id={id} style={{ opacity: 0 }}
      className={`fixed left-0 top-0 z-[100000] flex flex-col border border-white/15 bg-slate-950/95 text-white backdrop-blur-xl ${scrollPanel ? "overflow-y-auto overscroll-contain" : "overflow-hidden"} ${compact ? "rounded-xl p-1 shadow-lg" : "rounded-2xl p-2 shadow-2xl"}`}>
      {children}
    </div>, document.body
  );
}
