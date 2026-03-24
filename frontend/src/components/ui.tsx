import type { ReactNode } from "react";

export function StatCard(props: { label: string; value: string; caption: string }) {
  const { label, value, caption } = props;

  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/90 px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-3 font-display text-3xl tracking-tight text-slate-950">{value}</p>
      <p className="mt-2 text-sm text-slate-500">{caption}</p>
    </div>
  );
}

export function StatusChip(props: { active: boolean; children: ReactNode }) {
  const { active, children } = props;

  return (
    <span
      className={[
        "inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]",
        active ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-700"
      ].join(" ")}
    >
      {children}
    </span>
  );
}

export function EmptyState(props: { title: string; description: string }) {
  const { title, description } = props;

  return (
    <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50/80 px-4 py-10 text-center">
      <p className="font-display text-2xl tracking-tight text-slate-900">{title}</p>
      <p className="mt-2 text-sm text-slate-600">{description}</p>
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
      <span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-400 focus:bg-white focus:ring-4 focus:ring-teal-100"
      />
    </label>
  );
}

export function MetricPill(props: { label: string; value: string }) {
  const { label, value } = props;

  return (
    <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
      <span className="text-xs uppercase tracking-[0.18em] text-slate-400">{label}</span>
      <span className="ml-2 font-semibold text-white">{value}</span>
    </div>
  );
}

export function MetricPanel(props: { title: string; value: string; subtitle: string }) {
  const { title, value, subtitle } = props;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{title}</p>
      <p className="mt-3 font-display text-3xl tracking-tight text-white">{value}</p>
      <p className="mt-2 text-xs text-slate-400">{subtitle}</p>
    </div>
  );
}
