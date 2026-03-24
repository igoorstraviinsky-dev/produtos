type ToggleProps = {
  checked: boolean;
  disabled?: boolean;
  onChange: (nextValue: boolean) => void;
};

export function Toggle({ checked, disabled, onChange }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        "relative inline-flex h-8 w-14 items-center rounded-full border transition",
        checked
          ? "border-emerald-500 bg-emerald-500/90"
          : "border-slate-300 bg-slate-200",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
      ].join(" ")}
    >
      <span
        className={[
          "inline-block h-6 w-6 rounded-full bg-white shadow-sm transition",
          checked ? "translate-x-7" : "translate-x-1"
        ].join(" ")}
      />
    </button>
  );
}
