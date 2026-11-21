import { RotateCw, TriangleAlert } from "lucide-react";

/** Placeholder shown while the model is working. */
export function Loading({ label, lines = 4 }: { label: string; lines?: number }) {
  return (
    <div className="loading" role="status" aria-live="polite">
      <p className="loading-label">
        <span className="spinner" aria-hidden /> {label}
      </p>
      <div aria-hidden>
        {Array.from({ length: lines }, (_, i) => (
          <div key={i} className="skeleton" style={{ width: `${92 - ((i * 17) % 40)}%` }} />
        ))}
      </div>
    </div>
  );
}

/** An error with a way to try again. */
export function ErrorNotice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="error-notice" role="alert">
      <TriangleAlert size={16} aria-hidden />
      <p>{message}</p>
      {onRetry && (
        <button type="button" className="btn" onClick={onRetry}>
          <RotateCw size={14} aria-hidden /> Retry
        </button>
      )}
    </div>
  );
}
