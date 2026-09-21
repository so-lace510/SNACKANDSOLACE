/* ============================================================
   SNACKANDSOLACE — Shared JavaScript
   Product data, cart (with graceful storage fallback),
   navigation, and page-specific rendering.
   ============================================================ */

/* ---------- Product catalog ---------- */
const PRODUCTS = [
  { id: "cc1", name: "Classic Crunch Chin-Chin",  category: "Chin-Chin",   weight: "500g pack",  price: 2500, icon: "chinchin" },
  { id: "cc2", name: "Spiced Ginger Chin-Chin",    category: "Chin-Chin",   weight: "500g pack",  price: 2800, icon: "chinchin" },
  { id: "ck1", name: "Coconut Crumble Cookies",    category: "Cookies",    weight: "12-pack",     price: 3200, icon: "cookie" },
  { id: "ck2", name: "Oatmeal Raisin Cookies",     category: "Cookies",    weight: "12-pack",     price: 3000, icon: "cookie" },
  { id: "br1", name: "Golden Crust Loaf",          category: "Bread",      weight: "800g loaf",   price: 1800, icon: "bread" },
  { id: "br2", name: "Whole Wheat Family Loaf",    category: "Bread",      weight: "900g loaf",   price: 2100, icon: "bread" },
  { id: "fj1", name: "Zobo Hibiscus Juice",        category: "Fruit Juice",weight: "1 litre",     price: 1500, icon: "juice" },
  { id: "fj2", name: "Pineapple & Ginger Juice",   category: "Fruit Juice",weight: "1 litre",     price: 1700, icon: "juice" },
];

/* ---------- Storage layer (falls back to memory if unavailable) ---------- */
const memoryStore = {};
const storage = {
  get(key) {
    try {
      const v = window.localStorage.getItem(key);
      return v ? JSON.parse(v) : null;
    } catch (e) {
      return memoryStore[key] || null;
    }
  },
  set(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      memoryStore[key] = value;
    }
  },
};

const CART_KEY = "adunbites_cart";
const REVIEWS_KEY = "snackandsolace_reviews";
const API_URL = window.SNACKANDSOLACE_API_URL || "http://127.0.0.1:8000/api";

function getCart() {
  const cart = storage.get(CART_KEY) || [];
  return cart.map((item) => {
    const product = PRODUCTS.find((p) => p.id === item.id);
    if (!product) return item;
    return {
      ...item,
      name: item.name || product.name,
      price: item.price ?? product.price,
    };
  });
}
function saveCart(cart) {
  storage.set(CART_KEY, cart);
  updateCartCount();
}
function addToCart(productId, qty = 1, price = null, displayName = null) {
  const cart = getCart();
  const existing = cart.find((i) => i.id === productId);
  const product = PRODUCTS.find((p) => p.id === productId);
  const unitPrice = price ?? product?.price ?? 0;
  const label = displayName || product?.name || "Product";

  if (existing) {
    existing.qty += qty;
    if (price !== null) existing.price = unitPrice;
    else if (existing.price == null) existing.price = unitPrice;
    existing.name = label;
  } else {
    cart.push({ id: productId, qty, price: unitPrice, name: label });
  }
  saveCart(cart);
  showToast("Added to cart");
}
function updateQty(productId, delta) {
  const cart = getCart();
  const item = cart.find((i) => i.id === productId);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) {
    removeFromCart(productId);
    return;
  }
  saveCart(cart);
  renderCartPage();
}
function removeFromCart(productId) {
  const cart = getCart().filter((i) => i.id !== productId);
  saveCart(cart);
  renderCartPage();
}
function clearCart() {
  saveCart([]);
}
function cartTotalItems() {
  return getCart().reduce((sum, i) => sum + i.qty, 0);
}
function cartSubtotal() {
  const cart = getCart();
  return cart.reduce((sum, i) => {
    const p = PRODUCTS.find((p) => p.id === i.id);
    const unitPrice = i.price ?? p?.price ?? 0;
    return sum + unitPrice * i.qty;
  }, 0);
}
function formatNaira(amount) {
  return "\u20A6" + amount.toLocaleString("en-NG");
}

