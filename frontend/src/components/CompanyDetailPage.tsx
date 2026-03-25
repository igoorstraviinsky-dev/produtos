import { Toggle } from "./Toggle";
import { EmptyState, StatusChip } from "./ui";
import type { AdminInventoryItem, ApiKeySummary, Company } from "../types";

function formatDate(value: string | null) {
  if (!value) {
    return "Nunca";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

type CompanyDetailPageProps = {
  company: Company;
  activeTab: "settings" | "inventory";
  apiKeys: ApiKeySummary[];
  inventory: AdminInventoryItem[];
  apiKeysState: "idle" | "loading" | "success" | "error";
  inventoryState: "idle" | "loading" | "success" | "error";
  keyActionId: string;
  savingInventoryId: string;
  syncingCatalog: boolean;
  companyForm: {
    legalName: string;
    isActive: boolean;
  };
  inventoryDrafts: Record<string, string>;
  onBack: () => void;
  onChangeTab: (tab: "settings" | "inventory") => void;
  onCompanyFormChange: (patch: Partial<{ legalName: string; isActive: boolean }>) => void;
  onSaveCompany: () => void;
  onDeleteCompany: () => void;
  deletingCompany: boolean;
  onOpenIssueKey: () => void;
  onRevokeKey: (apiKeyId: string) => void;
  onSyncCatalog: () => void;
  onInventoryDraftChange: (productId: string, value: string) => void;
  onSaveInventory: (productId: string) => void;
};

export function CompanyDetailPage(props: CompanyDetailPageProps) {
  const {
    company,
    activeTab,
    apiKeys,
    inventory,
    apiKeysState,
    inventoryState,
    keyActionId,
    savingInventoryId,
    syncingCatalog,
    companyForm,
    inventoryDrafts,
    onBack,
    onChangeTab,
    onCompanyFormChange,
    onSaveCompany,
    onDeleteCompany,
    deletingCompany,
    onOpenIssueKey,
    onRevokeKey,
    onSyncCatalog,
    onInventoryDraftChange,
    onSaveInventory
  } = props;

  return (
    <section className="space-y-6">
      <div className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
            >
              Voltar ao dashboard
            </button>
            <p className="mt-5 text-sm font-semibold uppercase tracking-[0.18em] text-cyan-700">
              Visao da Empresa
            </p>
            <h2 className="mt-2 font-display text-4xl tracking-tight text-slate-950">
              {company.legalName}
            </h2>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <StatusChip active={company.isActive}>
                {company.isActive ? "Ativa" : "Inativa"}
              </StatusChip>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
                Codigo {company.externalCode}
              </span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Chaves emitidas
              </p>
              <p className="mt-3 font-display text-3xl tracking-tight text-slate-950">
                {company.apiKeyCount}
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                Chaves ativas
              </p>
              <p className="mt-3 font-display text-3xl tracking-tight text-emerald-900">
                {company.activeKeyCount}
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
                Produtos no painel
              </p>
              <p className="mt-3 font-display text-3xl tracking-tight text-amber-900">
                {inventory.length}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => onChangeTab("settings")}
            className={[
              "rounded-full px-4 py-2 text-sm font-semibold transition",
              activeTab === "settings"
                ? "bg-slate-950 text-white"
                : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300"
            ].join(" ")}
          >
            Configuracoes
          </button>
          <button
            type="button"
            onClick={() => onChangeTab("inventory")}
            className={[
              "rounded-full px-4 py-2 text-sm font-semibold transition",
              activeTab === "inventory"
                ? "bg-cyan-600 text-white"
                : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300"
            ].join(" ")}
          >
            Estoque da Empresa
          </button>
        </div>
      </div>

      {activeTab === "settings" ? (
        <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
          <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
            <div className="border-b border-slate-200 pb-5">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-700">
                Configuracoes
              </p>
              <h3 className="mt-2 font-display text-3xl tracking-tight text-slate-950">
                Dados da empresa
              </h3>
            </div>

            <div className="mt-6 space-y-5">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Nome da empresa
                </span>
                <input
                  value={companyForm.legalName}
                  onChange={(event) =>
                    onCompanyFormChange({ legalName: event.target.value })
                  }
                  className="w-full rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                />
              </label>

              <div className="flex items-center justify-between rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Empresa ativa</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Bloqueia ou libera imediatamente as integracoes dessa company.
                  </p>
                </div>
                <Toggle
                  checked={companyForm.isActive}
                  onChange={(nextValue) => onCompanyFormChange({ isActive: nextValue })}
                />
              </div>

              <button
                type="button"
                onClick={onSaveCompany}
                className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Salvar configuracoes
              </button>
              <button
                type="button"
                disabled={deletingCompany}
                onClick={onDeleteCompany}
                className="inline-flex items-center justify-center rounded-full border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
              >
                {deletingCompany ? "Excluindo..." : "Excluir empresa"}
              </button>
            </div>
          </section>

          <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
            <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">
                  API Keys
                </p>
                <h3 className="mt-2 font-display text-3xl tracking-tight text-slate-950">
                  Gestao de credenciais
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  Gere novas chaves para integracoes e revogue acessos comprometidos.
                </p>
              </div>
              <button
                type="button"
                onClick={onOpenIssueKey}
                className="inline-flex items-center justify-center rounded-full bg-amber-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-400"
              >
                Gerar nova chave
              </button>
            </div>

            <div className="mt-6 space-y-4">
              {apiKeysState === "loading" ? (
                <p className="text-sm text-slate-500">Atualizando chaves da empresa...</p>
              ) : null}

              {apiKeys.length === 0 && apiKeysState !== "loading" ? (
                <EmptyState
                  title="Nenhuma chave emitida"
                  description="Gere a primeira API key para integrar essa empresa ao gateway."
                />
              ) : null}

              {apiKeys.map((apiKey) => (
                <article
                  key={apiKey.id}
                  className="rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-4"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-display text-xl tracking-tight text-slate-950">
                          {apiKey.keyPrefix}
                        </p>
                        <StatusChip active={!apiKey.isRevoked}>
                          {apiKey.isRevoked ? "Revogada" : "Ativa"}
                        </StatusChip>
                      </div>
                      <div className="mt-3 grid gap-2 text-sm text-slate-600">
                        <p>Rate limit: {apiKey.rateLimitPerMinute} req/min</p>
                        <p>Criada: {formatDate(apiKey.createdAt)}</p>
                        <p>Ultimo uso: {formatDate(apiKey.lastUsedAt)}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={apiKey.isRevoked || keyActionId === apiKey.id}
                      onClick={() => onRevokeKey(apiKey.id)}
                      className="inline-flex items-center justify-center rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      Revogar
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {activeTab === "inventory" ? (
        <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-700">
                Estoque da Empresa
              </p>
              <h3 className="mt-2 font-display text-3xl tracking-tight text-slate-950">
                Catalogo mestre com quantidade customizada
              </h3>
              <p className="mt-2 text-sm text-slate-600">
                Edite apenas o estoque isolado dessa empresa. O catalogo principal continua
                preservado.
              </p>
            </div>
            <button
              type="button"
              disabled={syncingCatalog}
              onClick={onSyncCatalog}
              className="inline-flex items-center justify-center rounded-full border border-cyan-200 bg-cyan-50 px-5 py-3 text-sm font-semibold text-cyan-700 transition hover:border-cyan-300 hover:bg-cyan-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
            >
              {syncingCatalog ? "Sincronizando..." : "Sincronizar catalogo"}
            </button>
          </div>

          {inventoryState === "loading" ? (
            <p className="mt-6 text-sm text-slate-500">Carregando estoque da empresa...</p>
          ) : null}

          {inventory.length === 0 && inventoryState !== "loading" ? (
            <div className="mt-6">
              <div className="space-y-4">
                <EmptyState
                  title="Sem produtos sincronizados"
                  description="Sincronize o catalogo mestre primeiro para habilitar o estoque por empresa."
                />
                <div className="flex justify-center">
                  <button
                    type="button"
                    disabled={syncingCatalog}
                    onClick={onSyncCatalog}
                    className="inline-flex items-center justify-center rounded-full bg-cyan-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {syncingCatalog ? "Sincronizando..." : "Sincronizar agora"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {inventory.length > 0 ? (
            <div className="mt-6 overflow-hidden rounded-[1.75rem] border border-slate-200">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left">
                  <thead className="bg-slate-50/80 text-xs uppercase tracking-[0.16em] text-slate-500">
                    <tr>
                      <th className="px-4 py-4 font-semibold">Produto</th>
                      <th className="px-4 py-4 font-semibold">SKU</th>
                      <th className="px-4 py-4 font-semibold">Catalogo mestre</th>
                      <th className="px-4 py-4 font-semibold">Estoque da empresa</th>
                      <th className="px-4 py-4 font-semibold">Atualizado</th>
                      <th className="px-4 py-4 font-semibold text-right">Acao</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {inventory.map((item) => (
                      <tr key={item.productId} className="align-top hover:bg-slate-50/80">
                        <td className="px-4 py-4">
                          <p className="font-semibold text-slate-950">{item.name}</p>
                          <p className="mt-1 text-xs text-slate-500">{item.productId}</p>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-700">{item.sku}</td>
                        <td className="px-4 py-4 text-sm font-semibold text-slate-900">
                          {item.masterStock}
                        </td>
                        <td className="px-4 py-4">
                          <input
                            type="number"
                            min="0"
                            value={inventoryDrafts[item.productId] ?? ""}
                            onChange={(event) =>
                              onInventoryDraftChange(item.productId, event.target.value)
                            }
                            className="w-28 rounded-[1rem] border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                          />
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-500">
                          {formatDate(item.updatedAt)}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <button
                            type="button"
                            disabled={savingInventoryId === item.productId}
                            onClick={() => onSaveInventory(item.productId)}
                            className="inline-flex items-center justify-center rounded-full border border-cyan-200 bg-cyan-50 px-4 py-2 text-sm font-semibold text-cyan-700 transition hover:border-cyan-300 hover:bg-cyan-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                          >
                            Salvar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </section>
  );
}
