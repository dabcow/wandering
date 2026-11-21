"use client";

import { ArrowLeft, ArrowRight, FilePlus2, Plus, RotateCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CellList } from "@/components/CellList";
import { CreditsConcept } from "@/components/CreditsConcept";
import { ExportButton } from "@/components/ExportButton";
import { IdeaInput } from "@/components/IdeaInput";
import { OutlineEditor } from "@/components/OutlineEditor";
import { RabbitHolePanel, type RabbitState } from "@/components/RabbitHolePanel";
import { ErrorNotice, Loading } from "@/components/Status";
import { Stepper } from "@/components/Stepper";
import { StylePanel } from "@/components/StylePanel";
import { Toast, useToast } from "@/components/Toast";
import type {
  AlternativesResponse,
  DraftResponse,
  OutlineResponse,
  StatusResponse,
} from "@/lib/ai/schemas";
import { errorMessage, postJSON } from "@/lib/api";
import { newId, useProject } from "@/lib/project";
import type { Step } from "@/lib/types";

type Request = { status: "idle" | "loading" | "error"; error?: string };
const IDLE: Request = { status: "idle" };
const RABBIT_IDLE: RabbitState = { status: "idle", alternatives: [] };
const ALTERNATIVES_PER_ROUND = 4;

export default function Home() {
  const { project, dispatch, hydrated, saveFailed } = useProject();
  const { toast, show } = useToast();

  const [ai, setAi] = useState<StatusResponse | null>(null);
  const [outlineReq, setOutlineReq] = useState<Request>(IDLE);
  const [draftReq, setDraftReq] = useState<Request>(IDLE);
  const [rabbitCellId, setRabbitCellId] = useState<string | null>(null);
  const [rabbit, setRabbit] = useState<RabbitState>(RABBIT_IDLE);
  // Each kind of request keeps a counter so a slow, superseded reply is ignored.
  const latest = useRef({ outline: 0, draft: 0, rabbit: 0 });

  useEffect(() => {
    fetch("/api/status")
      .then((response) => (response.ok ? response.json() : null))
      .then((status: StatusResponse | null) => setAi(status))
      .catch(() => setAi(null));
  }, []);

  const { idea, attributes, outline, cells, step } = project;
  const hasIdea = idea.trim().length > 0;
  const title = outline?.title ?? "";

  const goTo = (next: Step) => dispatch({ type: "setStep", step: next });

  const canVisit = (target: Step) => {
    if (target === "idea") return true;
    if (target === "style") return hasIdea;
    if (target === "outline") return outline !== null || outlineReq.status !== "idle";
    return cells.length > 0 || draftReq.status !== "idle";
  };

  /* ---------- Outline ---------- */

  const generateOutline = async () => {
    const id = ++latest.current.outline;
    goTo("outline");
    setOutlineReq({ status: "loading" });
    try {
      const result = await postJSON<OutlineResponse>("/api/outline", { idea, attributes });
      if (id !== latest.current.outline) return;
      dispatch({
        type: "setOutline",
        outline: {
          title: result.outline.title,
          sections: result.outline.sections.map((s) => ({ id: newId(), ...s })),
        },
      });
      setOutlineReq(IDLE);
    } catch (error) {
      if (id !== latest.current.outline) return;
      setOutlineReq({ status: "error", error: errorMessage(error) });
    }
  };

  /* ---------- Draft cells ---------- */

  const generateDrafts = async () => {
    if (!outline) return;
    const sections = outline.sections
      .filter((s) => s.heading.trim() || s.intent.trim())
      .map((s, i) => ({ heading: s.heading.trim() || `Section ${i + 1}`, intent: s.intent.trim() }));
    if (sections.length === 0) {
      show("Give at least one section a heading first.", "error");
      return;
    }
    if (
      cells.some((c) => c.text.trim()) &&
      !window.confirm("Drafting again replaces the cells you have now. Continue?")
    ) {
      return;
    }

    const id = ++latest.current.draft;
    goTo("cells");
    setDraftReq({ status: "loading" });
    try {
      const result = await postJSON<DraftResponse>("/api/draft", {
        idea,
        attributes,
        outline: { title: outline.title, sections },
      });
      if (id !== latest.current.draft) return;
      dispatch({
        type: "setCells",
        cells: result.paragraphs.map((text, i) => ({
          id: newId(),
          heading: sections[i]?.heading ?? "",
          text,
          history: [],
        })),
      });
      setDraftReq(IDLE);
    } catch (error) {
      if (id !== latest.current.draft) return;
      setDraftReq({ status: "error", error: errorMessage(error) });
    }
  };

  /* ---------- Rabbit hole ---------- */

  const rabbitIndex = cells.findIndex((c) => c.id === rabbitCellId);
  const rabbitCell = rabbitIndex === -1 ? null : cells[rabbitIndex];

  const loadAlternatives = async (cellId: string, avoid: string[]) => {
    const index = cells.findIndex((c) => c.id === cellId);
    const cell = cells[index];
    if (!cell) return;
    const id = ++latest.current.rabbit;
    setRabbit({ status: "loading", alternatives: [] });
    try {
      const result = await postJSON<AlternativesResponse>("/api/alternatives", {
        paragraph: cell.text,
        context: {
          idea: idea.slice(0, 8000),
          title: title.slice(0, 200),
          heading: cell.heading.slice(0, 200),
          before: (cells[index - 1]?.text ?? "").slice(0, 6000),
          after: (cells[index + 1]?.text ?? "").slice(0, 6000),
        },
        attributes,
        n: ALTERNATIVES_PER_ROUND,
        avoid: avoid.slice(-8),
      });
      if (id !== latest.current.rabbit) return;
      setRabbit({ status: "idle", alternatives: result.alternatives });
    } catch (error) {
      if (id !== latest.current.rabbit) return;
      setRabbit({ status: "error", alternatives: [], error: errorMessage(error) });
    }
  };

  const openRabbitHole = (cellId: string) => {
    setRabbitCellId(cellId);
    void loadAlternatives(cellId, []);
  };

  const closeRabbitHole = () => {
    latest.current.rabbit++;
    setRabbitCellId(null);
    setRabbit(RABBIT_IDLE);
  };

  /* ---------- Cells ---------- */

  const blankCell = () => ({ id: newId(), heading: "", text: "", history: [] });

  const deleteCell = (id: string) => {
    const cell = cells.find((c) => c.id === id);
    if (cell?.text.trim() && !window.confirm("Delete this cell and its text?")) return;
    dispatch({ type: "deleteCell", id });
  };

  const duplicateCell = (id: string) => {
    const cell = cells.find((c) => c.id === id);
    if (!cell) return;
    dispatch({ type: "insertCell", afterId: id, cell: { ...cell, id: newId(), history: [] } });
  };

  const startOver = () => {
    const hasWork = hasIdea || outline !== null || cells.length > 0;
    if (hasWork && !window.confirm("Start a new project? This clears the current one.")) return;
    latest.current.outline++;
    latest.current.draft++;
    setOutlineReq(IDLE);
    setDraftReq(IDLE);
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
          No AI provider is configured, so generating won&apos;t work yet. Copy{" "}
          <code>.env.example</code> to <code>.env.local</code>, set <code>AI_API_KEY</code> and{" "}
          <code>AI_MODEL</code>, then restart the server.
        </p>
      )}
      {ai?.provider === "mock" && (
        <p className="notice">
          Mock AI is on: outlines, drafts and alternatives are canned placeholder text. Set a real
          provider in <code>.env.local</code> to get actual writing.
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
                sub="Drag the corners of the shape, or set exact values. Every draft and rewrite follows these."
              />
              <StylePanel
                attributes={attributes}
                onChange={(id, value) => dispatch({ type: "setAttribute", id, value })}
                onReset={() => dispatch({ type: "resetAttributes" })}
              />
              <div className="step-nav">
                <button type="button" className="btn btn-quiet" onClick={() => goTo("idea")}>
                  <ArrowLeft size={15} aria-hidden /> Idea
                </button>
                <div className="step-nav-group">
                  {outline && (
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
                    {outline ? "Regenerate outline" : "Generate outline"}{" "}
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
                title="Shape the outline"
                sub="Each section becomes one paragraph cell. Rename, reorder, add or remove before drafting."
              />
              {outlineReq.status === "loading" && <Loading label="Outlining your idea…" lines={5} />}
              {outlineReq.status === "error" && (
                <ErrorNotice
                  message={outlineReq.error ?? "Could not generate an outline."}
                  onRetry={generateOutline}
                />
              )}
              {outlineReq.status !== "loading" && outline && (
                <OutlineEditor outline={outline} dispatch={dispatch} />
              )}
              {outlineReq.status === "idle" && !outline && (
                <p className="empty">No outline yet. Generate one from your idea and style.</p>
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
                    <RotateCw size={14} aria-hidden /> {outline ? "Regenerate" : "Generate outline"}
                  </button>
                  {cells.length > 0 && (
                    <button type="button" className="btn" onClick={() => goTo("cells")}>
                      Back to cells
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={!outline || outlineReq.status === "loading" || draftReq.status === "loading"}
                    onClick={generateDrafts}
                  >
                    {cells.length > 0 ? "Draft again" : "Draft the cells"}{" "}
                    <ArrowRight size={15} aria-hidden />
                  </button>
                </div>
              </div>
            </>
          )}

          {step === "cells" && (
            <>
              <StepHeader
                number="04"
                name="cells"
                title="Work the draft"
                sub="Edit any paragraph, drag to reorder, or open a rabbit hole to see other ways to say it."
              />
              {draftReq.status === "loading" ? (
                <Loading label="Drafting a paragraph for each section…" lines={8} />
              ) : (
                <>
                  {draftReq.status === "error" && (
                    <ErrorNotice
                      message={draftReq.error ?? "Could not draft the cells."}
                      onRetry={generateDrafts}
                    />
                  )}
                  <input
                    className="title-input title-input-doc prose"
                    value={title}
                    placeholder="Untitled"
                    aria-label="Title"
                    onChange={(event) => dispatch({ type: "setTitle", title: event.target.value })}
                  />
                  {cells.length === 0 && draftReq.status === "idle" && (
                    <p className="empty">No cells yet. Add one, or draft them from the outline.</p>
                  )}
                  <CellList
                    cells={cells}
                    activeCellId={rabbitCellId}
                    onMove={(activeId, overId) => dispatch({ type: "moveCell", activeId, overId })}
                    onText={(id, text) => dispatch({ type: "updateCell", id, patch: { text } })}
                    onHeading={(id, heading) => dispatch({ type: "updateCell", id, patch: { heading } })}
                    onRabbitHole={openRabbitHole}
                    onUndo={(id) => dispatch({ type: "undoCell", id })}
                    onDuplicate={duplicateCell}
                    onAddBelow={(id) => dispatch({ type: "insertCell", afterId: id, cell: blankCell() })}
                    onDelete={deleteCell}
                  />
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
                <button type="button" className="btn btn-quiet" onClick={() => goTo("outline")}>
                  <ArrowLeft size={15} aria-hidden /> Outline
                </button>
                <ExportButton title={title} cells={cells} onResult={show} />
              </div>
            </>
          )}
        </main>
      )}

      <RabbitHolePanel
        cell={rabbitCell}
        cellNumber={rabbitIndex + 1}
        state={rabbit}
        onClose={closeRabbitHole}
        onPick={(text) => {
          if (!rabbitCell) return;
          dispatch({ type: "swapCellText", id: rabbitCell.id, text });
        }}
        onMore={() => rabbitCell && void loadAlternatives(rabbitCell.id, rabbit.alternatives)}
        onRestore={(index) => {
          if (!rabbitCell) return;
          dispatch({ type: "restoreCell", id: rabbitCell.id, index });
        }}
      />

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
