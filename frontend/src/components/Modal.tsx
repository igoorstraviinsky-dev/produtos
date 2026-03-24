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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl overflow-hidden rounded-[2rem] border border-white/60 bg-white shadow-[0_30px_80px_rgba(12,42,56,0.18)]">
        <div className="border-b border-slate-200/80 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-display text-2xl tracking-tight text-slate-950">{title}</p>
              {description ? (
                <p className="mt-2 text-sm text-slate-600">{description}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
            >
              x
            </button>
          </div>
        </div>
        <div className="px-6 py-5">{children}</div>
        {actions ? (
          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200/80 bg-slate-50 px-6 py-4">
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  );
}
