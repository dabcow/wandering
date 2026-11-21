"use client";

import { CircleUserRound, Cloud, HardDrive, MonitorSmartphone } from "lucide-react";
import { useState } from "react";
import { Dialog } from "./Dialog";

/**
 * Concept only. There are no accounts: nothing here signs anyone in, and the
 * fields are disabled so nothing can be typed into them. It shows where
 * signing in would live and what an account would add.
 */
export function AccountConcept() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className="btn btn-quiet" onClick={() => setOpen(true)}>
        <CircleUserRound size={15} aria-hidden /> Sign in
        <span className="tag">preview</span>
      </button>

      <Dialog open={open} onClose={() => setOpen(false)} title="Account">
        <p className="concept-banner">
          Preview of what&apos;s planned. Accounts don&apos;t exist yet, so you can&apos;t sign in and nothing on this
          screen is sent or saved.
        </p>

        <section className="concept">
          <div className="concept-head">
            <CircleUserRound size={16} aria-hidden />
            <h3>Sign in or create an account</h3>
            <span className="tag">coming soon</span>
          </div>
          <p>One account for all your projects, wherever you write.</p>
          <div className="account-form">
            <label className="field">
              <span className="label">Email</span>
              <input type="email" placeholder="you@example.com" disabled />
            </label>
            <div className="account-buttons">
              <button type="button" className="btn btn-primary" disabled>
                Sign in
              </button>
              <button type="button" className="btn" disabled>
                Create an account
              </button>
            </div>
          </div>
        </section>

        <section className="concept">
          <div className="concept-head">
            <h3>What an account will add</h3>
          </div>
          <ul className="concept-list">
            <li>
              <Cloud size={17} aria-hidden />
              <span>
                <strong>Projects kept in your account</strong>
                <span>Saved as you write, not only in this browser.</span>
              </span>
            </li>
            <li>
              <MonitorSmartphone size={17} aria-hidden />
              <span>
                <strong>The same projects on every device</strong>
                <span>Start on one computer and carry on from another.</span>
              </span>
            </li>
            <li>
              <HardDrive size={17} aria-hidden />
              <span>
                <strong>Storage for your files</strong>
                <span>Exports, reference material and earlier versions, kept with each project.</span>
              </span>
            </li>
          </ul>
        </section>

        <p className="file-note concept-foot">
          Until then your projects live in this browser. <strong>Projects</strong> in the top bar lists them
          and downloads copies.
        </p>
      </Dialog>
    </>
  );
}
