import type { PartnerInventoryItem } from "../types";

function formatUpdatedAt(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

type MyInventoryPageProps = {
  apiKey: string;
  inventory: PartnerInventoryItem[];
  inventoryState: "idle" | "loading" | "success" | "error";
  socketState: "disconnected" | "connecting" | "connected" | "error";
  errorMessage: string;
  toastMessage: string;
  savingProductId: string;
  draftQuantities: Record<string, string>;
  onApiKeyChange: (value: string) => void;
  onConnect: (event: React.FormEvent<HTMLFormElement>) => void;
  onRefresh: () => void;
  onDraftChange: (productId: string, value: string) => void;
  onSave: (productId: string) => void;
  onDismissToast: () => void;
};

function socketLabel(socketState: MyInventoryPageProps["socketState"]) {
  switch (socketState) {
    case "connected":
      return "Tempo real ativo";
    case "connecting":
      return "Conectando";
    case "error":
      return "Falha no socket";
    default:
      return "Nao conectado";
  }
}

function socketStyles(socketState: MyInventoryPageProps["socketState"]) {
  if (socketState === "connected") {
    return "bg-emerald-100 text-emerald-800";
  }

  if (socketState === "connecting") {
    return "bg-amber-100 text-amber-800";
  }

  if (socketState === "error") {
    return "bg-rose-100 text-rose-700";
  }

  return "bg-slate-100 text-slate-700";
}

export function MyInventoryPage(props: MyInventoryPageProps) {
  const {
    apiKey,
    inventory,
    inventoryState,
    socketState,
    errorMessage,
    toastMessage,
    savingProductId,
    draftQuantities,
    onApiKeyChange,
    onConnect,
    onRefresh,
    onDraftChange,
    onSave,
    onDismissToast
  } = props;

  const customizedCount = inventory.filter((item) => item.customStockQuantity !== null).length;
  const lowStockCount = inventory.filter((item) => item.effectiveStockQuantity <= 5).length;

  return (
    <section className="space-y-6">
      {toastMessage ? (
        <div className="rounded-[1.75rem] border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950 shadow-[0_20px_40px_rgba(245,158,11,0.12)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-semibold">{toastMessage}</p>
            <button
              type="button"
              onClick={onDismissToast}
              className="inline-flex w-fit items-center justify-center rounded-full border border-amber-300 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-amber-900 transition hover:bg-amber-100"
            >
              Fechar alerta
            </button>
          </div>
        </div>
      ) : null}

      <section className="rounded-[2rem] border border-white/70 bg-white/85 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur sm:p-6">
        <div className="flex flex-col gap-5 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">
              Meu Estoque
            </p>
            <h2 className="mt-2 font-display text-4xl tracking-tight text-slate-950">
              Estoque isolado por parceiro
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Use a API key da empresa para carregar o catalogo mestre combinado com
              a sua quantidade personalizada. Quando o Supabase sincronizar o catalogo
              principal, esta pagina recebe um alerta em tempo real.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Produtos
              </p>
              <p className="mt-3 font-display text-3xl tracking-tight text-slate-950">
                {inventory.length}
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
                Estoque baixo
              </p>
              <p className="mt-3 font-display text-3xl tracking-tight text-amber-900">
                {lowStockCount}
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                Personalizados
              </p>
              <p className="mt-3 font-display text-3xl tracking-tight text-emerald-900">
                {customizedCount}
              </p>
            </div>
          </div>
        </div>

        <form className="mt-6 grid gap-4 lg:grid-cols-[1fr_auto_auto]" onSubmit={onConnect}>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              API key do parceiro
            </span>
            <textarea
              value={apiKey}
              onChange={(event) => onApiKeyChange(event.target.value)}
              rows={3}
              placeholder="Cole aqui a API key da empresa para abrir o Meu Estoque"
              className="w-full rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-400 focus:bg-white focus:ring-4 focus:ring-teal-100"
            />
          </label>

          <button
            type="submit"
            disabled={!apiKey.trim() || inventoryState === "loading"}
            className="inline-flex items-center justify-center self-end rounded-full bg-teal-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-500 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {inventoryState === "loading" ? "Conectando..." : "Abrir Meu Estoque"}
          </button>

          <button
            type="button"
            onClick={onRefresh}
            disabled={!apiKey.trim()}
            className="inline-flex items-center justify-center self-end rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-100 disabled:text-slate-400"
          >
            Atualizar lista
          </button>
        </form>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <span
            className={[
              "inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]",
              socketStyles(socketState)
            ].join(" ")}
          >
            {socketLabel(socketState)}
          </span>
          <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">
            {inventoryState === "success" ? "Sessao carregada" : "Aguardando autenticacao"}
          </span>
        </div>

        {errorMessage ? (
          <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            {errorMessage}
          </div>
        ) : null}

        <div className="mt-6 overflow-hidden rounded-[1.75rem] border border-slate-200">
          <div className="overflow-x-auto">
            {inventory.length > 0 ? (
              <table className="min-w-full divide-y divide-slate-200 text-left">
                <thead className="bg-slate-50/80 text-xs uppercase tracking-[0.16em] text-slate-500">
                  <tr>
                    <th className="px-4 py-4 font-semibold">Produto</th>
                    <th className="px-4 py-4 font-semibold">SKU / Serie</th>
                    <th className="px-4 py-4 font-semibold">Estoque mestre</th>
                    <th className="px-4 py-4 font-semibold">Meu estoque</th>
                    <th className="px-4 py-4 font-semibold">Atualizado</th>
                    <th className="px-4 py-4 font-semibold text-right">Salvar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {inventory.map((item) => (
                    <tr key={item.productId} className="align-top hover:bg-slate-50/80">
                      <td className="px-4 py-4">
                        <div className="max-w-[360px]">
                          <p className="font-semibold text-slate-950">{item.name}</p>
                          <p className="mt-1 text-xs text-slate-500">{item.productId}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">{item.sku}</td>
                      <td className="px-4 py-4">
                        <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">
                          {item.masterStock}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="max-w-[160px]">
                          <input
                            type="number"
                            min={0}
                            value={draftQuantities[item.productId] ?? ""}
                            onChange={(event) => onDraftChange(item.productId, event.target.value)}
                            className="w-full rounded-[1rem] border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-teal-400 focus:bg-white focus:ring-4 focus:ring-teal-100"
                          />
                          <p className="mt-2 text-xs text-slate-500">
                            Atual: {item.effectiveStockQuantity}
                            {item.customStockQuantity !== null ? " personalizado" : " herdado do mestre"}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-500">
                        {formatUpdatedAt(item.updatedAt)}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => onSave(item.productId)}
                          disabled={savingProductId === item.productId}
                          className="inline-flex items-center justify-center rounded-full border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-700 transition hover:border-teal-300 hover:bg-teal-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500"
                        >
                          {savingProductId === item.productId ? "Salvando..." : "Salvar"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="bg-white px-6 py-14 text-center">
                <p className="font-display text-3xl tracking-tight text-slate-950">
                  Nenhum item carregado
                </p>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-slate-500">
                  Cole uma API key valida do parceiro para listar o catalogo mestre
                  combinado com o estoque isolado da empresa.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>
    </section>
  );
}
