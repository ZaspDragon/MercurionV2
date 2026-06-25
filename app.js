/*
 * Mercurion WMS - Render-ready Express server
 * SERVER CODE ONLY. Do not paste index.html into this file.
 */

import express from "express";
import path from "path";
import { fileURLToPath } from "url";

import { receiveShipment } from "./receiving.js";
import { listInventory } from "./inventory.js";
import { createTransferTask, completeTransferTask } from "./transfer.js";
import { generatePickRoute, startPickSession, recordPickAction } from "./order_pulling.js";

const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json());
app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/health", (req, res) => {
  res.json({ ok: true, app: "Mercurion WMS" });
});

app.post("/receive", (req, res) => {
  try {
    const { shipment = {}, items = [] } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: "Add at least one item before receiving." });
    }
    res.json({ success: true, summary: receiveShipment(shipment, items) });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.get("/inventory", (req, res) => {
  try {
    res.json({ success: true, inventory: listInventory() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/transfer", (req, res) => {
  try {
    const { sourceLocation, destinationLocation, sku, quantity, userId } = req.body || {};
    if (!sourceLocation || !destinationLocation || !sku || !quantity) {
      return res.status(400).json({ success: false, error: "Source, destination, SKU, and quantity are required." });
    }
    const task = createTransferTask(sourceLocation, destinationLocation, sku, Number(quantity));
    res.json({ success: true, task: completeTransferTask(task.id, userId || "worker") });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post("/pick/start", (req, res) => {
  try {
    const { orderId, lines = [], workerId } = req.body || {};
    if (!orderId || !Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({ success: false, error: "Order ID and at least one order line are required." });
    }
    const tasks = generatePickRoute(orderId, lines);
    const session = startPickSession(workerId || "worker", tasks);
    res.json({ success: true, session });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post("/pick/action", (req, res) => {
  try {
    const { sessionId, scannedLocation, scannedItem, quantity } = req.body || {};
    if (!sessionId || !scannedLocation || !scannedItem || quantity === undefined) {
      return res.status(400).json({ success: false, error: "Session ID, location, SKU, and quantity are required." });
    }
    const result = recordPickAction(sessionId, scannedLocation, scannedItem, Number(quantity));
    res.json({ success: true, result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Mercurion WMS running on port ${PORT}`);
});