/* ---------- Icons (inline SVG, keeps things dependency-free) ---------- */
const ICONS = {
  chinchin: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="42" fill="var(--gold-500)" opacity="0.15"/><g stroke="var(--brown-700)" stroke-width="4" stroke-linecap="round"><rect x="28" y="30" width="14" height="14" rx="3" transform="rotate(15 35 37)"/><rect x="46" y="26" width="14" height="14" rx="3" transform="rotate(-10 53 33)"/><rect x="60" y="40" width="14" height="14" rx="3" transform="rotate(20 67 47)"/><rect x="32" y="48" width="14" height="14" rx="3" transform="rotate(-15 39 55)"/><rect x="50" y="54" width="14" height="14" rx="3" transform="rotate(8 57 61)"/><rect x="36" y="66" width="14" height="14" rx="3" transform="rotate(-5 43 73)"/></g></svg>`,
  cookie: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="52" r="34" fill="var(--gold-500)" opacity="0.25"/><circle cx="50" cy="52" r="34" stroke="var(--brown-700)" stroke-width="4"/><circle cx="38" cy="42" r="4" fill="var(--brown-700)"/><circle cx="58" cy="38" r="4" fill="var(--brown-700)"/><circle cx="64" cy="58" r="4" fill="var(--brown-700)"/><circle cx="42" cy="64" r="4" fill="var(--brown-700)"/><circle cx="52" cy="52" r="4" fill="var(--brown-700)"/></svg>`,
  bread: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 55 C20 35 35 24 50 24 C65 24 80 35 80 55 L80 70 C80 75 76 78 71 78 L29 78 C24 78 20 75 20 70 Z" fill="var(--gold-500)" opacity="0.25" stroke="var(--brown-700)" stroke-width="4"/><path d="M35 40 Q50 30 65 40" stroke="var(--brown-700)" stroke-width="3" stroke-linecap="round"/><path d="M32 50 Q50 40 68 50" stroke="var(--brown-700)" stroke-width="3" stroke-linecap="round"/></svg>`,
  juice: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="36" y="18" width="10" height="12" rx="2" fill="var(--brown-700)"/><path d="M30 30 H70 L64 82 C64 86 60 88 56 88 H44 C40 88 36 86 36 82 Z" fill="var(--gold-500)" opacity="0.25" stroke="var(--brown-700)" stroke-width="4"/><path d="M38 55 H62" stroke="var(--brown-700)" stroke-width="3"/></svg>`,
};

function iconFor(product) {
  return ICONS[product.icon] || ICONS.cookie;
}

/* ---------- Toast ---------- */
function showToast(message) {
  let toast = document.querySelector(".toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    toast.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg><span></span>`;
    document.body.appendChild(toast);
  }
  toast.querySelector("span").textContent = message;
  toast.classList.add("show");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove("show"), 2400);
}

/* ---------- Header cart badge ---------- */
function updateCartCount() {
  document.querySelectorAll("#cart-count").forEach((el) => {
    el.textContent = cartTotalItems();
  });
}

/* ---------- Mobile nav ---------- */
function initNavToggle() {
  const toggle = document.querySelector(".nav-toggle");
  const links = document.querySelector(".nav-links");
  if (!toggle || !links) return;
  toggle.addEventListener("click", () => {
    const open = links.classList.toggle("open");
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  });
}

/* ---------- Home page: product grid ---------- */
function renderProductGrid(containerId, filterCategory) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const items = filterCategory ? PRODUCTS.filter((p) => p.category === filterCategory) : PRODUCTS;
  container.innerHTML = items
    .map(
      (p) => `
    <article class="product-card">
      <div class="product-thumb">${iconFor(p)}</div>
      <div class="product-body">
        <span class="product-cat">${p.category}</span>
        <h3 class="product-name">${p.name}</h3>
        <span class="product-weight">${p.weight} — sold per carton</span>

        <div class="carton-selector" data-product="${p.id}">
          <div class="carton-presets">
            <button type="button" class="carton-btn selected" data-qty="1">1 Carton</button>
            <button type="button" class="carton-btn" data-qty="2">2 Cartons</button>
            <button type="button" class="carton-btn" data-qty="3">3 Cartons</button>
          </div>
          <div class="bulk-order">
            <label for="bulk-${p.id}">Bulk order</label>
            <input type="number" id="bulk-${p.id}" class="bulk-input" min="1" step="1" placeholder="Enter number of cartons">
          </div>
        </div>

        <div class="product-row">
          <span class="price-tag">${formatNaira(p.price)} <span class="per-carton">/ carton</span></span>
        </div>
      </div>
    </article>`
    )
    .join("");

  container.querySelectorAll(".carton-selector").forEach(initCartonSelector);
}

