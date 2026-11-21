"use client";

import { Mic, Square } from "lucide-react";
import { useDictation } from "@/lib/speech";

type Props = {
  value: string;
  onChange: (value: string) => void;
};

export function IdeaInput({ value, onChange }: Props) {
  const dictation = useDictation(value, onChange);

  return (
    <div className="idea">
      <div className={`idea-box${dictation.listening ? " is-listening" : ""}`}>
        <textarea
          className="idea-text prose"
          value={value}
          onChange={(event) => {
            if (dictation.listening) dictation.rebase(event.target.value);
            onChange(event.target.value);
          }}
          placeholder="What do you want to write? Ramble. A few messy sentences are enough."
          aria-label="Your rough idea"
          autoFocus
        />
        <div className="idea-bar">
          <span className="idea-count">
            {value.trim() ? `${value.trim().split(/\s+/).length} words` : "empty"}
          </span>
          {dictation.supported ? (
            <button
              type="button"
              className={`btn${dictation.listening ? " btn-live" : ""}`}
              onClick={dictation.listening ? dictation.stop : dictation.start}
              aria-pressed={dictation.listening}
            >
              {dictation.listening ? (
                <>
                  <Square size={13} aria-hidden /> Stop dictating
                </>
              ) : (
                <>
                  <Mic size={14} aria-hidden /> Dictate
                </>
              )}
            </button>
          ) : (
            <span className="idea-note">Voice input isn&apos;t available in this browser.</span>
          )}
        </div>
      </div>
      {dictation.listening && (
        <p className="hint" role="status">
          Listening. Speak, and edit the text whenever you like.
        </p>
      )}
      {dictation.error && (
        <p className="hint hint-error" role="alert">
          {dictation.error}
        </p>
      )}
    </div>
  );
}
