import { useEffect } from "react";

const ATTR = "data-keyboard-nav";
const NAVIGATION_KEYS = new Set([
  "Tab",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Enter",
  " ",
  "Escape",
  "Home",
  "End",
  "PageUp",
  "PageDown",
]);

function isKeyboardNavigationEvent(event: KeyboardEvent) {
  if (event.key === "Shift" || event.key === "Meta") {
    return false;
  }

  if (event.ctrlKey || event.metaKey) {
    return true;
  }

  return NAVIGATION_KEYS.has(event.key);
}

export function useKeyboardNavDetection() {
  useEffect(() => {
    const root = document.documentElement;

    function onKeyDown(e: KeyboardEvent) {
      if (isKeyboardNavigationEvent(e)) {
        root.setAttribute(ATTR, "");
      }
    }

    function onPointerDown() {
      root.removeAttribute(ATTR);
    }

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("pointerdown", onPointerDown, true);

    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, []);
}