function initCartonSelector(selector) {
  const presetBtns = selector.querySelectorAll(".carton-btn");
  const bulkInput = selector.querySelector(".bulk-input");
  const productId = selector.dataset.product;

  presetBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      presetBtns.forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
      const bulkVal = parseInt(bulkInput.value, 10);
      const qty = bulkVal > 0 ? bulkVal : parseInt(btn.dataset.qty, 10) || 1;
      addToCart(productId, qty);
      resetCartonSelector(productId);
      bulkInput.value = "";
    });
  });

  bulkInput.addEventListener("input", () => {
    if (bulkInput.value.trim() !== "") {
      presetBtns.forEach((b) => b.classList.remove("selected"));
    }
  });
}

function getSelectedCartonQty(productId) {
  const selector = document.querySelector(`.carton-selector[data-product="${productId}"]`);
  if (!selector) return 1;
  const bulkInput = selector.querySelector(".bulk-input");
  const bulkVal = parseInt(bulkInput.value, 10);
  if (bulkVal > 0) return bulkVal;
  const selectedBtn = selector.querySelector(".carton-btn.selected");
  return selectedBtn ? parseInt(selectedBtn.dataset.qty, 10) : 1;
}

function resetCartonSelector(productId) {
  const selector = document.querySelector(`.carton-selector[data-product="${productId}"]`);
  if (!selector) return;
  selector.querySelectorAll(".carton-btn").forEach((b) => b.classList.remove("selected"));
  selector.querySelector('.carton-btn[data-qty="1"]').classList.add("selected");
  selector.querySelector(".bulk-input").value = "";
}
/* ---------- Carton selection + add to cart ---------- */
function initCartonSelectors() {
  document.querySelectorAll(".carton-select").forEach((selector) => {
    const productId = selector.dataset.product;
    const cartonBtns = selector.querySelectorAll(".carton-btn");
    const bulkInput = selector.querySelector(".bulk-input");
    const addBtn = selector.querySelector(".add-to-cart-btn");

    // Quick-select carton buttons (1 / 2 / 3)
    cartonBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        cartonBtns.forEach((b) => b.classList.remove("selected"));
        btn.classList.add("selected");
        bulkInput.value = ""; // clear bulk field so they don't conflict
      });
    });

    // Typing in bulk field cancels the quick-select buttons
    bulkInput.addEventListener("input", () => {
      if (bulkInput.value.trim() !== "") {
        cartonBtns.forEach((b) => b.classList.remove("selected"));
      }
    });

    // Add to cart
    addBtn.addEventListener("click", () => {
      const bulkValue = parseInt(bulkInput.value, 10);
      const selectedBtn = selector.querySelector(".carton-btn.selected");

      let cartons;
      if (bulkValue > 0) {
        cartons = bulkValue;
      } else if (selectedBtn) {
        cartons = parseInt(selectedBtn.dataset.cartons, 10);
      } else {
        showToast("Please select a carton quantity first");
        return;
      }

      addToCart(productId, cartons);

      // reset the card's selection after adding
      cartonBtns.forEach((b) => b.classList.remove("selected"));
      bulkInput.value = "";
    });
  });
}

function initCategoryFilters() {
  document.querySelectorAll("[data-filter]").forEach((tag) => {
    tag.addEventListener("click", () => {
      document.getElementById("shop")?.scrollIntoView({ behavior: "smooth" });
      renderProductGrid("product-grid", tag.dataset.filter === "all" ? null : tag.dataset.filter);
    });
  });
}

/* ---------- Newsletter / contact form validation helpers ---------- */
function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function initNewsletterForm() {
  const form = document.getElementById("newsletter-form");
  if (!form) return;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = form.querySelector("input[type=email]");
    const msg = document.getElementById("newsletter-msg");
    if (!isValidEmail(email.value)) {
      msg.textContent = "Please enter a valid email address.";
      msg.classList.remove("success");
      return;
    }
    msg.textContent = "You're on the list — watch your inbox for fresh drops!";
    msg.classList.add("success");
    form.reset();
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  }[character]));
}

