type NumericValue = string | number | null | undefined;

export type VariantMetrics = {
  cost: number | null;
  stockWeightGrams: number;
  stockUnits: number;
};

function parseNumericValue(value: NumericValue): number | null {
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

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function normalizeStockWeightGrams(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return value;
}

export function buildVariantMetrics(input: {
  individualWeight: NumericValue;
  stockWeightGrams: number | null | undefined;
  productCostFinal: number | null | undefined;
}): VariantMetrics {
  const individualWeight = parseNumericValue(input.individualWeight);
  const stockWeightGrams = normalizeStockWeightGrams(input.stockWeightGrams);
  const productCostFinal =
    typeof input.productCostFinal === "number" && Number.isFinite(input.productCostFinal)
      ? input.productCostFinal
      : null;

  const stockUnits =
    individualWeight !== null && individualWeight > 0
      ? Math.floor(stockWeightGrams / individualWeight)
      : 0;

  const cost =
    individualWeight !== null &&
    individualWeight > 0 &&
    productCostFinal !== null &&
    productCostFinal > 0
      ? roundCurrency(individualWeight * productCostFinal)
      : null;

  return {
    cost,
    stockWeightGrams,
    stockUnits
  };
}

export function attachVariantMetrics<T extends object>(variant: T, metrics: VariantMetrics) {
  return {
    ...variant,
    cost: metrics.cost,
    stock_weight_grams: metrics.stockWeightGrams,
    stockWeightGrams: metrics.stockWeightGrams,
    stock_units: metrics.stockUnits,
    stockUnits: metrics.stockUnits
  };
}
