"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil } from "lucide-react";
import { useRef, useState } from "react";
import { newId } from "@/lib/id";
import type { Beat } from "@/lib/types";
import { AutoTextarea } from "./AutoTextarea";

type Props = {
  beats: Beat[];
  onChange: (index: number, patch: Partial<Beat>) => void;
  onMove: (from: number, to: number) => void;
};

/**
 * The suggested outline, one beat per column of the plot tree. Every title
 * and description can be rewritten in place, and beats can be dragged (or
 * moved with the keyboard) into a different order.
 */
export function GuideRail({ beats, onChange, onMove }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      // Jump rather than glide when a move needs the page to scroll; a smooth
      // scroll that gets cut short leaves the beat where it started.
      scrollBehavior: "auto",
    }),
  );

  // Beats have no ids of their own. These follow each beat as it is moved, so
  // a beat keeps its fields (and the cursor in them) when the order changes.
  const [ids, setIds] = useState(() => beats.map(() => newId()));
  if (ids.length !== beats.length) {
    // A new outline of a different length has arrived.
    setIds(beats.map(() => newId()));
    return null;
  }

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from === -1 || to === -1) return;
    setIds(arrayMove(ids, from, to));
    onMove(from, to);
  };

  return (
    <DndContext id="outline" sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ol className="rail">
          {beats.map((beat, index) => (
            <BeatRow
              key={ids[index]}
              id={ids[index]}
              number={index + 1}
              beat={beat}
              onChange={(patch) => onChange(index, patch)}
            />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}

function BeatRow(props: { id: string; number: number; beat: Beat; onChange: (patch: Partial<Beat>) => void }) {
  const { id, number, beat, onChange } = props;
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  // What a field held when the cursor entered it, to put back if it is left empty:
  // every beat needs a title and a description for the suggestions to follow.
  const before = useRef("");

  return (
    <li
      ref={setNodeRef}
      className={`rail-beat${isDragging ? " is-dragging" : ""}`}
      style={{
        // Beats only move up and down.
        transform: CSS.Translate.toString(transform ? { ...transform, x: 0 } : null),
        transition,
      }}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        className="rail-grip"
        aria-label={`Move beat ${number}, ${beat.title}`}
        title="Drag to move this beat"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={16} aria-hidden />
      </button>
      <span className="rail-num" aria-hidden>
        {number}
      </span>
      <div className="rail-fields">
        <label className="rail-field">
          <span className="sr-only">Beat {number} title</span>
          <input
            className="rail-title"
            value={beat.title}
            maxLength={160}
            placeholder="Name this beat"
            onFocus={(event) => (before.current = event.target.value)}
            onChange={(event) => onChange({ title: event.target.value })}
            onBlur={(event) => {
              if (!event.target.value.trim()) onChange({ title: before.current.trim() || `Beat ${number}` });
            }}
          />
          <Pencil className="rail-pencil" size={13} aria-hidden />
        </label>
        <label className="rail-field">
          <span className="sr-only">Beat {number} description</span>
          <AutoTextarea
            className="rail-desc"
            value={beat.description}
            maxLength={600}
            placeholder="What does this part of the story need to do?"
            onFocus={(event) => (before.current = event.target.value)}
            onChange={(event) => onChange({ description: event.target.value })}
            onBlur={(event) => {
              if (!event.target.value.trim()) {
                onChange({ description: before.current.trim() || "This part of the story." });
              }
            }}
          />
          <Pencil className="rail-pencil" size={13} aria-hidden />
        </label>
      </div>
    </li>
  );
}
