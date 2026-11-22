"use client";

import { Check, Download, FilePlus2, LibraryBig, Pencil, Trash2, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { newId } from "@/lib/id";
import {
  deleteProject,
  emptyProject,
  listProjects,
  parseProject,
  projectFileName,
  readProject,
  renameProject,
  type ProjectEntry,
} from "@/lib/storage";
import type { Project } from "@/lib/types";
import { Dialog } from "./Dialog";

type Props = {
  /** The project that is open now. */
  project: Project;
  /** Open another project in place of the current one. */
  onOpen: (project: Project) => void;
  /** Start a new, empty project. */
  onNew: () => void;
  /** Rename the open project. */
  onRename: (title: string) => void;
};

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

function ago(time: number): string {
  const minutes = Math.round((Date.now() - time) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${plural(minutes, "minute")} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${plural(hours, "hour")} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${plural(days, "day")} ago`;
  return new Date(time).toLocaleDateString();
}

function download(project: Project) {
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = projectFileName(project);
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Give the browser a moment to start the download before letting go of the data.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * The project library: every project kept in this browser. Start, open,
 * rename, delete, and download or re-open a copy as a file. Nothing here
 * leaves the browser.
 */
export function ProjectMenu({ project, onOpen, onNew, onRename }: Props) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<ProjectEntry[]>([]);
  const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);

  const refresh = () => setEntries(listProjects());

  const show = () => {
    refresh();
    setError(null);
    setRenaming(null);
    setOpen(true);
  };

  const close = () => setOpen(false);

  const openEntry = (id: string) => {
    const stored = readProject(id);
    if (!stored) {
      setError("That project couldn't be opened. It may have been removed from this browser.");
      refresh();
      return;
    }
    onOpen(stored);
    close();
  };

  const downloadEntry = (id: string) => {
    const stored = id === project.id ? project : readProject(id);
    if (stored) download(stored);
    else setError("That project couldn't be read, so there is nothing to download.");
  };

  const openFile = async (file: File) => {
    setError(null);
    let loaded: Project | null = null;
    try {
      loaded = parseProject(JSON.parse(await file.text()));
    } catch {
      loaded = null;
    }
    if (!loaded) {
      setError("That file isn't a Wandering project. Choose a file you downloaded from here.");
      return;
    }
    // It joins the library as a project of its own, so it can't overwrite one already here.
    onOpen({ ...loaded, id: newId() });
    close();
  };

  const saveName = () => {
    if (!renaming) return;
    const title = renaming.title.trim();
    if (renaming.id === project.id) onRename(title);
    else renameProject(renaming.id, title);
    setRenaming(null);
    refresh();
  };

  const remove = (entry: ProjectEntry, title: string) => {
    if (
      !window.confirm(
        `Delete "${title}" for good? This can't be undone. Download a copy first if you might want it back.`,
      )
    ) {
      return;
    }
    deleteProject(entry.id);
    if (entry.id === project.id) {
      // The open project is gone: fall back to the most recent other one, or a fresh one.
      const next = entries.find((other) => other.id !== entry.id);
      onOpen((next && readProject(next.id)) ?? emptyProject());
    }
    refresh();
  };

  return (
    <>
      <button type="button" className="btn btn-quiet" onClick={show}>
        <LibraryBig size={15} aria-hidden /> Projects
      </button>

      <Dialog open={open} onClose={close} title="Your projects" wide>
        <p className="file-note">
          Projects are kept in this browser only. Clearing your browsing data or moving to another computer
          loses them, so download a copy of anything you want to keep.
        </p>

        <div className="library-tools">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              onNew();
              close();
            }}
          >
            <FilePlus2 size={15} aria-hidden /> New project
          </button>
          <button type="button" className="btn" onClick={() => picker.current?.click()}>
            <Upload size={15} aria-hidden /> Open a downloaded copy
          </button>
          <input
            ref={picker}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void openFile(file);
            }}
          />
        </div>

        {error && (
          <p className="hint hint-error" role="alert">
            {error}
          </p>
        )}

        <ul className="library-list">
          {entries.map((entry) => {
            const isOpen = entry.id === project.id;
            // The open project's title is live; the others come from the library.
            const title = (isOpen ? project.title : entry.title).trim() || "Untitled";
            const editing = renaming?.id === entry.id;
            return (
              <li key={entry.id} className={`library-row${isOpen ? " is-open" : ""}`}>
                <div className="library-main">
                  {editing ? (
                    <form
                      className="library-rename"
                      onSubmit={(event) => {
                        event.preventDefault();
                        saveName();
                      }}
                    >
                      <input
                        value={renaming.title}
                        aria-label={`New name for ${title}`}
                        maxLength={200}
                        autoFocus
                        onChange={(event) => setRenaming({ id: entry.id, title: event.target.value })}
                        onKeyDown={(event) => {
                          if (event.key === "Escape") {
                            event.stopPropagation();
                            setRenaming(null);
                          }
                        }}
                      />
                      <button type="submit" className="icon-btn" aria-label="Save name" title="Save name">
                        <Check size={16} aria-hidden />
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label="Cancel renaming"
                        title="Cancel"
                        onClick={() => setRenaming(null)}
                      >
                        <X size={16} aria-hidden />
                      </button>
                    </form>
                  ) : (
                    <p className="library-title">
                      <strong>{title}</strong>
                      {isOpen && <span className="tag tag-gold">open now</span>}
                    </p>
                  )}
                  <p className="library-meta">
                    {entry.beats === 0 && entry.plotPoints === 0 && entry.words === 0
                      ? entry.hasIdea
                        ? "Just an idea so far"
                        : "Nothing in it yet"
                      : `${plural(entry.beats, "beat")} · ${plural(entry.plotPoints, "plot point")} · ${plural(entry.words, "word")}`}
                    {" · "}
                    changed {ago(entry.updatedAt)}
                  </p>
                </div>

                <div className="library-actions">
                  {!isOpen && (
                    <button type="button" className="btn" onClick={() => openEntry(entry.id)}>
                      Open
                    </button>
                  )}
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Rename ${title}`}
                    title="Rename"
                    onClick={() => setRenaming({ id: entry.id, title: isOpen ? project.title : entry.title })}
                  >
                    <Pencil size={15} aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Download a copy of ${title}`}
                    title="Download a copy"
                    onClick={() => downloadEntry(entry.id)}
                  >
                    <Download size={15} aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="icon-btn icon-btn-danger"
                    aria-label={`Delete ${title}`}
                    title="Delete"
                    onClick={() => remove(entry, title)}
                  >
                    <Trash2 size={15} aria-hidden />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </Dialog>
    </>
  );
}
