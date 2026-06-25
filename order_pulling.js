import { listInventory, getInventory, removeInventory } from "./inventory.js";
import { createTransferTask } from "./transfer.js";

const sessions = new Map();

function makeSessionId() {
  return `PICK-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function findLocationsForSku(sku) {
  return listInventory()
    .filter((row) => row.sku === sku && row.quantity > 0)
    .sort((a, b) => a.location.localeCompare(b.location))
    .map((row) => ({ location: row.location, availableQty: row.quantity }));
}

export function generatePickRoute(orderId, lines) {
  const tasks = [];
  for (const line of lines) {
    const sku = String(line.sku || "").trim();
    let remaining = Number(line.quantity || 0);
    if (!sku || remaining < 1) continue;

    const locations = findLocationsForSku(sku);
    for (const location of locations) {
      if (remaining <= 0) break;
      const pickQty = Math.min(remaining, location.availableQty);
      tasks.push({ orderId, sku, location: location.location, quantity: pickQty, status: "open" });
      remaining -= pickQty;
    }

    if (remaining > 0) {
      tasks.push({ orderId, sku, location: "NO-STOCK", quantity: remaining, status: "short" });
    }
  }
  return tasks;
}

export function startPickSession(workerId, tasks) {
  const session = {
    id: makeSessionId(),
    workerId,
    tasks,
    currentIndex: 0,
    completed: [],
    exceptions: [],
    startedAt: new Date().toISOString()
  };
  sessions.set(session.id, session);
  return session;
}

export function recordPickAction(sessionId, scannedLocation, scannedItem, quantity) {
  const session = sessions.get(sessionId);
  if (!session) return { error: "Pick session not found." };

  const task = session.tasks[session.currentIndex];
  if (!task) return { success: true, message: "All picks complete." };

  if (task.location === "NO-STOCK") {
    session.exceptions.push({ type: "short", task });
    session.currentIndex += 1;
    return { warning: `No stock available for ${task.sku}.`, nextTask: session.tasks[session.currentIndex] || null };
  }

  if (scannedLocation !== task.location) {
    return { error: `Wrong location. Go to ${task.location}.`, expectedLocation: task.location };
  }

  if (scannedItem !== task.sku) {
    return { error: `Wrong item. Expected ${task.sku}.`, expectedSku: task.sku };
  }

  const onHand = getInventory(scannedLocation, scannedItem);
  if (!onHand || onHand.quantity <= 0) {
    const overflow = findLocationsForSku(scannedItem).find((loc) => loc.location !== scannedLocation);
    if (overflow) {
      const replenishment = createTransferTask(overflow.location, scannedLocation, scannedItem, Math.min(overflow.availableQty, task.quantity));
      session.exceptions.push({ type: "empty_pick_face", task, replenishmentTaskId: replenishment.id });
      return { warning: "Pick location is empty. Replenishment task created.", replenishment };
    }
    return { error: "Pick location empty and no overflow found." };
  }

  const pickedQty = Number(quantity);
  if (!pickedQty || pickedQty < 1) return { error: "Pick quantity must be at least 1." };
  if (pickedQty > onHand.quantity) return { error: `Only ${onHand.quantity} available.` };

  removeInventory(scannedLocation, scannedItem, pickedQty);

  session.completed.push({ ...task, pickedQty, completedAt: new Date().toISOString() });
  if (pickedQty < task.quantity) {
    session.exceptions.push({ type: "partial_pick", task, pickedQty, remaining: task.quantity - pickedQty });
  }

  session.currentIndex += 1;
  return { success: true, pickedQty, nextTask: session.tasks[session.currentIndex] || null };
}
