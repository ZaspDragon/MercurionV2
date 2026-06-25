const inventoryStore = new Map();

function makeKey(location, sku) {
  return `${location}|${sku}`;
}

export function addInventory(location, sku, quantity, meta = {}) {
  const key = makeKey(location, sku);
  const existing = inventoryStore.get(key) || { quantity: 0, meta: {} };
  existing.quantity += Number(quantity);
  existing.meta = { ...existing.meta, ...meta };
  inventoryStore.set(key, existing);
  return { location, sku, quantity: existing.quantity, meta: existing.meta };
}

export function removeInventory(location, sku, quantity) {
  const key = makeKey(location, sku);
  const existing = inventoryStore.get(key);
  if (!existing || existing.quantity < Number(quantity)) {
    throw new Error(`Not enough ${sku} at ${location}.`);
  }
  existing.quantity -= Number(quantity);
  inventoryStore.set(key, existing);
  return { location, sku, quantity: existing.quantity, meta: existing.meta };
}

export function getInventory(location, sku) {
  const existing = inventoryStore.get(makeKey(location, sku));
  if (!existing) return null;
  return { location, sku, quantity: existing.quantity, meta: existing.meta };
}

export function listInventory() {
  return Array.from(inventoryStore.entries()).map(([key, value]) => {
    const [location, sku] = key.split("|");
    return { location, sku, quantity: value.quantity, meta: value.meta };
  });
}
