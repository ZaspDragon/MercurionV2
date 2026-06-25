import { removeInventory, addInventory } from "./inventory.js";

const transferTasks = new Map();

function makeTaskId() {
  return `TRN-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createTransferTask(source, destination, sku, quantity) {
  const task = {
    id: makeTaskId(),
    source,
    destination,
    sku,
    quantity: Number(quantity),
    status: "created",
    createdAt: new Date().toISOString()
  };
  transferTasks.set(task.id, task);
  return task;
}

export function completeTransferTask(taskId, userId = "worker") {
  const task = transferTasks.get(taskId);
  if (!task) throw new Error("Transfer task not found.");
  if (task.status === "completed") throw new Error("Transfer already completed.");

  removeInventory(task.source, task.sku, task.quantity);
  addInventory(task.destination, task.sku, task.quantity);

  task.status = "completed";
  task.completedBy = userId;
  task.completedAt = new Date().toISOString();
  transferTasks.set(task.id, task);
  return task;
}
