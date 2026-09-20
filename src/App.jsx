import { useEffect, useMemo, useState } from "react";

const PRODUCTS = [
  { id: "cc1", name: "Chin-Chin", category: "Chin-Chin", weight: "500g pack", price: 1000, unit: "pack", icon: "chinchin" },
  { id: "ck1", name: "Cookies", category: "Cookies", weight: "12-pack", price: 2000, unit: "pack", icon: "cookie" },
  { id: "br1", name: "Bread", category: "Bread", weight: "800g loaf", price: 1500, unit: "loaf", icon: "bread" },
  { id: "fj1", name: "Fruit Juice", category: "Fruit Juice", weight: "1 litre", price: 1000, unit: "bottle", icon: "juice" },
];

const CART_KEY = "adunbites_cart";
const API_URL = "http://127.0.0.1:8000/api";
const categories = ["Chin-Chin", "Cookies", "Bread", "Fruit Juice"];
const money = (value) => `₦${value.toLocaleString("en-NG")}`;

const getDeliveryFee = (address = "") => {
  const normalized = String(address).trim().toLowerCase();
  if (!normalized) return 0;

  const portHarcourtCore = /(rumuewhara|rumuola|rumuomasi|diobu|port harcourt|phc|p\.h\.c|old gra|new gra|g\.r\.a|gra|mgbuoba|ada george|ogbunabali|d-line|dline|rivers state|rivers)/i;
  const portHarcourtOuter = /(woji|choba|aluu|ozuoba|eneka|oroazi|trans-amadi|eliozu|rumuodomaya|mini|oyigbo|eleme|bonny|obio|obio[/-]akpor|akpor)/i;
  const interstate = /(lagos|ikeja|lekki|surulere|yaba|ajah|victoria island|abuja|kubwa|gwarinpa|ibadan|abeokuta|enugu|owerri|aba|asaba|benin|warri|kaduna|kano|jos|katsina|sokoto|kogi|calabar|uyo|akwa ibom|bayelsa|delta|edo|onitsha|nnewi)/i;
  const international = /(uk|united kingdom|usa|united states|america|canada|europe|france|germany|dubai|uae|saudi|qatar|london|new york|toronto|paris|berlin|abroad)/i;

  if (international.test(normalized)) return 45000;
  if (interstate.test(normalized)) return 9000;
  if (portHarcourtCore.test(normalized)) return 1500;
  if (portHarcourtOuter.test(normalized)) return 2500;
  return 3000;
};

function readCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY)) || [];
  } catch {
    return [];
  }
}

