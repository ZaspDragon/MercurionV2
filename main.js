const sections = document.querySelectorAll("main section");
const navButtons = document.querySelectorAll(".menu button");
const tips = document.getElementById("tips");

const TIPS = {
  receive: "Receiving tip: enter SKU and quantity. New QR code IDs are created when no barcode exists.",
  inventory: "Inventory tip: refresh after receiving or moving stock.",
  transfer: "Transfer tip: source is where stock is now. Destination is where it should go.",
  pick: "Picking tip: scan location, scan item, then confirm quantity."
};

function showSection(id) {
  sections.forEach((section) => section.classList.toggle("hidden", section.id !== id));
  tips.textContent = TIPS[id] || "";
  if (id === "inventory") loadInventory();
}

navButtons.forEach((button) => button.addEventListener("click", () => showSection(button.dataset.section)));

function addReceiveRow() {
  const wrapper = document.createElement("div");
  wrapper.className = "row-card";
  wrapper.innerHTML = `
    <label>SKU <input class="recv-sku" placeholder="SKU123" required /></label>
    <label>Qty <input class="recv-qty" type="number" min="1" value="1" required /></label>
    <label>UOM <input class="recv-uom" value="item" /></label>
    <label>Supplier Barcode <input class="recv-barcode" placeholder="optional" /></label>
    <button type="button" class="danger">Remove</button>
  `;
  wrapper.querySelector(".danger").addEventListener("click", () => wrapper.remove());
  document.getElementById("recv-items").appendChild(wrapper);
}

function addPickLine() {
  const wrapper = document.createElement("div");
  wrapper.className = "row-card";
  wrapper.innerHTML = `
    <label>SKU <input class="line-sku" placeholder="SKU123" required /></label>
    <label>Qty <input class="line-qty" type="number" min="1" value="1" required /></label>
    <button type="button" class="danger">Remove</button>
  `;
  wrapper.querySelector(".danger").addEventListener("click", () => wrapper.remove());
  document.getElementById("pick-lines").appendChild(wrapper);
}

document.getElementById("add-recv-item").addEventListener("click", addReceiveRow);
document.getElementById("add-pick-line").addEventListener("click", addPickLine);

document.getElementById("receive-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  const items = Array.from(document.querySelectorAll("#recv-items .row-card")).map((row) => {
    const item = {
      sku: row.querySelector(".recv-sku").value.trim(),
      quantity: Number(row.querySelector(".recv-qty").value),
      uom: row.querySelector(".recv-uom").value.trim() || "item"
    };
    const barcode = row.querySelector(".recv-barcode").value.trim();
    if (barcode) item.supplierBarcode = barcode;
    return item;
  }).filter((item) => item.sku && item.quantity > 0);

  const response = await fetch("/receive", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      shipment: {
        po: document.getElementById("recv-po").value.trim(),
        vendor: document.getElementById("recv-vendor").value.trim()
      },
      items
    })
  });

  document.getElementById("recv-result").textContent = JSON.stringify(await response.json(), null, 2);
});

async function loadInventory() {
  const response = await fetch("/inventory");
  const data = await response.json();
  const tbody = document.querySelector("#inventory-table tbody");
  tbody.innerHTML = "";

  (data.inventory || []).forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${row.location}</td><td>${row.sku}</td><td>${row.quantity}</td><td>${row.meta?.uom || ""} ${row.meta?.code || ""}</td>`;
    tbody.appendChild(tr);
  });
}

document.getElementById("refresh-inventory").addEventListener("click", loadInventory);

document.getElementById("transfer-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  const response = await fetch("/transfer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sourceLocation: document.getElementById("transfer-source").value.trim(),
      destinationLocation: document.getElementById("transfer-dest").value.trim(),
      sku: document.getElementById("transfer-sku").value.trim(),
      quantity: Number(document.getElementById("transfer-qty").value)
    })
  });

  document.getElementById("transfer-result").textContent = JSON.stringify(await response.json(), null, 2);
});

let currentSessionId = null;

document.getElementById("pick-start-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  const lines = Array.from(document.querySelectorAll("#pick-lines .row-card")).map((row) => ({
    sku: row.querySelector(".line-sku").value.trim(),
    quantity: Number(row.querySelector(".line-qty").value)
  })).filter((line) => line.sku && line.quantity > 0);

  const response = await fetch("/pick/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      orderId: document.getElementById("pick-order").value.trim(),
      workerId: document.getElementById("pick-worker").value.trim(),
      lines
    })
  });

  const data = await response.json();
  if (!data.session) {
    document.getElementById("pick-result").textContent = JSON.stringify(data, null, 2);
    return;
  }

  currentSessionId = data.session.id;
  document.getElementById("session-id").textContent = data.session.id;
  document.getElementById("pick-session").classList.remove("hidden");

  const list = document.getElementById("tasks-list");
  list.innerHTML = "";

  data.session.tasks.forEach((task, index) => {
    const li = document.createElement("li");
    li.textContent = `${index + 1}. ${task.location}: pick ${task.quantity} of ${task.sku}`;
    list.appendChild(li);
  });
});

document.getElementById("pick-action-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  const response = await fetch("/pick/action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: currentSessionId,
      scannedLocation: document.getElementById("pick-location").value.trim(),
      scannedItem: document.getElementById("pick-sku").value.trim(),
      quantity: Number(document.getElementById("pick-qty").value)
    })
  });

  document.getElementById("pick-result").textContent = JSON.stringify(await response.json(), null, 2);
});

showSection("receive");
addReceiveRow();
addPickLine();
