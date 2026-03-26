import { useEffect, useState } from "react";

import { Toggle } from "./Toggle";
import { EmptyState, StatusChip } from "./ui";
import type { AdminInventoryItem, ApiKeySummary, Company, Product, ProductVariant } from "../types";

const DEFAULT_PRODUCT_IMAGE_BASE_URL = "https://estoque-joias-b2b-gold.s3.us-east-2.amazonaws.com";
const PRODUCT_IMAGE_BASE_URL = (
  import.meta.env.VITE_PRODUCT_IMAGE_BASE_URL ?? DEFAULT_PRODUCT_IMAGE_BASE_URL
).replace(/\/$/, "");
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

function formatDate(value: string | null) {
  if (!value) {
    return "Nunca";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function toNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const normalized = value.replace(",", ".").trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatWeight(value: string | number | null | undefined) {
  const parsed = toNumber(value);
  if (parsed === null) {
    return "Peso n/d";
  }

  return `${parsed.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3
  })} g`;
}

function getSupplierCode(product: Product | null) {
  return product?.supplier_code ?? product?.supplierCode ?? "n/d";
}

function getCommercialDescription(product: Product | null, fallbackName: string) {
  return product?.descricao ?? product?.description ?? fallbackName;
}

function getVariantStockTotal(product: Product | null) {
  const variants = product?.variants ?? [];
  if (variants.length === 0) {
    return null;
  }

  return variants.reduce((total, variant) => {
    const variantStock = toNumber(variant.individual_stock ?? variant.individualStock) ?? 0;
    return total + variantStock;
  }, 0);
}

function getCurrentDisplayStock(item: AdminInventoryItem, product: Product | null) {
  return getVariantStockTotal(product) ?? item.effectiveStockQuantity;
}

function normalizeCandidateUrl(value: string | null | undefined) {
  const nextValue = value?.trim();
  return nextValue ? nextValue : null;
}

function buildPublicBucketUrl(key: string | null | undefined) {
  const nextKey = normalizeCandidateUrl(key);
  if (!nextKey || nextKey.startsWith("local:")) {
    return null;
  }

  if (/^https?:\/\//i.test(nextKey)) {
    return nextKey;
  }

  return PRODUCT_IMAGE_BASE_URL ? `${PRODUCT_IMAGE_BASE_URL}/${nextKey.replace(/^\/+/, "")}` : null;
}

function buildStableMediaApiUrl(key: string | null | undefined) {
  const nextKey = normalizeCandidateUrl(key);
  if (!nextKey) {
    return null;
  }

  const routePath = `/api/v1/media/object/${encodeURIComponent(nextKey)}`;
  return API_BASE_URL ? `${API_BASE_URL}${routePath}` : routePath;
}

function collectProductImageCandidates(product: Product | null) {
  if (!product) {
    return [];
  }

  const candidates = [
    normalizeCandidateUrl(product.main_image_url),
    normalizeCandidateUrl(product.mainImageUrl),
    ...(product.media_assets ?? []).map((asset) => normalizeCandidateUrl(asset.url)),
    ...(product.media_assets ?? []).map((asset) =>
      buildStableMediaApiUrl(asset.storage_key ?? asset.storageKey)
    ),
    ...(product.media_assets ?? []).map((asset) =>
      buildPublicBucketUrl(asset.storage_key ?? asset.storageKey)
    ),
    ...(product.mediaAssets ?? []).map((asset) => normalizeCandidateUrl(asset.url)),
    ...(product.mediaAssets ?? []).map((asset) =>
      buildStableMediaApiUrl(asset.storage_key ?? asset.storageKey)
    ),
    ...(product.mediaAssets ?? []).map((asset) =>
      buildPublicBucketUrl(asset.storage_key ?? asset.storageKey)
    ),
    ...(product.media_urls ?? []).map((url) => normalizeCandidateUrl(url)),
    ...(product.mediaUrls ?? []).map((url) => normalizeCandidateUrl(url)),
    buildStableMediaApiUrl(product.s3_key_bronze ?? product.bronzeImageKey),
    buildPublicBucketUrl(product.s3_key_bronze ?? product.bronzeImageKey),
    buildStableMediaApiUrl(product.s3_key_silver ?? product.silverImageKey),
    buildPublicBucketUrl(product.s3_key_silver ?? product.silverImageKey)
  ].filter((value): value is string => Boolean(value));

  return [...new Set(candidates)];
}

function buildProductImageCandidates(product: Product | null) {
  const baseCandidates = collectProductImageCandidates(product);
  if (baseCandidates.length === 0) {
    return [];
  }

  const suffixVariants = [
    ["_st.", "_md."],
    ["_md.", "_st."],
    ["_st.", "_sm."],
    ["_sm.", "_md."]
  ] as const;

  const expandedCandidates: string[] = [];

  for (const candidate of baseCandidates) {
    expandedCandidates.push(candidate);

    for (const [from, to] of suffixVariants) {
      if (candidate.includes(from)) {
        expandedCandidates.push(candidate.replace(from, to));
      }
    }
  }

  return [...new Set(expandedCandidates)];
}

function getVariantOptionChips(variant: ProductVariant) {
  const sizeChips = variant.size_labels.map((label) => ({
    key: `size:${label}`,
    label: label,
    tone: "bg-cyan-100 text-cyan-800"
  }));
  const colorChips = variant.color_labels.map((label) => ({
    key: `color:${label}`,
    label: label,
    tone: "bg-amber-100 text-amber-800"
  }));
  const extraChips = variant.options
    .filter((option) => option.kind !== "size" && option.kind !== "color")
    .map((option) => ({
      key: `${option.kind}:${option.id}`,
      label: `${option.kind}: ${option.label}`,
      tone: "bg-slate-100 text-slate-700"
    }));

  return [...sizeChips, ...colorChips, ...extraChips];
}

function ProductImage(props: { product: Product | null; alt: string; mode?: "line" | "card" }) {
  const { product, alt, mode = "card" } = props;
  const candidates = buildProductImageCandidates(product);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [exhausted, setExhausted] = useState(false);
  const isCompact = mode === "line";

  useEffect(() => {
    setCandidateIndex(0);
    setExhausted(false);
  }, [product?.id, candidates.join("|")]);

  if (candidates.length === 0 || exhausted) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.12),_transparent_55%),linear-gradient(145deg,_rgba(248,250,252,0.96),_rgba(241,245,249,0.92))] px-4 text-center">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-sm text-slate-400">
          +
        </span>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
            Sem foto
          </p>
          {!isCompact ? (
            <p className="mt-1 text-xs text-slate-400">Produto sem imagem valida no catalogo.</p>
          ) : null}
        </div>
      </div>
    );
  }

  const currentCandidate = candidates[candidateIndex];

  return (
    <button
      type="button"
      onClick={() => window.open(currentCandidate, "_blank", "noopener,noreferrer")}
      className="group relative block h-full w-full overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.18),_transparent_40%),radial-gradient(circle_at_bottom_right,_rgba(250,204,21,0.18),_transparent_34%),linear-gradient(150deg,_rgba(255,255,255,0.98),_rgba(241,245,249,0.96))]"
      title="Abrir foto do produto"
    >
      <img
        src={currentCandidate}
        alt={alt}
        className={[
          "h-full w-full transition duration-300 group-hover:scale-[1.03]",
          isCompact ? "object-contain p-2" : "object-contain p-5"
        ].join(" ")}
        loading="lazy"
        onError={() => {
          setCandidateIndex((current) => {
            if (current >= candidates.length - 1) {
              setExhausted(true);
              return current;
            }

            return current + 1;
          });
        }}
      />
      <span
        className={[
          "absolute rounded-full bg-slate-950/78 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white transition",
          isCompact
            ? "bottom-2 left-2 opacity-100"
            : "bottom-3 left-3 opacity-0 group-hover:opacity-100"
        ].join(" ")}
      >
        Abrir foto
      </span>
    </button>
  );
}

