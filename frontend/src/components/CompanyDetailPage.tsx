import { useEffect, useMemo, useState } from "react";

import { Toggle } from "./Toggle";
import { EmptyState, StatusChip } from "./ui";
import type {
  AdminInventoryItem,
  AdminInventoryVariant,
  ApiKeySummary,
  Company,
  Product,
  ProductMediaAsset,
  ProductVariant
} from "../types";

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

function formatCurrency(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "Custo n/d";
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(value);
}

function formatUnits(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "n/d";
  }

  const roundedDown = Math.floor(value);

  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(roundedDown);
}

function formatWeightStock(value: number | null | undefined) {
  const parsed = typeof value === "number" ? value : null;
  if (parsed === null || !Number.isFinite(parsed)) {
    return "0 g";
  }

  return `${new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(parsed)} g`;
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
  if (item.hasVariantInventory) {
    return item.variantStockQuantityTotal ?? item.effectiveStockQuantity;
  }

  return getVariantStockTotal(product) ?? item.effectiveStockQuantity;
}

function getManualInventoryValue(item: AdminInventoryItem, draftValue: string | undefined) {
  if (item.hasVariantInventory) {
    return draftValue ?? "";
  }

  return draftValue ?? String(item.customStockQuantity ?? item.effectiveStockQuantity);
}

