import { CostSettingsRecord } from "../../lib/postgres";
import { ProductRecord } from "../../lib/supabase";

export type ProductCostBreakdown = {
  laborCostUsd: number;
  laborCostBrl: number;
  silverCost: number;
  r1: number;
  r2: number;
  r3: number;
  finalCost: number;
};

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

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

export function calculateProductCost(
  product: Pick<ProductRecord, "weightGrams" | "laborCost">,
  settings: CostSettingsRecord
): ProductCostBreakdown {
  const laborCostUsd = parseNumericValue(product.laborCost);
  const weightGrams = parseNumericValue(product.weightGrams);
  const laborCostBrl = laborCostUsd * settings.dollarRate;
  const silverCost = weightGrams * settings.silverPricePerGram;
  const r1 = laborCostBrl + silverCost;
  const r2 = r1 * (1 + settings.zonaFrancaRatePercent / 100);
  const r3 = r2 + settings.transportFee;
  const finalCost = r3 * settings.dollarRate;

  return {
    laborCostUsd: roundCurrency(laborCostUsd),
    laborCostBrl: roundCurrency(laborCostBrl),
    silverCost: roundCurrency(silverCost),
    r1: roundCurrency(r1),
    r2: roundCurrency(r2),
    r3: roundCurrency(r3),
    finalCost: roundCurrency(finalCost)
  };
}
