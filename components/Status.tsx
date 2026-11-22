import { RotateCw, TriangleAlert } from "lucide-react";
import { CheshireLoader } from "./CheshireLoader";

/** Shown while the model is working: the Cheshire cat wanders by while it thinks. */
export function Loading({ label }: { label: string }) {
  return (
    <div className="loading" role="status" aria-live="polite">
      <p className="loading-label">
        <span className="spinner" aria-hidden /> {label}
      </p>
      <CheshireLoader />
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
