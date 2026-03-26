import { ControlPlaneRepository, MasterProductRecord } from "../../lib/postgres";
import { AppError } from "../../middleware/error-handler";
import {
  MyInventoryItem,
  MyInventoryResponse,
  MyInventorySyncError,
  MyInventorySyncResponse,
  SyncMyInventoryItem
} from "./inventory.schemas";

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

  private async resolveMasterProduct(
    item: SyncMyInventoryItem,
    productsById: Map<string, MasterProductRecord | null>,
    productsBySku: Map<string, MasterProductRecord | null>
  ): Promise<MasterProductRecord | null> {
    if (item.productId) {
      if (!productsById.has(item.productId)) {
        productsById.set(
          item.productId,
          await this.controlPlane.findMasterProductById(item.productId)
        );
      }

      return productsById.get(item.productId) ?? null;
    }

    const candidateSku = item.sku ?? item.code ?? item.numeroSerie;
    if (!candidateSku) {
      return null;
    }

    if (!productsBySku.has(candidateSku)) {
      productsBySku.set(candidateSku, await this.controlPlane.findMasterProductBySku(candidateSku));
    }

    return productsBySku.get(candidateSku) ?? null;
  }

  private buildSyncError(index: number, item: SyncMyInventoryItem, message: string): MyInventorySyncError {
    return {
      index,
      productId: item.productId,
      sku: item.sku,
      code: item.code,
      numeroSerie: item.numeroSerie,
      message
    };
  }

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

  async syncMyInventory(
    companyId: string,
    items: SyncMyInventoryItem[]
  ): Promise<MyInventorySyncResponse> {
    const updatedItems: MyInventoryItem[] = [];
    const errors: MyInventorySyncError[] = [];
    const productsById = new Map<string, MasterProductRecord | null>();
    const productsBySku = new Map<string, MasterProductRecord | null>();

    for (const [index, item] of items.entries()) {
      const product = await this.resolveMasterProduct(item, productsById, productsBySku);

      if (!product) {
        errors.push(
          this.buildSyncError(
            index,
            item,
            "Produto nao encontrado para o product_id ou sku/codigo informado"
          )
        );
        continue;
      }

      const updatedInventory = await this.controlPlane.upsertCompanyInventory(
        companyId,
        product.id,
        item.customStockQuantity
      );

      if (!updatedInventory) {
        errors.push(
          this.buildSyncError(
            index,
            item,
            "Produto nao encontrado no catalogo mestre local para atualizacao"
          )
        );
        continue;
      }

      updatedItems.push(mapInventoryItem(updatedInventory));
    }

    return {
      data: updatedItems,
      errors,
      meta: {
        companyId,
        receivedCount: items.length,
        updatedCount: updatedItems.length,
        errorCount: errors.length
      }
    };
  }
}
