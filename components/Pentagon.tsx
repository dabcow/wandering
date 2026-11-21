"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { clampValue } from "@/lib/attributes";
import type { Attribute } from "@/lib/types";

type Props = {
  attributes: Attribute[];
  onChange: (id: string, value: number) => void;
};

const WIDTH = 500;
const HEIGHT = 400;
const CX = WIDTH / 2;
const CY = 208;
const RADIUS = 130;
/** Value 0 sits a little way out from the centre so the handles never stack. */
const INNER = RADIUS * 0.14;
const RINGS = [0, 25, 50, 75, 100];

/** Unit vector for axis i of n, starting at 12 o'clock and going clockwise. */
function axis(i: number, n: number) {
  const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

function pointAt(i: number, n: number, value: number) {
  const u = axis(i, n);
  const r = INNER + ((RADIUS - INNER) * value) / 100;
  return { x: CX + u.x * r, y: CY + u.y * r };
}

function ring(n: number, value: number) {
  return Array.from({ length: n }, (_, i) => {
    const p = pointAt(i, n, value);
    return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  }).join(" ");
}

/**
 * Radar-style style picker. Draws one axis per attribute, so it is a pentagon
 * for five attributes and any other N-gon if the list changes.
 */
export function Pentagon({ attributes, onChange }: Props) {
  const svg = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const n = attributes.length;

  const valueFromPointer = (event: PointerEvent, index: number): number | null => {
    const matrix = svg.current?.getScreenCTM();
    if (!matrix) return null;
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    const u = axis(index, n);
    // Project the pointer onto this axis.
    const along = (p.x - CX) * u.x + (p.y - CY) * u.y;
    return clampValue(((along - INNER) / (RADIUS - INNER)) * 100);
  };

  const onKeyDown = (event: KeyboardEvent, attribute: Attribute) => {
    const step = event.shiftKey ? 10 : 1;
    let next: number | null = null;
    if (event.key === "ArrowUp" || event.key === "ArrowRight") next = attribute.value + step;
    else if (event.key === "ArrowDown" || event.key === "ArrowLeft") next = attribute.value - step;
    else if (event.key === "PageUp") next = attribute.value + 10;
    else if (event.key === "PageDown") next = attribute.value - 10;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = 100;
    if (next === null) return;
    event.preventDefault();
    onChange(attribute.id, clampValue(next));
  };

  return (
    <svg
      ref={svg}
      className="pentagon"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="group"
      aria-label="Style shape. Drag a corner, or focus it and use the arrow keys."
    >
      {RINGS.map((value) => (
        <polygon
          key={value}
          className={value === 100 ? "pg-ring pg-ring-outer" : "pg-ring"}
          points={ring(n, value)}
        />
      ))}
      {attributes.map((a, i) => {
        const from = pointAt(i, n, 0);
        const to = pointAt(i, n, 100);
        return <line key={a.id} className="pg-axis" x1={from.x} y1={from.y} x2={to.x} y2={to.y} />;
      })}

      <polygon
        className="pg-shape"
        points={attributes
          .map((a, i) => {
            const p = pointAt(i, n, a.value);
            return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
          })
          .join(" ")}
      />

      {attributes.map((a, i) => {
        const u = axis(i, n);
        const centred = Math.abs(u.x) < 0.2;
        const x = CX + u.x * (RADIUS + 20);
        // Two-line label: lift it above the top corner, drop it below the bottom ones.
        const y = CY + u.y * (RADIUS + 20) + (centred ? (u.y < 0 ? -20 : 16) : u.y > 0 ? 6 : -6);
        return (
          <text
            key={a.id}
            className="pg-label"
            x={x}
            y={y}
            textAnchor={centred ? "middle" : u.x > 0 ? "start" : "end"}
          >
            <tspan x={x}>{a.label}</tspan>
            <tspan className="pg-value" x={x} dy={16}>
              {a.value}
            </tspan>
          </text>
        );
      })}

      {attributes.map((a, i) => {
        const p = pointAt(i, n, a.value);
        const update = (event: PointerEvent) => {
          const value = valueFromPointer(event, i);
          if (value !== null && value !== a.value) onChange(a.id, value);
        };
        return (
          <g key={a.id} className={dragging === a.id ? "pg-handle is-dragging" : "pg-handle"}>
            <circle
              className="pg-hit"
              cx={p.x}
              cy={p.y}
              r={22}
              role="slider"
              tabIndex={0}
              aria-label={a.label}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={a.value}
              onKeyDown={(event) => onKeyDown(event, a)}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                setDragging(a.id);
                update(event);
              }}
              onPointerMove={(event) => {
                if (dragging === a.id) update(event);
              }}
              onPointerUp={() => setDragging(null)}
              onPointerCancel={() => setDragging(null)}
            />
            <circle className="pg-dot" cx={p.x} cy={p.y} r={7} />
          </g>
        );
      })}
    </svg>
  );
}
