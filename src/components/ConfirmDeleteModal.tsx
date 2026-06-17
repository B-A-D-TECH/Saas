import { useMemo } from "react";

export default function ConfirmDeleteModal({
  open,
  title,
  description,
  confirmLabel = "Supprimer",
  cancelLabel = "Annuler",
  danger = true,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const modal = useMemo(() => {
    if (!open) return null;
    return (
      <div className="modal-backdrop" role="dialog" aria-modal="true">
        <div className="modal" aria-label={title}>
          <div className="modal-header">
            <h3>{title}</h3>
            <button type="button" className="btn-secondary" onClick={onCancel}>
              {cancelLabel}
            </button>
          </div>

          <div className="modal-content">
            {description ? <p className="tagline">{description}</p> : null}
            {error ? <div className="app-banner app-banner-error" role="alert">{error}</div> : null}

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1rem", gap: "0.5rem" }}>
              <button type="button" className="btn-secondary" onClick={onCancel} disabled={busy}>
                {cancelLabel}
              </button>
              <button
                type="button"
                className={danger ? "btn-danger" : "btn-secondary"}
                onClick={onConfirm}
                disabled={busy}
              >
                {busy ? "Suppression…" : confirmLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }, [open, title, description, confirmLabel, cancelLabel, danger, busy, error, onCancel, onConfirm]);

  return modal;
}

