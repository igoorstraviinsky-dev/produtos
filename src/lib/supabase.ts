import { SupabaseClient, createClient } from "@supabase/supabase-js";

import type { ProductMediaAssetRecord } from "../modules/media/media.service";

export type ProductVariantOptionRecord = {
  id: string;
  kind: string;
  label: string;
};

export type ProductVariantRecord = {
  variant_id: string;
  variantId: string;
  product_id: string;
  productId: string;
  sku: string;
  individual_weight: string | number | null;
  individualWeight: string | number | null;
  individual_stock: number;
  individualStock: number;
  size_labels: string[];
  sizeLabels: string[];
  color_labels: string[];
  colorLabels: string[];
  options: ProductVariantOptionRecord[];
  created_at: string | null;
  createdAt: string | null;
  updated_at: string | null;
  updatedAt: string | null;
};

export type ProductRecord = {
  media_assets?: ProductMediaAssetRecord[];
  mediaAssets?: ProductMediaAssetRecord[];
  media_urls?: string[];
  mediaUrls?: string[];
  main_image_url?: string | null;
  mainImageUrl?: string | null;
  variants: ProductVariantRecord[];
  id: string;
  product_id: string;
  code: string;
  sku: string;
  numero_serie: string;
  name: string;
  nome: string;
  serialNumber: string;
  description: string | null;
  descricao: string | null;
  category: string | null;
  categoria: string | null;
  subcategory: string | null;
  subcategoria: string | null;
  material: string | null;
  baseMaterial: string | null;
  material_base: string | null;
  purity: string | null;
  pureza: string | null;
  weight_grams: string | number | null;
  weightGrams: string | number | null;
  peso_gramas: string | number | null;
  bathType: string | null;
  tipo_banho: string | null;
  status: string | null;
  bronzeImageKey: string | null;
  s3_key_bronze: string | null;
  silverImageKey: string | null;
  s3_key_silver: string | null;
  supplierCode: string | null;
  supplier_code: string | null;
  supplierId: string | null;
  supplier_id: string | null;
  supplierName: string | null;
  supplier_name: string | null;
  supplierProductSku: string | null;
  supplier_product_sku: string | null;
  fiscalCode: string | null;
  fiscal_code: string | null;
  categoryId: string | null;
  category_id: string | null;
  productType: string | null;
  tipo: string | null;
  typeId: string | null;
  type_id: string | null;
  subcategoryId: string | null;
  subcategory_id: string | null;
  blingProductId: string | null;
  bling_product_id: string | null;
  blingLastSyncAt: string | null;
  bling_last_sync_at: string | null;
  laborRateId: string | null;
  labor_rate_id: string | null;
  laborRateLabel: string | null;
  labor_rate_label: string | null;
  laborCost: string | number | null;
  labor_cost: string | number | null;
  sizeOptionId: string | null;
  size_option_id: string | null;
  sizeLabel: string | null;
  size_label: string | null;
  colorOptionId: string | null;
  color_option_id: string | null;
  colorLabel: string | null;
  color_label: string | null;
  availableQuantity: number;
  available_quantity: number | null;
  stock_quantity: number | null;
  ncm: string | null;
  laborRateTableId: string | null;
  labor_rate_table_id: string | null;
  laborRateTableName: string | null;
  labor_rate_table_name: string | null;
  createdAt: string | null;
  created_at: string | null;
  price: number | null;
  updatedAt: string | null;
  updated_at: string | null;
};

export type LaborRateTableRecord = {
  id: string;
  name: string;
  nome: string;
  label: string;
};

export type ProductTypeRecord = {
  id: string;
  name: string;
  nome: string;
  label: string;
  material: string | null;
  baseMaterial: string | null;
  material_base: string | null;
  purity: string | null;
  pureza: string | null;
};

export interface ProductGateway {
  listProducts(): Promise<ProductRecord[]>;
  listLaborRateTables(): Promise<LaborRateTableRecord[]>;
  listProductTypes(): Promise<ProductTypeRecord[]>;
  updateProduct(input: {
    id: string;
    sku: string;
    name: string;
    availableQuantity: number;
  }): Promise<ProductRecord>;
}

