"use client";

import { ArrowLeft, ArrowRight, FilePlus2, Plus, RotateCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CellList } from "@/components/CellList";
import { CreditsConcept } from "@/components/CreditsConcept";
import { ExportButton } from "@/components/ExportButton";
import { IdeaInput } from "@/components/IdeaInput";
import { ErrorNotice, Loading } from "@/components/Status";
import { Stepper } from "@/components/Stepper";
import { StylePanel } from "@/components/StylePanel";
import { Toast, useToast } from "@/components/Toast";
import type { OutlineResponse, StatusResponse } from "@/lib/ai/schemas";
import { errorMessage, postJSON } from "@/lib/api";
import { blankCell, newId, useProject } from "@/lib/project";
import type { Step } from "@/lib/types";

type Request = { status: "idle" | "loading" | "error"; error?: string };
const IDLE: Request = { status: "idle" };

export default function Home() {
  const { project, dispatch, hydrated, saveFailed } = useProject();
  const { toast, show } = useToast();

  const [ai, setAi] = useState<StatusResponse | null>(null);
  const [outlineReq, setOutlineReq] = useState<Request>(IDLE);
  // Counts outline requests so a slow, superseded reply is ignored.
  const latestOutline = useRef(0);

  useEffect(() => {
    fetch("/api/status")
      .then((response) => (response.ok ? response.json() : null))
      .then((status: StatusResponse | null) => setAi(status))
      .catch(() => setAi(null));
  }, []);

  const { idea, attributes, length, title, cells, step } = project;
  const hasIdea = idea.trim().length > 0;
  const hasOutline = cells.length > 0;
  const hasWriting = cells.some((c) => c.text.trim() || c.alternates.some((a) => a.text.trim()));

  const goTo = (next: Step) => dispatch({ type: "setStep", step: next });

  const canVisit = (target: Step) => {
    if (target === "idea") return true;
    if (target === "style") return hasIdea;
    return hasOutline || outlineReq.status !== "idle";
  };

  const generateOutline = async () => {
    if (
      hasWriting &&
      !window.confirm("A new outline replaces this one, including the paragraphs you've written. Continue?")
    ) {
      return;
    }
    const id = ++latestOutline.current;
    goTo("outline");
    setOutlineReq({ status: "loading" });
    try {
      const { outline } = await postJSON<OutlineResponse>("/api/outline", {
        idea,
        attributes,
        length,
      });
      if (id !== latestOutline.current) return;
      dispatch({
        type: "setOutline",
        title: outline.title,
        cells: outline.sections.map((section) => ({
          id: newId(),
          heading: section.heading,
          intent: section.intent,
          mood: section.mood,
          started: false,
          text: "",
          alternates: [],
        })),
      });
      setOutlineReq(IDLE);
    } catch (error) {
      if (id !== latestOutline.current) return;
      setOutlineReq({ status: "error", error: errorMessage(error) });
    }
  };

  const startOver = () => {
    const hasWork = hasIdea || hasOutline;
    if (hasWork && !window.confirm("Start a new project? This clears the current one.")) return;
    latestOutline.current++;
    setOutlineReq(IDLE);
    dispatch({ type: "reset" });
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden>
            ~/
          </span>
          wandering
        </div>
        <Stepper current={step} canVisit={canVisit} onVisit={goTo} />
        <div className="topbar-actions">
          <AiChip status={ai} />
          <CreditsConcept />
          <button type="button" className="btn btn-quiet" onClick={startOver}>
            <FilePlus2 size={14} aria-hidden /> New
          </button>
        </div>
      </header>

      {ai && !ai.configured && (
        <p className="notice notice-error">
          No AI provider is configured, so generating an outline won&apos;t work yet. Copy{" "}
          <code>.env.example</code> to <code>.env.local</code>, set <code>AI_API_KEY</code> and{" "}
          <code>AI_MODEL</code>, then restart the server.
        </p>
      )}
      {ai?.provider === "mock" && (
        <p className="notice">
          Mock AI is on: outlines are canned placeholder text. Set a real provider in{" "}
          <code>.env.local</code> to get an outline of your own idea.
        </p>
      )}
      {saveFailed && (
        <p className="notice notice-error">
          This browser is blocking local storage, so your work won&apos;t survive a reload.
        </p>
      )}

      {!hydrated ? (
        <main className="main" aria-busy="true" />
      ) : (
        <main className={`main main-${step}`}>
          {step === "idea" && (
            <>
              <StepHeader
                number="01"
                name="idea"
                title="What's on your mind?"
                sub="Type or dictate a rough idea. It doesn't need to be tidy; the outline comes next."
              />
              <IdeaInput value={idea} onChange={(value) => dispatch({ type: "setIdea", idea: value })} />
              <div className="step-nav">
                <span />
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!hasIdea}
                  onClick={() => goTo("style")}
                >
                  Set the style <ArrowRight size={15} aria-hidden />
                </button>
              </div>
            </>
          )}

          {step === "style" && (
            <>
              <StepHeader
                number="02"
                name="style"
                title="How should it sound?"
                sub="Drag the corners of the shape, or set exact values, and choose how long the outline runs. The outline's notes and moods follow these."
              />
              <StylePanel
                attributes={attributes}
                length={length}
                idea={idea}
                onChange={(id, value) => dispatch({ type: "setAttribute", id, value })}
                onLength={(value) => dispatch({ type: "setLength", length: value })}
                onReset={() => dispatch({ type: "resetStyle" })}
              />
              <div className="step-nav">
                <button type="button" className="btn btn-quiet" onClick={() => goTo("idea")}>
                  <ArrowLeft size={15} aria-hidden /> Idea
                </button>
                <div className="step-nav-group">
                  {hasOutline && (
                    <button type="button" className="btn" onClick={() => goTo("outline")}>
                      Keep current outline
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={!hasIdea || outlineReq.status === "loading"}
                    onClick={generateOutline}
                  >
                    {hasOutline ? "Regenerate outline" : "Generate outline"}{" "}
                    <ArrowRight size={15} aria-hidden />
                  </button>
                </div>
              </div>
            </>
          )}

          {step === "outline" && (
            <>
              <StepHeader
                number="03"
                name="outline"
                title="Write along the outline"
                sub="Click a cell to write its paragraph; the outline stays beside it as a note. Drag cells to reorder, and open a rabbit hole to try another version of a paragraph. Each cell's colour is its mood."
              />
              {outlineReq.status === "loading" ? (
                <Loading label="Outlining your idea…" lines={5} />
              ) : (
                <>
                  {outlineReq.status === "error" && (
                    <ErrorNotice
                      message={outlineReq.error ?? "Could not generate an outline."}
                      onRetry={generateOutline}
                    />
                  )}
                  <input
                    className="title-input prose"
                    value={title}
                    placeholder="Untitled"
                    aria-label="Title"
                    onChange={(event) => dispatch({ type: "setTitle", title: event.target.value })}
                  />
                  {!hasOutline && outlineReq.status === "idle" && (
                    <p className="empty">No outline yet. Generate one, or add a cell and start writing.</p>
                  )}
                  <CellList cells={cells} dispatch={dispatch} />
                  <button
                    type="button"
                    className="btn btn-quiet add-row"
                    onClick={() => dispatch({ type: "insertCell", afterId: null, cell: blankCell() })}
                  >
                    <Plus size={14} aria-hidden /> Add cell
                  </button>
                </>
              )}
              <div className="step-nav">
                <button type="button" className="btn btn-quiet" onClick={() => goTo("style")}>
                  <ArrowLeft size={15} aria-hidden /> Style
                </button>
                <div className="step-nav-group">
                  <button
                    type="button"
                    className="btn"
                    disabled={!hasIdea || outlineReq.status === "loading"}
                    onClick={generateOutline}
                  >
                    <RotateCw size={14} aria-hidden /> {hasOutline ? "Regenerate outline" : "Generate outline"}
                  </button>
                  <ExportButton title={title} cells={cells} onResult={show} />
                </div>
              </div>
            </>
          )}
        </main>
      )}

      <Toast toast={toast} />
    </div>
  );
}

function StepHeader(props: { number: string; name: string; title: string; sub: string }) {
  return (
    <header className="step-header">
      <p className="label">
        {props.number} / {props.name}
      </p>
      <h1>{props.title}</h1>
      <p className="step-sub">{props.sub}</p>
    </header>
  );
}

function AiChip({ status }: { status: StatusResponse | null }) {
  if (!status) return null;
  const state = !status.configured ? "off" : status.provider === "mock" ? "mock" : "on";
  const text = state === "off" ? "not configured" : state === "mock" ? "mock" : status.model;
  return (
    <span className={`chip chip-${state}`} title={`AI provider: ${status.provider}`}>
      <span className="chip-dot" aria-hidden />
      ai: {text}
    </span>
  );
}
