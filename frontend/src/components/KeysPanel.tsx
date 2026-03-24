import type { ApiKeySummary, Company } from "../types";
import { EmptyState, StatusChip } from "./ui";

type KeysPanelProps = {
  selectedCompany: Company | null;
  apiKeys: ApiKeySummary[];
  apiKeysState: "idle" | "loading" | "success" | "error";
  keyActionId: string;
  onOpenIssue: () => void;
  onRevokeKey: (apiKeyId: string) => void;
  formatDate: (value: string | null) => string;
};

export function KeysPanel(props: KeysPanelProps) {
  const {
    selectedCompany,
    apiKeys,
    apiKeysState,
    keyActionId,
    onOpenIssue,
    onRevokeKey,
    formatDate
  } = props;

  return (
    <section className="rounded-[2rem] border border-white/70 bg-white/85 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur sm:p-6">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">
          API Keys
        </p>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-display text-3xl tracking-tight text-slate-950">
              {selectedCompany ? selectedCompany.legalName : "Selecione uma empresa"}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Gere e revogue chaves sem expor a chave completa novamente.
            </p>
          </div>
          <button
            type="button"
            disabled={!selectedCompany}
            onClick={onOpenIssue}
            className="inline-flex items-center justify-center rounded-full bg-amber-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
          >
            Gerar nova chave
          </button>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {!selectedCompany ? (
          <EmptyState
            title="Nenhuma empresa selecionada"
            description="Escolha uma company na tabela para listar e gerenciar suas chaves."
          />
        ) : null}

        {selectedCompany && apiKeys.length === 0 && apiKeysState !== "loading" ? (
          <EmptyState
            title="Sem chaves para esta empresa"
            description="Crie a primeira API key para liberar integracoes B2B."
          />
        ) : null}

        {apiKeysState === "loading" ? (
          <p className="text-sm text-slate-500">Atualizando chaves da empresa...</p>
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
  );
}
