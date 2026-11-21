"use client";

import { Coins, Link2 } from "lucide-react";
import { useState } from "react";
import { Dialog } from "./Dialog";

/**
 * Concept only. Nothing here charges, authenticates or connects to anything;
 * it shows where credits and bring-your-own-account would live.
 */
export function CreditsConcept() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className="btn btn-quiet" onClick={() => setOpen(true)}>
        <Coins size={14} aria-hidden /> Credits
        <span className="tag">soon</span>
      </button>

      <Dialog open={open} onClose={() => setOpen(false)} title="Credits & AI account">
        <p className="concept-banner">
          Preview of what&apos;s planned. Nothing on this screen works yet, and nothing is charged.
        </p>

        <section className="concept">
          <div className="concept-head">
            <Coins size={16} aria-hidden />
            <h3>Credits</h3>
            <span className="tag">coming soon</span>
          </div>
          <p>
            The outline and plot suggestions will draw from a credit balance you can top up. For now
            they are free and unmetered.
          </p>
          <button type="button" className="btn" disabled>
            Buy credits
          </button>
        </section>

        <section className="concept">
          <div className="concept-head">
            <Link2 size={16} aria-hidden />
            <h3>Connect your own AI account</h3>
            <span className="tag">coming soon</span>
          </div>
          <p>
            Link an AI provider account you already pay for and Wandering will use it instead of
            credits.
          </p>
          <button type="button" className="btn" disabled>
            Connect account
          </button>
        </section>
      </Dialog>
    </>
  );
}
