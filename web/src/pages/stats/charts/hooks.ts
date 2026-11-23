import { createElement, useLayoutEffect, useRef, useState, type FocusEvent, type PointerEvent, type ReactNode } from "react";

// Two small helpers every chart uses.

// The width of an element, kept up to date. SVG charts draw at this real pixel
// width (instead of a stretched viewBox), so text and lines stay crisp.
export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}

// A hover tooltip. Call show() from a mark's onPointerMove / onFocus and render
// `node` inside the chart's wrapper: the nearest element with class "chart"
// (position: relative, see charts.css), which the tooltip is placed in.
// Content is React, so names in it are escaped.
export function useTooltip() {
  const [tip, setTip] = useState<{ x: number; y: number; content: ReactNode } | null>(null);

  const show = (e: PointerEvent | FocusEvent, content: ReactNode) => {
    const box = (e.currentTarget as Element).closest(".chart")?.getBoundingClientRect();
    if (!box) return;
    if ("clientX" in e) {
      setTip({ x: e.clientX - box.left, y: e.clientY - box.top, content });
    } else {
      // keyboard focus: above the middle of the focused mark
      const mark = (e.target as Element).getBoundingClientRect();
      setTip({ x: mark.left + mark.width / 2 - box.left, y: mark.top - box.top, content });
    }
  };
  const hide = () => setTip(null);

  const node = tip && createElement("div", { className: "tip", style: { left: tip.x, top: tip.y }, role: "tooltip" }, tip.content);
  return { show, hide, node };
}
