"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowLeftRight, Copy, GripVertical, PenLine, Plus, Rabbit, Trash2, X } from "lucide-react";
import type { CSSProperties } from "react";
import { MOODS, MOOD_IDS, type Mood } from "@/lib/moods";
import type { Cell as CellData } from "@/lib/types";
import { AutoTextarea } from "./AutoTextarea";

export type CellHandlers = {
  onStart: (id: string) => void;
  onPatch: (id: string, patch: Partial<Pick<CellData, "heading" | "intent" | "mood" | "text">>) => void;
  onToggleHole: (id: string) => void;
  onAddAlternate: (id: string) => void;
  onAlternateText: (id: string, alternateId: string, text: string) => void;
  onSwapAlternate: (id: string, alternateId: string) => void;
  onDeleteAlternate: (id: string, alternateId: string) => void;
  onDuplicate: (id: string) => void;
  onAddBelow: (id: string) => void;
  onDelete: (id: string) => void;
};

type Props = {
  cell: CellData;
  index: number;
  /** True while this cell's rabbit hole is open. */
  holeOpen: boolean;
  /** Id of the cell or alternate whose text box should take focus. */
  focusTarget: string | null;
  on: CellHandlers;
};

export function Cell({ cell, index, holeOpen, focusTarget, on }: Props) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: cell.id });
  const n = index + 1;
  const versions = cell.alternates.filter((a) => a.text.trim()).length;

  return (
    <li
      ref={setNodeRef}
      className={`cell${isDragging ? " is-dragging" : ""}`}
      data-mood={cell.mood}
      style={
        {
          "--mood": MOODS[cell.mood].color,
          // Cells only move vertically.
          transform: CSS.Translate.toString(transform ? { ...transform, x: 0 } : null),
          transition,
        } as CSSProperties
      }
    >
      <div className="cell-gutter">
        <button
          type="button"
          ref={setActivatorNodeRef}
          className="cell-grip"
          aria-label={`Reorder cell ${n}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={16} aria-hidden />
        </button>
        <span className="gutter" aria-hidden>
          [{n}]
        </span>
      </div>

      <div className="cell-main">
        <div className="cell-top">
          <label className="mood">
            <span className="mood-dot" aria-hidden />
            <select
              value={cell.mood}
              aria-label={`Mood of cell ${n}`}
              onChange={(event) => on.onPatch(cell.id, { mood: event.target.value as Mood })}
            >
              {MOOD_IDS.map((id) => (
                <option key={id} value={id}>
                  {MOODS[id].label}
                </option>
              ))}
            </select>
          </label>

          <div className="cell-tools">
            {cell.started && (
              <button
                type="button"
                className="btn btn-rabbit"
                aria-expanded={holeOpen}
                onClick={() => on.onToggleHole(cell.id)}
              >
                <Rabbit size={15} aria-hidden /> Rabbit hole
                {versions > 0 && <span className="count">{versions}</span>}
              </button>
            )}
            <button
              type="button"
              className="icon-btn"
              aria-label={`Duplicate cell ${n}`}
              title="Duplicate"
              onClick={() => on.onDuplicate(cell.id)}
            >
              <Copy size={15} aria-hidden />
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label={`Add a cell below cell ${n}`}
              title="Add cell below"
              onClick={() => on.onAddBelow(cell.id)}
            >
              <Plus size={15} aria-hidden />
            </button>
            <button
              type="button"
              className="icon-btn icon-btn-danger"
              aria-label={`Delete cell ${n}`}
              title="Delete"
              onClick={() => on.onDelete(cell.id)}
            >
              <Trash2 size={15} aria-hidden />
            </button>
          </div>
        </div>

        {cell.started ? (
          <div className="cell-body">
            <div className="cell-write">
              <AutoTextarea
                className="cell-text prose"
                value={cell.text}
                focused={focusTarget === cell.id}
                placeholder="Write this paragraph…"
                aria-label={`Cell ${n} paragraph`}
                onChange={(event) => on.onPatch(cell.id, { text: event.target.value })}
              />

              {holeOpen && (
                <div className="hole" role="group" aria-label={`Other versions of cell ${n}`}>
                  <p className="hole-head">
                    <Rabbit size={14} aria-hidden /> Other versions
                    <span>Write another take, then swap it with the one above.</span>
                  </p>
                  <ul className="hole-list">
                    {cell.alternates.map((alternate, i) => (
                      <li key={alternate.id} className="alt-cell">
                        <AutoTextarea
                          className="alt-text prose"
                          value={alternate.text}
                          focused={focusTarget === alternate.id}
                          placeholder="Write another version of this paragraph…"
                          aria-label={`Other version ${i + 1} of cell ${n}`}
                          onChange={(event) =>
                            on.onAlternateText(cell.id, alternate.id, event.target.value)
                          }
                        />
                        <div className="alt-foot">
                          <span className="gutter">version {i + 2}</span>
                          <div className="alt-actions">
                            <button
                              type="button"
                              className="btn"
                              disabled={!alternate.text.trim()}
                              onClick={() => on.onSwapAlternate(cell.id, alternate.id)}
                            >
                              <ArrowLeftRight size={14} aria-hidden /> Swap in
                            </button>
                            <button
                              type="button"
                              className="icon-btn icon-btn-danger"
                              aria-label={`Delete other version ${i + 1} of cell ${n}`}
                              title="Delete this version"
                              onClick={() => on.onDeleteAlternate(cell.id, alternate.id)}
                            >
                              <X size={15} aria-hidden />
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    className="btn btn-quiet"
                    onClick={() => on.onAddAlternate(cell.id)}
                  >
                    <Plus size={14} aria-hidden /> Another version
                  </button>
                </div>
              )}
            </div>

            <aside className="cell-note" aria-label={`Outline note for cell ${n}`}>
              <span className="label">outline note</span>
              <input
                className="note-heading"
                value={cell.heading}
                placeholder="Section heading"
                aria-label={`Cell ${n} heading`}
                onChange={(event) => on.onPatch(cell.id, { heading: event.target.value })}
              />
              <AutoTextarea
                className="note-intent prose"
                value={cell.intent}
                placeholder="What should this paragraph do?"
                aria-label={`Cell ${n} intent`}
                onChange={(event) => on.onPatch(cell.id, { intent: event.target.value })}
              />
            </aside>
          </div>
        ) : (
          <button type="button" className="cell-start" onClick={() => on.onStart(cell.id)}>
            <span className="cell-start-heading">{cell.heading || "Untitled section"}</span>
            {cell.intent && <span className="cell-start-intent prose">{cell.intent}</span>}
            <span className="cell-start-hint">
              <PenLine size={13} aria-hidden /> Click to write this paragraph
            </span>
          </button>
        )}
      </div>
    </li>
  );
}
