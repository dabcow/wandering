"use client";

import { ArrowLeft, ArrowRight, Check, Crown, PenLine, Pencil, Sparkles, Undo2 } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  MAX_CHOICES_PER_PARENT,
  MAX_NODES_PER_LEVEL,
  childrenOf,
  groupKey,
  nodesAtLevel,
  pathTo,
} from "@/lib/tree";
import type { Beat, Candidate, Plot, PlotNode } from "@/lib/types";
import type { Req } from "@/lib/useStoryAI";
import { OwnCard, type OwnPlotPoint } from "./OwnCard";
import { ErrorNotice } from "./Status";

type Props = {
  nodes: PlotNode[];
  candidates: Record<string, Candidate[]>;
  guideRail: Beat[];
  hasB: boolean;
  plot: Plot;
  /** The plot point in view, or null for the start of the plot. */
  focusId: string | null;
  reqs: Record<string, Req>;
  onPlot: (plot: Plot) => void;
  /** Bring a plot point (or the start, with null) into view. */
  onFocus: (id: string | null) => void;
  /** Ask for (more) suggestions under one parent. */
  onLoad: (parentId: string | null) => void;
  /** Choose a suggestion and move straight on to it. */
  onExplore: (candidate: Candidate, parentId: string | null) => void;
  /** Choose a suggestion but stay here; it becomes a branch in the tree. */
  onKeep: (candidate: Candidate, parentId: string | null) => void;
  onRemove: (nodeId: string) => void;
  onAddOwn: (parentId: string | null, own: OwnPlotPoint) => void;
  onEdit: (nodeId: string) => void;
  /** When given, the card shows this editor in place of the plot point. */
  editor?: ReactNode;
};

/** What the card shows; kept so the outgoing card can still be drawn while it leaves. */
type Face = {
  plot: Plot;
  kicker: string;
  title: string;
  summary: string;
  isEnding: boolean;
  yours: boolean;
};

/** Which way the view moves: down a branch, back up it, or across to another branch. */
type Move = "none" | "deeper" | "back" | "across";

function faceOf(node: PlotNode | null, plot: Plot, guideRail: Beat[]): Face {
  if (!node) {
    return {
      plot,
      kicker: "Before beat 1",
      title: plot === "b" ? "The subplot begins" : "The story begins",
      summary: guideRail[0]?.description ?? "",
      isEnding: false,
      yours: false,
    };
  }
  const beat = guideRail[node.level - 1];
  return {
    plot,
    kicker: `Beat ${node.level}${beat ? ` · ${beat.title}` : ""}`,
    title: node.title,
    summary: node.summary,
    isEnding: node.isEnding,
    yours: node.source === "user",
  };
}

function moveBetween(nodes: PlotNode[], from: string | null, to: string | null): Move {
  if (from === to) return "none";
  if (to === null) return "back";
  if (from === null) return "deeper";
  if (pathTo(nodes, to).some((n) => n.id === from)) return "deeper";
  if (pathTo(nodes, from).some((n) => n.id === to)) return "back";
  return "across";
}

function CardFace({ face }: { face: Face }) {
  return (
    <>
      <p className="label">
        <span className="pip" aria-hidden>
          {face.plot === "b" ? "♠" : "♥"}
        </span>
        {face.kicker}
      </p>
      <h2>{face.title}</h2>
      {face.summary && <p className="card-summary">{face.summary}</p>}
      {(face.isEnding || face.yours) && (
        <p className="option-flags">
          {face.isEnding && (
            <span className="tag tag-gold">
              <Crown size={11} aria-hidden /> ending
            </span>
          )}
          {face.yours && (
            <span className="tag">
              <PenLine size={11} aria-hidden /> yours
            </span>
          )}
        </p>
      )}
    </>
  );
}

/**
 * One plot point at a time: the plot point in view as a card, with its
 * possible next steps below it. Every other plot point is reached by clicking
 * it in the tree above.
 */
