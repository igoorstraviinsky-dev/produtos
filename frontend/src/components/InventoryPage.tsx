import type { Product } from "../types";

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

type InventoryPageProps = {
  products: Product[];
  productsState: "idle" | "loading" | "success" | "error";
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  onRefresh: () => void;
  onEdit: (product: Product) => void;
};

export function InventoryPage(props: InventoryPageProps) {
  const { products, productsState, searchTerm, onSearchTermChange, onRefresh, onEdit } = props;

  const lowStockCount = products.filter((product) => product.availableQuantity <= 5).length;
  const hasProducts = products.length > 0;

  return (
    <section className="rounded-[2rem] border border-white/70 bg-white/85 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur sm:p-6">
      <div className="flex flex-col gap-5 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-700">
            Produtos / Estoque
          </p>
          <h2 className="mt-2 font-display text-4xl tracking-tight text-slate-950">
            Catalogo operacional
          </h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            Aqui fica a pagina dedicada para visualizar e editar o estoque remoto que a
            API publica para os clientes B2B.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Produtos
            </p>
            <p className="mt-3 font-display text-3xl tracking-tight text-slate-950">
              {products.length}
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
          <button
            type="button"
            onClick={onRefresh}
            className="rounded-[1.5rem] border border-slate-200 bg-white px-4 py-4 text-left transition hover:border-slate-300 hover:bg-slate-50"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Atualizar
            </p>
            <p className="mt-3 font-display text-2xl tracking-tight text-slate-950">
              Sincronizar
            </p>
          </button>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <label className="block w-full max-w-xl">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            Buscar por nome ou serie
          </span>
          <input
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
            placeholder="Ex.: corrente, pulseira, XCC075..."
            className="w-full rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
          />
        </label>
      </div>

      <div className="mt-6 overflow-hidden rounded-[1.75rem] border border-slate-200">
        <div className="overflow-x-auto">
          {hasProducts ? (
            <table className="min-w-full divide-y divide-slate-200 text-left">
              <thead className="bg-slate-50/80 text-xs uppercase tracking-[0.16em] text-slate-500">
                <tr>
                  <th className="px-4 py-4 font-semibold">Nome</th>
                  <th className="px-4 py-4 font-semibold">SKU / Serie</th>
                  <th className="px-4 py-4 font-semibold">Estoque</th>
                  <th className="px-4 py-4 font-semibold">Preco</th>
                  <th className="px-4 py-4 font-semibold">Atualizado</th>
                  <th className="px-4 py-4 font-semibold text-right">Acao</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {products.map((product) => (
                  <tr key={product.id} className="align-top hover:bg-slate-50/80">
                    <td className="px-4 py-4">
                      <div className="max-w-[360px]">
                        <p className="font-semibold text-slate-950">{product.name}</p>
                        <p className="mt-1 text-xs text-slate-500">{product.id}</p>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-700">{product.sku}</td>
                    <td className="px-4 py-4">
                      <span
                        className={[
                          "inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]",
                          product.availableQuantity <= 5
                            ? "bg-amber-100 text-amber-800"
                            : "bg-emerald-100 text-emerald-800"
                        ].join(" ")}
                      >
                        {product.availableQuantity}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-700">
                      {formatPrice(product.price)}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-500">
                      {formatUpdatedAt(product.updatedAt)}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => onEdit(product)}
                        className="inline-flex items-center justify-center rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-700 transition hover:border-sky-300 hover:bg-sky-100"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="bg-white px-6 py-14 text-center">
              <p className="font-display text-3xl tracking-tight text-slate-950">
                Nenhum produto encontrado
              </p>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-slate-500">
                Ajuste a busca ou sincronize novamente para recarregar o catalogo remoto
                vindo do Supabase.
              </p>
            </div>
          )}
        </div>
      </div>

      {productsState === "loading" ? (
        <p className="mt-4 text-sm text-slate-500">Atualizando produtos do estoque...</p>
      ) : null}
      {productsState === "error" ? (
        <p className="mt-4 text-sm text-rose-600">
          Nao foi possivel carregar o estoque remoto agora.
        </p>
      ) : null}
    </section>
  );
}
