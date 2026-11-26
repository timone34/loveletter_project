import { useCallback, useEffect, useState, type RefObject } from "react";

// The browser's Fullscreen API on one element (the Play page). `active` also
// follows Esc and the browser's own controls, through "fullscreenchange".
export function useFullscreen(ref: RefObject<HTMLElement | null>) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const onChange = () => setActive(document.fullscreenElement === ref.current && ref.current !== null);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [ref]);

  const toggle = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      // can be refused (e.g. inside an iframe); then nothing changes
      ref.current?.requestFullscreen().catch(() => {});
    }
  }, [ref]);

  return { active, toggle, supported: document.fullscreenEnabled };
}