function Icon({ name }) {
  const paths = {
    cart: <><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" /></>,
    check: <path d="M20 6L9 17l-5-5" />,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></>,
    star: <path d="M12 2l3 7h7l-5.5 4.5L18.5 21 12 16.5 5.5 21l2-7.5L2 9h7z" />,
    truck: <><rect x="1" y="7" width="15" height="10" rx="2" /><path d="M16 10h4l3 3v4h-7z" /><circle cx="6" cy="19" r="2" /><circle cx="18" cy="19" r="2" /></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">{paths[name] || paths.star}</svg>;
}

function ProductMark({ type }) {
  return <div className={`product-mark ${type}`} aria-hidden="true">{type === "juice" ? "◒" : type === "bread" ? "⌁" : type === "cookie" ? "●" : "✦"}</div>;
}

function App() {
  const [path, setPath] = useState(window.location.pathname || "/");
  const [cart, setCart] = useState(readCart);
  const [toast, setToast] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const [shopTarget, setShopTarget] = useState(false);
  const [products, setProducts] = useState(PRODUCTS);

  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    fetch(`${API_URL}/products`)
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Product request failed")))
      .then((remoteProducts) => setProducts(remoteProducts.slice(0, 4).map((product) => ({
        ...product,
        unit: product.category === "Bread" ? "loaf" : product.category === "Fruit Juice" ? "bottle" : "pack",
        icon: product.category === "Fruit Juice" ? "juice" : product.category === "Bread" ? "bread" : product.category === "Cookies" ? "cookie" : "chinchin",
      }))))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const handlePopState = () => setPath(window.location.pathname || "/");
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (!shopTarget || (path !== "/" && path !== "/homepage.html")) return;
    document.getElementById("shop")?.scrollIntoView({ behavior: "smooth", block: "start" });
    setShopTarget(false);
  }, [path, shopTarget]);

  const navigate = (to) => {
    const aliases = { "/about": "/aboutpage.html", "/cart": "/cartpage.html", "/checkout": "/paymentpage.html", "/contact": "/contactpage.html" };
    const next = aliases[to] || (to === "/" || to === "/shop" ? "/homepage.html" : to);
    const shouldScrollToShop = to === "/shop";
    window.history.pushState({}, "", next);
    setPath(next);
    setMobileNav(false);
    setShopTarget(shouldScrollToShop);
    if (!shouldScrollToShop) window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const notify = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  };

  const addToCart = (product, quantity) => {
    setCart((current) => {
      const existing = current.find((item) => item.id === product.id);
      if (existing) return current.map((item) => item.id === product.id ? { ...item, qty: item.qty + quantity } : item);
      return [...current, { id: product.id, name: product.name, price: product.price, qty: quantity }];
    });
    notify(`${product.name} added to cart`);
  };

  const updateQty = (id, delta) => setCart((current) => current.flatMap((item) => item.id === id && item.qty + delta <= 0 ? [] : item.id === id ? [{ ...item, qty: item.qty + delta }] : [item]));
  const removeItem = (id) => setCart((current) => current.filter((item) => item.id !== id));
  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);

  return <>
    <Header path={path} cartCount={cartCount} navigate={navigate} mobileNav={mobileNav} setMobileNav={setMobileNav} />
    {path === "/" || path === "/homepage.html" ? <Home products={products} addToCart={addToCart} navigate={navigate} /> : null}
    {path === "/cart" || path === "/cartpage.html" ? <Cart cart={cart} updateQty={updateQty} removeItem={removeItem} navigate={navigate} /> : null}
    {path === "/checkout" || path === "/paymentpage.html" ? <Checkout cart={cart} setCart={setCart} navigate={navigate} notify={notify} /> : null}
    {path === "/about" || path === "/aboutpage.html" ? <About navigate={navigate} /> : null}
    {path === "/contact" || path === "/contactpage.html" ? <BackendContact navigate={navigate} /> : null}
    {path === "/admin" || path === "/adminpage.html" ? <AdminOrders /> : null}
    <Footer navigate={navigate} />
    {toast && <div className="toast show"><Icon name="check" /><span>{toast}</span></div>}
  </>;
}