export function PlotPointView(props: Props) {
  const { nodes, candidates, guideRail, hasB, plot, focusId, reqs } = props;
  const node = (focusId ? nodes.find((n) => n.id === focusId && n.plot === plot) : null) ?? null;
  const face = faceOf(node, plot, guideRail);
  const currentKey = `${plot}:${node?.id ?? "start"}`;

  // Remember the card that was in view so it can slide away when the view changes.
  const [view, setView] = useState<{
    key: string;
    plot: Plot;
    id: string | null;
    face: Face;
    move: Move;
    leaving: Face | null;
  }>({ key: currentKey, plot, id: node?.id ?? null, face, move: "none", leaving: null });
  if (view.key !== currentKey) {
    setView({
      key: currentKey,
      plot,
      id: node?.id ?? null,
      face,
      move: view.plot === plot ? moveBetween(nodes, view.id, node?.id ?? null) : "across",
      leaving: view.face,
    });
  }
  const move = view.key === currentKey ? view.move : "none";

  const card = useRef<HTMLElement>(null);
  const settledKey = useRef(currentKey);
  useEffect(() => {
    // Only when the card actually changed, not on first mount.
    if (settledKey.current === currentKey) return;
    settledKey.current = currentKey;
    // Keep keyboard users with the card they just brought up.
    card.current?.focus({ preventScroll: true });
    // In case the leave animation never reports back (e.g. the tab was hidden).
    const timer = window.setTimeout(() => setView((v) => (v.leaving ? { ...v, leaving: null } : v)), 900);
    return () => window.clearTimeout(timer);
  }, [currentKey]);

  // The next step from the plot point in view.
  const parentId = node?.id ?? null;
  const childLevel = (node?.level ?? 0) + 1;
  const beat = guideRail[childLevel - 1];
  const key = groupKey(plot, parentId);
  const offered = candidates[key] ?? [];
  const children = childrenOf(nodes, plot, parentId);
  const chosen = new Set(children.map((n) => n.id));
  const own = children.filter((n) => !offered.some((c) => c.id === n.id));
  const levelFull = nodesAtLevel(nodes, plot, childLevel).length >= MAX_NODES_PER_LEVEL;
  const parentFull = children.length >= MAX_CHOICES_PER_PARENT;
  const full = levelFull || parentFull;
  const req = reqs[key] ?? { status: "idle" };

  return (
    <section className="picker panel" aria-label="The plot point in view">
      {hasB && (
        <div className="tabs" role="tablist" aria-label="Plot">
          <button
            type="button"
            role="tab"
            className="tab tab-main"
            aria-selected={plot === "main"}
            onClick={() => props.onPlot("main")}
          >
            ♥ Main plot
          </button>
          <button
            type="button"
            role="tab"
            className="tab tab-b"
            aria-selected={plot === "b"}
            onClick={() => props.onPlot("b")}
          >
            ♠ Subplot
          </button>
        </div>
      )}

      {/* The stage clips cards as they slide in and out. */}
      <div className="card-stage">
        <div className="card-slot">
          {view.leaving && (
            <div
              key={`leaving-${view.key}`}
              className={`focus-card is-leaving move-${move} plot-${view.leaving.plot}${view.leaving.isEnding ? " is-ending" : ""}`}
              aria-hidden
              onAnimationEnd={() => setView((v) => ({ ...v, leaving: null }))}
            >
              <CardFace face={view.leaving} />
            </div>
          )}
          <article
            key={currentKey}
            ref={card}
            tabIndex={-1}
            className={`focus-card is-current move-${move} plot-${plot}${face.isEnding ? " is-ending" : ""}`}
            aria-label={`In view: ${face.title}`}
          >
            {node && props.editor ? (
              <>
                <p className="label">
                  <span className="pip" aria-hidden>
                    {face.plot === "b" ? "♠" : "♥"}
                  </span>
                  {face.kicker} · editing
                </p>
                {props.editor}
              </>
            ) : (
              <>
                <CardFace face={face} />
                {node && (
                  <div className="card-actions">
                    <button type="button" className="btn btn-quiet" onClick={() => props.onFocus(node.parentId)}>
                      <ArrowLeft size={14} aria-hidden /> Back
                    </button>
                    {node.parentId && (
                      <button type="button" className="btn btn-quiet" onClick={() => props.onFocus(null)}>
                        <Undo2 size={14} aria-hidden /> To the start
                      </button>
                    )}
                    <button type="button" className="btn btn-quiet" onClick={() => props.onEdit(node.id)}>
                      <Pencil size={14} aria-hidden /> Edit
                    </button>
                  </div>
                )}
              </>
            )}
          </article>
        </div>
        <p className="sr-only" role="status">
          Now on: {face.title}
        </p>
      </div>

      <div key={currentKey} className={`group next-steps move-${move}`}>
        {node?.isEnding ? (
          <p className="empty">
            This branch ends here. Click another plot point in the tree to keep exploring, or use Edit to make
            this not an ending.
          </p>
        ) : (
          <>
            <div className="group-head">
              <h3>
                What happens next
                <span className="next-beat">
                  {" "}
                  · beat {childLevel}
                  {beat ? `, ${beat.title}` : guideRail.length > 0 ? ", past the outline" : ""}
                </span>
              </h3>
              {children.length > 0 && (
                <span className="group-count">
                  {children.length} of {MAX_CHOICES_PER_PARENT} kept
                </span>
              )}
            </div>
            {beat && <p className="picker-beat">{beat.description}</p>}
            {parentFull ? (
              <p className="hint">
                You&apos;ve kept {MAX_CHOICES_PER_PARENT} possibilities here, the most for one plot point. Remove
                one to choose a different one.
              </p>
            ) : (
              levelFull && (
                <p className="hint">
                  Beat {childLevel} already holds {MAX_NODES_PER_LEVEL} plot points across the tree, the most it
                  can. Remove one somewhere in this beat to add another.
                </p>
              )
            )}

            <div className="option-grid">
              <OwnCard disabled={full} onAdd={(value) => props.onAddOwn(parentId, value)} />
              {offered.map((candidate) => (
                <NextOption
                  key={candidate.id}
                  plot={plot}
                  title={candidate.title}
                  summary={candidate.summary}
                  isEnding={candidate.isEnding}
                  chosen={chosen.has(candidate.id)}
                  full={full}
                  onGo={() => props.onFocus(candidate.id)}
                  onExplore={() => props.onExplore(candidate, parentId)}
                  onKeep={() => props.onKeep(candidate, parentId)}
                  onRemove={() => props.onRemove(candidate.id)}
                />
              ))}
              {own.map((child) => (
                <NextOption
                  key={child.id}
                  plot={plot}
                  title={child.title}
                  summary={child.summary}
                  isEnding={child.isEnding}
                  yours
                  chosen
                  full={full}
                  onGo={() => props.onFocus(child.id)}
                  onRemove={() => props.onRemove(child.id)}
                />
              ))}
              {req.status === "loading" &&
                Array.from({ length: 3 }, (_, i) => <div key={i} className="option option-ghost" aria-hidden />)}
            </div>

            {req.status === "loading" && (
              <p className="hint" role="status">
                <span className="spinner" aria-hidden /> Thinking of where this could go…
              </p>
            )}
            {req.status === "error" && (
              <ErrorNotice
                message={req.error ?? "Could not get suggestions."}
                onRetry={() => props.onLoad(parentId)}
              />
            )}
            {/* The AI suggests only when asked. */}
            {req.status === "idle" && (
              <button
                type="button"
                className={offered.length > 0 ? "btn btn-quiet" : "btn btn-suggest"}
                onClick={() => props.onLoad(parentId)}
              >
                <Sparkles size={14} aria-hidden /> {offered.length > 0 ? "Suggest more beats" : "Suggest beats"}
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function NextOption(props: {
  plot: Plot;
  title: string;
  summary: string;
  isEnding: boolean;
  chosen: boolean;
  /** No more can be chosen under this parent or on this level. */
  full: boolean;
  yours?: boolean;
  onGo: () => void;
  onExplore?: () => void;
  onKeep?: () => void;
  onRemove: () => void;
}) {
  return (
    <div className={`option next-option plot-${props.plot}${props.chosen ? " is-chosen" : ""}`}>
      {props.chosen && (
        <span className="option-check" aria-hidden>
          <Check size={13} />
        </span>
      )}
      <span className="option-title">{props.title}</span>
      <span className="option-summary">{props.summary}</span>
      <span className="option-flags">
        {props.yours ? (
          <span className="tag">
            <PenLine size={11} aria-hidden /> yours
          </span>
        ) : (
          <span className="tag tag-ai" title="Suggested by AI">
            <Sparkles size={11} aria-hidden /> AI
          </span>
        )}
        {props.isEnding && (
          <span className="tag tag-gold">
            <Crown size={11} aria-hidden /> ending
          </span>
        )}
      </span>
      <span className="next-actions">
        {props.chosen ? (
          <>
            <button
              type="button"
              className="btn btn-primary"
              aria-label={`Go here: ${props.title}`}
              onClick={props.onGo}
            >
              Go here <ArrowRight size={14} aria-hidden />
            </button>
            <button
              type="button"
              className="btn btn-quiet"
              aria-label={`Remove: ${props.title}`}
              onClick={props.onRemove}
            >
              Remove
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="btn btn-explore"
              disabled={props.full}
              aria-label={`Go here: ${props.title}`}
              onClick={props.onExplore}
            >
              Go here <ArrowRight size={14} aria-hidden />
            </button>
            <button
              type="button"
              className="btn"
              disabled={props.full}
              aria-label={`Keep for later: ${props.title}`}
              onClick={props.onKeep}
            >
              Keep for later
            </button>
          </>
        )}
      </span>
    </div>
  );
}
