import { useEffect } from "react";

const ATTR = "data-keyboard-nav";

export function useKeyboardNavDetection() {
  useEffect(() => {
    const root = document.documentElement;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Tab") {
        root.setAttribute(ATTR, "");
      }
    }

    function onMouseDown() {
      root.removeAttribute(ATTR);
    }

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("mousedown", onMouseDown, true);

    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("mousedown", onMouseDown, true);
    };
  }, []);
}
