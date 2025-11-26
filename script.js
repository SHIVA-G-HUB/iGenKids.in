/* script.js - iGenkids
   - Firebase (compat) usage (v8)
   - Cart in localStorage
   - Checkout flow
   - Save orders to Firestore
   - Dashboard reads orders from Firestore
   - Admin protection & Google Sign-in (UID locked)
*/

/* ============ FIREBASE CONFIG ============ */
const firebaseConfig = {
  apiKey: "AIzaSyABq6b5vH4D5JAjAuHV5uGhA7g4CMMh4eo",
  authDomain: "igenkids-c4e93.firebaseapp.com",
  projectId: "igenkids-c4e93",
  storageBucket: "igenkids-c4e93.firebasestorage.app",
  messagingSenderId: "939973792356",
  appId: "1:939973792356:web:d3dcd769f083616907c571",
  measurementId: "G-TFB9FR78Q3"
};

// Initialize Firebase (compat)
try {
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  } else {
    firebase.app();
  }
  var db = firebase.firestore();
  console.log('Firebase initialized (compat).');
} catch (e) {
  console.warn('Firebase not initialized yet or running in environment without firebase script.', e);
  var db = null;
}

/* ============ ADMIN HELPERS ============ */
function adminLogout() {
  if (firebase && firebase.auth) {
    firebase.auth().signOut().then(() => {
      location.href = 'index.html';
    });
  }
}

/* ============ PRODUCTS & CART (localStorage) ============ */
const PRODUCTS = {
  book1: { id: 'book1', title: 'Creative Writing Kit', price: 199 },
  book2: { id: 'book2', title: 'Math Starter Pack', price: 149 },
  book3: { id: 'book3', title: 'English Workbook', price: 129 }
};

function getCart() {
  return JSON.parse(localStorage.getItem('igen_cart') || '[]');
}
function saveCart(cart) {
  localStorage.setItem('igen_cart', JSON.stringify(cart));
}
function addToCart(id) {
  const p = PRODUCTS[id];
  if (!p) return alert('Product not found');
  const cart = getCart();
  const found = cart.find(x => x.id === id);
  if (found) found.qty += 1; else cart.push({ ...p, qty: 1 });
  saveCart(cart);
  renderCartPreview();
  alert(`${p.title} added to cart`);
}
function clearCart() {
  if (confirm('Clear cart?')) {
    localStorage.removeItem('igen_cart');
    renderCartPreview();
  }
}

/* Render cart on pages that have cart preview */
function renderCartPreview() {
  const itemsEl = document.getElementById('cart-items');
  const totalEl = document.getElementById('cart-total');
  if (!itemsEl) return;
  const cart = getCart();
  if (cart.length === 0) {
    itemsEl.innerHTML = '<p>Your cart is empty.</p>';
    if (totalEl) totalEl.innerText = 'Total: Rs. 0';
    return;
  }
  itemsEl.innerHTML = cart.map(it => `
    <div class="order-row">${it.title} x ${it.qty} — Rs. ${it.price * it.qty}</div>
  `).join('');
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  if (totalEl) totalEl.innerText = `Total: Rs. ${total}`;
}

/* Populate product buttons if dynamic required */
function populateProductButtons() {
  document.querySelectorAll('.product-card').forEach(card => {
    const id = card.dataset.id;
    if (!id) return;
    const btn = card.querySelector('button');
    if (btn) btn.onclick = () => addToCart(id);
  });
}

/* ============ CHECKOUT ============ */
function populateCheckout() {
  const cart = getCart();
  const summary = document.getElementById('summary-items');
  const totalAmtSpan = document.getElementById('summary-total-amt');
  if (!summary) return;
  if (cart.length === 0) {
    summary.innerHTML = '<p>Your cart is empty. Add products from home.</p>';
    if (totalAmtSpan) totalAmtSpan.innerText = '0';
    return;
  }
  summary.innerHTML = cart.map(it => `<div>${it.title} x ${it.qty} — Rs. ${it.price * it.qty}</div>`).join('');
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  if (totalAmtSpan) totalAmtSpan.innerText = total;
}

function startPayment() {
  const name = (document.getElementById('cust-name')||{}).value || '';
  const email = (document.getElementById('cust-email')||{}).value || '';
  const phone = (document.getElementById('cust-phone')||{}).value || '';
  const address = (document.getElementById('cust-address')||{}).value || '';
  const cart = getCart();

  if (!name || !email || !phone) {
    alert('Please fill name, email and phone.');
    return;
  }
  if (!cart || cart.length === 0) {
    alert('Cart is empty.');
    return;
  }

  const draft = {
    id: 'draft_' + Date.now(),
    name, email, phone, address,
    items: cart,
    total: cart.reduce((s,i)=>s + i.price * i.qty, 0),
    createdAt: new Date().toISOString()
  };

  localStorage.setItem('igen_order_draft', JSON.stringify(draft));
  // Redirect to payment simulation page
  location.href = 'payment.html';
}

/* ============ PAYMENT ============ */
function populatePaymentPage() {
  const desc = document.getElementById('payment-description');
  const draft = JSON.parse(localStorage.getItem('igen_order_draft') || 'null');
  if (desc && draft) {
    desc.innerHTML = `Pay Rs. ${draft.total} for ${draft.items.length} item(s).`;
  }
}

