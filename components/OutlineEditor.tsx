"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import type { Dispatch } from "react";
import { newId, type Action } from "@/lib/project";
import type { Outline } from "@/lib/types";
import { AutoTextarea } from "./AutoTextarea";

type Props = {
  outline: Outline;
  dispatch: Dispatch<Action>;
};

export function OutlineEditor({ outline, dispatch }: Props) {
  const { sections } = outline;

  return (
    <div className="outline">
      <label className="label" htmlFor="outline-title">
        title
      </label>
      <input
        id="outline-title"
        className="title-input prose"
        value={outline.title}
        placeholder="Untitled"
        onChange={(event) => dispatch({ type: "setTitle", title: event.target.value })}
      />

      <ol className="section-list">
        {sections.map((section, index) => (
          <li key={section.id} className="section">
            <span className="gutter" aria-hidden>
              {String(index + 1).padStart(2, "0")}
            </span>
            <div className="section-fields">
              <input
                className="section-heading"
                value={section.heading}
                placeholder="Section heading"
                aria-label={`Section ${index + 1} heading`}
                onChange={(event) =>
                  dispatch({
                    type: "updateSection",
                    id: section.id,
                    patch: { heading: event.target.value },
                  })
                }
              />
              <AutoTextarea
                className="section-intent prose"
                value={section.intent}
                placeholder="What should this paragraph do?"
                aria-label={`Section ${index + 1} intent`}
                onChange={(event) =>
                  dispatch({
                    type: "updateSection",
                    id: section.id,
                    patch: { intent: event.target.value },
                  })
                }
              />
            </div>
            <div className="section-tools">
              <button
                type="button"
                className="icon-btn"
                aria-label={`Move section ${index + 1} up`}
                disabled={index === 0}
                onClick={() => dispatch({ type: "moveSection", id: section.id, direction: -1 })}
              >
                <ArrowUp size={15} aria-hidden />
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label={`Move section ${index + 1} down`}
                disabled={index === sections.length - 1}
                onClick={() => dispatch({ type: "moveSection", id: section.id, direction: 1 })}
              >
                <ArrowDown size={15} aria-hidden />
              </button>
              <button
                type="button"
                className="icon-btn icon-btn-danger"
                aria-label={`Delete section ${index + 1}`}
                disabled={sections.length === 1}
                onClick={() => dispatch({ type: "removeSection", id: section.id })}
              >
                <Trash2 size={15} aria-hidden />
              </button>
            </div>
          </li>
        ))}
      </ol>

      <button
        type="button"
        className="btn btn-quiet add-row"
        disabled={sections.length >= 12}
        onClick={() =>
          dispatch({ type: "addSection", section: { id: newId(), heading: "", intent: "" } })
        }
      >
        <Plus size={14} aria-hidden /> Add section
      </button>
    </div>
  );
}