function Header({ path, cartCount, navigate, mobileNav, setMobileNav }) {
  const link = (to, label, matches) => <li><a href={to} aria-current={matches ? "page" : undefined} onClick={(event) => { event.preventDefault(); navigate(to); }}>{label}</a></li>;
  return <header className="site-header"><nav className="nav-bar">
    <a href="/" className="logo" onClick={(event) => { event.preventDefault(); navigate("/"); }}><svg className="logo-mark" viewBox="0 0 100 100" fill="none"><circle cx="50" cy="50" r="46" fill="var(--emerald-700)" /><path d="M32 58 C32 40 40 30 50 30 C60 30 68 40 68 58" stroke="var(--gold-500)" strokeWidth="5" strokeLinecap="round" /><circle cx="50" cy="66" r="6" fill="var(--gold-500)" /></svg><span>SNACKANDSOLACE</span></a>
    <button className="nav-toggle" aria-label="Toggle menu" aria-expanded={mobileNav} onClick={() => setMobileNav((open) => !open)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16" /></svg></button>
    <ul className={`nav-links ${mobileNav ? "open" : ""}`}>{link("/homepage.html", "Home", path === "/" || path === "/homepage.html")}{link("/aboutpage.html", "About", path.includes("about"))}{link("/paymentpage.html", "Checkout", path.includes("checkout") || path.includes("payment"))}{link("/contactpage.html", "Contact", path.includes("contact"))}</ul>
    <div className="nav-actions"><a href="/cartpage.html" className="cart-pill" onClick={(event) => { event.preventDefault(); navigate("/cartpage.html"); }}><Icon name="cart" /> Cart <span id="cart-count">{cartCount}</span></a></div>
  </nav></header>;
}

function PageHero({ title, copy, navigate }) {
  return <section className="page-hero"><div className="container"><div className="breadcrumb"><a href="/" onClick={(event) => { event.preventDefault(); navigate("/"); }}>Home</a> / {title}</div><h1>{title}</h1>{copy && <p style={{ color: "var(--brown-700)" }}>{copy}</p>}</div></section>;
}

function Home({ products, addToCart, navigate }) {
  const [filter, setFilter] = useState("all");
  const [slide, setSlide] = useState(0);
  const visible = filter === "all" ? products : products.filter((product) => product.category === filter);
  useEffect(() => { const timer = window.setInterval(() => setSlide((current) => (current + 1) % 3), 5000); return () => window.clearInterval(timer); }, []);
  const featured = [
    ["Freshly baked", "Crunchy chin-chin", "Golden, airy and perfect for sharing with every cup of tea.", "hero-card-chinchin"],
    ["Warm & soft", "Homestyle bread snacks", "Soft crumb, hearty flavor and just the right bake for breakfast.", "hero-card-bread"],
    ["Cold pressed", "Bright fruit juice", "Freshly bottled and chilled for a refreshing everyday sip.", "hero-card-juice"],
  ];
  return <>
    <section className="hero"><div className="container"><div className="hero-copy"><span className="eyebrow" style={{ color: "var(--gold-500)" }}>Treats that feel like a hug</span><h1>Everyday snacks, made <em>for comfort</em> — made delicious.</h1><p className="lede">From crunchy chin-chin to bread snacks and cold-pressed juice, SNACKANDSOLACE brings the taste of a proper kitchen to your doorstep.</p><div className="hero-ctas"><a href="#categories" className="btn btn-primary" onClick={(event) => { event.preventDefault(); document.getElementById("categories")?.scrollIntoView({ behavior: "smooth" }); }}>Shop the tray</a><button className="btn btn-secondary" onClick={() => navigate("/about")}>Our story</button></div></div><div className="hero-tray"><div className="hero-carousel" aria-label="Featured snacks slideshow">{featured.map((item, index) => <div className={`hero-slide ${index === slide ? "active" : ""}`} key={item[1]}><div className={`hero-slide-card ${item[3]}`}><span className="hero-slide-tag">{item[0]}</span><h3>{item[1]}</h3><p>{item[2]}</p></div></div>)}</div><div className="hero-dots">{featured.map((item, index) => <button key={item[1]} className={`hero-dot ${index === slide ? "active" : ""}`} aria-label={`Show slide ${index + 1}`} onClick={() => setSlide(index)} />)}</div></div></div></section>
    <section id="categories"><div className="container"><div className="section-head"><span className="eyebrow">What we make</span><h2>Four cravings, one basket</h2></div><div className="category-row">{categories.map((category) => <button className="category-tag" key={category} onClick={() => setFilter(category)}><ProductMark type={category === "Fruit Juice" ? "juice" : category === "Bread" ? "bread" : category === "Cookies" ? "cookie" : "chinchin"} /><h3>{category}</h3><span>Browse treats</span></button>)}</div><div className="shop-heading"><div><span className="eyebrow">The full shop</span><h2>{filter === "all" ? "Made for your snack drawer" : filter}</h2></div><button className="btn btn-secondary" onClick={() => setFilter("all")}>Show everything</button></div><div className="product-grid" id="shop">{visible.map((product) => <ProductCard key={product.id} product={product} addToCart={addToCart} />)}</div></div></section>
    <section><div className="container"><div className="section-head"><span className="eyebrow">Why SNACKANDSOLACE</span><h2>Small-batch, seriously fresh</h2></div><div className="why-grid"><Why icon="clock" title="Baked with you in mind" copy="Made in small batches with care." /><Why icon="star" title="No preservatives" copy="Real butter, real fruit, honest ingredients — nothing artificial." /><Why icon="truck" title="Nationwide delivery" copy="Packed to stay crisp and fresh, wherever in Nigeria you are." /></div></div></section>
    <section style={{ background: "var(--cream-100)" }}><div className="container"><div className="section-head"><span className="eyebrow">Loved locally</span><h2>What customers say</h2></div><div className="testimonial-row"><Testimonial text="The chin-chin doesn't go soft after two days like every other brand I've tried. My kids finish a pack in one sitting." name="Ngozi A., Abuja" /><Testimonial text="Ordered the family loaf and cookies for a Sunday brunch. Everything arrived warm-fresh and beautifully packed." name="Tunde O., Lagos" /><Testimonial text="Zobo juice tastes homemade, not the overly sweet bottled stuff. Now a weekly staple in our fridge." name="Amaka I., Enugu" /></div></div></section>
    <section><div className="container"><div className="newsletter"><div><h2>Get first taste of new flavors</h2><p>Join the list for early access to limited batches and delivery discounts. No spam, just snacks.</p></div><Newsletter /></div></div></section>
  </>;
}

function ProductCard({ product, addToCart }) {
  const [quantity, setQuantity] = useState(1);
  const [customQuantity, setCustomQuantity] = useState("");

  const addQuantity = (value) => {
    const cartons = Number(value);
    if (cartons > 0) {
      addToCart(product, cartons);
      setQuantity(cartons);
      setCustomQuantity("");
    }
  };

  return <article className="product-card"><div className="product-thumb"><ProductMark type={product.icon} /></div><div className="product-body"><span className="product-cat">{product.category}</span><h3 className="product-name">{product.name}</h3><div className="carton-selector"><div className="carton-presets">{[1, 2, 3].map((value) => <button type="button" className={`carton-btn ${quantity === value ? "selected" : ""}`} key={value} onClick={() => addQuantity(value)}>{value}</button>)}</div><div className="bulk-order"><label htmlFor={`bulk-${product.id}`}>Bulk order</label><input id={`bulk-${product.id}`} type="number" min="1" placeholder="Enter quantity" value={customQuantity} onChange={(event) => { setCustomQuantity(event.target.value); setQuantity(Number(event.target.value) || 1); }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addQuantity(customQuantity); } }} onBlur={() => addQuantity(customQuantity)} /></div></div><div className="product-row"><span className="price-tag">{money(product.price)} <small>/{product.unit}</small></span></div></div></article>;
}

