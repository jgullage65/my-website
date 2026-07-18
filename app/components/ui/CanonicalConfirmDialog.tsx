"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

type ConfirmDialogState = {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  confirmDisabled: boolean;
  resolve: (confirmed: boolean) => void;
} | null;

type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmDisabled?: boolean;
};

function CanonicalConfirmDialog({
  dialog,
  onClose,
}: {
  dialog: NonNullable<ConfirmDialogState>;
  onClose: (confirmed: boolean) => void;
}) {
  const node = (
    <div
      className="fixed inset-0 z-[240] flex items-center justify-center bg-slate-950/82 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="canonical-confirm-title"
    >
      <div className="relative flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-[24px] border border-[rgba(245,158,11,0.22)] bg-[#030713] shadow-[0_26px_70px_rgba(0,0,0,0.48)]">
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/70 to-transparent" />
        <div className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-[rgba(245,158,11,0.14)] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-10 -left-8 h-24 w-24 rounded-full bg-[rgba(245,158,11,0.08)] blur-3xl" />

        <button
          type="button"
          onClick={() => onClose(false)}
          aria-label="Close"
          className="absolute right-3 top-3 z-20 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[rgba(245,158,11,0.28)] bg-[#030713] text-[var(--gold)] transition hover:bg-[rgba(245,158,11,0.12)] focus:outline-none focus:ring-2 focus:ring-amber-300/50"
        >
          ×
        </button>

        <div className="relative z-10 min-h-0 flex-1 overflow-y-auto px-5 pt-5">
          <h3
            id="canonical-confirm-title"
            className="whitespace-pre-line pr-10 text-lg font-semibold text-white"
          >
            {dialog.title}
          </h3>
          <p className="mt-4 whitespace-pre-line text-sm leading-6 text-slate-200">
            {dialog.message}
          </p>
        </div>

        <div className="relative z-10 flex justify-end gap-2 px-5 pb-5 pt-5">
          <button
            type="button"
            onClick={() => onClose(false)}
            className="rounded-lg border border-[rgba(245,158,11,0.22)] bg-[#030713] px-3 py-1.5 text-sm font-semibold text-slate-100 transition hover:border-amber-300/40"
          >
            {dialog.cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => onClose(true)}
            disabled={dialog.confirmDisabled}
            className="rounded-lg border border-[rgba(245,158,11,0.22)] bg-[#030713] px-3 py-1.5 text-sm font-semibold text-slate-100 transition hover:border-amber-300/40 hover:text-[var(--gold)] disabled:cursor-not-allowed disabled:border-white/10 disabled:text-slate-500 disabled:hover:border-white/10 disabled:hover:text-slate-500"
          >
            {dialog.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(node, document.body);
}

export function useCanonicalConfirm() {
  const [dialog, setDialog] = useState<ConfirmDialogState>(null);

  function showConfirm(options: ConfirmOptions) {
    return new Promise<boolean>((resolve) => {
      setDialog({
        title: options.title,
        message: options.message,
        confirmLabel: options.confirmLabel ?? "Delete",
        cancelLabel: options.cancelLabel ?? "Cancel",
        confirmDisabled: options.confirmDisabled ?? false,
        resolve,
      });
    });
  }

  function closeConfirm(confirmed: boolean) {
    if (!dialog) return;

    if (confirmed && dialog.confirmDisabled) {
      return;
    }

    setDialog(null);
    dialog.resolve(confirmed);
  }

  const confirmDialogNode = dialog ? (
    <CanonicalConfirmDialog dialog={dialog} onClose={closeConfirm} />
  ) : null;

  return { showConfirm, confirmDialogNode };
}