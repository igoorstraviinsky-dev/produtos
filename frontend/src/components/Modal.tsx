import type { PropsWithChildren, ReactNode } from "react";

type ModalProps = PropsWithChildren<{
  open: boolean;
  title: string;
  description?: string;
  actions?: ReactNode;
  onClose: () => void;
}>;

export function Modal({ open, title, description, actions, onClose, children }: ModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/72 p-4 backdrop-blur-md">
      <div className="surface-modal w-full max-w-xl overflow-hidden rounded-[2rem]">
        <div className="surface-divider border-b px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-display text-2xl tracking-tight text-slate-50">{title}</p>
              {description ? (
                <p className="mt-2 text-sm leading-7 text-slate-400">{description}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="surface-button-secondary inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-200 transition"
            >
              x
            </button>
          </div>
        </div>
        <div className="px-6 py-5">{children}</div>
        {actions ? (
          <div className="surface-divider flex flex-wrap items-center justify-end gap-3 border-t bg-white/[0.02] px-6 py-4">
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  );
}
