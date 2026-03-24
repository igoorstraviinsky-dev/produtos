import type { ProductsResponse } from "../types";
import { MetricPanel, MetricPill } from "./ui";

function formatPrice(price: number | null) {
  if (price === null) {
    return "Nao informado";
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(price);
}

function formatUpdatedAt(value: string | null) {
  if (!value) {
    return "Sem data";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

type PlaygroundPanelProps = {
  playgroundState: "idle" | "loading" | "success" | "error";
  playgroundApiKey: string;
  playgroundResult: ProductsResponse | null;
  playgroundStatus: number | null;
  playgroundLatency: number | null;
  playgroundError: string;
  onChangeApiKey: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onClear: () => void;
};

export function PlaygroundPanel(props: PlaygroundPanelProps) {
  const {
    playgroundState,
    playgroundApiKey,
    playgroundResult,
    playgroundStatus,
    playgroundLatency,
    playgroundError,
    onChangeApiKey,
    onSubmit,
    onClear
  } = props;

  return (
    <section className="xl:col-span-2 rounded-[2rem] border border-white/70 bg-white/85 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur sm:p-6">
      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-700">
            Playground
          </p>
          <h2 className="mt-2 font-display text-3xl tracking-tight text-slate-950">
            Simulador do Cliente
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-7 text-slate-600">
            Cole uma API key gerada, execute a leitura do estoque e acompanhe o status
            HTTP, o tempo de resposta e a origem dos dados para visualizar cache e rate
            limit em acao.
          </p>

          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">API key</span>
              <textarea
                value={playgroundApiKey}
                onChange={(event) => onChangeApiKey(event.target.value)}
                placeholder="Cole aqui a chave emitida no painel"
                rows={4}
                className="w-full rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
              />
            </label>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={playgroundState === "loading" || !playgroundApiKey.trim()}
                className="inline-flex items-center justify-center rounded-full bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {playgroundState === "loading" ? "Buscando..." : "Buscar estoque"}
              </button>
              <button
                type="button"
                onClick={onClear}
                className="inline-flex items-center justify-center rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                Limpar
              </button>
            </div>
          </form>
        </div>

        <div className="rounded-[1.75rem] border border-slate-200 bg-slate-950 p-5 text-slate-50">
          <div className="flex flex-wrap gap-3">
            <MetricPill label="HTTP" value={playgroundStatus ? String(playgroundStatus) : "--"} />
            <MetricPill
              label="Tempo"
              value={playgroundLatency !== null ? `${playgroundLatency} ms` : "--"}
            />
            <MetricPill label="Origem" value={playgroundResult?.meta.source ?? "--"} />
          </div>

          {playgroundError ? (
            <div className="mt-5 rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
              {playgroundError}
            </div>
          ) : null}

          {playgroundResult ? (
            <div className="mt-5 space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Resumo da resposta
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <MetricPanel
                    title="Fonte"
                    value={playgroundResult.meta.source}
                    subtitle={playgroundResult.meta.stale ? "cache stale" : "fluxo normal"}
                  />
                  <MetricPanel
                    title="Produtos"
                    value={String(playgroundResult.meta.count)}
                    subtitle="itens retornados"
                  />
                  <MetricPanel
                    title="Latencia"
                    value={playgroundLatency !== null ? `${playgroundLatency}ms` : "--"}
                    subtitle="medida no browser"
                  />
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                <div className="border-b border-white/10 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                    Produtos retornados
                  </p>
                </div>

                <div className="hidden overflow-x-auto lg:block">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-white/5 text-xs uppercase tracking-[0.16em] text-slate-400">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Nome</th>
                        <th className="px-4 py-3 font-semibold">SKU / Serie</th>
                        <th className="px-4 py-3 font-semibold">Estoque</th>
                        <th className="px-4 py-3 font-semibold">Preco</th>
                        <th className="px-4 py-3 font-semibold">Atualizado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {playgroundResult.data.map((product) => (
                        <tr key={product.id} className="align-top text-slate-100">
                          <td className="px-4 py-4">
                            <div className="max-w-[280px]">
                              <p className="font-semibold">{product.name}</p>
                              <p className="mt-1 text-xs text-slate-400">{product.id}</p>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-slate-300">{product.sku}</td>
                          <td className="px-4 py-4">
                            <span className="inline-flex rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                              {product.availableQuantity}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-slate-300">
                            {formatPrice(product.price)}
                          </td>
                          <td className="px-4 py-4 text-slate-400">
                            {formatUpdatedAt(product.updatedAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="space-y-3 p-4 lg:hidden">
                  {playgroundResult.data.map((product) => (
                    <article
                      key={product.id}
                      className="rounded-2xl border border-white/10 bg-white/5 p-4"
                    >
                      <p className="font-semibold text-white">{product.name}</p>
                      <div className="mt-3 grid gap-2 text-sm text-slate-300">
                        <p>SKU / Serie: {product.sku}</p>
                        <p>Estoque: {product.availableQuantity}</p>
                        <p>Preco: {formatPrice(product.price)}</p>
                        <p>Atualizado: {formatUpdatedAt(product.updatedAt)}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </div>

              <div className="max-h-[280px] overflow-auto rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                <p className="mb-3 text-xs uppercase tracking-[0.18em] text-slate-500">
                  Payload tecnico
                </p>
                <pre className="text-xs leading-6 text-slate-200">
                  {JSON.stringify(playgroundResult.data, null, 2)}
                </pre>
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-dashed border-white/15 px-4 py-10 text-center text-sm text-slate-400">
              Execute uma chamada para visualizar o payload do estoque e o efeito do
              cache.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
