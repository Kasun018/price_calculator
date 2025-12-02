// ===== Billing System JS =====

// List of possible backend URLs
const backendUrls = [
    "barcodegetprice.php",
    "./barcodegetprice.php",
    "http://localhost/price_calculator/barcodegetprice.php"
];

let currentBackendUrl = null;
let items = [];

// DOM Elements
const video = document.getElementById("video");
const tbody = document.querySelector("#billTable tbody");
const subtotalEl = document.getElementById("subtotal");
const discountInput = document.getElementById("discount");
const discountValueEl = document.getElementById("discountValue");
const grandTotalEl = document.getElementById("grandTotal");

const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const manualBtn = document.getElementById("manualBtn");
const resetBtn = document.getElementById("resetBtn");
const saveBtn = document.getElementById("saveBtn");

let codeReader = null;
let streamActive = false;
let lastScanned = null;
let scanCooldown = false;

// ===== Backend Connection Test =====
async function testBackendConnection() {
    for (const url of backendUrls) {
        try {
            const response = await fetch(url + "?barcode=8901234567890");
            if (response.ok) {
                currentBackendUrl = url;
                console.log("✅ Backend connected:", url);
                flashMessage("Backend connected successfully", "success");
                return true;
            }
        } catch (e) {
            console.log("❌ Failed:", url);
        }
    }
    flashMessage("⚠️ Backend connection failed. Make sure PHP server is running", "error");
    console.error("Could not connect to backend. Tried:", backendUrls);
    return false;
}

// ===== Render Billing Table =====
function renderTable() {
    tbody.innerHTML = "";
    items.forEach((it, idx) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${idx + 1}</td>
            <td>${it.name || 'Unknown'}</td>
            <td>${it.price.toFixed(2)}</td>
            <td><input type="number" min="1" value="${it.qty}" onchange="updateQty(${idx}, this.value)"></td>
            <td>${(it.price * it.qty).toFixed(2)}</td>
            <td><button onclick="removeItem(${idx})">✖</button></td>
        `;
        tbody.appendChild(tr);
    });
    updateTotals();
}

// ===== Update Totals =====
function updateTotals() {
    const subtotal = items.reduce((s, it) => s + it.price * it.qty, 0);
    const discount = parseFloat(discountInput.value) || 0;
    const grand = Math.max(0, subtotal - discount);

    subtotalEl.textContent = subtotal.toFixed(2);
    discountValueEl.textContent = discount.toFixed(2);
    grandTotalEl.textContent = grand.toFixed(2);
}

// ===== Quantity & Remove Handlers =====
window.updateQty = function(index, val) {
    const qty = parseInt(val) || 1;
    if (qty < 1) {
        items[index].qty = 1;
    } else {
        items[index].qty = qty;
    }
    renderTable();
};

window.removeItem = function(index) {
    items.splice(index, 1);
    renderTable();
};

// ===== Reset Bill =====
function resetBill() {
    if (items.length > 0 && !confirm("Reset all items?")) return;
    items = [];
    discountInput.value = 0;
    renderTable();
}

// ===== Save as PDF =====
function saveAsPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    
    doc.setFontSize(16);
    doc.text("Billing Receipt", 40, 50);
    doc.setFontSize(10);
    doc.text(`Date: ${new Date().toLocaleString()}`, 40, 70);
    
    doc.setFontSize(11);
    let y = 100;
    
    items.forEach((it, i) => {
        const line = `${i + 1}. ${it.name || 'Item'} - ${it.price.toFixed(2)} x ${it.qty} = ${(it.price * it.qty).toFixed(2)} LKR`;
        doc.text(line, 40, y);
        y += 20;
        if (y > 750) {
            doc.addPage();
            y = 40;
        }
    });

    y += 20;
    doc.text(`Subtotal: ${subtotalEl.textContent} LKR`, 40, y);
    y += 18;
    doc.text(`Discount: ${discountValueEl.textContent} LKR`, 40, y);
    y += 18;
    doc.setFontSize(12);
    doc.text(`Grand Total: ${grandTotalEl.textContent} LKR`, 40, y);
    
    doc.save(`bill_${Date.now()}.pdf`);
}

// ===== Camera & Barcode =====
async function startCamera() {
    if (streamActive) return;
    try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            flashMessage("Camera access not supported in this browser", "error");
            return;
        }
        
        codeReader = new ZXing.BrowserMultiFormatReader();
        await codeReader.reset();
        streamActive = true;
        
        codeReader.decodeFromVideoDevice(null, video, (result, err) => {
            if (result) {
                if (scanCooldown) return;
                scanCooldown = true;
                setTimeout(() => scanCooldown = false, 1000);

                const barcode = result.text;
                if (barcode && barcode !== lastScanned) {
                    lastScanned = barcode;
                    fetchPriceAndAdd(barcode);
                }
            }
        });
    } catch (e) {
        alert("Camera error: " + (e.message || e));
        console.error(e);
        streamActive = false;
    }
}

function stopCamera() {
    if (!streamActive) return;
    try {
        if (codeReader) codeReader.reset();
        video.srcObject = null;
    } catch (e) { console.error(e); }
    streamActive = false;
}

// ===== Fetch Price & Add Item =====
async function fetchPriceAndAdd(barcode) {
    if (!currentBackendUrl) {
        const connected = await testBackendConnection();
        if (!connected) return;
    }

    const url = `${currentBackendUrl}?barcode=${encodeURIComponent(barcode)}`;
    console.log("Fetching:", url);

    try {
        const res = await fetch(url);
        if (!res.ok) {
            flashMessage(`Network error: ${res.status}`, "error");
            return;
        }

        const data = await res.json();

        if (data.error) {
            flashMessage("Product not found: " + barcode, "error");
            return;
        }

        const price = parseFloat(data.price);
        if (isNaN(price)) {
            flashMessage("Invalid price data", "error");
            return;
        }

        const existingItem = items.find(item => item.name === data.product_name);
        if (existingItem) {
            existingItem.qty++;
        } else {
            items.push({ 
                price, 
                qty: 1, 
                name: data.product_name || barcode,
                barcode: barcode 
            });
        }
        
        renderTable();
        flashMessage(`Added: ${data.product_name || "Item"}`, "success");

    } catch (err) {
        console.error(err);
        flashMessage("Connection error: " + err.message, "error");
    }
}

// ===== Flash Message =====
function flashMessage(msg, type = "info") {
    const el = document.createElement("div");
    el.textContent = msg;
    el.style.position = "fixed";
    el.style.left = "50%";
    el.style.transform = "translateX(-50%)";
    el.style.bottom = "20px";
    el.style.padding = "12px 18px";
    el.style.background = type === "error" ? "rgba(192,57,43,0.9)" : 
                         type === "success" ? "rgba(43,138,62,0.9)" : "rgba(52,152,219,0.9)";
    el.style.color = "#fff";
    el.style.borderRadius = "8px";
    el.style.zIndex = "9999";
    el.style.fontSize = "14px";
    el.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
}

// ===== Manual Barcode Input =====
async function manualBarcode() {
    const code = prompt("Enter barcode manually:");
    if (!code) return;
    await fetchPriceAndAdd(code.trim());
}

// ===== Event Listeners =====
startBtn.addEventListener("click", startCamera);
stopBtn.addEventListener("click", stopCamera);
manualBtn.addEventListener("click", manualBarcode);
resetBtn.addEventListener("click", resetBill);
saveBtn.addEventListener("click", saveAsPDF);
discountInput.addEventListener("input", updateTotals);

// ===== Initialize =====
renderTable();
testBackendConnection();