type RemoteProductRow = {
  id: string;
  sku?: string | null;
  numero_serie?: string | null;
  name?: string | null;
  nome?: string | null;
  descricao?: string | null;
  categoria?: string | null;
  subcategoria?: string | null;
  material_base?: string | null;
  pureza?: string | null;
  peso_gramas?: string | number | null;
  tipo_banho?: string | null;
  status?: string | null;
  s3_key_bronze?: string | null;
  s3_key_silver?: string | null;
  supplier_code?: string | null;
  supplier_product_sku?: string | null;
  fiscal_code?: string | null;
  category_id?: string | null;
  tipo?: string | null;
  type_id?: string | null;
  subcategory_id?: string | null;
  bling_product_id?: string | null;
  bling_last_sync_at?: string | null;
  labor_rate_id?: string | null;
  labor_rate_label?: string | null;
  labor_cost?: string | number | null;
  size_option_id?: string | null;
  size_label?: string | null;
  color_option_id?: string | null;
  color_label?: string | null;
  available_quantity?: number | null;
  stock_quantity?: number | null;
  ncm?: string | null;
  labor_rate_table_id?: string | null;
  labor_rate_table_name?: string | null;
  created_at?: string | null;
  price?: number | null;
  updated_at?: string | null;
};

type RemoteSupplierRow = {
  id: string;
  code: string;
  name: string;
};

type RemoteProductTypeRow = {
  id: string;
  nome?: string | null;
  name?: string | null;
  label?: string | null;
  tipo?: string | null;
  material_base?: string | null;
  pureza?: string | null;
};

type RemoteLaborRateTableRow = {
  id: string;
  nome?: string | null;
  name?: string | null;
  label?: string | null;
};