function renderReviews() {
  const list = document.getElementById("review-list");
  const count = document.getElementById("review-count");
  const reviewListWrap = document.getElementById("review-list-wrap");
  if (!list || !count || !reviewListWrap) return;
  const reviews = storage.get(REVIEWS_KEY) || [];
  count.textContent = `${reviews.length} review${reviews.length === 1 ? "" : "s"}`;
  reviewListWrap.hidden = reviews.length === 0;
  list.innerHTML = reviews.map((review) => `
    <article class="review-card">
      <div class="review-card-top">
        <strong>${escapeHtml(review.name)}</strong>
        <span class="review-stars" aria-label="${review.rating} out of 5 stars">${"★".repeat(review.rating)}${"☆".repeat(5 - review.rating)}</span>
      </div>
      <p>${escapeHtml(review.message)}</p>
    </article>
  `).join("");
}

function initReviewForm() {
  const form = document.getElementById("review-form");
  if (!form) return;
  const openButton = document.getElementById("show-review-form");
  const cancelButton = document.getElementById("cancel-review");
  renderReviews();
  openButton?.addEventListener("click", () => {
    form.hidden = false;
    openButton.hidden = true;
    document.getElementById("review-name")?.focus();
  });
  cancelButton?.addEventListener("click", () => {
    form.reset();
    form.hidden = true;
    openButton.hidden = false;
    document.getElementById("review-msg").textContent = "";
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const reviews = storage.get(REVIEWS_KEY) || [];
    reviews.unshift({
      name: data.get("name").trim(),
      rating: Number(data.get("rating")),
      message: data.get("message").trim(),
    });
    storage.set(REVIEWS_KEY, reviews);
    renderReviews();
    form.reset();
    form.hidden = true;
    openButton.hidden = false;
    document.getElementById("review-msg").textContent = "Thanks for sharing your review!";
  });
}

/* ---------- Cart page ---------- */
function renderCartPage() {
  const body = document.getElementById("cart-body");
  const layout = document.getElementById("cart-layout");
  const emptyState = document.getElementById("cart-empty");
  if (!body) return;

  const cart = getCart();
  if (cart.length === 0) {
    if (layout) layout.style.display = "none";
    if (emptyState) emptyState.style.display = "block";
    return;
  }
  if (layout) layout.style.display = "grid";
  if (emptyState) emptyState.style.display = "none";

  body.innerHTML = cart
    .map((item) => {
      const p = PRODUCTS.find((p) => p.id === item.id);
      if (!p) return "";
      const unitPrice = item.price ?? p.price;
      const displayName = item.name || p.name;
      const normalizedCart = getCart();
      const currentItem = normalizedCart.find((entry) => entry.id === item.id) || item;
      return `
      <tr>
        <td>
          <div class="cart-item-info">
            <div class="cart-item-thumb">${iconFor(p)}</div>
            <div>
              <h4>${displayName}</h4>
              <span>${p.category}</span>
            </div>
          </div>
        </td>
        <td>${formatNaira(unitPrice)}</td>
        <td>
          <div class="qty-control">
            <button aria-label="Decrease quantity" data-qty-down="${p.id}">−</button>
            <span>${item.qty}</span>
            <button aria-label="Increase quantity" data-qty-up="${p.id}">+</button>
          </div>
        </td>
        <td>${formatNaira(unitPrice * item.qty)}</td>
        <td><button class="remove-btn" data-remove="${p.id}">Remove</button></td>
      </tr>`;
    })
    .join("");

  body.querySelectorAll("[data-qty-up]").forEach((b) => b.addEventListener("click", () => updateQty(b.dataset.qtyUp, 1)));
  body.querySelectorAll("[data-qty-down]").forEach((b) => b.addEventListener("click", () => updateQty(b.dataset.qtyDown, -1)));
  body.querySelectorAll("[data-remove]").forEach((b) => b.addEventListener("click", () => removeFromCart(b.dataset.remove)));

  updateSummary("cart");
}

function updateSummary(context) {
  const subtotal = cartSubtotal();
  const delivery = subtotal > 0 ? 1200 : 0;
  const total = subtotal + delivery;

  const prefix = context === "cart" ? "cart" : "pay";
  const subEl = document.getElementById(`${prefix}-subtotal`);
  const delEl = document.getElementById(`${prefix}-delivery`);
  const totEl = document.getElementById(`${prefix}-total`);
  if (subEl) subEl.textContent = formatNaira(subtotal);
  if (delEl) delEl.textContent = formatNaira(delivery);
  if (totEl) totEl.textContent = formatNaira(total);
}

