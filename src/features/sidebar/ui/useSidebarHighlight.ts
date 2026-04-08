import { useCallback, useEffect, useRef, useState } from "react";

interface HighlightRect {
  top: number;
  height: number;
  width: number;
}

export function useSidebarHighlight(
  navRef: React.RefObject<HTMLElement | null>,
) {
  const [hoveredRect, setHoveredRect] = useState<HighlightRect | null>(null);
  const [activeRect, setActiveRect] = useState<HighlightRect | null>(null);
  const [isHovering, setIsHovering] = useState(false);
  const activeElRef = useRef<HTMLElement | null>(null);

  const measureElement = useCallback(
    (el: HTMLElement): HighlightRect | null => {
      const nav = navRef.current;
      if (!nav || !el) return null;
      const navRect = nav.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      return {
        top: elRect.top - navRect.top + nav.scrollTop,
        height: elRect.height,
        width: elRect.width,
      };
    },
    [navRef],
  );

  // Re-measure the active element whenever the nav subtree changes
  // (project expand/collapse, list re-sort, filtering, show-more, etc.).
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    const observer = new MutationObserver(() => {
      const el = activeElRef.current;
      if (!el) return;
      const rect = measureElement(el);
      if (rect) setActiveRect(rect);
    });

    observer.observe(nav, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [navRef, measureElement]);

  const onItemMouseEnter = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      setIsHovering(true);
      const rect = measureElement(e.currentTarget);
      if (rect) setHoveredRect(rect);
    },
    [measureElement],
  );

  const onNavMouseLeave = useCallback(() => {
    setIsHovering(false);
    setHoveredRect(null);
  }, []);

  const updateActiveRect = useCallback(
    (el: HTMLElement | null) => {
      activeElRef.current = el;
      if (el) {
        const rect = measureElement(el);
        if (rect) setActiveRect(rect);
      } else {
        setActiveRect(null);
      }
    },
    [measureElement],
  );

  const currentRect = isHovering && hoveredRect ? hoveredRect : activeRect;

  return {
    currentRect,
    isHovering,
    onItemMouseEnter,
    onNavMouseLeave,
    updateActiveRect,
  };
}