function Why({ icon, title, copy }) { return <div className="why-card"><Icon name={icon} /><h3>{title}</h3><p>{copy}</p></div>; }
function Testimonial({ text, name }) { return <div className="testimonial"><p>"{text}"</p><strong>— {name}</strong></div>; }
function Newsletter() { const [email, setEmail] = useState(""); const [message, setMessage] = useState(""); const submit = (event) => { event.preventDefault(); setMessage(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? "You're on the list — watch your inbox for fresh drops!" : "Please enter a valid email address."); }; return <div><form className="newsletter-form" onSubmit={submit}><input type="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required /><button type="submit" className="btn btn-gold">Subscribe</button></form>{message && <div className="form-msg success">{message}</div>}</div>; }

function Cart({ cart, updateQty, removeItem, navigate }) {
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  return <><PageHero title="Your cart" copy="Review your tray before checkout." navigate={navigate} /><section><div className="container">{cart.length ? <div className="cart-layout"><table className="cart-table"><thead><tr><th>Item</th><th>Price</th><th>Quantity</th><th>Subtotal</th><th /></tr></thead><tbody>{cart.map((item) => <tr key={item.id}><td><div className="cart-item-info"><div className="cart-item-thumb"><ProductMark type={PRODUCTS.find((product) => product.id === item.id)?.icon || "cookie"} /></div><div><h4>{item.name}</h4><span>Freshly packed</span></div></div></td><td>{money(item.price)}</td><td><div className="qty-control"><button onClick={() => updateQty(item.id, -1)}>-</button><span>{item.qty}</span><button onClick={() => updateQty(item.id, 1)}>+</button></div></td><td>{money(item.price * item.qty)}</td><td><button className="remove-btn" onClick={() => removeItem(item.id)}>Remove</button></td></tr>)}</tbody></table><Summary subtotal={subtotal} navigate={navigate} /></div> : <div className="empty-state"><Icon name="cart" /><h3>Your tray is empty</h3><p style={{ color: "var(--brown-500)" }}>Nothing here yet — go pick some chin-chin, cookies, bread or juice.</p><button className="btn btn-primary" onClick={() => navigate("/")}>Browse the shop</button></div>}</div></section></>;
}
function Summary({ subtotal, navigate }) { return <aside className="summary-card"><h3>Order summary</h3><div className="summary-line"><span>Subtotal</span><span>{money(subtotal)}</span></div><div className="summary-line"><span>Delivery</span><span>{money(0)}</span></div><div className="summary-line total"><span>Total</span><span>{money(subtotal)}</span></div><button className="btn btn-primary btn-block" style={{ marginTop: 20 }} onClick={() => navigate("/checkout")}>Proceed to checkout</button><button className="btn btn-secondary btn-block" style={{ marginTop: 12 }} onClick={() => navigate("/")}>Continue shopping</button></aside>; }

function Checkout({ cart, setCart, navigate, notify }) {
  const [submitted, setSubmitted] = useState(false);
  const [payment] = useState("paystack");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const deliveryFee = getDeliveryFee(deliveryAddress);
  const total = subtotal + deliveryFee;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reference = params.get("reference");
    if (!reference) return;

    const pendingOrder = sessionStorage.getItem("pending_paystack_order");
    if (!pendingOrder) return;

    (async () => {
      try {
        const verifyResponse = await fetch(`${API_URL}/paystack/verify?reference=${encodeURIComponent(reference)}`);
        if (!verifyResponse.ok) throw new Error("Verification failed");
        const verification = await verifyResponse.json();
        if (verification.status !== "success") throw new Error("Payment not successful");

        const payload = JSON.parse(pendingOrder);
        const orderResponse = await fetch(`${API_URL}/orders`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...payload,
            payment_method: "paystack",
          }),
        });
        if (!orderResponse.ok) throw new Error("Order creation failed");

        sessionStorage.removeItem("pending_paystack_order");
        setSubmitted(true);
        setCart([]);
        notify("Order received");
        const nextUrl = new URL(window.location.href);
        nextUrl.search = "";
        window.history.replaceState({}, "", nextUrl);
      } catch {
        setError("Your payment was not completed successfully. Please try again.");
      }
    })();
  }, [notify, setCart]);

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const payload = {
      full_name: form.get("full_name"),
      phone: form.get("phone"),
      email: form.get("email"),
      address: form.get("address"),
      payment_method: payment,
      delivery_fee: deliveryFee,
      items: cart.map((item) => ({ id: item.id, quantity: item.qty })),
    };

    try {
      if (payment === "paystack") {
        const response = await fetch(`${API_URL}/paystack/initialize`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorDetail = await response.json().catch(() => ({}));
          throw new Error(errorDetail.detail || "Paystack initialization failed");
        }

        const paystackData = await response.json();
        sessionStorage.setItem("pending_paystack_order", JSON.stringify(payload));
        window.location.href = paystackData.authorization_url;
        return;
      }

      throw new Error("Paystack is the only available payment method");
    } catch {
      setError("We could not place your order. Please check that the backend is running and try again.");
    } finally {
      setSubmitting(false);
    }
  };
  if (submitted) return <section><div className="container"><div className="confirmation-box show"><Icon name="check" /><h2>Order placed!</h2><p style={{ color: "var(--brown-700)" }}>Thank you — your tray is being packed. A confirmation has been sent to your email.</p><div className="order-id">Order ID: <strong>SNS-{Date.now().toString().slice(-6)}</strong></div><div style={{ marginTop: 26 }}><button className="btn btn-secondary" onClick={() => navigate("/")}>Back to home</button></div></div></div></section>;
  return <><PageHero title="Checkout" copy="Enter your delivery details and pay securely with Paystack." navigate={navigate} /><section><div className="container"><div className="cart-layout"><div className="checkout-panel"><form onSubmit={submit}><h3 style={{ marginBottom: 20 }}>Delivery details</h3><div className="form-grid"><Field label="Full name" placeholder="Chioma Eze" /><Field label="Phone number" placeholder="080 000 0000" type="tel" /><Field label="Email address" placeholder="you@example.com" type="email" full /><Field label="Delivery address" placeholder="Street, city, state" textarea full value={deliveryAddress} onChange={(event) => setDeliveryAddress(event.target.value)} /></div><h3 style={{ margin: "8px 0 16px" }}>Payment method</h3><div className="pay-methods"><label className="pay-method selected"><input type="radio" name="payment-method" checked readOnly />Pay securely with Paystack</label></div>{error && <div className="form-msg error" style={{ marginTop: 12 }}>{error}</div>}<button type="submit" className="btn btn-primary btn-block" style={{ marginTop: 10 }} disabled={!cart.length || submitting}>{submitting ? "Processing..." : "Continue to Paystack"}</button></form></div><aside className="summary-card"><h3>Order summary</h3>{cart.map((item) => <div className="summary-line" key={item.id}><span>{item.name} x {item.qty}</span><span>{money(item.price * item.qty)}</span></div>)}<div className="summary-line"><span>Delivery</span><span>{money(deliveryFee)}</span></div><div className="summary-line total"><span>Total</span><span>{money(total)}</span></div></aside></div></div></section></>;
}
function Field({ label, name, placeholder, type = "text", full = false, textarea = false, value, onChange }) { const fieldName = name || ({ "Full name": "full_name", "Phone number": "phone", "Email address": "email", "Delivery address": "address", Subject: "subject", Message: "message" }[label] || label.toLowerCase().replace(/\s+/g, "_")); return <div className={`field ${full ? "full" : ""}`}><label>{label}</label>{textarea ? <textarea name={fieldName} rows="3" placeholder={placeholder} required value={value} onChange={onChange} /> : <input name={fieldName} type={type} placeholder={placeholder} required value={value} onChange={onChange} />}</div>; }

