import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

// Fullscreen that scales the content up as far as the screen allows.
//
//   stageRef      the element that goes fullscreen (it becomes the whole screen)
//   contentRef    the element inside it to scale
//   contentStyle  put this on the content element
//
// In fullscreen the content is zoomed: everything inside keeps its layout but
// gets bigger. The zoom is the largest at which the content's height still
// fits the screen (measured in fullscreen, with its fullscreen CSS applied),
// capped so it's never narrower than minWidth (measured just before going
// fullscreen). Any width to spare goes to the content's flexible parts. CSS
// zoom re-renders text and shapes at the bigger size, so they stay sharp.
//
// Esc leaves fullscreen as usual; the F key toggles it (except while typing).
export function useFullscreen<S extends HTMLElement, C extends HTMLElement>(
  minWidth: (content: C) => number = (content) => content.getBoundingClientRect().width,
) {
  const stageRef = useRef<S>(null);
  const contentRef = useRef<C>(null);
  const narrowest = useRef(0); // minWidth, measured before going fullscreen
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fit, setFit] = useState<{ width: number; height: number; zoom: number } | null>(null);

  useEffect(() => {
    const refit = () => {
      const content = contentRef.current;
      if (!content || document.fullscreenElement !== stageRef.current) return;
      const { innerWidth: w, innerHeight: h } = window;
      // the content's natural height: briefly unzoomed and as tall as it wants to be
      const saved = content.style.cssText;
      content.style.cssText = `${saved}; zoom: 1; flex: none; height: auto; width: ${w / 1.2}px`;
      const natural = content.getBoundingClientRect().height;
      content.style.cssText = saved;
      const zoom = Math.max(1, Math.min(h / natural, narrowest.current ? w / narrowest.current : Infinity));
      setFit({ width: w / zoom, height: h / zoom, zoom });
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
    if (contentRef.current) narrowest.current = minWidth(contentRef.current);
    stageRef.current?.requestFullscreen().catch(() => undefined); // refused (not from a click): stay put
  }, [minWidth]);

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
