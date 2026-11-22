"use client";

import { useId } from "react";

/**
 * Shown while the AI is thinking: a light pencil sketch of the Cheshire cat
 * strolling up to a signpost that points every which way. It fades out
 * beside the post until only its grin is left, then strolls in again.
 * Decorative only; the loading text beside it is what screen readers hear.
 */
export function CheshireLoader({ className = "" }: { className?: string }) {
  // A filter id of its own, in case two loaders are on screen at once.
  const sketchy = `sketchy-${useId().replace(/:/g, "")}`;

  return (
    <svg
      className={`cheshire ${className}`}
      viewBox="0 0 400 112"
      aria-hidden="true"
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* A slight wobble, so the lines read as pencil rather than vector. */}
        <filter id={sketchy} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="4" />
          <feDisplacementMap in="SourceGraphic" scale="1.8" />
        </filter>
      </defs>

      <g filter={`url(#${sketchy})`}>
        {/* The ground, sketched with a few gaps and tufts. */}
        <path className="sk-faint" d="M 8 101 Q 60 99 118 101 M 128 100 Q 200 102 262 100 M 272 101 Q 330 99 392 101" />
        <path className="sk-faint" d="M 52 101 l -2 -5 M 55 101 l 1 -6 M 58 101 l 3 -4 M 186 101 l -2 -4 M 189 101 l 2 -5" />

        {/* The signpost, every board pointing a different way. */}
        <g className="signpost">
          <path d="M 318 101 Q 317 70 319 30" />
          <path d="M 314 101 l -4 -5 M 322 101 l 3 -4 M 318 101 l 0 -5" className="sk-faint" />
          {/* Left */}
          <path d="M 318 40 H 286 L 278 46 L 286 52 H 318" />
          <path className="sk-faint" d="M 290 46 h 10 M 303 46 h 9" />
          {/* Right */}
          <path d="M 319 56 H 352 L 360 62 L 352 68 H 319" />
          <path className="sk-faint" d="M 325 62 h 14 M 342 62 h 6" />
          {/* Up and away to the right */}
          <path d="M 320 34 L 346 22 L 355 24 L 350 32 L 322 44" />
          <path className="sk-faint" d="M 328 33 l 9 -4 M 340 28 l 5 -2" />
          {/* Back and down to the left */}
          <path d="M 317 74 L 292 82 L 285 79 L 289 72 L 316 64" />
          <path className="sk-faint" d="M 309 72 l -9 3" />
        </g>

        {/* The cat, walking right along the ground. */}
        <g transform="translate(0 100)">
          <g className="cat-walk">
            <g className="cat-bob">
              <g className="cat-body">
                {/* Tail, curling up behind */}
                <g className="cat-tail">
                  <path d="M -24 -21 C -37 -23 -42 -37 -36 -47 C -32 -54 -24 -53 -26 -46" />
                  <path className="sk-faint" d="M -33 -27 l 4 -3 M -38 -35 l 5 -1 M -37 -43 l 4 2" />
                </g>
                {/* Legs, in two pairs that swing in turn */}
                <g className="cat-legs-a">
                  <path d="M 12 -16 L 13 -1 l 3 0" />
                  <path d="M -18 -16 L -19 -1 l 3 0" />
                </g>
                <g className="cat-legs-b">
                  <path d="M 6 -16 L 5 -1 l 3 0" />
                  <path d="M -12 -16 L -11 -1 l 3 0" />
                </g>
                {/* Body, with a few stripes */}
                <path d="M -24 -18 C -29 -31 -6 -37 10 -33 C 21 -30 23 -21 15 -16 C 5 -12 -18 -12 -24 -18 Z" />
                <path className="sk-faint" d="M -15 -32 q -3 8 0 17 M -7 -34 q -3 9 0 20 M 1 -34 q -3 9 0 19" />
                {/* Head and ears */}
                <path d="M 14 -38 C 14 -49 32 -51 36 -41 C 39 -31 31 -24 22 -25 C 15 -26 13 -32 14 -38 Z" />
                <path d="M 16 -45 L 15 -55 L 23 -48 M 28 -49 L 34 -57 L 35 -45" />
                {/* Eyes and whiskers */}
                <path d="M 21 -41 q 2 -2.5 4 0 q -2 2.5 -4 0 M 29 -42 q 2 -2.5 4 0 q -2 2.5 -4 0" />
                <path className="sk-faint" d="M 37 -35 l 8 -3 M 37 -33 l 8 1 M 14 -34 l -7 -2" />
              </g>
              {/* The grin outlasts the cat. */}
              <g className="cat-grin">
                <path d="M 15 -34 Q 26 -23 39 -36" />
                <path d="M 17 -34 Q 26 -29 37 -35.5" />
                <path className="sk-faint" d="M 20 -32 l 0 2.5 M 23.5 -31 l 0 3 M 27 -30.5 l 0 3 M 30.5 -31 l 0 3 M 34 -33 l 0 2.5" />
              </g>
            </g>
          </g>
        </g>
      </g>
    </svg>
  );
}
