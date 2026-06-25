import { randomUUID } from "crypto";
import { addInventory } from "./inventory.js";

const RECEIVING_LOCATION = "RECV-AREA";

export function generateItemCode(item) {
  return `MERC-${randomUUID()}`;
}

export function receiveShipment(shipment, items) {
  return items.map((item) => {
    const sku = String(item.sku || "").trim();
    const quantity = Number(item.quantity || 0);
    const uom = item.uom || "item";

    if (!sku) throw new Error("SKU is required.");
    if (!quantity || quantity < 1) throw new Error(`Quantity is required for ${sku}.`);

    const code = item.supplierBarcode || generateItemCode(item);

    addInventory(RECEIVING_LOCATION, sku, quantity, {
      code,
      uom,
      shipment: shipment?.po || shipment?.id || "",
      vendor: shipment?.vendor || ""
    });

    return {
      sku,
      quantity,
      uom,
      code,
      receivedTo: RECEIVING_LOCATION,
      suggestedLocation: `PUT-${sku.substring(0, 3).toUpperCase()}-01`
    };
  });
}
