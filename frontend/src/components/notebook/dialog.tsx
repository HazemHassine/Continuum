"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { Paper } from "./sketch";

export function NotebookDialog({
  title,
  children,
  onClose,
  wide = false,
  closeDisabled = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  closeDisabled?: boolean;
}) {
  const titleId = useId();
  const ref = useRef<HTMLDialogElement>(null);
  const close = useRef(() => {});
  close.current = () => {
    if (!closeDisabled) onClose();
  };
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    dialog.querySelector<HTMLElement>(
      "[data-dialog-autofocus], input:not([disabled]), textarea:not([disabled]), select:not([disabled])",
    )?.focus();
    const cancel = (event: Event) => {
      event.preventDefault();
      close.current();
    };
    dialog.addEventListener("cancel", cancel);
    return () => {
      dialog.removeEventListener("cancel", cancel);
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`notebook-dialog ${wide ? "wide" : ""}`}
      aria-labelledby={titleId}
      aria-busy={closeDisabled}
      onClick={(event) => {
        if (event.target === event.currentTarget) close.current();
      }}
    >
      <Paper className="dialog-paper">
        <div className="dialog-heading">
          <div>
            <h2 id={titleId}>{title}</h2>
          </div>
          <button
            className="icon-button"
            aria-label="Close dialog"
            type="button"
            disabled={closeDisabled}
            onClick={() => close.current()}
          >
            <X size={19} />
          </button>
        </div>
        {children}
      </Paper>
    </dialog>
  );
}
