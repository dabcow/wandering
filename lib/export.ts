/**
 * Older copy path: answer the browser's own copy event with our data. Works
 * where the async Clipboard API is missing or refused (plain-HTTP pages,
 * embedded browsers) and still carries the formatting.
 */
function copyViaEvent(html: string, plain: string): boolean {
  const onCopy = (event: ClipboardEvent) => {
    event.clipboardData?.setData("text/html", html);
    event.clipboardData?.setData("text/plain", plain);
    event.preventDefault();
  };
  document.addEventListener("copy", onCopy);
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    document.removeEventListener("copy", onCopy);
  }
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Put rich text (plus a plain-text twin) on the clipboard so Google Docs keeps
 * headings and paragraphs. Throws if the browser allows neither copy path.
 */
export async function copyRichText(html: string, plain: string): Promise<void> {
  if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([plain], { type: "text/plain" }),
        }),
      ]);
      return;
    } catch {
      // Fall through to the event-based copy.
    }
  }
  if (!copyViaEvent(html, plain)) throw new Error("Clipboard unavailable");
}
