"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent, type PointerEvent, type RefObject } from "react";

/** How long a plot point must be held before it lifts, and how far the pointer may wander meanwhile. */
const HOLD_MS = 350;
const SLOP_PX = 8;
/** How close to the map's edge the pointer must be to scroll it while dragging. */
const EDGE_PX = 32;

/** What is being dragged, where the pointer is, and what it is over. */
export type DragView = {
  id: string;
  x: number;
  y: number;
  /** The plot point under the pointer, if any (never the one being dragged). */
  overId: string | null;
  /** Why it can't be dropped there, or null if it can. */
  problem: string | null;
};

type Options = {
  /** Off where the map is only for looking (the Write and Review steps). */
  enabled: boolean;
  /** The scrolling map, which scrolls itself when the pointer nears its edges. */
  scroller: RefObject<HTMLElement | null>;
  problem: (id: string, targetId: string) => string | null;
  onDrop: (id: string, targetId: string) => void;
};

/**
 * Press and hold a plot point, then drag it onto another one. A quick press is
 * still a click, and moving before the hold completes is a scroll, as before.
 * Drop targets are elements with a data-node-id attribute. Escape cancels.
 */
export function useHoldToDrag({ enabled, scroller, problem, onDrop }: Options) {
  const [drag, setDrag] = useState<DragView | null>(null);
  const latest = useRef({ problem, onDrop });
  useEffect(() => {
    latest.current = { problem, onDrop };
  });

  // The gesture in progress: waiting out the hold, or dragging.
  const gesture = useRef<{
    id: string;
    pointerId: number;
    startX: number;
    startY: number;
    timer: number;
    active: boolean;
    view: DragView | null;
  } | null>(null);
  const suppressClick = useRef(false);
  const stop = useRef<() => void>(() => {});

  const end = useCallback((drop: boolean) => {
    const g = gesture.current;
    if (!g) return;
    window.clearTimeout(g.timer);
    stop.current();
    gesture.current = null;
    if (g.active) {
      // The press that started the drag must not also count as a click.
      suppressClick.current = true;
      window.setTimeout(() => (suppressClick.current = false), 0);
      const view = g.view;
      if (drop && view?.overId && !view.problem) latest.current.onDrop(view.id, view.overId);
      setDrag(null);
    }
  }, []);

  useEffect(() => () => end(false), [end]);

  const onPointerDown = useCallback(
    (id: string, event: PointerEvent<HTMLElement>) => {
      if (!enabled || (event.pointerType === "mouse" && event.button !== 0)) return;
      end(false);

      const look = (x: number, y: number): DragView => {
        const hit = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-node-id]");
        const inMap = hit && scroller.current?.contains(hit);
        const overId = inMap && hit.dataset.nodeId !== id ? (hit.dataset.nodeId ?? null) : null;
        return { id, x, y, overId, problem: overId ? latest.current.problem(id, overId) : null };
      };

      const onMove = (e: globalThis.PointerEvent) => {
        const g = gesture.current;
        if (!g || e.pointerId !== g.pointerId) return;
        if (!g.active) {
          // Moved before the hold finished: an ordinary scroll or click, not a drag.
          if (Math.hypot(e.clientX - g.startX, e.clientY - g.startY) > SLOP_PX) end(false);
          return;
        }
        e.preventDefault();
        g.view = look(e.clientX, e.clientY);
        setDrag(g.view);
        // Near an edge of the map, scroll it so far-off plot points can be reached.
        const box = scroller.current?.getBoundingClientRect();
        if (box && scroller.current) {
          const dy = e.clientY < box.top + EDGE_PX ? -14 : e.clientY > box.bottom - EDGE_PX ? 14 : 0;
          const dx = e.clientX < box.left + EDGE_PX ? -14 : e.clientX > box.right - EDGE_PX ? 14 : 0;
          if (dx || dy) scroller.current.scrollBy(dx, dy);
        }
      };
      const onUp = (e: globalThis.PointerEvent) => {
        if (gesture.current && e.pointerId === gesture.current.pointerId) end(true);
      };
      const onCancel = (e: globalThis.PointerEvent) => {
        if (gesture.current && e.pointerId === gesture.current.pointerId) end(false);
      };
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") end(false);
      };
      // On touch screens, keep the page from scrolling under a finger that is dragging.
      const onTouchMove = (e: TouchEvent) => {
        if (gesture.current?.active) e.preventDefault();
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onCancel);
      window.addEventListener("keydown", onKey);
      window.addEventListener("touchmove", onTouchMove, { passive: false });
      stop.current = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onCancel);
        window.removeEventListener("keydown", onKey);
        window.removeEventListener("touchmove", onTouchMove);
      };

      const x = event.clientX;
      const y = event.clientY;
      gesture.current = {
        id,
        pointerId: event.pointerId,
        startX: x,
        startY: y,
        active: false,
        view: null,
        timer: window.setTimeout(() => {
          const g = gesture.current;
          if (!g) return;
          g.active = true;
          g.view = look(x, y);
          setDrag(g.view);
          navigator.vibrate?.(12);
        }, HOLD_MS),
      };
    },
    [enabled, end, scroller],
  );

  /** Swallow the click that ends a drag, and the long-press menu that would open on touch. */
  const onClickCapture = useCallback((event: MouseEvent) => {
    if (suppressClick.current) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, []);
  const onContextMenu = useCallback(
    (event: MouseEvent) => {
      if (enabled && gesture.current) event.preventDefault();
    },
    [enabled],
  );

  return { drag, onPointerDown, onClickCapture, onContextMenu };
}
