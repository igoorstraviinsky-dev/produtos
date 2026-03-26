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

  return (
    <section className="space-y-6">
      <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
        <div className="flex flex-col gap-5 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-700">
              Custos
            </p>
            <h2 className="mt-2 font-display text-4xl tracking-tight text-slate-950">
              Calculadora de custo da mercadoria
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Formula aplicada: `(Mao de Obra + Prata Internacional) = R1`, `R1 + Taxa ZF = R2`, `R2 + Transporte = R3`, `R3 x Dolar = Custo Final`.
              A mao de obra original vem em dolar no produto, e abaixo ela e convertida automaticamente para real pela cotacao informada no topo.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800">
              {autosaveLabel}
            </div>
            <button
              type="button"
              onClick={onOpenHistory}
              className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Ver historico
            </button>
            <button
              type="button"
              onClick={onRefresh}
              className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Atualizar produtos
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Prata internacional por grama
            </span>
            <input
              value={variables.silverPricePerGram}
              onChange={(event) => onVariableChange("silverPricePerGram", event.target.value)}
              className="w-full rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-100"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Taxa ZF (%)
            </span>
            <input
              value={variables.zonaFrancaRatePercent}
              onChange={(event) => onVariableChange("zonaFrancaRatePercent", event.target.value)}
              className="w-full rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-100"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Transporte
            </span>
            <input
              value={variables.transportFee}
              onChange={(event) => onVariableChange("transportFee", event.target.value)}
              className="w-full rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-100"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Dolar
            </span>
            <input
              value={variables.dollarRate}
              onChange={(event) => onVariableChange("dollarRate", event.target.value)}
              className="w-full rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-100"
            />
          </label>
        </div>
      </section>

      {costSettingsState === "loading" ? (
        <p className="text-sm text-slate-500">
          Carregando parametros persistidos do backend...
        </p>
      ) : null}
      {costSettingsSaveState === "error" ? (
        <p className="text-sm text-rose-600">
          Nao foi possivel salvar os parametros automaticamente.
        </p>
      ) : null}

      <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
        <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-700">
              Atualizacoes
            </p>
            <h3 className="mt-2 font-display text-3xl tracking-tight text-slate-950">
              Historico recente das variaveis
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              Visualize as ultimas alteracoes de prata, taxa ZF, transporte e dolar aplicadas na calculadora.
            </p>
          </div>
        </div>

        {costHistoryState === "loading" ? (
          <p className="mt-4 text-sm text-slate-500">Carregando historico...</p>
        ) : null}
        {costHistoryState === "error" ? (
          <p className="mt-4 text-sm text-rose-600">Nao foi possivel carregar o historico.</p>
        ) : null}
        {costHistoryState === "success" && costHistoryEntries.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">Nenhuma alteracao registrada ainda.</p>
        ) : null}
        {costHistoryEntries.length > 0 ? (
          <div className="mt-5 grid gap-3 lg:grid-cols-3">
            {costHistoryEntries.slice(0, 3).map((entry) => (
              <article
                key={entry.id}
                className="rounded-[1.5rem] border border-slate-200 bg-slate-50/80 px-4 py-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-2">
                    {entry.changedFields.map((field) => (
                      <span
                        key={field}
                        className="rounded-full bg-cyan-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-800"
                      >
                        {formatHistoryField(field)}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs font-medium text-slate-500">
                    {formatHistoryDate(entry.createdAt)}
                  </p>
                </div>

                <div className="mt-4 space-y-2 text-sm text-slate-700">
                  {entry.changedFields.map((field) => (
                    <p key={field}>
                      <span className="font-semibold text-slate-950">{formatHistoryField(field)}:</span>{" "}
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

      <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
        <div className="overflow-hidden rounded-[1.75rem] border border-slate-200">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left">
              <thead className="bg-slate-50/80 text-xs uppercase tracking-[0.16em] text-slate-500">
                <tr>
                  <th className="px-4 py-4 font-semibold">Produto</th>
                  <th className="px-4 py-4 font-semibold">Peso (g)</th>
                  <th className="px-4 py-4 font-semibold">Mao de obra (USD)</th>
                  <th className="px-4 py-4 font-semibold">Mao de obra (BRL)</th>
                  <th className="px-4 py-4 font-semibold">Prata</th>
                  <th className="px-4 py-4 font-semibold">Custo Final</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {products.map((product) => {
                  const weightGrams = parseNumericValue(product.weightGrams);

                  return (
                    <tr key={product.id} className="align-top hover:bg-slate-50/80">
                      <td className="px-4 py-4">
                        <div className="max-w-[300px]">
                          <p className="font-semibold text-slate-950">{product.name}</p>
                          <p className="mt-1 text-xs text-slate-500">{product.serialNumber}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">
                        {formatNumber(weightGrams)}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">
                        {formatNumber(product.costBreakdown.laborCostUsd)}
                      </td>
                      <td className="px-4 py-4">
                        <div className="min-w-[180px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900">
                          {formatCurrency(product.costBreakdown.laborCostBrl)}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">
                        {formatCurrency(product.costBreakdown.silverCost)}
                      </td>
                      <td className="px-4 py-4">
                        <div className="inline-flex rounded-full bg-cyan-50 px-3 py-1 text-sm font-semibold text-cyan-800">
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
          <p className="mt-4 text-sm text-slate-500">Carregando produtos para calcular custos...</p>
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