type CompanyDetailPageProps = {
  company: Company;
  activeTab: "profile" | "keys" | "inventory";
  apiKeys: ApiKeySummary[];
  inventory: AdminInventoryItem[];
  products: Product[];
  apiKeysState: "idle" | "loading" | "success" | "error";
  inventoryState: "idle" | "loading" | "success" | "error";
  productsState: "idle" | "loading" | "success" | "error";
  keyActionId: string;
  savingInventoryId: string;
  syncingCatalog: boolean;
  companyForm: {
    legalName: string;
    isActive: boolean;
    syncStoreInventory: boolean;
  };
  inventoryDrafts: Record<string, string>;
  onBack: () => void;
  onChangeTab: (tab: "profile" | "keys" | "inventory") => void;
  onCompanyFormChange: (
    patch: Partial<{ legalName: string; isActive: boolean; syncStoreInventory: boolean }>
  ) => void;
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
    products,
    apiKeysState,
    inventoryState,
    productsState,
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

  const productsById = new Map(products.map((product) => [product.id, product]));
  const [openInventoryProductId, setOpenInventoryProductId] = useState<string | null>(null);
  const [expandedProductIds, setExpandedProductIds] = useState<Record<string, boolean>>({});

  function toggleVariants(productId: string) {
    setExpandedProductIds((current) => ({
      ...current,
      [productId]: !current[productId]
    }));
  }

  useEffect(() => {
    if (!openInventoryProductId) {
      return;
    }

    const stillExists = inventory.some((item) => item.productId === openInventoryProductId);
    if (!stillExists) {
      setOpenInventoryProductId(null);
    }
  }, [inventory, openInventoryProductId]);

  function toggleInventoryCard(productId: string) {
    setOpenInventoryProductId((current) => (current === productId ? null : productId));
  }

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
              {company.syncStoreInventory ? (
                <span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-800">
                  Sync loja ativo
                </span>
              ) : null}
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
          <button
            type="button"
            onClick={() => onChangeTab("profile")}
            className={[
              "rounded-full px-4 py-2 text-sm font-semibold transition",
              activeTab === "profile"
                ? "bg-slate-950 text-white"
                : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300"
            ].join(" ")}
          >
            Dados da empresa
          </button>
          <button
            type="button"
            onClick={() => onChangeTab("keys")}
            className={[
              "rounded-full px-4 py-2 text-sm font-semibold transition",
              activeTab === "keys"
                ? "bg-amber-500 text-slate-950"
                : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300"
            ].join(" ")}
          >
            Gestao de credenciais
          </button>
        </div>
      </div>

      {activeTab === "profile" ? (
        <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="border-b border-slate-200 pb-5">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-700">
              Dados da empresa
            </p>
            <h3 className="mt-2 font-display text-3xl tracking-tight text-slate-950">
              Configuracoes da operacao
            </h3>
          </div>

          <div className="mt-6 max-w-3xl space-y-5">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">
                Nome da empresa
              </span>
              <input
                value={companyForm.legalName}
                onChange={(event) => onCompanyFormChange({ legalName: event.target.value })}
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

            <div className="flex items-center justify-between rounded-[1.4rem] border border-cyan-200 bg-cyan-50 px-4 py-4">
              <div className="pr-4">
                <p className="text-sm font-semibold text-slate-900">
                  Sincronizar estoque loja
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Deixa esta empresa preparada para puxarmos o estoque diretamente da loja
                  usada na operacao, sem depender apenas do valor manual do painel.
                </p>
              </div>
              <Toggle
                checked={companyForm.syncStoreInventory}
                onChange={(nextValue) => onCompanyFormChange({ syncStoreInventory: nextValue })}
              />
            </div>

            <div className="flex flex-wrap gap-3">
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
          </div>
        </section>
      ) : null}

      {activeTab === "keys" ? (
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
      ) : null}

      {activeTab === "inventory" ? (
        <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-700">
                Estoque da Empresa
              </p>
              <h3 className="mt-2 font-display text-3xl tracking-tight text-slate-950">
                Catalogo mestre com fotos e variacoes
              </h3>
              <p className="mt-2 text-sm text-slate-600">
                Edite o estoque isolado da empresa e visualize foto, SKU principal e todas as
                variacoes cadastradas no catalogo mestre.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span
                  className={[
                    "rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]",
                    company.syncStoreInventory
                      ? "bg-cyan-100 text-cyan-800"
                      : "bg-slate-100 text-slate-600"
                  ].join(" ")}
                >
                  {company.syncStoreInventory
                    ? "Sincronizacao da loja habilitada"
                    : "Sincronizacao da loja desabilitada"}
                </span>
              </div>
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

          {productsState === "loading" && inventory.length > 0 ? (
            <p className="mt-3 text-sm text-slate-500">
              Carregando fotos e variacoes do catalogo mestre...
            </p>
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
            <div className="mt-6 space-y-3">
              {inventory.map((item) => {
                const product = productsById.get(item.productId) ?? null;
                const variants = product?.variants ?? [];
                const currentDisplayStock = getCurrentDisplayStock(item, product);
                const isCardOpen = openInventoryProductId === item.productId;
                const isVariantsExpanded = Boolean(expandedProductIds[item.productId]);

                return (
                  <article
                    key={item.productId}
                    className={[
                      "overflow-hidden rounded-[1.75rem] border transition",
                      isCardOpen
                        ? "border-cyan-200 bg-white shadow-[0_22px_55px_rgba(14,165,233,0.12)]"
                        : "border-slate-200 bg-slate-50/70 shadow-[0_12px_28px_rgba(15,23,42,0.05)] hover:border-cyan-200 hover:bg-white hover:shadow-[0_18px_40px_rgba(15,23,42,0.08)]"
                    ].join(" ")}
                  >
                    <button
                      type="button"
                      onClick={() => toggleInventoryCard(item.productId)}
                      className="flex w-full flex-col gap-3 p-3 text-left sm:p-4"
                    >
                      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
                        <div className="flex items-center gap-3 xl:min-w-0 xl:flex-1">
                          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-[1.25rem] border border-slate-200 bg-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.7)]">
                            <ProductImage product={product} alt={item.name} mode="line" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="grid gap-2 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] lg:items-start">
                              <div className="min-w-0">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                  Cód
                                </p>
                                <p className="mt-1 truncate font-display text-lg tracking-tight text-slate-950">
                                  {item.sku}
                                </p>
                              </div>

                              <div className="min-w-0">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                  Cod fornecedor
                                </p>
                                <p className="mt-1 truncate text-sm font-semibold text-slate-900">
                                  {getSupplierCode(product)}
                                </p>
                              </div>

                              <div className="flex items-start lg:justify-end">
                                <span className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-700">
                                  {variants.length} variacoes
                                </span>
                              </div>
                            </div>

                            <div className="mt-3">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                Descricao comercial
                              </p>
                              <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-700">
                                {getCommercialDescription(product, item.name)}
                              </p>
                            </div>

                            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                              <div className="rounded-[1rem] border border-slate-200 bg-white px-3 py-2.5">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                  Catalogo mestre
                                </p>
                                <p className="mt-1.5 text-base font-semibold text-slate-950">
                                  {item.masterStock}
                                </p>
                              </div>
                              <div className="rounded-[1rem] border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                                  Estoque atual
                                </p>
                                <p className="mt-1.5 text-base font-semibold text-emerald-900">
                                  {currentDisplayStock}
                                </p>
                              </div>
                              <div className="rounded-[1rem] border border-slate-200 bg-white px-3 py-2.5">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                  Atualizado
                                </p>
                                <p className="mt-1.5 text-sm font-semibold text-slate-950">
                                  {formatDate(item.updatedAt)}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-3 xl:w-[11rem] xl:flex-col xl:items-stretch">
                          <div className="rounded-[1rem] border border-slate-200 bg-white px-3 py-2.5">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                              Estoque loja
                            </p>
                            <p className="mt-1.5 text-lg font-semibold text-slate-950">
                              {inventoryDrafts[item.productId] ?? currentDisplayStock}
                            </p>
                          </div>
                          <div className="flex items-center justify-end">
                            <span
                              className={[
                                "inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold transition",
                                isCardOpen
                                  ? "bg-slate-950 text-white"
                                  : "border border-slate-200 bg-white text-slate-700"
                              ].join(" ")}
                            >
                              {isCardOpen ? "Fechar card" : "Abrir card"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>

                    {isCardOpen ? (
                      <div className="border-t border-slate-200 bg-white px-5 py-5">
                        <div className="grid gap-5 xl:grid-cols-[20rem_minmax(0,1fr)]">
                          <div className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
                            <div className="aspect-[4/5]">
                              <ProductImage product={product} alt={item.name} />
                            </div>
                            <div className="border-t border-slate-200 bg-slate-50 px-4 py-3">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                Clique na imagem para ampliar
                              </p>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/70 px-4 py-4">
                              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                                <div className="max-w-md">
                                  <p className="text-sm font-semibold text-slate-900">
                                    Estoque isolado da empresa
                                  </p>
                                  <p className="mt-1 text-sm text-slate-500">
                                    O valor salvo aqui substitui o estoque mestre desse produto para a
                                    empresa selecionada.
                                  </p>
                                </div>

                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                  <input
                                    type="number"
                                    min="0"
                                    value={inventoryDrafts[item.productId] ?? ""}
                                    onChange={(event) =>
                                      onInventoryDraftChange(item.productId, event.target.value)
                                    }
                                    className="w-32 rounded-[1rem] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                                  />
                                  <button
                                    type="button"
                                    disabled={savingInventoryId === item.productId}
                                    onClick={() => onSaveInventory(item.productId)}
                                    className="inline-flex items-center justify-center rounded-full border border-cyan-200 bg-cyan-50 px-4 py-2 text-sm font-semibold text-cyan-700 transition hover:border-cyan-300 hover:bg-cyan-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                                  >
                                    {savingInventoryId === item.productId ? "Salvando..." : "Salvar"}
                                  </button>
                                </div>
                              </div>

                              {variants.length > 0 ? (
                                <div className="mt-4 border-t border-slate-200 pt-4">
                                  <button
                                    type="button"
                                    onClick={() => toggleVariants(item.productId)}
                                    className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
                                  >
                                    {isVariantsExpanded
                                      ? `Ocultar variacoes (${variants.length})`
                                      : `Ver variacoes (${variants.length})`}
                                  </button>
                                </div>
                              ) : null}
                            </div>

                            {isVariantsExpanded ? (
                              <div className="rounded-[1.5rem] border border-slate-200 bg-white/90 px-4 py-4">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
                                      Variacoes do produto
                                    </p>
                                    <p className="mt-1 text-sm text-slate-600">
                                      Exibimos as variacoes oficiais do catalogo mestre para consulta rapida
                                      no painel da empresa.
                                    </p>
                                  </div>
                                  {product?.material_base ? (
                                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
                                      {product.material_base}
                                    </span>
                                  ) : null}
                                </div>

                                {!product && productsState === "loading" ? (
                                  <p className="mt-4 text-sm text-slate-500">
                                    Carregando detalhes do catalogo mestre...
                                  </p>
                                ) : null}

                                {!product && productsState !== "loading" ? (
                                  <div className="mt-4 rounded-[1.25rem] border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                                    Nao foi possivel carregar a ficha completa desse produto no catalogo
                                    mestre.
                                  </div>
                                ) : null}

                                {product && variants.length > 0 ? (
                                  <div className="mt-4 grid gap-3 lg:grid-cols-3">
                                    {variants.map((variant) => {
                                      const chips = getVariantOptionChips(variant);

                                      return (
                                        <div
                                          key={variant.variant_id}
                                          className="rounded-[1.25rem] border border-slate-200 bg-slate-50 px-4 py-4"
                                        >
                                          <div className="flex flex-wrap items-start justify-between gap-3">
                                            <div>
                                              <p className="font-semibold text-slate-950">{variant.sku}</p>
                                              <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
                                                {formatWeight(
                                                  variant.individual_weight ?? variant.individualWeight
                                                )}
                                              </p>
                                            </div>
                                            <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
                                              Estoque {variant.individual_stock}
                                            </div>
                                          </div>

                                          <div className="mt-3 flex flex-wrap gap-2">
                                            {chips.map((chip) => (
                                              <span
                                                key={chip.key}
                                                className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${chip.tone}`}
                                              >
                                                {chip.label}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : null}
        </section>
      ) : null}
    </section>
  );
}