function normalizeSearchTerm(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
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

function getCanonicalImageKey(value: string | null | undefined) {
  const nextValue = normalizeCandidateUrl(value);
  if (!nextValue) {
    return null;
  }

  let normalized = nextValue;

  if (/^https?:\/\//i.test(normalized)) {
    try {
      const url = new URL(normalized);
      normalized = decodeURIComponent(url.pathname);
    } catch {
      normalized = normalized.replace(/^https?:\/\/[^/]+/i, "");
    }
  } else {
    normalized = decodeURIComponent(normalized);
  }

  normalized = normalized.replace(/^\/api\/v1\/media\/object\//, "");
  normalized = normalized.replace(/^\/+/, "");
  normalized = normalized.replace(/\?.*$/, "");

  return normalized.toLowerCase();
}

function normalizeMediaRole(value: string | null | undefined) {
  const nextValue = value?.trim();
  if (!nextValue) {
    return null;
  }

  const normalized = nextValue
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

  if (normalized === "st" || normalized === "still" || normalized === "ststill") {
    return "st";
  }

  if (
    normalized === "mf" ||
    normalized === "macroframe" ||
    normalized === "macro" ||
    normalized === "mfmacroframe"
  ) {
    return "mf";
  }

  if (
    normalized === "md" ||
    normalized === "modelo" ||
    normalized === "model" ||
    normalized === "mdmodelo"
  ) {
    return "md";
  }

  if (
    normalized === "mmf" ||
    normalized === "mmfmodelomacroframe" ||
    normalized === "modelomacroframe" ||
    normalized === "modelmacroframe" ||
    normalized === "modelomacro" ||
    normalized === "modelmacro"
  ) {
    return "mmf";
  }

  return normalized || null;
}

function getMediaRolePriority(value: string | null | undefined) {
  switch (normalizeMediaRole(value)) {
    case "st":
      return 0;
    case "mf":
      return 1;
    case "md":
      return 2;
    case "mmf":
      return 3;
    default:
      return 10;
  }
}

function getMediaRoleLabel(value: string | null | undefined) {
  switch (normalizeMediaRole(value)) {
    case "st":
      return "ST - Still";
    case "mf":
      return "MF - Macroframe";
    case "md":
      return "MD - Modelo";
    case "mmf":
      return "MMF - Modelo Macroframe";
    default:
      return null;
  }
}

function getImageDisplayName(value: string | null | undefined, fallback?: string | null) {
  const mediaRoleLabel = getMediaRoleLabel(fallback);
  if (mediaRoleLabel) {
    return mediaRoleLabel;
  }

  const nextValue = normalizeCandidateUrl(value);
  if (!nextValue) {
    return fallback?.trim() || "Imagem";
  }

  let normalized = nextValue;

  if (/^https?:\/\//i.test(normalized)) {
    try {
      const url = new URL(normalized);
      normalized = decodeURIComponent(url.pathname);
    } catch {
      normalized = normalized.replace(/^https?:\/\/[^/]+/i, "");
    }
  } else {
    normalized = decodeURIComponent(normalized);
  }

  const fileName = normalized.split("/").filter(Boolean).pop() ?? normalized;
  const baseName = fileName.replace(/\.[a-z0-9]+$/i, "").replace(/_(st|md|sm)$/i, "");
  const label = baseName.replace(/[_-]+/g, " ").trim();

  return label || fallback?.trim() || "Imagem";
}

function buildGalleryImageGroups(product: Product | null) {
  if (!product) {
    return [];
  }

  const rawAssets = [...(product.media_assets ?? []), ...(product.mediaAssets ?? [])];
  const sortedAssets = [...rawAssets].sort((left, right) => {
    const leftOrder = left.sort_order ?? left.sortOrder ?? 0;
    const rightOrder = right.sort_order ?? right.sortOrder ?? 0;
    return leftOrder - rightOrder;
  });

  const groups = new Map<
    string,
    { candidates: string[]; label: string; priority: number; sortOrder: number }
  >();

  function addGroup(
    groupKey: string | null | undefined,
    keySource: string | null | undefined,
    urls: Array<string | null | undefined>,
    fallbackLabel?: string | null,
    priority = 10,
    sortOrder = 999
  ) {
    const key = groupKey ?? getCanonicalImageKey(keySource ?? urls[0]);
    if (!key) {
      return;
    }

    const current = groups.get(key) ?? {
      candidates: [],
      label: getImageDisplayName(keySource ?? urls[0], fallbackLabel),
      priority,
      sortOrder
    };
    for (const url of urls) {
      const normalizedUrl = normalizeCandidateUrl(url);
      if (normalizedUrl && !current.candidates.includes(normalizedUrl)) {
        current.candidates.push(normalizedUrl);
      }
    }

    if (current.candidates.length > 0) {
      groups.set(key, current);
    }
  }

  sortedAssets.forEach((asset: ProductMediaAsset) => {
    const storageKey = asset.storage_key ?? asset.storageKey;
    const roleKey = normalizeMediaRole(asset.role);
    const canonicalKey = getCanonicalImageKey(storageKey ?? asset.url);
    const groupKey = roleKey ? `role:${roleKey}` : canonicalKey ? `asset:${canonicalKey}` : null;

    addGroup(groupKey, storageKey ?? asset.url, [
      asset.url,
      buildStableMediaApiUrl(storageKey),
      buildPublicBucketUrl(storageKey)
    ], asset.role, getMediaRolePriority(asset.role), asset.sort_order ?? asset.sortOrder ?? 999);
  });

  if (groups.size < 4) {
    [...(product.media_urls ?? []), ...(product.mediaUrls ?? [])].forEach((url) => {
      const canonicalKey = getCanonicalImageKey(url);
      addGroup(canonicalKey ? `asset:${canonicalKey}` : null, url, [url]);
    });

    const bronzeKey = product.s3_key_bronze ?? product.bronzeImageKey;
    const canonicalBronzeKey = getCanonicalImageKey(bronzeKey);
    addGroup(
      canonicalBronzeKey ? `asset:${canonicalBronzeKey}` : null,
      bronzeKey,
      [buildStableMediaApiUrl(bronzeKey), buildPublicBucketUrl(bronzeKey)],
      "st"
    );

    const silverKey = product.s3_key_silver ?? product.silverImageKey;
    const canonicalSilverKey = getCanonicalImageKey(silverKey);
    addGroup(
      canonicalSilverKey ? `asset:${canonicalSilverKey}` : null,
      silverKey,
      [buildStableMediaApiUrl(silverKey), buildPublicBucketUrl(silverKey)]
    );
  }

  return Array.from(groups.entries())
    .sort((left, right) => {
      const [, leftEntry] = left;
      const [, rightEntry] = right;

      if (leftEntry.priority !== rightEntry.priority) {
        return leftEntry.priority - rightEntry.priority;
      }

      if (leftEntry.sortOrder !== rightEntry.sortOrder) {
        return leftEntry.sortOrder - rightEntry.sortOrder;
      }

      return leftEntry.label.localeCompare(rightEntry.label, "pt-BR", {
        sensitivity: "base"
      });
    })
    .map(([key, entry]) => ({
      key,
      candidates: entry.candidates,
      label: entry.label
    }));
}

function buildPrimaryImageCandidates(product: Product | null) {
  const galleryGroups = buildGalleryImageGroups(product);
  if (galleryGroups.length > 0) {
    return galleryGroups[0].candidates;
  }

  return collectProductImageCandidates(product);
}

function getVariantDisplayLabel(variant: ProductVariant) {
  if (variant.size_labels.length > 0) {
    return variant.size_labels.join(", ");
  }

  if (variant.color_labels.length > 0) {
    return variant.color_labels.join(", ");
  }

  const firstOption = variant.options[0];
  return firstOption?.label ?? "Sem atributo";
}

function variantMatchesInventorySearch(variant: ProductVariant, normalizedQuery: string) {
  if (!normalizedQuery) {
    return true;
  }

  const variantSearchText = [
    variant.sku,
    ...variant.size_labels,
    ...variant.color_labels,
    ...variant.options.map((option) => option.label)
  ]
    .filter(Boolean)
    .join(" ");

  return normalizeSearchTerm(variantSearchText).includes(normalizedQuery);
}

function itemMatchesInventorySearch(
  item: AdminInventoryItem,
  product: Product | null,
  normalizedQuery: string
) {
  if (!normalizedQuery) {
    return true;
  }

  const productSearchText = [
    item.sku,
    item.name,
    product?.sku,
    product?.code,
    product?.numero_serie,
    product?.name,
    product?.nome,
    product?.description,
    product?.descricao,
    product?.supplier_code,
    product?.supplierCode,
    product?.supplier_product_sku,
    product?.supplierProductSku,
    product?.material_base,
    product?.categoria,
    product?.subcategoria
  ]
    .filter(Boolean)
    .join(" ");

  if (normalizeSearchTerm(productSearchText).includes(normalizedQuery)) {
    return true;
  }

  return (product?.variants ?? []).some((variant) =>
    variantMatchesInventorySearch(variant, normalizedQuery)
  );
}

function getInventoryVariantRecord(
  item: AdminInventoryItem,
  variant: ProductVariant
): AdminInventoryVariant | null {
  return (
    item.variants.find((inventoryVariant) => inventoryVariant.variantId === variant.variant_id) ??
    item.variants.find((inventoryVariant) => inventoryVariant.sku === variant.sku) ??
    null
  );
}

function getVariantDisplayStock(item: AdminInventoryItem, variant: ProductVariant) {
  const inventoryVariant = getInventoryVariantRecord(item, variant);
  return inventoryVariant?.effectiveStockQuantity ?? variant.individual_stock;
}

function getVariantUnitsStock(item: AdminInventoryItem, variant: ProductVariant) {
  const stock = getVariantDisplayStock(item, variant);
  const weight = toNumber(variant.individual_weight ?? variant.individualWeight);

  if (weight === null || weight <= 0) {
    return null;
  }

  return stock / weight;
}

function getVariantCost(product: Product | null, variant: ProductVariant) {
  const variantWeight = toNumber(variant.individual_weight ?? variant.individualWeight);
  const productCost = typeof product?.costFinal === "number" ? product.costFinal : null;

  if (variantWeight === null || variantWeight <= 0 || productCost === null || !Number.isFinite(productCost)) {
    return null;
  }

  return variantWeight * productCost;
}

function ProductImage(props: { product: Product | null; alt: string; mode?: "line" | "card" }) {
  const { product, alt, mode = "card" } = props;
  const candidates = buildPrimaryImageCandidates(product);
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
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/45 text-sm text-slate-300">
          +
        </span>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">
            Sem foto
          </p>
          {!isCompact ? (
            <p className="mt-1 text-xs text-slate-300/80">Produto sem imagem valida no catalogo.</p>
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
    </button>
  );
}

function InventorySummaryBox(props: {
  label: string;
  value: string | number;
  valueClassName?: string;
}) {
  const { label, value, valueClassName = "text-slate-50" } = props;

  return (
    <div className="surface-stat flex h-[4.85rem] min-w-[8.75rem] flex-col justify-between rounded-[1.1rem] px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className={["text-lg font-semibold leading-none", valueClassName].join(" ")}>{value}</p>
    </div>
  );
}

type CompanyDetailPageProps = {
  company: Company;
  activeTab: "profile" | "keys" | "inventory" | "costs";
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
  onChangeTab: (tab: "profile" | "keys" | "inventory" | "costs") => void;
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
  const [inventorySearch, setInventorySearch] = useState("");
  const normalizedInventorySearch = normalizeSearchTerm(inventorySearch);
  const filteredInventory = useMemo(
    () =>
      inventory.filter((item) =>
        itemMatchesInventorySearch(
          item,
          productsById.get(item.productId) ?? null,
          normalizedInventorySearch
        )
      ),
    [inventory, normalizedInventorySearch, products]
  );

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
      <div className="surface-panel rounded-[2rem] p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <button
              type="button"
              onClick={onBack}
              className="surface-button-secondary inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition"
            >
              Voltar ao dashboard
            </button>
            <p className="surface-kicker mt-5">
              Visao da Empresa
            </p>
            <h2 className="mt-2 font-display text-4xl tracking-tight text-slate-50">
              {company.legalName}
            </h2>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <StatusChip active={company.isActive}>
                {company.isActive ? "Ativa" : "Inativa"}
              </StatusChip>
              <span className="surface-chip rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]">
                Codigo {company.externalCode}
              </span>
              {company.syncStoreInventory ? (
                <span className="rounded-full border border-cyan-400/24 bg-cyan-400/12 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100">
                  Sync loja ativo
                </span>
              ) : null}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="surface-stat rounded-[1.5rem] px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Chaves emitidas
              </p>
              <p className="mt-3 font-display text-3xl tracking-tight text-slate-50">
                {company.apiKeyCount}
              </p>
            </div>
            <div className="surface-stat rounded-[1.5rem] border border-emerald-400/22 bg-[linear-gradient(180deg,rgba(52,211,153,0.12),rgba(16,185,129,0.06)),rgba(18,18,24,0.92)] px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">
                Chaves ativas
              </p>
              <p className="mt-3 font-display text-3xl tracking-tight text-emerald-100">
                {company.activeKeyCount}
              </p>
            </div>
            <div className="surface-stat rounded-[1.5rem] border border-amber-400/22 bg-[linear-gradient(180deg,rgba(251,191,36,0.12),rgba(245,158,11,0.06)),rgba(18,18,24,0.92)] px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">
                Produtos no painel
              </p>
              <p className="mt-3 font-display text-3xl tracking-tight text-amber-100">
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
                ? "surface-button-primary text-white"
                : "surface-button-secondary text-slate-100"
            ].join(" ")}
          >
            Estoque da Empresa
          </button>
          <button
            type="button"
            onClick={() => onChangeTab("costs")}
            className={[
              "rounded-full px-4 py-2 text-sm font-semibold transition",
              activeTab === "costs"
                ? "surface-button-warning"
                : "surface-button-secondary text-slate-100"
            ].join(" ")}
          >
            Custos
          </button>
          <button
            type="button"
            onClick={() => onChangeTab("profile")}
            className={[
              "rounded-full px-4 py-2 text-sm font-semibold transition",
              activeTab === "profile"
                ? "surface-button-primary text-white"
                : "surface-button-secondary text-slate-100"
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
                ? "surface-button-warning"
                : "surface-button-secondary text-slate-100"
            ].join(" ")}
          >
            Gestao de credenciais
          </button>
        </div>
      </div>

      {activeTab === "profile" ? (
        <section className="surface-panel rounded-[2rem] p-6">
          <div className="surface-divider border-b pb-5">
            <p className="surface-kicker">
              Dados da empresa
            </p>
            <h3 className="mt-2 font-display text-3xl tracking-tight text-slate-50">
              Configuracoes da operacao
            </h3>
          </div>

          <div className="mt-6 max-w-3xl space-y-5">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-300">
                Nome da empresa
              </span>
              <input
                value={companyForm.legalName}
                onChange={(event) => onCompanyFormChange({ legalName: event.target.value })}
                className="surface-input w-full rounded-[1.2rem] px-4 py-3 text-sm outline-none transition"
              />
            </label>

            <div className="surface-card flex items-center justify-between rounded-[1.4rem] px-4 py-4">
              <div>
                <p className="text-sm font-semibold text-slate-100">Empresa ativa</p>
                <p className="mt-1 text-sm text-slate-400">
                  Bloqueia ou libera imediatamente as integracoes dessa company.
                </p>
              </div>
              <Toggle
                checked={companyForm.isActive}
                onChange={(nextValue) => onCompanyFormChange({ isActive: nextValue })}
              />
            </div>

            <div className="surface-card flex items-center justify-between rounded-[1.4rem] border border-cyan-400/16 bg-[linear-gradient(180deg,rgba(34,211,238,0.08),rgba(255,255,255,0.02)),rgba(22,22,28,0.92)] px-4 py-4">
              <div className="pr-4">
                <p className="text-sm font-semibold text-slate-100">
                  Sincronizar estoque loja
                </p>
                <p className="mt-1 text-sm text-slate-400">
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
                className="surface-button-primary inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition"
              >
                Salvar configuracoes
              </button>
              <button
                type="button"
                disabled={deletingCompany}
                onClick={onDeleteCompany}
                className="surface-button-danger inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deletingCompany ? "Excluindo..." : "Excluir empresa"}
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === "keys" ? (
        <section className="surface-panel rounded-[2rem] p-6">
          <div className="surface-divider flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="surface-kicker">
                API Keys
              </p>
              <h3 className="mt-2 font-display text-3xl tracking-tight text-slate-50">
                Gestao de credenciais
              </h3>
              <p className="mt-2 text-sm text-slate-400">
                Gere novas chaves para integracoes e revogue acessos comprometidos.
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenIssueKey}
              className="surface-button-warning inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition"
            >
              Gerar nova chave
            </button>
          </div>

          <div className="mt-6 space-y-4">
            {apiKeysState === "loading" ? (
              <p className="text-sm text-slate-400">Atualizando chaves da empresa...</p>
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
                className="surface-card rounded-[1.5rem] p-4"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-display text-xl tracking-tight text-slate-50">
                        {apiKey.keyPrefix}
                      </p>
                      <StatusChip active={!apiKey.isRevoked}>
                        {apiKey.isRevoked ? "Revogada" : "Ativa"}
                      </StatusChip>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-slate-400">
                      <p>Rate limit: {apiKey.rateLimitPerMinute} req/min</p>
                      <p>Criada: {formatDate(apiKey.createdAt)}</p>
                      <p>Ultimo uso: {formatDate(apiKey.lastUsedAt)}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={apiKey.isRevoked || keyActionId === apiKey.id}
                    onClick={() => onRevokeKey(apiKey.id)}
                    className="surface-button-danger inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
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
        <section className="surface-panel rounded-[2rem] p-6">
          <div className="surface-divider flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="surface-kicker">
                Estoque da Empresa
              </p>
              <h3 className="mt-2 font-display text-3xl tracking-tight text-slate-50">
                Catalogo mestre com fotos e variacoes
              </h3>
              <p className="mt-2 text-sm text-slate-400">
                Edite o estoque isolado da empresa e visualize foto, SKU principal e todas as
                variacoes cadastradas no catalogo mestre.
              </p>
            </div>
            <button
              type="button"
              disabled={syncingCatalog}
              onClick={onSyncCatalog}
              className="surface-button-secondary inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
            >
              {company.syncStoreInventory ? "Atualizar agora" : "Verificar alteracoes"}
            </button>
          </div>

          <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="w-full max-w-2xl">
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Buscar produto ou variante
                </span>
                <input
                  type="search"
                  value={inventorySearch}
                  onChange={(event) => setInventorySearch(event.target.value)}
                  placeholder="Busque por sku, descricao comercial, cod fornecedor, variante ou tamanho"
                  className="surface-input mt-2 w-full rounded-[1.2rem] px-4 py-3 text-sm outline-none transition"
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span className="surface-chip rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
                {filteredInventory.length} de {inventory.length} produto(s)
              </span>
              {inventorySearch ? (
                <button
                  type="button"
                  onClick={() => setInventorySearch("")}
                  className="surface-button-secondary inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition"
                >
                  Limpar busca
                </button>
              ) : null}
            </div>
          </div>

          {inventoryState === "loading" ? (
            <p className="mt-6 text-sm text-slate-400">Carregando estoque da empresa...</p>
          ) : null}

          {inventory.length === 0 && inventoryState !== "loading" ? (
            <div className="mt-6">
              <div className="space-y-4">
                <EmptyState
                  title="Sem produtos sincronizados"
                  description={
                    company.syncStoreInventory
                      ? "Nenhum produto foi carregado para essa empresa ainda."
                      : "Sincronize o catalogo mestre primeiro para habilitar o estoque por empresa."
                  }
                />
                <div className="flex justify-center">
                  <button
                    type="button"
                    disabled={syncingCatalog}
                    onClick={onSyncCatalog}
                    className="surface-button-primary inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {company.syncStoreInventory ? "Atualizar agora" : "Sincronizar agora"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {inventory.length > 0 && filteredInventory.length === 0 ? (
            <div className="mt-6">
              <EmptyState
                title="Nenhum produto encontrado"
                description="Tente buscar por SKU, descricao comercial, codigo do fornecedor ou por uma variante especifica."
              />
            </div>
          ) : null}

          {filteredInventory.length > 0 ? (
            <div className="mt-6 space-y-3">
              {filteredInventory.map((item) => {
                const product = productsById.get(item.productId) ?? null;
                const variants = product?.variants ?? [];
                const matchingVariants = normalizedInventorySearch
                  ? variants.filter((variant) =>
                      variantMatchesInventorySearch(variant, normalizedInventorySearch)
                    )
                  : variants;
                const displayedVariants =
                  matchingVariants.length > 0 ? matchingVariants : variants;
                const currentDisplayStock = getCurrentDisplayStock(item, product);
                const isCardOpen = openInventoryProductId === item.productId;
                const productCost = formatCurrency(product?.costFinal);
                const variantCountLabel =
                  normalizedInventorySearch &&
                  matchingVariants.length > 0 &&
                  matchingVariants.length !== variants.length
                    ? `${matchingVariants.length} de ${variants.length} variacoes`
                    : `${variants.length} variacoes`;

                return (
                  <article
                    key={item.productId}
                    className={[
                      "overflow-hidden rounded-[1.75rem] border transition",
                      isCardOpen
                        ? "border-cyan-400/25 bg-[linear-gradient(180deg,rgba(34,211,238,0.08),rgba(255,255,255,0.02)),rgba(17,17,24,0.96)] shadow-[0_22px_55px_rgba(8,145,178,0.18)]"
                        : "border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.008)),rgba(17,17,24,0.94)] shadow-[0_12px_28px_rgba(0,0,0,0.22)] hover:border-cyan-400/20 hover:bg-[linear-gradient(180deg,rgba(34,211,238,0.06),rgba(255,255,255,0.02)),rgba(17,17,24,0.96)] hover:shadow-[0_18px_40px_rgba(0,0,0,0.28)]"
                    ].join(" ")}
                  >
                    <button
                      type="button"
                      onClick={() => toggleInventoryCard(item.productId)}
                      className="flex w-full flex-col gap-3 p-3 text-left sm:p-4"
                    >
                      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                        <div className="flex min-w-0 items-center gap-3 xl:flex-1">
                          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-[1.25rem] border border-white/8 bg-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                            <ProductImage product={product} alt={item.name} mode="line" />
                          </div>

                          <div className="grid min-w-0 flex-1 gap-3 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,0.55fr)_minmax(0,1.2fr)] xl:items-center">
                              <div className="min-w-0">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                  Cód
                                </p>
                                  <p className="mt-1 truncate font-display text-base tracking-tight text-slate-50">
                                  {item.sku}
                                </p>
                              </div>

                              <div className="min-w-0">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                  Cod fornecedor
                                </p>
                                <p className="mt-1 truncate text-sm font-semibold text-slate-200">
                                  {getSupplierCode(product)}
                                </p>
                              </div>

                            <div className="min-w-0">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                Descricao comercial
                              </p>
                              <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-300">
                                {getCommercialDescription(product, item.name)}
                              </p>
                            </div>
                          </div>
                        </div>

                          <div className="flex flex-wrap items-center gap-3 xl:ml-4 xl:shrink-0 xl:flex-nowrap">
                            <span className="rounded-full border border-cyan-400/20 bg-cyan-400/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100">
                              {variantCountLabel}
                            </span>
                            <InventorySummaryBox
                              label="Custo"
                              value={productCost}
                              valueClassName="text-cyan-100"
                            />
                            <InventorySummaryBox label="Estoque loja" value={currentDisplayStock} />
                            <span
                              className={[
                                "inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold transition",
                              isCardOpen
                                ? "surface-button-primary text-white"
                                : "surface-button-secondary text-slate-100"
                            ].join(" ")}
                          >
                            {isCardOpen ? "Fechar card" : "Abrir card"}
                          </span>
                        </div>
                      </div>
                    </button>

                    {isCardOpen ? (
                      <div className="surface-divider border-t bg-white/[0.015] px-5 py-5">
                        <div className="space-y-5">
                          <div className="surface-card rounded-[1.5rem] px-4 py-4">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                              <div className="max-w-md">
                                <p className="text-sm font-semibold text-slate-100">
                                  Estoque isolado da empresa
                                </p>
                                <p className="mt-1 text-sm text-slate-400">
                                  O valor salvo aqui substitui o estoque mestre desse produto para a empresa selecionada.
                                </p>
                                {item.hasVariantInventory ? (
                                  <p className="mt-2 text-sm font-medium text-cyan-200">
                                    Total atual pelas variantes: {currentDisplayStock}
                                  </p>
                                ) : null}
                              </div>

                              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                <input
                                  type="number"
                                  min="0"
                                  value={getManualInventoryValue(item, inventoryDrafts[item.productId])}
                                  placeholder={item.hasVariantInventory ? String(currentDisplayStock) : undefined}
                                  onChange={(event) =>
                                    onInventoryDraftChange(item.productId, event.target.value)
                                  }
                                  className="surface-input w-32 rounded-[1rem] px-3 py-2 text-sm outline-none transition"
                                />
                                <button
                                  type="button"
                                  disabled={savingInventoryId === item.productId}
                                  onClick={() => onSaveInventory(item.productId)}
                                  className="surface-button-secondary inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {savingInventoryId === item.productId ? "Salvando..." : "Salvar"}
                                </button>
                              </div>
                            </div>
                          </div>

                          {product && displayedVariants.length > 0 ? (
                            <div className="surface-card rounded-[1.5rem] px-4 py-4">
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-slate-100">
                                    Variantes ({displayedVariants.length})
                                  </p>
                                  <p className="mt-1 text-sm text-slate-400">
                                    {normalizedInventorySearch && matchingVariants.length > 0
                                      ? "Variacoes filtradas pela busca atual."
                                      : "Variacoes oficiais do catalogo mestre para consulta rapida da empresa."}
                                  </p>
                                </div>
                                {product?.material_base ? (
                                  <span className="surface-chip rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
                                    {product.material_base}
                                  </span>
                                ) : null}
                              </div>

                              <div className="mt-4 overflow-x-auto">
                                <table className="surface-table min-w-full divide-y divide-white/8 text-left">
                                    <thead className="text-[11px] uppercase tracking-[0.16em]">
                                      <tr>
                                        <th className="px-3 py-3 font-semibold">Tamanho</th>
                                        <th className="px-3 py-3 font-semibold">SKU</th>
                                        <th className="px-3 py-3 font-semibold">Peso (g)</th>
                                        <th className="px-3 py-3 font-semibold">Custo</th>
                                        <th className="px-3 py-3 font-semibold">Estoque/Peso (g)</th>
                                        <th className="px-3 py-3 font-semibold">Estoque (UN)</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                      {displayedVariants.map((variant) => (
                                        <tr key={variant.variant_id} className="text-sm text-slate-300">
                                        <td className="px-3 py-3 font-semibold text-slate-100">
                                          {getVariantDisplayLabel(variant)}
                                        </td>
                                        <td className="px-3 py-3">{variant.sku}</td>
                                          <td className="px-3 py-3">
                                            {formatWeight(
                                              variant.individual_weight ?? variant.individualWeight
                                            )}
                                          </td>
                                          <td className="px-3 py-3 text-slate-200">
                                            {formatCurrency(getVariantCost(product, variant))}
                                          </td>
                                          <td className="px-3 py-3">
                                            <span className="inline-flex min-w-10 items-center justify-center rounded-full border border-rose-400/20 bg-rose-500/18 px-2 py-1 text-xs font-semibold text-rose-100">
                                              {formatWeightStock(getVariantDisplayStock(item, variant))}
                                            </span>
                                          </td>
                                          <td className="px-3 py-3 text-slate-200">
                                            {formatUnits(getVariantUnitsStock(item, variant))}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                            </div>
                          ) : null}

                          {!product && productsState === "loading" ? (
                            <p className="text-sm text-slate-500">Carregando variantes do catalogo mestre...</p>
                          ) : null}

                          {!product && productsState !== "loading" ? (
                            <div className="rounded-[1.25rem] border border-dashed border-white/12 bg-white/[0.03] px-4 py-4 text-sm text-slate-400">
                              Nao foi possivel carregar as variantes desse produto no catalogo mestre.
                            </div>
                          ) : null}
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
