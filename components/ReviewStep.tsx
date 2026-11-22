"use client";

import {
  ArrowLeft,
  ClipboardCopy,
  Download,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import { useMemo, useState, type Dispatch } from "react";
import { countWords, sectionStatus } from "@/lib/doc";
import { copyRichText } from "@/lib/export";
import { exportTelling, type ExportFormat } from "@/lib/exporters";
import { manuscriptBlocks, tellingOrder, toHtml, toPlainText } from "@/lib/manuscript";
import type { Action } from "@/lib/project";
import { firstLeafUnder, leavesOf, pathTo } from "@/lib/tree";
import type { Plot, PlotNode, Project } from "@/lib/types";
import { TreeGraph } from "./TreeGraph";

type Props = {
  project: Project;
  dispatch: Dispatch<Action>;
  onToast: (message: string, kind?: "ok" | "error") => void;
  onBack: () => void;
};

const FORMATS: { format: ExportFormat; label: string; title: string }[] = [
  { format: "docx", label: "Word", title: "Word document (.docx)" },
  { format: "pdf", label: "PDF", title: "PDF (.pdf)" },
  { format: "md", label: "Markdown", title: "Markdown (.md)" },
  { format: "txt", label: "Text", title: "Plain text (.txt)" },
  { format: "html", label: "HTML", title: "Web page (.html)" },
];

/**
 * Step 4: the finished text of the chosen branch, laid out as one piece with
 * no plot point headings, beside the story map. The plot points picked out in
 * the map are the ones whose writing is shown and exported.
 */
export function ReviewStep({ project, dispatch, onToast, onBack }: Props) {
  const { nodes, guideRail, links, bPlot, activeLeaf, intro, sections, title } = project;
  const [panelOpen, setPanelOpen] = useState(true);
  const [includeB, setIncludeB] = useState(true);
  const [busy, setBusy] = useState<ExportFormat | null>(null);

  const leaves = useMemo(() => ({ main: leavesOf(nodes, "main"), b: leavesOf(nodes, "b") }), [nodes]);
  // The branch chosen here (shared with the Write step), or the first one.
  const leafId = (plot: Plot): string | null => {
    const saved = activeLeaf[plot];
    if (saved && leaves[plot].some((n) => n.id === saved)) return saved;
    return leaves[plot][0]?.id ?? null;
  };
  const mainLeaf = leafId("main");
  const bLeaf = includeB ? leafId("b") : null;

  const order = useMemo(
    () => tellingOrder(mainLeaf ? pathTo(nodes, mainLeaf) : [], bLeaf ? pathTo(nodes, bLeaf) : []),
    [nodes, mainLeaf, bLeaf],
  );
  const chosen = useMemo(() => new Set(order), [order]);
  const blocks = useMemo(() => manuscriptBlocks(intro, sections, order), [intro, sections, order]);
  const html = useMemo(() => toHtml(blocks), [blocks]);
  const words = useMemo(() => countWords(blocks), [blocks]);
  const status = useMemo(() => sectionStatus(sections), [sections]);

  /** Pick the branch through a plot point: it and the plot points before and after it are told. */
  const choose = (node: PlotNode) => {
    const leaf = firstLeafUnder(nodes, node.id)?.id ?? node.id;
    dispatch({ type: "setActiveLeaf", plot: node.plot, id: leaf });
    if (node.plot === "b") setIncludeB(true);
  };

  const download = async (format: ExportFormat) => {
    if (blocks.length === 0) {
      onToast("Nothing is written on these plot points yet.", "error");
      return;
    }
    setBusy(format);
    try {
      await exportTelling(format, blocks, title);
    } catch (error) {
      console.error("[export]", error);
      onToast("That file couldn't be made. Try again, or try another format.", "error");
    } finally {
      setBusy(null);
    }
  };

  const copy = async () => {
    if (blocks.length === 0) {
      onToast("Nothing is written on these plot points yet.", "error");
      return;
    }
    const heading = title.trim();
    try {
      await copyRichText(`${heading ? `<h1>${heading.replace(/</g, "&lt;")}</h1>` : ""}${html}`, toPlainText(blocks, heading));
      onToast("Copied. Paste it into Google Docs.");
    } catch {
      onToast("Couldn't reach the clipboard. Check the browser's permission and try again.", "error");
    }
  };

  return (
    <>
      <div className={`write${panelOpen ? "" : " is-wide"}`}>
        <div className="write-main">
          <div className="write-bar review-bar" role="toolbar" aria-label="Export">
            <span className="review-bar-label">
              <Download size={14} aria-hidden /> Download
            </span>
            {FORMATS.map(({ format, label, title: name }) => (
              <button
                key={format}
                type="button"
                className="btn btn-quiet"
                title={name}
                aria-label={`Download as ${name}`}
                disabled={busy !== null}
                onClick={() => void download(format)}
              >
                {busy === format ? "Making…" : label}
              </button>
            ))}
            <span className="write-bar-gap" />
            <span className="review-words">
              {words.toLocaleString()} word{words === 1 ? "" : "s"}
            </span>
            <button
              type="button"
              className="btn btn-quiet"
              aria-expanded={panelOpen}
              onClick={() => setPanelOpen(!panelOpen)}
            >
              {panelOpen ? <PanelRightClose size={15} aria-hidden /> : <PanelRightOpen size={15} aria-hidden />}
              {panelOpen ? "Hide map" : "Show map"}
            </button>
          </div>

          <article className="page review-page" aria-label="The story">
            {title.trim() && <h1 className="review-title">{title.trim()}</h1>}
            {blocks.length > 0 ? (
              // Built from the writer's own text by toHtml, which escapes every piece of it.
              <div className="writer prose review-text" dangerouslySetInnerHTML={{ __html: html }} />
            ) : (
              <p className="page-hint">
                Nothing is written on these plot points yet. Write under them in step 3, or choose another branch
                in the story map.
              </p>
            )}
          </article>
        </div>

        {panelOpen && (
          <aside className="write-side panel" aria-label="The plot tree">
            <h2>Beats in the text</h2>
            <p className="hint">
              The highlighted plot points are the ones whose writing is shown and exported. Click any plot point to
              tell its branch instead.
            </p>
            {bPlot !== null && leaves.b.length > 0 && (
              <label className="check">
                <input type="checkbox" checked={includeB} onChange={(event) => setIncludeB(event.target.checked)} />
                Weave in the subplot
              </label>
            )}

            <TreeGraph
              compact
              vertical
              nodes={nodes}
              beats={guideRail}
              links={links}
              showB={bPlot !== null}
              highlight={chosen}
              status={status}
              onSelect={choose}
            />

            <p className="legend">
              <span className="node-dot" aria-hidden /> not written yet
              <span className="node-dot has-text" aria-hidden /> written
            </p>
          </aside>
        )}
      </div>

      <div className="step-nav">
        <button type="button" className="btn btn-quiet" onClick={onBack}>
          <ArrowLeft size={15} aria-hidden /> Write
        </button>
        <button type="button" className="btn btn-primary" onClick={() => void copy()}>
          <ClipboardCopy size={15} aria-hidden /> Copy for Google Docs
        </button>
      </div>
    </>
  );
}
