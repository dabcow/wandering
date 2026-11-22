"use client";

import { Crown, PenLine } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { layoutTree, maxLevel, subtreeIds } from "@/lib/tree";
import type { Beat, Link, Plot, PlotNode } from "@/lib/types";
import { useHoldToDrag } from "./useHoldToDrag";

type Props = {
  nodes: PlotNode[];
  beats: Beat[];
  links: Link[];
  /** Draw the B-plot lane beside the main tree. */
  showB: boolean;
  selectedId?: string | null;
  /** The plot point in view in the tree step; it is ringed and kept on screen. */
  topId?: string;
  onSelect: (node: PlotNode) => void;
  /** Smaller cards, for the side panel beside the document. */
  compact?: boolean;
  /** When given, nodes outside this set are dimmed (the active path while writing). */
  highlight?: Set<string>;
  /** Which nodes have an anchor in the document, and whether text follows it. */
  status?: Map<string, { hasText: boolean }>;
  /** The level whose plot points are being chosen; its column (or row, when vertical) is tinted. */
  activeLevel?: number;
  /**
   * Draw the story top to bottom: one row per beat, branches side by side,
   * and the subplot in a lane to the right. Otherwise beats are columns, left to right.
   */
  vertical?: boolean;
  /**
   * Hold a plot point and drag it onto another to move it (with everything after it) to
   * follow that one. Without this the map is only for looking and clicking.
   */
  onMove?: (id: string, parentId: string) => void;
  /** Why a plot point can't move to follow another, or null if it can. Required with onMove. */
  moveProblem?: (id: string, parentId: string) => string | null;
};

const FULL = { cardW: 188, cardH: 68, colW: 232, rowH: 84, laneGap: 52, head: 78, headRow: 54, pad: 16 };
const COMPACT = { cardW: 136, cardH: 38, colW: 156, rowH: 48, laneGap: 36, head: 34, headRow: 26, pad: 10 };
/** Vertical: `colW` is one branch's slot, `rowH` one beat's band, `labelH` the beat name atop each band. */
const VERTICAL = { cardW: 156, cardH: 68, colW: 168, rowH: 112, labelH: 32, laneGap: 36, laneTag: 26, pad: 14 };
const VERTICAL_COMPACT = { cardW: 124, cardH: 44, colW: 134, rowH: 78, labelH: 26, laneGap: 26, laneTag: 22, pad: 10 };

const PIP: Record<Plot, string> = { main: "♥", b: "♠" };

type Point = { x: number; y: number };

/**
 * The plot tree as a node-link graph: one column per level, cards joined by
 * lines, and the B plot in a second lane below the main one. Vertical, it
 * reads top to bottom instead: one row per level, the B plot to the right.
 */