type RemoteProductVariantRow = {
  id: string;
  product_id: string;
  sku?: string | null;
  individual_weight?: string | number | null;
  individual_stock?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type RemoteProductMediaAssetRow = {
  id: string;
  product_id: string;
  role?: string | null;
  storage_key?: string | null;
  sort_order?: number | null;
  created_at?: string | null;
};

type RemoteVariantOptionLinkRow = {
  variant_id: string;
  option_id: string;
};

type RemoteTreatmentOptionRow = {
  id: string;
  kind?: string | null;
  label?: string | null;
};

function compareText(left: string, right: string) {
  return left.localeCompare(right, "pt-BR", {
    sensitivity: "base"
  });
}

function sortOptions(options: ProductVariantOptionRecord[]) {
  return [...options].sort((left, right) => {
    const kindOrder = compareText(left.kind, right.kind);
    if (kindOrder !== 0) {
      return kindOrder;
    }

    return compareText(left.label, right.label);
  });
}

function mapRemoteProductVariantRow(
  row: RemoteProductVariantRow,
  options: ProductVariantOptionRecord[]
): ProductVariantRecord {
  const sortedOptions = sortOptions(options);
  const sizeLabels = sortedOptions
    .filter((option) => option.kind === "size")
    .map((option) => option.label);
  const colorLabels = sortedOptions
    .filter((option) => option.kind === "color")
    .map((option) => option.label);

  return {
    variant_id: row.id,
    variantId: row.id,
    product_id: row.product_id,
    productId: row.product_id,
    sku: row.sku ?? row.id,
    individual_weight: row.individual_weight ?? null,
    individualWeight: row.individual_weight ?? null,
    individual_stock: row.individual_stock ?? 0,
    individualStock: row.individual_stock ?? 0,
    size_labels: sizeLabels,
    sizeLabels,
    color_labels: colorLabels,
    colorLabels,
    options: sortedOptions,
    created_at: row.created_at ?? null,
    createdAt: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
    updatedAt: row.updated_at ?? null
  };
}

function mapRemoteProductRow(
  row: RemoteProductRow,
  variants: ProductVariantRecord[],
  supplier: RemoteSupplierRow | null,
  productType: RemoteProductTypeRow | null
): ProductRecord {
  return mapRemoteProductRowWithMedia(row, variants, [], supplier, productType);
}

function mapRemoteProductRowWithMedia(
  row: RemoteProductRow,
  variants: ProductVariantRecord[],
  mediaAssets: ProductMediaAssetRecord[],
  supplier: RemoteSupplierRow | null,
  productType: RemoteProductTypeRow | null
): ProductRecord {
  const code = row.numero_serie ?? row.sku ?? row.id;
  const resolvedProductType =
    productType?.nome ??
    productType?.name ??
    productType?.label ??
    productType?.tipo ??
    row.tipo ??
    null;
  const resolvedMaterial =
    productType?.material_base ??
    row.material_base ??
    resolvedProductType ??
    null;
  const resolvedPurity = productType?.pureza ?? row.pureza ?? null;

  return {
    media_assets: mediaAssets,
    mediaAssets,
    media_urls: [],
    mediaUrls: [],
    main_image_url: null,
    mainImageUrl: null,
    variants,
    id: row.id,
    product_id: row.id,
    code,
    sku: row.sku ?? row.numero_serie ?? row.id,
    numero_serie: row.numero_serie ?? row.sku ?? row.id,
    name: row.name ?? row.nome ?? row.id,
    nome: row.nome ?? row.name ?? row.id,
    serialNumber: code,
    description: row.descricao ?? null,
    descricao: row.descricao ?? null,
    category: row.categoria ?? null,
    categoria: row.categoria ?? null,
    subcategory: row.subcategoria ?? null,
    subcategoria: row.subcategoria ?? null,
    material: resolvedMaterial,
    baseMaterial: resolvedMaterial,
    material_base: resolvedMaterial,
    purity: resolvedPurity,
    pureza: resolvedPurity,
    weight_grams: row.peso_gramas ?? null,
    weightGrams: row.peso_gramas ?? null,
    peso_gramas: row.peso_gramas ?? null,
    bathType: row.tipo_banho ?? null,
    tipo_banho: row.tipo_banho ?? null,
    status: row.status ?? null,
    bronzeImageKey: row.s3_key_bronze ?? null,
    s3_key_bronze: row.s3_key_bronze ?? null,
    silverImageKey: row.s3_key_silver ?? null,
    s3_key_silver: row.s3_key_silver ?? null,
    supplierCode: row.supplier_code ?? null,
    supplier_code: row.supplier_code ?? null,
    supplierId: supplier?.id ?? null,
    supplier_id: supplier?.id ?? null,
    supplierName: supplier?.name ?? null,
    supplier_name: supplier?.name ?? null,
    supplierProductSku: row.supplier_product_sku ?? null,
    supplier_product_sku: row.supplier_product_sku ?? null,
    fiscalCode: row.fiscal_code ?? null,
    fiscal_code: row.fiscal_code ?? null,
    categoryId: row.category_id ?? null,
    category_id: row.category_id ?? null,
    productType: resolvedProductType,
    tipo: resolvedProductType,
    typeId: row.type_id ?? null,
    type_id: row.type_id ?? null,
    subcategoryId: row.subcategory_id ?? null,
    subcategory_id: row.subcategory_id ?? null,
    blingProductId: row.bling_product_id ?? null,
    bling_product_id: row.bling_product_id ?? null,
    blingLastSyncAt: row.bling_last_sync_at ?? null,
    bling_last_sync_at: row.bling_last_sync_at ?? null,
    laborRateId: row.labor_rate_id ?? null,
    labor_rate_id: row.labor_rate_id ?? null,
    laborRateLabel: row.labor_rate_label ?? null,
    labor_rate_label: row.labor_rate_label ?? null,
    laborCost:
      row.labor_cost === null || row.labor_cost === undefined ? null : String(row.labor_cost),
    labor_cost:
      row.labor_cost === null || row.labor_cost === undefined ? null : row.labor_cost,
    sizeOptionId: row.size_option_id ?? null,
    size_option_id: row.size_option_id ?? null,
    sizeLabel: row.size_label ?? null,
    size_label: row.size_label ?? null,
    colorOptionId: row.color_option_id ?? null,
    color_option_id: row.color_option_id ?? null,
    colorLabel: row.color_label ?? null,
    color_label: row.color_label ?? null,
    availableQuantity: row.available_quantity ?? row.stock_quantity ?? 0,
    available_quantity: row.available_quantity ?? null,
    stock_quantity: row.stock_quantity ?? null,
    ncm: row.ncm ?? null,
    laborRateTableId: row.labor_rate_table_id ?? null,
    labor_rate_table_id: row.labor_rate_table_id ?? null,
    laborRateTableName: row.labor_rate_table_name ?? null,
    labor_rate_table_name: row.labor_rate_table_name ?? null,
    createdAt: row.created_at ?? null,
    created_at: row.created_at ?? null,
    price: row.price ?? null,
    updatedAt: row.updated_at ?? null,
    updated_at: row.updated_at ?? null
  };
}

function mapRemoteLaborRateTableRow(row: RemoteLaborRateTableRow): LaborRateTableRecord {
  const resolvedName = row.nome ?? row.name ?? row.label ?? row.id;

  return {
    id: row.id,
    name: resolvedName,
    nome: resolvedName,
    label: resolvedName
  };
}

function mapRemoteProductTypeRow(row: RemoteProductTypeRow): ProductTypeRecord {
  const resolvedName = row.nome ?? row.name ?? row.label ?? row.tipo ?? row.id;
  const resolvedMaterial = row.material_base ?? resolvedName;

  return {
    id: row.id,
    name: resolvedName,
    nome: resolvedName,
    label: resolvedName,
    material: resolvedMaterial,
    baseMaterial: resolvedMaterial,
    material_base: resolvedMaterial,
    purity: row.pureza ?? null,
    pureza: row.pureza ?? null
  };
}

function mapRemoteMediaAssetRow(row: RemoteProductMediaAssetRow): ProductMediaAssetRecord | null {
  if (!row.storage_key) {
    return null;
  }

  return {
    id: row.id,
    role: row.role ?? "media",
    storage_key: row.storage_key,
    storageKey: row.storage_key,
    sort_order: row.sort_order ?? 0,
    sortOrder: row.sort_order ?? 0,
    url: null,
    created_at: row.created_at ?? null,
    createdAt: row.created_at ?? null
  };
}

function buildVariantsByProductId(
  variantRows: RemoteProductVariantRow[],
  linkRows: RemoteVariantOptionLinkRow[],
  optionRows: RemoteTreatmentOptionRow[]
) {
  const optionById = new Map<string, ProductVariantOptionRecord>();
  for (const option of optionRows) {
    if (!option.id || !option.kind || !option.label) {
      continue;
    }

    optionById.set(option.id, {
      id: option.id,
      kind: option.kind,
      label: option.label
    });
  }

  const optionIdsByVariantId = new Map<string, string[]>();
  for (const link of linkRows) {
    const next = optionIdsByVariantId.get(link.variant_id) ?? [];
    next.push(link.option_id);
    optionIdsByVariantId.set(link.variant_id, next);
  }

  const variantsByProductId = new Map<string, ProductVariantRecord[]>();
  for (const variantRow of variantRows) {
    const optionIds = optionIdsByVariantId.get(variantRow.id) ?? [];
    const options = [...new Set(optionIds)]
      .map((optionId) => optionById.get(optionId) ?? null)
      .filter((option): option is ProductVariantOptionRecord => option !== null);
    const mappedVariant = mapRemoteProductVariantRow(variantRow, options);
    const existing = variantsByProductId.get(variantRow.product_id) ?? [];
    existing.push(mappedVariant);
    variantsByProductId.set(variantRow.product_id, existing);
  }

  for (const [productId, variants] of variantsByProductId.entries()) {
    variantsByProductId.set(
      productId,
      [...variants].sort((left, right) => {
        if (left.created_at && right.created_at) {
          return Date.parse(left.created_at) - Date.parse(right.created_at);
        }

        return compareText(left.sku, right.sku);
      })
    );
  }

  return variantsByProductId;
}

export function createSupabaseGatewayClient(url: string, serviceRoleKey: string) {
  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

export class SupabaseProductGateway implements ProductGateway {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly tableName: string
  ) {}

  async listProducts() {
    const { data: productsData, error: productsError } = await this.supabase
      .from(this.tableName)
      .select("*")
      .order("created_at", {
        ascending: false
      });

    if (productsError) {
      throw new Error(`supabase products query failed: ${productsError.message}`);
    }

    const productRows = (productsData ?? []) as RemoteProductRow[];
    const productIds = productRows.map((product) => product.id);
    const supplierCodes = [...new Set(
      productRows
        .map((product) => product.supplier_code?.trim() ?? null)
        .filter((supplierCode): supplierCode is string => Boolean(supplierCode))
    )];

    if (productIds.length === 0) {
      return [];
    }

    const { data: variantsData, error: variantsError } = await this.supabase
      .from("product_variants")
      .select("id, product_id, sku, individual_weight, individual_stock, created_at, updated_at")
      .in("product_id", productIds)
      .order("created_at", {
        ascending: true
      });

    if (variantsError) {
      throw new Error(`supabase product_variants query failed: ${variantsError.message}`);
    }

    const variantRows = (variantsData ?? []) as RemoteProductVariantRow[];
    const variantIds = variantRows.map((variant) => variant.id);

    let linkRows: RemoteVariantOptionLinkRow[] = [];
    let optionRows: RemoteTreatmentOptionRow[] = [];
    let mediaAssetRows: RemoteProductMediaAssetRow[] = [];
    let supplierRows: RemoteSupplierRow[] = [];
    let productTypeRows: RemoteProductTypeRow[] = [];
    let laborRateTableRows: RemoteLaborRateTableRow[] = [];
    const productTypeIds = [...new Set(
      productRows
        .map((product) => product.type_id?.trim() ?? null)
        .filter((typeId): typeId is string => Boolean(typeId))
    )];
    const laborRateTableIds = [...new Set(
      productRows
        .map((product) => product.labor_rate_table_id?.trim() ?? null)
        .filter((tableId): tableId is string => Boolean(tableId))
    )];

    if (variantIds.length > 0) {
      const { data: linksData, error: linksError } = await this.supabase
        .from("variant_option_links")
        .select("variant_id, option_id")
        .in("variant_id", variantIds);

      if (linksError) {
        throw new Error(`supabase variant_option_links query failed: ${linksError.message}`);
      }

      linkRows = (linksData ?? []) as RemoteVariantOptionLinkRow[];

      const optionIds = [...new Set(linkRows.map((link) => link.option_id))];
      if (optionIds.length > 0) {
        const { data: optionsData, error: optionsError } = await this.supabase
          .from("treatment_options")
          .select("id, kind, label")
          .in("id", optionIds);

        if (optionsError) {
          throw new Error(`supabase treatment_options query failed: ${optionsError.message}`);
        }

        optionRows = (optionsData ?? []) as RemoteTreatmentOptionRow[];
      }
    }

    const { data: mediaAssetsData, error: mediaAssetsError } = await this.supabase
      .from("product_media_assets")
      .select("id, product_id, role, storage_key, sort_order, created_at")
      .in("product_id", productIds)
      .order("sort_order", {
        ascending: true
      })
      .order("created_at", {
        ascending: true
      });

    if (mediaAssetsError) {
      throw new Error(`supabase product_media_assets query failed: ${mediaAssetsError.message}`);
    }

    mediaAssetRows = (mediaAssetsData ?? []) as RemoteProductMediaAssetRow[];

    if (supplierCodes.length > 0) {
      const { data: suppliersData, error: suppliersError } = await this.supabase
        .from("suppliers")
        .select("id, code, name")
        .in("code", supplierCodes);

      if (suppliersError) {
        throw new Error(`supabase suppliers query failed: ${suppliersError.message}`);
      }

      supplierRows = (suppliersData ?? []) as RemoteSupplierRow[];
    }

    if (productTypeIds.length > 0) {
      const { data: productTypesData, error: productTypesError } = await this.supabase
        .from("product_types")
        .select("*")
        .in("id", productTypeIds);

      if (productTypesError) {
        throw new Error(`supabase product_types query failed: ${productTypesError.message}`);
      }

      productTypeRows = (productTypesData ?? []) as RemoteProductTypeRow[];
    }

    if (laborRateTableIds.length > 0) {
      const { data: laborRateTablesData, error: laborRateTablesError } = await this.supabase
        .from("labor_rate_tables")
        .select("*")
        .in("id", laborRateTableIds);

      if (laborRateTablesError) {
        throw new Error(`supabase labor_rate_tables query failed: ${laborRateTablesError.message}`);
      }

      laborRateTableRows = (laborRateTablesData ?? []) as RemoteLaborRateTableRow[];
    }

    const variantsByProductId = buildVariantsByProductId(variantRows, linkRows, optionRows);
    const mediaAssetsByProductId = new Map<string, ProductMediaAssetRecord[]>();
    const suppliersByCode = new Map<string, RemoteSupplierRow>();
    const productTypesById = new Map<string, RemoteProductTypeRow>();
    const laborRateTablesById = new Map<string, LaborRateTableRecord>();

    for (const supplierRow of supplierRows) {
      suppliersByCode.set(supplierRow.code, supplierRow);
    }

    for (const productTypeRow of productTypeRows) {
      productTypesById.set(productTypeRow.id, productTypeRow);
    }

    for (const laborRateTableRow of laborRateTableRows) {
      laborRateTablesById.set(laborRateTableRow.id, mapRemoteLaborRateTableRow(laborRateTableRow));
    }

    for (const mediaAssetRow of mediaAssetRows) {
      const mappedAsset = mapRemoteMediaAssetRow(mediaAssetRow);
      if (!mappedAsset) {
        continue;
      }

      const existingAssets = mediaAssetsByProductId.get(mediaAssetRow.product_id) ?? [];
      existingAssets.push(mappedAsset);
      mediaAssetsByProductId.set(mediaAssetRow.product_id, existingAssets);
    }

    return productRows.map((row) => {
      const mappedProduct = mapRemoteProductRowWithMedia(
        row,
        variantsByProductId.get(row.id) ?? [],
        mediaAssetsByProductId.get(row.id) ?? [],
        suppliersByCode.get(row.supplier_code?.trim() ?? "") ?? null,
        productTypesById.get(row.type_id?.trim() ?? "") ?? null
      );
      const laborRateTable =
        laborRateTablesById.get(row.labor_rate_table_id?.trim() ?? "") ?? null;
      const resolvedLaborRateTableName =
        laborRateTable?.name ?? row.labor_rate_table_name ?? null;

      return {
        ...mappedProduct,
        laborRateTableName: resolvedLaborRateTableName,
        labor_rate_table_name: resolvedLaborRateTableName
      };
    });
  }

  async listLaborRateTables() {
    const { data, error } = await this.supabase
      .from("labor_rate_tables")
      .select("*")
      .order("nome", {
        ascending: true
      });

    if (error) {
      throw new Error(`supabase labor_rate_tables query failed: ${error.message}`);
    }

    return ((data ?? []) as RemoteLaborRateTableRow[]).map((row) => mapRemoteLaborRateTableRow(row));
  }

  async listProductTypes() {
    const { data, error } = await this.supabase
      .from("product_types")
      .select("*")
      .order("nome", {
        ascending: true
      });

    if (error) {
      throw new Error(`supabase product_types query failed: ${error.message}`);
    }

    return ((data ?? []) as RemoteProductTypeRow[]).map((row) => mapRemoteProductTypeRow(row));
  }

  async updateProduct(input: {
    id: string;
    sku: string;
    name: string;
    availableQuantity: number;
  }) {
    const { error } = await this.supabase
      .from(this.tableName)
      .update({
        numero_serie: input.sku,
        nome: input.name,
        stock_quantity: input.availableQuantity,
        updated_at: new Date().toISOString()
      })
      .eq("id", input.id);

    if (error) {
      throw new Error(`supabase product update failed: ${error.message}`);
    }

    const products = await this.listProducts();
    const product = products.find((item) => item.id === input.id);

    if (!product) {
      throw new Error("supabase product update failed: updated product not found");
    }

    return product;
  }
}
