import type { CostSettingsHistoryEntry, Product } from "../types";

function parseNumericValue(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const normalized = value.replace(",", ".").trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

function formatHistoryField(field: string) {
  switch (field) {
    case "silverPricePerGram":
      return "Prata";
    case "zonaFrancaRatePercent":
      return "Taxa ZF";
    case "transportFee":
      return "Transporte";
    case "dollarRate":
      return "Dolar";
    default:
      return field;
  }
}

function formatHistoryDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

type CostCalculatorPageProps = {
  companyName?: string;
  products: Product[];
  productsState: "idle" | "loading" | "success" | "error";
  costSettingsState: "idle" | "loading" | "success" | "error";
  costSettingsSaveState: "idle" | "saving" | "saved" | "error";
  costHistoryEntries: CostSettingsHistoryEntry[];
  costHistoryState: "idle" | "loading" | "success" | "error";
  variables: {
    silverPricePerGram: string;
    zonaFrancaRatePercent: string;
    transportFee: string;
    dollarRate: string;
  };
  onVariableChange: (
    field:
      | "silverPricePerGram"
      | "zonaFrancaRatePercent"
      | "transportFee"
      | "dollarRate",
    value: string
  ) => void;
  onOpenHistory: () => void;
  onRefresh: () => void;
};

export function CostCalculatorPage(props: CostCalculatorPageProps) {
  const {
    companyName,
    products,
    productsState,
    costSettingsState,
    costSettingsSaveState,
    costHistoryEntries,
    costHistoryState,
    variables,
    onVariableChange,
    onOpenHistory,
    onRefresh
  } = props;

  const autosaveLabel =
    costSettingsSaveState === "saving"
      ? "Salvando automaticamente..."
      : costSettingsSaveState === "saved"
        ? "Parametros salvos automaticamente"
        : costSettingsSaveState === "error"
          ? "Erro ao salvar automaticamente"
          : "Salvamento automatico ativo";
  const previewProducts = products.slice(0, 1);

  return (
    <section className="space-y-6">
      <section className="surface-panel rounded-[2rem] p-6">
        <div className="surface-divider flex flex-col gap-5 border-b pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="surface-kicker">
              {companyName ? "Custos da Empresa" : "Custos"}
            </p>
            <h2 className="mt-2 font-display text-4xl tracking-tight text-slate-50">
              {companyName
                ? `Calculadora de custo da mercadoria de ${companyName}`
                : "Calculadora de custo da mercadoria"}
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-400">
              Formula aplicada: `(Mao de Obra + Prata Internacional) = R1`, `R1 + (R1 x Taxa ZF%) = R2`, `R2 + Transporte = R3`, `R3 x Dolar = Custo Final`.
              A mao de obra original continua em dolar dentro da formula e abaixo ela aparece convertida para real apenas para leitura rapida. A Taxa ZF e aplicada como percentual sobre o R1.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center rounded-full border border-emerald-400/30 bg-emerald-400/12 px-4 py-2 text-sm font-semibold text-emerald-200">
              {autosaveLabel}
            </div>
            <button
              type="button"
              onClick={onOpenHistory}
              className="surface-button-secondary inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition"
            >
              Ver historico
            </button>
            <button
              type="button"
              onClick={onRefresh}
              className="surface-button-secondary inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition"
            >
              Atualizar produtos
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-300">
              Prata internacional por grama
            </span>
            <input
              value={variables.silverPricePerGram}
              onChange={(event) => onVariableChange("silverPricePerGram", event.target.value)}
              className="surface-input w-full rounded-[1.2rem] px-4 py-3 text-sm outline-none transition"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-300">
              Taxa ZF (%)
            </span>
            <input
              value={variables.zonaFrancaRatePercent}
              onChange={(event) => onVariableChange("zonaFrancaRatePercent", event.target.value)}
              className="surface-input w-full rounded-[1.2rem] px-4 py-3 text-sm outline-none transition"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-300">
              Transporte
            </span>
            <input
              value={variables.transportFee}
              onChange={(event) => onVariableChange("transportFee", event.target.value)}
              className="surface-input w-full rounded-[1.2rem] px-4 py-3 text-sm outline-none transition"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-300">
              Dolar
            </span>
            <input
              value={variables.dollarRate}
              onChange={(event) => onVariableChange("dollarRate", event.target.value)}
              className="surface-input w-full rounded-[1.2rem] px-4 py-3 text-sm outline-none transition"
            />
          </label>
        </div>
      </section>

      {costSettingsState === "loading" ? (
        <p className="text-sm text-slate-400">
          Carregando parametros persistidos do backend...
        </p>
      ) : null}
      {costSettingsSaveState === "error" ? (
        <p className="text-sm text-rose-600">
          Nao foi possivel salvar os parametros automaticamente.
        </p>
      ) : null}

      <section className="surface-panel rounded-[2rem] p-6">
        <div className="surface-divider flex flex-col gap-3 border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="surface-kicker">
              Atualizacoes
            </p>
            <h3 className="mt-2 font-display text-3xl tracking-tight text-slate-50">
              Historico recente das variaveis
            </h3>
            <p className="mt-2 text-sm text-slate-400">
              Visualize as ultimas alteracoes de prata, taxa ZF, transporte e dolar aplicadas na calculadora.
            </p>
          </div>
        </div>

        {costHistoryState === "loading" ? (
          <p className="mt-4 text-sm text-slate-400">Carregando historico...</p>
        ) : null}
        {costHistoryState === "error" ? (
          <p className="mt-4 text-sm text-rose-600">Nao foi possivel carregar o historico.</p>
        ) : null}
        {costHistoryState === "success" && costHistoryEntries.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400">Nenhuma alteracao registrada ainda.</p>
        ) : null}
        {costHistoryEntries.length > 0 ? (
          <div className="mt-5 grid gap-3 lg:grid-cols-3">
            {costHistoryEntries.slice(0, 3).map((entry) => (
              <article
                key={entry.id}
                className="surface-card rounded-[1.5rem] px-4 py-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-2">
                    {entry.changedFields.map((field) => (
                      <span
                        key={field}
                        className="rounded-full border border-cyan-400/20 bg-cyan-400/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-100"
                      >
                        {formatHistoryField(field)}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs font-medium text-slate-500">
                    {formatHistoryDate(entry.createdAt)}
                  </p>
                </div>

                <div className="mt-4 space-y-2 text-sm text-slate-300">
                  {entry.changedFields.map((field) => (
                    <p key={field}>
                      <span className="font-semibold text-slate-50">{formatHistoryField(field)}:</span>{" "}
                      {entry.previous[field as keyof typeof entry.previous]} {"->"}{" "}
                      {entry.next[field as keyof typeof entry.next]}
                    </p>
                  ))}
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>

      <section className="surface-panel rounded-[2rem] p-6">
        <div className="overflow-hidden rounded-[1.75rem] border border-white/8">
          <div className="overflow-x-auto">
            <table className="surface-table min-w-full divide-y divide-white/8 text-left">
              <thead className="text-xs uppercase tracking-[0.16em]">
                <tr>
                  <th className="px-4 py-4 font-semibold">Produto</th>
                  <th className="px-4 py-4 font-semibold">Peso (g)</th>
                  <th className="px-4 py-4 font-semibold">Mao de obra (USD)</th>
                  <th className="px-4 py-4 font-semibold">Mao de obra (BRL)</th>
                  <th className="px-4 py-4 font-semibold">Prata</th>
                  <th className="px-4 py-4 font-semibold">Custo Final</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {previewProducts.map((product) => {
                  const weightGrams = parseNumericValue(product.weightGrams);

                  return (
                    <tr key={product.id} className="align-top">
                      <td className="px-4 py-4">
                        <div className="max-w-[300px]">
                          <p className="font-semibold text-slate-50">{product.name}</p>
                          <p className="mt-1 text-xs text-slate-500">{product.serialNumber}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-300">
                        {formatNumber(weightGrams)}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-300">
                        {formatNumber(product.costBreakdown.laborCostUsd)}
                      </td>
                      <td className="px-4 py-4">
                        <div className="surface-input min-w-[180px] rounded-xl px-3 py-2 text-sm text-slate-100">
                          {formatCurrency(product.costBreakdown.laborCostBrl)}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-300">
                        {formatCurrency(product.costBreakdown.silverCost)}
                      </td>
                      <td className="px-4 py-4">
                        <div className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/12 px-3 py-1 text-sm font-semibold text-cyan-100">
                          {formatCurrency(product.costFinal)}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {productsState === "loading" ? (
          <p className="mt-4 text-sm text-slate-400">Carregando produtos para calcular custos...</p>
        ) : null}
        {productsState === "error" ? (
          <p className="mt-4 text-sm text-rose-600">
            Nao foi possivel carregar os produtos para a calculadora.
          </p>
        ) : null}
      </section>
    </section>
  );
}