function completePayment() {
  const status = document.getElementById('payment-status');
  if (status) status.innerText = 'Processing...';

  const draft = JSON.parse(localStorage.getItem('igen_order_draft') || 'null');
  if (!draft) {
    if (status) status.innerText = 'No order draft found. Please start checkout again.';
    return;
  }

  setTimeout(async () => {
    if (status) status.innerText = 'Payment successful — saving order...';

    const orderToSave = {
      name: draft.name,
      email: draft.email,
      phone: draft.phone,
      address: draft.address,
      items: draft.items,
      total: draft.total,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
      if (!db) throw new Error('Firestore not initialized.');
      const docRef = await db.collection('orders').add(orderToSave);
      localStorage.removeItem('igen_cart');
      localStorage.removeItem('igen_order_draft');

      if (status) status.innerHTML = `✅ Order saved. Order ID: <strong>${docRef.id}</strong>.<br/><a href="dashboard.html">Open Dashboard</a>`;
    } catch (err) {
      console.error('Save order failed', err);
      if (status) status.innerText = 'Failed to save order: ' + err.message;
    }
  }, 1200);
}

/* ============ DASHBOARD ============ */
async function loadDashboardOrders() {
  const out = document.getElementById('orders-list');
  if (!out) return;

  out.innerHTML = '<p>Loading orders...</p>';

  if (db) {
    try {
      const snap = await db.collection('orders').orderBy('createdAt', 'desc').get();
      const orders = snap.docs.map(d => ({ id: d.id, ...(d.data() || {}) }));
      renderOrders(out, orders);
      return;
    } catch (e) {
      console.error('Error loading orders from Firestore:', e);
      out.innerHTML = `<p>Failed to load remote orders: ${e.message}</p>`;
    }
  }

  const local = JSON.parse(localStorage.getItem('igen_orders_backup') || '[]');
  if (local && local.length) {
    renderOrders(out, local);
  } else {
    out.innerHTML = '<p>No orders available yet.</p>';
  }
}

function renderOrders(container, orders) {
  if (!orders || orders.length === 0) {
    container.innerHTML = '<p>No orders found.</p>';
    return;
  }
  container.innerHTML = '';
  orders.forEach(o => {
    const div = document.createElement('div');
    div.className = 'order-card';

    let timeStr = '';
    if (o.createdAt && o.createdAt.toDate) {
      timeStr = new Date(o.createdAt.toDate()).toLocaleString();
    } else if (o.createdAt && o.createdAt.seconds) {
      timeStr = new Date(o.createdAt.seconds * 1000).toLocaleString();
    } else if (o.createdAt) {
      timeStr = new Date(o.createdAt).toLocaleString();
    }

    div.innerHTML = `
      <strong>Order ID:</strong> ${o.id || '—'}<br/>
      <strong>Name:</strong> ${o.name || ''}<br/>
      <strong>Email:</strong> ${o.email || ''}<br/>
      <strong>Phone:</strong> ${o.phone || ''}<br/>
      <strong>Total:</strong> Rs. ${o.total || 0}<br/>
      <strong>Date:</strong> ${timeStr}<br/>
      <details style="margin-top:8px;">
        <summary>Items (${(o.items||[]).length})</summary>
        <ul>
          ${(o.items || []).map(it => `<li>${it.title} x ${it.qty} — Rs. ${it.price * it.qty}</li>`).join('')}
        </ul>
      </details>
    `;
    container.appendChild(div);
  });
}

/* ============ IMPORT / EXPORT ============ */
function downloadOrdersJSON() {
  if (db) {
    db.collection('orders').get().then(snap => {
      const arr = snap.docs.map(d => ({ id: d.id, ...(d.data()||{}) }));
      triggerDownload(JSON.stringify(arr, null, 2), 'igen_orders.json');
    }).catch(e => alert('Failed to download from server: ' + e.message));
    return;
  }
  const local = JSON.parse(localStorage.getItem('igen_orders_backup') || '[]');
  triggerDownload(JSON.stringify(local, null, 2), 'igen_orders.json');
}

function triggerDownload(content, filename) {
  const a = document.createElement('a');
  const blob = new Blob([content], { type: 'application/json' });
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

function importOrdersFile(event) {
  const f = event.target.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const arr = JSON.parse(e.target.result);
      localStorage.setItem('igen_orders_backup', JSON.stringify(arr));
      alert('Orders imported to localStorage backup. Reload dashboard to view.');
      loadDashboardOrders();
    } catch (err) {
      alert('Invalid JSON file');
    }
  };
  reader.readAsText(f);
}

/* ============ COUNTDOWN TIMER ============ */
function initCountdown() {
  const el = document.getElementById('countdown');
  if (!el) return;

  // 24-hour countdown from page load
  const endTime = Date.now() + 24 * 60 * 60 * 1000;

  function updateTimer() {
    const diff = endTime - Date.now();
    if (diff <= 0) {
      el.textContent = "00:00:00";
      return;
    }
    const totalSeconds = Math.floor(diff / 1000);
    const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
    const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    el.textContent = `${hours}:${minutes}:${seconds}`;
  }

  updateTimer();
  setInterval(updateTimer, 1000);
}

/* ============ INIT ============ */
document.addEventListener('DOMContentLoaded', () => {
  renderCartPreview();
  populateProductButtons();
  populateCheckout();
  populatePaymentPage();
  initCountdown();

  // Only load dashboard orders automatically if allowed flag is set by dashboard.html
  if (window.__IGEN_ALLOW_DASHBOARD_LOAD__) {
    loadDashboardOrders();
  }
});

/* expose some functions for buttons */
window.addToCart = addToCart;
window.clearCart = clearCart;
window.startPayment = startPayment;
window.completePayment = completePayment;
window.downloadOrdersJSON = downloadOrdersJSON;
window.importOrdersFile = importOrdersFile;
window.adminLogout = adminLogout;
window.loadDashboardOrders = loadDashboardOrders;