function About({ navigate }) { return <><PageHero title="A bite of comfort, a promise of quality" copy="SNACKANDSOLACE was built on a simple idea: healthy, delicious snacks made with real ingredients and genuine care." navigate={navigate} /><section><div className="container"><div className="about-story"><div><span className="eyebrow">Our story</span><h2>From a kitchen project to wholesome treats delivered to you</h2><p>SNACKANDSOLACE was officially registered in 2026 with a single mission — to make healthy snacking effortless, comforting, and utterly delicious.</p><p>Every item is crafted with wholesome ingredients and zero shortcuts, following one golden rule: if it’s not good enough for our own table, it doesn’t leave our kitchen.</p></div><div className="timeline"><Timeline year="2026" title="The First Batch & Launch" text="Our first recipes moved from the kitchen straight to our earliest supporters." /><Timeline year="2026" title="Glowing Reviews & Growing Demand" text="Customer feedback confirmed what we set out to do — create snacks that taste amazing and nourish well." /><Timeline year="Next Step" title="Expanding Our Reach" text="Growing our delivery network so fresh treats reach snack lovers everywhere." /></div></div></div></section><section style={{ background: "var(--cream-100)" }}><div className="container"><div className="section-head"><span className="eyebrow">What we stand for</span><h2>Four rules we don't bend</h2></div><div className="values-grid"><Value title="Real ingredients" text="No preservatives, no shortcuts, ever." /><Value title="Made to order" text="Baked in the days before it ships, not before." /><Value title="Fair to farmers" text="We buy grain and fruit directly from local growers." /><Value title="Careful delivery" text="Packaging built to survive a bumpy road trip." /></div></div></section><section style={{ background: "var(--emerald-900)", color: "var(--cream-50)", textAlign: "center" }}><div className="container"><h2 style={{ color: "var(--cream-50)" }}>Hungry already?</h2><p>Browse the full shop and build your own tray of chin-chin, cookies, bread and juice.</p><button className="btn btn-gold" onClick={() => navigate("/shop")}>Start shopping</button></div></section></>; }
function Timeline({ year, title, text }) { return <div className="timeline-item"><div className="timeline-year">{year}</div><div><h4>{title}</h4><p>{text}</p></div></div>; }
function Value({ title, text }) { return <div className="value-card"><Icon name="star" /><h4>{title}</h4><p>{text}</p></div>; }

function BackendContact({ navigate }) {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event) => {
    event.preventDefault();
    setError("");
    try {
      const form = new FormData(event.currentTarget);
      const response = await fetch(`${API_URL}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(form.entries())),
      });
      if (!response.ok) throw new Error("Contact request failed");
      setSent(true);
      event.currentTarget.reset();
    } catch {
      setError("We could not send your message. Please check that the backend is running and try again.");
    }
  };
return <><PageHero title="We'd love to hear from you" copy="Questions about an order, bulk requests, or just want to say hi — reach us below." navigate={navigate} /><section><div className="container"><div className="contact-layout"><div className="contact-info-card"><h3>Contact details</h3><div className="info-row"><strong>Phone<span>+234 703 7749 735</span></strong></div><div className="info-row"><strong>Email<span>snackandsolace@gmail.com</span></strong></div><div className="info-row"><strong>Address<span>13 Nyejelem close Rumuewhara, Portharcourt, Nigeria</span></strong></div><div className="info-row"><strong>Hours<span>Mon – Sat, 8am – 6pm WAT</span></strong></div></div><div className="checkout-panel"><h3 style={{ marginBottom: 20 }}>Send us a message</h3><form onSubmit={submit}><div className="form-grid"><Field label="Full name" name="name" placeholder="Your name" /><Field label="Email address" placeholder="you@example.com" type="email" /><Field label="Subject" placeholder="Order enquiry" full /><Field label="Message" placeholder="How can we help?" textarea full /></div><button type="submit" className="btn btn-primary btn-block">Send message</button>{sent && <p style={{ marginTop: 14, color: "var(--emerald-700)", fontWeight: 600 }}>Thanks — we’ll get back to you shortly.</p>}{error && <p className="error-msg" style={{ marginTop: 14 }}>{error}</p>}</form></div></div></div></section></>;
}

function AdminOrders() {
  const [adminKey, setAdminKey] = useState("");
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const statuses = ["received", "preparing", "shipped", "delivered"];

  const loadDashboard = async (event) => {
    event?.preventDefault();
    setLoading(true);
    setError("");
    try {
      const headers = { "X-Admin-Key": adminKey };
      const [ordersResponse, customersResponse] = await Promise.all([
        fetch(`${API_URL}/orders`, { headers }),
        fetch(`${API_URL}/customers`, { headers }),
      ]);

      if (ordersResponse.status === 401 || customersResponse.status === 401) throw new Error("Invalid admin key");
      if (!ordersResponse.ok) throw new Error("Orders could not be loaded");
      if (!customersResponse.ok) throw new Error("Customers could not be loaded");

      const nextOrders = await ordersResponse.json();
      const nextCustomers = await customersResponse.json();
      setOrders(nextOrders);
      setCustomers(nextCustomers);
    } catch (requestError) {
      setError(requestError.message);
      setOrders([]);
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (orderId, status) => {
    try {
      const response = await fetch(`${API_URL}/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-Admin-Key": adminKey },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error("Status update failed");
      setOrders((current) => current.map((order) => order.id === orderId ? { ...order, status } : order));
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  return <section><div className="container admin-page"><div className="section-head"><span className="eyebrow">Private area</span><h1>Order dashboard</h1><p>Review orders and customer records saved in your backend.</p></div><form className="admin-login" onSubmit={loadDashboard}><label htmlFor="admin-key">Admin API key</label><input id="admin-key" type="password" value={adminKey} onChange={(event) => setAdminKey(event.target.value)} placeholder="Enter your admin key" required /><button className="btn btn-primary" type="submit" disabled={loading}>{loading ? "Loading..." : "View dashboard"}</button></form>{error && <p className="error-msg admin-error">{error}</p>}{orders.length > 0 ? <div className="admin-orders">{orders.map((order) => <article className="admin-order" key={order.id}><div><strong>{order.id}</strong><span>{order.full_name} · {order.email}</span><span>{new Date(order.created_at).toLocaleString()}</span></div><div><strong>{money(order.total)}</strong><select value={order.status} onChange={(event) => updateStatus(order.id, event.target.value)}>{statuses.map((status) => <option key={status} value={status}>{status}</option>)}</select><span>{order.payment_method}</span></div></article>)}</div> : !loading && !error ? <div className="empty-state"><h3>No orders yet</h3><p>Your orders will appear here.</p></div> : null}{customers.length > 0 ? <div style={{ marginTop: 42 }}><div className="section-head"><span className="eyebrow">Customer data</span><h2>Registered customers</h2></div><div className="admin-orders">{customers.map((customer) => <article className="admin-order" key={customer.id}><div><strong>{customer.full_name}</strong><span>{customer.email}</span><span>{customer.phone}</span></div><div><strong>{money(customer.total_spent || 0)}</strong><span>{customer.order_count || 0} orders</span><span>Last seen: {new Date(customer.last_order_at).toLocaleString()}</span></div></article>)}</div></div> : !loading && !error && orders.length === 0 ? <div className="empty-state" style={{ marginTop: 32 }}><h3>No customer records yet</h3><p>Orders placed through checkout will appear here.</p></div> : null}</div></section>;
}

function Footer({ navigate }) { return <footer className="site-footer"><div className="container"><div className="footer-grid"><div><div className="logo" style={{ color: "var(--cream-50)", marginBottom: 12 }}>SNACKANDSOLACE</div><p>Freshly made chin-chin, cookies, bread and fruit juice — delivered worldwide.</p></div><div><h4>Shop</h4><ul><li><button className="footer-link" onClick={() => navigate("/")}>All products</button></li><li><button className="footer-link" onClick={() => navigate("/cart")}>View cart</button></li><li><button className="footer-link" onClick={() => navigate("/checkout")}>Checkout</button></li></ul></div><div><h4>Company</h4><ul><li><button className="footer-link" onClick={() => navigate("/about")}>About us</button></li><li><button className="footer-link" onClick={() => navigate("/contact")}>Contact</button></li></ul></div><div><h4>Get in touch</h4><ul><li>snackandsolace@gmail.com</li><li>+234 703 7749 735</li><li>13 Nyejelem close Rumuewhara, Portharcourt</li></ul></div></div><div className="footer-bottom"><span>© 2026 SNACKANDSOLACE. All rights reserved.</span><span>Made with love in Portharcourt, Nigeria.</span></div></div></footer>; }

export default App;
