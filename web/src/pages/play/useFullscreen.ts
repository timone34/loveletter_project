import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

// Fullscreen that keeps the layout and scales it up.
//
//   stageRef    the element that goes fullscreen (it becomes the whole screen)
//   contentRef  the element inside it to scale
//   contentStyle  put this on the content element
//
// Just before going fullscreen, the content's height is measured, plus the
// narrowest width it needs (minWidth). In fullscreen it's zoomed so that this
// height fills the screen: everything inside keeps its regular size and shape,
// only bigger. The zoom is capped so minWidth still fits across the screen;
// any width to spare goes to the content's flexible parts. CSS zoom re-renders
// text and shapes at the bigger size, so it stays sharp.
//
// Esc leaves fullscreen as usual; the F key toggles it (except while typing).
export function useFullscreen<S extends HTMLElement, C extends HTMLElement>(
  minWidth: (content: C) => number = (content) => content.getBoundingClientRect().width,
  topGap = 0, // px of room the content gets above it in fullscreen (its CSS adds it as padding)
) {
  const stageRef = useRef<S>(null);
  const contentRef = useRef<C>(null);
  const regular = useRef<{ height: number; minWidth: number } | null>(null); // measured outside fullscreen
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fit, setFit] = useState<{ width: number; height: number; zoom: number } | null>(null);

  useEffect(() => {
    const refit = () => {
      const size = regular.current;
      if (!size) return;
      const zoom = Math.min(window.innerHeight / size.height, window.innerWidth / size.minWidth);
      setFit({ width: window.innerWidth / zoom, height: window.innerHeight / zoom, zoom });
    };
    const onChange = () => {
      const on = stageRef.current !== null && document.fullscreenElement === stageRef.current;
      setIsFullscreen(on);
      if (on) refit();
    };
    document.addEventListener("fullscreenchange", onChange);
    window.addEventListener("resize", refit);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      window.removeEventListener("resize", refit);
    };
  }, []);

  const toggle = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => undefined);
      return;
    }
    const content = contentRef.current;
    if (content) regular.current = { height: content.getBoundingClientRect().height + topGap, minWidth: minWidth(content) };
    stageRef.current?.requestFullscreen().catch(() => undefined); // refused (not from a click): stay put
  }, [minWidth, topGap]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && e.target.closest("input, textarea, select, [contenteditable]");
      if (e.key.toLowerCase() === "f" && !e.ctrlKey && !e.metaKey && !e.altKey && !typing) toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  const contentStyle: CSSProperties | undefined = isFullscreen && fit
    ? { width: fit.width, height: fit.height, flex: "none", zoom: fit.zoom }
    : undefined;

  return { stageRef, contentRef, isFullscreen, contentStyle, toggle };
}
