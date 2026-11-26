import { useCallback, useEffect, useState } from "react";

// The browser's Fullscreen API on the whole page, the same as pressing F11:
// header and footer stay, the browser's own bars go. `active` also follows
// Esc and the browser's controls, through "fullscreenchange". (F11 itself is
// the browser's own full screen and doesn't show up here.)
export function useFullscreen() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const onChange = () => setActive(document.fullscreenElement !== null);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggle = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      // can be refused (e.g. inside an iframe); then nothing changes
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }, []);

  return { active, toggle, supported: document.fullscreenEnabled };
}