export function TreeGraph({
  nodes,
  beats,
  links,
  showB,
  selectedId,
  topId,
  onSelect,
  compact = false,
  highlight,
  status,
  activeLevel,
  vertical = false,
  onMove,
  moveProblem,
}: Props) {
  const size = compact ? COMPACT : FULL;
  const v = compact ? VERTICAL_COMPACT : VERTICAL;
  // Without an outline (started from scratch) there is no expected number of beats: the map is
  // as deep as the story so far, plus one open beat below it for whatever comes next.
  const open = beats.length === 0;
  const deepest = Math.max(maxLevel(nodes, "main"), maxLevel(nodes, "b"));
  const levels = Math.max(beats.length, open && !compact ? deepest + 1 : deepest, activeLevel ?? 0, 1);
  /** The name shown for a beat: the outline's, or for an open story nothing until the open beat at the bottom. */
  const beatName = (level: number) => {
    const beat = beats[level - 1];
    if (beat) return beat.title;
    if (!open) return "Past the outline";
    return level > deepest ? "What comes next" : "";
  };
  const isOpenBeat = (level: number) => open && !compact && level > deepest;

  // `layoutTree` gives each node a slot across its plot's lane: a row when
  // horizontal, a column when vertical.
  const main = layoutTree(nodes, "main");
  const b = layoutTree(nodes, "b");
  const mainSlots = Math.max(main.rowCount, 1);
  const bSlots = showB ? Math.max(b.rowCount, 1) : 0;

  // Horizontal: beats are columns, branches are rows, the B plot is a lane below.
  const mainTop = size.head;
  const bTop = mainTop + mainSlots * size.rowH + size.laneGap;

  // Vertical: beats are rows, branches are columns, the B plot is a lane to the right.
  const bandsTop = v.pad + (showB ? v.laneTag : 0);
  const mainLeft = v.pad;
  const bLeft = mainLeft + mainSlots * v.colW + v.laneGap;
  const bandTop = (level: number) => bandsTop + (level - 1) * v.rowH;

  const cardW = vertical ? v.cardW : size.cardW;
  const cardH = vertical ? v.cardH : size.cardH;
  const width = vertical
    ? (showB ? bLeft + bSlots * v.colW : mainLeft + mainSlots * v.colW) - (v.colW - v.cardW) + v.pad
    : size.pad * 2 + levels * size.colW - (size.colW - size.cardW);
  const height = vertical
    ? bandsTop + levels * v.rowH
    : (showB ? bTop + bSlots * size.rowH : mainTop + mainSlots * size.rowH) + size.pad;

  const position = (node: PlotNode): Point => {
    const slot = (node.plot === "main" ? main.rows : b.rows).get(node.id) ?? 0;
    if (vertical) {
      return {
        x: (node.plot === "main" ? mainLeft : bLeft) + slot * v.colW,
        y: bandTop(node.level) + v.labelH,
      };
    }
    const laneTop = node.plot === "main" ? mainTop : bTop;
    return {
      x: size.pad + (node.level - 1) * size.colW,
      y: laneTop + slot * size.rowH + (size.rowH - size.cardH) / 2,
    };
  };

  /** The line from a plot point to one that follows it. */
  const edgePath = (from: Point, to: Point) => {
    if (vertical) {
      const x1 = from.x + cardW / 2;
      const y1 = from.y + cardH;
      const x2 = to.x + cardW / 2;
      const y2 = to.y;
      const mid = (y1 + y2) / 2;
      return `M ${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}`;
    }
    const x1 = from.x + cardW;
    const y1 = from.y + cardH / 2;
    const x2 = to.x;
    const y2 = to.y + cardH / 2;
    const mid = (x1 + x2) / 2;
    return `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`;
  };

  /** The dashed line where a main-plot point meets a B-plot point. */
  const linkPath = (mainAt: Point, bAt: Point) => {
    if (vertical) {
      const x1 = mainAt.x + cardW;
      const y1 = mainAt.y + cardH / 2;
      const x2 = bAt.x;
      const y2 = bAt.y + cardH / 2;
      const mid = (x1 + x2) / 2;
      return `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`;
    }
    const x1 = mainAt.x + cardW / 2;
    const y1 = mainAt.y + cardH;
    const x2 = bAt.x + cardW / 2;
    const y2 = bAt.y;
    const mid = (y1 + y2) / 2;
    return `M ${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}`;
  };

  const placed = new Map(nodes.map((n) => [n.id, { node: n, ...position(n) }]));
  const onPath = (id: string) => !highlight || highlight.has(id);

  // Scroll the drawing, not the page, so the plot point in view stays visible.
  const scroller = useRef<HTMLDivElement>(null);

  // Hold and drag a plot point onto another to move it there.
  const { drag, onPointerDown, onClickCapture, onContextMenu } = useHoldToDrag({
    enabled: Boolean(onMove),
    scroller,
    problem: (id, targetId) => moveProblem?.(id, targetId) ?? null,
    onDrop: (id, targetId) => onMove?.(id, targetId),
  });
  const dragId = drag?.id;
  // The plot point being dragged moves with everything after it, so all of them fade while it does.
  const lifted = useMemo(() => new Set(dragId ? subtreeIds(nodes, dragId) : []), [nodes, dragId]);
  const titleOf = (id: string | null | undefined) => nodes.find((n) => n.id === id)?.title ?? "";
  const top = topId ? placed.get(topId) : undefined;
  const topX = top?.x;
  const topY = top?.y;
  useEffect(() => {
    const box = scroller.current;
    if (!box || topX === undefined || topY === undefined) return;
    const margin = 24;
    // Horizontally, the pinned beat headings cover the top; vertically, keep the beat's name in view.
    const inset = vertical ? v.labelH + 6 : size.head;
    const left =
      topX < box.scrollLeft + margin
        ? topX - margin
        : topX + cardW > box.scrollLeft + box.clientWidth - margin
          ? topX + cardW - box.clientWidth + margin
          : box.scrollLeft;
    const upper =
      topY - inset < box.scrollTop
        ? topY - inset
        : topY + cardH > box.scrollTop + box.clientHeight - margin
          ? topY + cardH - box.clientHeight + margin
          : box.scrollTop;
    if (left !== box.scrollLeft || upper !== box.scrollTop) box.scrollTo({ left, top: upper, behavior: "smooth" });
  }, [topId, topX, topY, cardW, cardH, vertical, v.labelH, size.head]);

  return (
    <div
      ref={scroller}
      className={`tree-scroll${compact ? " is-compact" : ""}${vertical ? " is-vertical" : ""}${drag ? " is-dragging" : ""}${onMove ? " can-move" : ""}`}
    >
      <div className="tree-canvas" style={{ width, height }}>
        {vertical ? (
          <>
            {/* One band per beat with its name at the top; the beat being chosen for is tinted. */}
            {Array.from({ length: levels }, (_, i) => {
              const level = i + 1;
              const beat = beats[i];
              return (
                <div
                  key={level}
                  className={`row-band${activeLevel === level ? " is-active" : ""}${isOpenBeat(level) ? " is-open" : ""}`}
                  style={{ top: bandTop(level), height: v.rowH }}
                  title={beat?.description}
                >
                  <span className="row-head">
                    <span className="col-num">Beat {level}</span>
                    {beatName(level) && <span className="row-beat">{beatName(level)}</span>}
                  </span>
                </div>
              );
            })}
            {showB && (
              <>
                <span className="lane-tag lane-main" style={{ top: v.pad, left: mainLeft }}>
                  ♥ Main plot
                </span>
                <div
                  className="lane-rule is-vertical"
                  style={{ left: bLeft - v.laneGap / 2, top: v.pad, height: height - v.pad }}
                  aria-hidden
                />
                <span className="lane-tag lane-b" style={{ top: v.pad - 1, left: bLeft }}>
                  ♠ Subplot
                </span>
              </>
            )}
          </>
        ) : (
          <>
            {activeLevel !== undefined && (
              <div
                className="col-active"
                style={{ left: size.pad + (activeLevel - 1) * size.colW - 8, width: size.cardW + 16, height }}
                aria-hidden
              />
            )}

            {/* The level headings stay pinned to the top while the drawing scrolls. */}
            <div className="col-heads" style={{ height: size.headRow }}>
              {Array.from({ length: levels }, (_, i) => {
                const level = i + 1;
                const beat = beats[i];
                return (
                  <div
                    key={level}
                    className={`col-head${activeLevel === level ? " is-active" : ""}`}
                    style={{ left: size.pad + i * size.colW, width: size.cardW }}
                    title={beat?.description}
                  >
                    <span className="col-num">{compact ? level : `Beat ${level}`}</span>
                    {!compact && <span className="col-beat">{beatName(level)}</span>}
                  </div>
                );
              })}
            </div>

            {showB && (
              <>
                {!compact && (
                  <span className="lane-tag lane-main" style={{ top: mainTop - 20, left: size.pad }}>
                    ♥ Main plot
                  </span>
                )}
                <div className="lane-rule" style={{ top: bTop - size.laneGap / 2, width }} aria-hidden />
                <span className="lane-tag lane-b" style={{ top: bTop - size.laneGap / 2 - 9, left: size.pad }}>
                  ♠ Subplot
                </span>
              </>
            )}
          </>
        )}

        <svg className="tree-lines" width={width} height={height} aria-hidden>
          {nodes.map((node) => {
            const child = placed.get(node.id);
            const parent = node.parentId ? placed.get(node.parentId) : undefined;
            if (!child || !parent) return null;
            const dim = !(onPath(node.id) && onPath(parent.node.id));
            return (
              <path
                key={node.id}
                className={`edge edge-${node.plot}${dim ? " is-dim" : ""}`}
                d={edgePath(parent, child)}
              />
            );
          })}
          {links.map((link) => {
            const mainAt = placed.get(link.mainId);
            const bAt = placed.get(link.bId);
            if (!mainAt || !bAt) return null;
            return (
              <path key={`${link.mainId}-${link.bId}`} className="edge edge-link" d={linkPath(mainAt, bAt)} />
            );
          })}
        </svg>

        {main.rowCount === 0 && !compact && (
          <p
            className="tree-empty"
            style={
              vertical
                ? { top: bandsTop + v.labelH + 8, left: mainLeft, right: v.pad }
                : { top: mainTop + 22, left: size.pad }
            }
          >
            {vertical
              ? "Nothing chosen yet. Choose how the story begins, and it appears here."
              : "Nothing chosen yet. Choose how the story begins above."}
          </p>
        )}
        {showB && b.rowCount === 0 && !compact && (
          <p
            className="tree-empty"
            style={
              vertical
                ? { top: bandsTop + v.labelH + 8, left: bLeft, width: v.cardW }
                : { top: bTop + 22, left: size.pad }
            }
          >
            The subplot is empty. Switch to Subplot to begin it.
          </p>
        )}

        {nodes.map((node) => {
          const at = placed.get(node.id);
          if (!at) return null;
          const anchor = status?.get(node.id);
          const classes = [
            "node-card",
            `plot-${node.plot}`,
            node.id === selectedId ? "is-selected" : "",
            node.id === topId ? "is-top" : "",
            node.isEnding ? "is-ending" : "",
            onPath(node.id) ? "" : "is-dim",
            lifted.has(node.id) ? "is-lifted" : "",
            drag?.overId === node.id ? (drag.problem ? "is-drop-no" : "is-drop-ok") : "",
          ];
          const state = !status ? "" : anchor?.hasText ? ", written" : ", not written yet";
          return (
            <button
              key={node.id}
              type="button"
              className={classes.filter(Boolean).join(" ")}
              style={{ left: at.x, top: at.y, width: cardW, height: cardH }}
              aria-pressed={node.id === selectedId}
              aria-label={`${node.plot === "b" ? "Subplot" : "Main plot"}, beat ${node.level}: ${node.title}${node.isEnding ? ", ending" : ""}${node.id === topId ? ", in view" : ""}${state}`}
              title={node.summary}
              data-node-id={node.id}
              onPointerDown={(event) => onPointerDown(node.id, event)}
              onClickCapture={onClickCapture}
              onContextMenu={onContextMenu}
              onClick={() => onSelect(node)}
            >
              <span className="node-title">{node.title}</span>
              {!compact && (
                <span className="node-meta">
                  <span className="pip" aria-hidden>
                    {PIP[node.plot]}
                  </span>
                  {node.isEnding && (
                    <span className="node-flag flag-ending">
                      <Crown size={11} aria-hidden /> ending
                    </span>
                  )}
                  {node.source === "user" && (
                    <span className="node-flag">
                      <PenLine size={11} aria-hidden /> yours
                    </span>
                  )}
                </span>
              )}
              {status && <span className={`node-dot${anchor?.hasText ? " has-text" : ""}`} aria-hidden />}
            </button>
          );
        })}
      </div>

      {/* The plot point in hand follows the pointer, saying where it would go. */}
      {drag &&
        createPortal(
          <div
            className={`drag-ghost${drag.overId && drag.problem ? " is-no" : ""}`}
            style={{ left: drag.x + 14, top: drag.y + 14 }}
            aria-hidden
          >
            <strong>{titleOf(drag.id)}</strong>
            <small>
              {!drag.overId
                ? "Drop it on the plot point it should follow"
                : (drag.problem ?? `Will follow “${titleOf(drag.overId)}”`)}
            </small>
          </div>,
          document.body,
        )}
    </div>
  );
}