/* ---------- Payment page ---------- */
function renderOrderSummary() {
  const list = document.getElementById("order-items");
  if (!list) return;
  const cart = getCart();

  if (cart.length === 0) {
    list.innerHTML = `<p style="font-size:0.88rem;color:var(--brown-500);">Your cart is empty. <a href="index.html#shop" style="color:var(--emerald-700);font-weight:600;">Go pick something tasty</a>.</p>`;
    const btn = document.getElementById("place-order-btn");
    if (btn) btn.setAttribute("disabled", "true");
  }

  list.innerHTML =
    cart
      .map((item) => {
        const p = PRODUCTS.find((p) => p.id === item.id);
        if (!p) return "";
        const unitPrice = item.price ?? p.price;
        const displayName = item.name || p.name;
        return `<div class="summary-line"><span>${displayName} × ${item.qty}</span><span>${formatNaira(unitPrice * item.qty)}</span></div>`;
      })
      .join("") || list.innerHTML;

  updateSummary("pay");
}

function initPaymentMethods() {
  const methods = document.querySelectorAll(".pay-method");
  const cardFields = document.getElementById("card-fields");
  if (!methods.length) return;
  methods.forEach((m) => {
    m.addEventListener("click", () => {
      methods.forEach((x) => x.classList.remove("selected"));
      m.classList.add("selected");
      m.querySelector("input").checked = true;
      if (cardFields) {
        cardFields.classList.toggle("show", m.dataset.method === "card");
      }
    });
  });
}

function validateField(field, condition, message) {
  const wrap = field.closest(".field");
  const errorEl = wrap.querySelector(".error-msg");
  if (!condition) {
    wrap.classList.add("has-error");
    if (errorEl) errorEl.textContent = message;
    return false;
  }
  wrap.classList.remove("has-error");
  if (errorEl) errorEl.textContent = "";
  return true;
}

