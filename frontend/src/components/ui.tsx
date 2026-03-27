import type { ReactNode } from "react";

export function StatCard(props: { label: string; value: string; caption: string }) {
  const { label, value, caption } = props;

  return (
    <div className="surface-stat rounded-[1.7rem] px-5 py-5">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">{label}</p>
      <p className="mt-4 font-display text-3xl tracking-tight text-slate-50">{value}</p>
      <p className="mt-2 text-sm text-slate-400">{caption}</p>
    </div>
  );
}

export function StatusChip(props: { active: boolean; children: ReactNode }) {
  const { active, children } = props;

  return (
    <span
      className={[
        "inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]",
        active
          ? "border border-emerald-400/30 bg-emerald-400/12 text-emerald-200"
          : "border border-rose-400/30 bg-rose-400/12 text-rose-200"
      ].join(" ")}
    >
      {children}
    </span>
  );
}

export function EmptyState(props: { title: string; description: string }) {
  const { title, description } = props;

  return (
    <div className="rounded-[1.7rem] border border-dashed border-white/10 bg-white/[0.025] px-4 py-10 text-center">
      <p className="font-display text-2xl tracking-tight text-slate-50">{title}</p>
      <p className="mt-2 text-sm text-slate-400">{description}</p>
    </div>
  );
}

export function Field(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
}) {
  const { label, value, onChange, placeholder, type = "text" } = props;

  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-300">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="surface-input w-full rounded-[1.2rem] px-4 py-3 text-sm outline-none transition"
      />
    </label>
  );
}

export function MetricPill(props: { label: string; value: string }) {
  const { label, value } = props;

  return (
    <div className="surface-chip rounded-full px-4 py-2">
      <span className="text-xs uppercase tracking-[0.18em] text-slate-400">{label}</span>
      <span className="ml-2 font-semibold text-slate-100">{value}</span>
    </div>
  );
}

export function MetricPanel(props: { title: string; value: string; subtitle: string }) {
  const { title, value, subtitle } = props;

  return (
    <div className="surface-card rounded-2xl p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{title}</p>
      <p className="mt-3 font-display text-3xl tracking-tight text-slate-50">{value}</p>
      <p className="mt-2 text-xs text-slate-400">{subtitle}</p>
    </div>
  );
}
