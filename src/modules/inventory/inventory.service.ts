import { ControlPlaneRepository } from "../../lib/postgres";
import { AppError } from "../../middleware/error-handler";
import { MyInventoryItem, MyInventoryResponse } from "./inventory.schemas";

function mapInventoryItem(record: {
  productId: string;
  sku: string;
  name: string;
  masterStock: number;
  customStockQuantity: number | null;
  effectiveStockQuantity: number;
  updatedAt: Date;
}): MyInventoryItem {
  return {
    productId: record.productId,
    sku: record.sku,
    name: record.name,
    masterStock: record.masterStock,
    customStockQuantity: record.customStockQuantity,
    effectiveStockQuantity: record.effectiveStockQuantity,
    updatedAt: record.updatedAt.toISOString()
  };
}

export class InventoryService {
  constructor(private readonly controlPlane: ControlPlaneRepository) {}

  async listMyInventory(companyId: string): Promise<MyInventoryResponse> {
    const inventory = await this.controlPlane.listEffectiveInventoryByCompany(companyId);

    return {
      data: inventory.map(mapInventoryItem),
      meta: {
        count: inventory.length,
        companyId
      }
    };
  }

  async updateMyInventory(
    companyId: string,
    productId: string,
    customStockQuantity: number
  ) {
    const updatedInventory = await this.controlPlane.upsertCompanyInventory(
      companyId,
      productId,
      customStockQuantity
    );

    if (!updatedInventory) {
      throw new AppError(
        404,
        "PRODUCT_NOT_FOUND_IN_INVENTORY",
        "Produto nao encontrado no seu inventario"
      );
    }

    return {
      data: mapInventoryItem(updatedInventory)
    };
  }
}