function initPaymentForm() {
  const form = document.getElementById("payment-form");
  if (!form) return;
  renderOrderSummary();
  initPaymentMethods();

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (getCart().length === 0) return;

    const name = form.querySelector("#full-name");
    const phone = form.querySelector("#phone");
    const address = form.querySelector("#address");
    const email = form.querySelector("#email");
    const selectedMethod = form.querySelector("input[name=payment-method]:checked");

    let valid = true;
    valid = validateField(name, name.value.trim().length > 2, "Please enter your full name.") && valid;
    valid = validateField(phone, /^[0-9+\s]{7,15}$/.test(phone.value.trim()), "Enter a valid phone number.") && valid;
    valid = validateField(address, address.value.trim().length > 5, "Please enter a delivery address.") && valid;
    valid = validateField(email, isValidEmail(email.value.trim()), "Enter a valid email address.") && valid;

    if (selectedMethod && selectedMethod.value === "card") {
      const cardNum = form.querySelector("#card-number");
      const cardExp = form.querySelector("#card-expiry");
      valid = validateField(cardNum, /^[0-9\s]{12,19}$/.test(cardNum.value.trim()), "Enter a valid card number.") && valid;
      valid = validateField(cardExp, /^[0-9]{2}\/[0-9]{2}$/.test(cardExp.value.trim()), "Use MM/YY format.") && valid;
    }

    if (!valid) return;

    const orderId = "AB-" + Math.floor(100000 + Math.random() * 900000);
    document.getElementById("order-id-value").textContent = orderId;
    document.getElementById("checkout-panel").style.display = "none";
    document.getElementById("confirmation-box").classList.add("show");
    clearCart();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

/* ---------- Contact page ---------- */
function initContactForm() {
  const form = document.getElementById("contact-form");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = form.querySelector("#c-name");
    const email = form.querySelector("#c-email");
    const subject = form.querySelector("#c-subject");
    const message = form.querySelector("#c-message");
    const success = document.getElementById("contact-success");

    let valid = true;
    valid = validateField(name, name.value.trim().length > 1, "Please enter your name.") && valid;
    valid = validateField(email, isValidEmail(email.value.trim()), "Enter a valid email address.") && valid;
    valid = validateField(message, message.value.trim().length > 8, "Tell us a little more.") && valid;

    if (!valid) return;

    try {
      const response = await fetch(`${API_URL}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.value.trim(),
          email: email.value.trim(),
          subject: subject.value,
          message: message.value.trim(),
        }),
      });
      if (!response.ok) throw new Error("Contact request failed");
      success.classList.add("show-msg");
      success.textContent = "Message sent — we'll reply within one business day.";
      form.reset();
    } catch {
      success.classList.add("show-msg");
      success.textContent = "We could not send your message right now. Please try again while the backend is running.";
    }
  });
}

function initFaq() {
  document.querySelectorAll(".faq-item").forEach((item) => {
    item.querySelector(".faq-q").addEventListener("click", () => {
      const isOpen = item.classList.contains("open");
      document.querySelectorAll(".faq-item").forEach((i) => i.classList.remove("open"));
      if (!isOpen) item.classList.add("open");
    });
  });
}

/* ---------- Boot ---------- */
document.addEventListener("DOMContentLoaded", () => {
  updateCartCount();
  initNavToggle();
  renderProductGrid("product-grid");
  initCategoryFilters();
  initNewsletterForm();
  initReviewForm();
  initAddToCart();
  renderCartPage();
  initPaymentForm();
  initContactForm();
  initFaq();
  initHeroCarousel();
});

function initHeroCarousel() {
  const slides = document.querySelectorAll(".hero-slide");
  const dots = document.querySelectorAll(".hero-dot");
  if (!slides.length) return;

  let activeIndex = 0;
  const showSlide = (index) => {
    slides.forEach((slide, slideIndex) => {
      slide.classList.toggle("active", slideIndex === index);
    });
    dots.forEach((dot, dotIndex) => {
      dot.classList.toggle("active", dotIndex === index);
    });
  };

  dots.forEach((dot) => {
    dot.addEventListener("click", () => {
      activeIndex = Number(dot.dataset.slide || 0);
      showSlide(activeIndex);
    });
  });

  setInterval(() => {
    activeIndex = (activeIndex + 1) % slides.length;
    showSlide(activeIndex);
  }, 5000);

  showSlide(activeIndex);
}

/* ---------- Compatibility for add-to-cart buttons ---------- */
function initAddToCart() {
  document.querySelectorAll(".product-card[data-product-id]").forEach((card) => {
    const productId = card.dataset.productId;
    const cartonBtns = card.querySelectorAll(".carton-btn");
    const bulkToggle = card.querySelector(".bulk-toggle");
    const bulkWrap = card.querySelector(".bulk-input-wrap");
    const bulkInput = card.querySelector(".bulk-input");

    if (!productId) return;

    let bulkActive = false;

    cartonBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        cartonBtns.forEach((b) => b.classList.remove("selected", "active"));
        btn.classList.add("selected", "active");

        const bulkVal = parseInt(bulkInput?.value, 10);
        const qty = bulkVal > 0 ? bulkVal : Number(btn.dataset.cartons || btn.dataset.qty || 1);
        const priceText = card.querySelector(".price-tag")?.textContent || "";
        const price = Number(priceText.replace(/[^\d]/g, ""));
        const displayName = card.querySelector(".product-cat")?.textContent?.trim() || "Product";
        addToCart(productId, qty, Number.isFinite(price) ? price : null, displayName);

        cartonBtns.forEach((b) => b.classList.remove("selected", "active"));
        const defaultBtn = card.querySelector('.carton-btn[data-cartons="1"], .carton-btn[data-qty="1"]');
        if (defaultBtn) defaultBtn.classList.add("selected", "active");
        if (bulkInput) bulkInput.value = "";
        if (bulkWrap) bulkWrap.hidden = true;
        if (bulkToggle) bulkToggle.textContent = "Bulk order?";
        bulkActive = false;
      });
    });

    if (bulkToggle && bulkWrap && bulkInput) {
      bulkToggle.addEventListener("click", () => {
        bulkActive = !bulkActive;
        bulkWrap.hidden = !bulkActive;
        bulkToggle.textContent = bulkActive ? "Cancel bulk order" : "Bulk order?";
        if (bulkActive) {
          cartonBtns.forEach((b) => b.classList.remove("selected", "active"));
          bulkInput.focus();
        }
      });
    }
  });
}