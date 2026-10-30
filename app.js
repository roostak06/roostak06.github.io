/* Roostak starter — configure Supabase values before enabling account features. */
const SUPABASE_URL = "https://livlnryfpbsmsnzixxqy.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_CSFsOwJ2-ekzxrKMN5ceQA_MP2KXsbZ";
const DEFAULT_CATEGORIES = ["خوراکی محلی", "عرقیجات و سرکه", "محصولات کشاورزی", "خدمات حضوری", "صنایع دستی"];
let CATEGORIES = [...DEFAULT_CATEGORIES];
const INTERNAL_EMAIL_DOMAIN = "users.roostak.invalid";
const PLACEHOLDER_IMAGE = "data:image/svg+xml;charset=UTF-8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300"><rect width="300" height="300" fill="#e7ebe2"/><path d="M60 220l60-70 40 45 35-40 45 65z" fill="#b7c8b4"/><circle cx="196" cy="92" r="24" fill="#d9a441"/></svg>');
const $ = (id) => document.getElementById(id);
const state = { client: null, user: null, profile: null, products: [], installPrompt: null, authMode: "login", images: [], theme: "light", search: "", sellerProfiles: new Map(), ratings: new Map(), myRatings: new Map() };
const modal = $("appModal");
const modalBody = $("modalBody");
const modalTitle = $("modalTitle");

function configured() {
  return !SUPABASE_URL.includes("YOUR-PROJECT") && !SUPABASE_ANON_KEY.includes("YOUR-SUPABASE");
}
function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (ch) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[ch]));
}
function safeUrl(value = "") {
  try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) ? url.href : ""; } catch { return ""; }
}
function toast(message) {
  const el = $("toast"); el.textContent = message; el.classList.add("show");
  clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove("show"), 3000);
}
function openModal(title, html) {
  modalTitle.textContent = title; modalBody.innerHTML = `<div class="modal-content">${html}</div>`;
  const shareBtn = $("modalShare"); if (shareBtn) { shareBtn.hidden = true; delete shareBtn.dataset.productId; }
  if (!modal.open) modal.showModal();
}
function closeModal() { if (modal.open) modal.close(); }
$("modalClose").addEventListener("click", closeModal);
modal.addEventListener("click", (event) => { if (event.target === modal) closeModal(); });

function setTheme(theme) {
  state.theme = theme;
  document.body.classList.toggle("dark", theme === "dark");
  localStorage.setItem("roostak-theme", theme);
}
setTheme(localStorage.getItem("roostak-theme") || "light");

function showMain(which) {
  $("appMain").hidden = which !== "home";
  $("authMain").hidden = which !== "auth";
  $("accountMain").hidden = which !== "account";
  // Auth and account are focused screens: no search header or bottom navigation, only a way back home.
  const focused = which === "auth" || which === "account";
  document.querySelector(".site-header").hidden = focused;
  document.querySelector(".bottom-nav").hidden = focused;
  $("backBar").hidden = !focused;
  document.body.classList.toggle("auth-screen", which === "auth");
  document.body.classList.toggle("focused-screen", focused);
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function goHome() { showMain("home"); renderHome(); }
$("homeLink").addEventListener("click", (e) => { e.preventDefault(); goHome(); });
$("backHomeBtn").addEventListener("click", () => goHome());
$("accountEntry").addEventListener("click", () => state.user ? showAccount() : showAuth("login"));
$("accountNav").addEventListener("click", () => state.user ? showAccount() : showAuth("login"));
$("categoriesNav").addEventListener("click", async () => { await loadPublicCategories(); openModal("دسته‌بندی‌ها", `<div class="form-stack">${CATEGORIES.map((c,i)=>`<button class="btn btn-outline category-jump" data-index="${i}">${escapeHtml(c)}</button>`).join("")}</div>`); });
modalBody.addEventListener("click", (e) => {
  const jump = e.target.closest(".category-jump");
  if (jump) { closeModal(); showMain("home"); document.querySelector(`[data-category-index="${jump.dataset.index}"]`)?.scrollIntoView({behavior:"smooth",block:"start"}); }
});
$("settingsNav").addEventListener("click", () => openModal("تنظیمات ظاهر", `
  <div class="settings-row"><div><strong>حالت نمایش</strong><p class="form-note">روشن یا تاریک</p></div><button class="btn btn-outline" id="themeToggle">${state.theme === "dark" ? "حالت روشن" : "حالت تاریک"}</button></div>
  <div class="settings-row"><div><strong>رنگ تأکیدی</strong><p class="form-note">رنگ اصلی رابط کاربری</p></div><input id="accentPicker" class="color-input" type="color" value="${getComputedStyle(document.body).getPropertyValue("--green").trim() || "#246B45"}"></div>
  <button class="btn btn-outline" id="resetColors">بازگشت به رنگ اصلی</button>
  <button class="btn btn-outline legal-open" id="legalOpen">قوانین و راهنمای روستاک</button>
`));
modalBody.addEventListener("click", (e) => {
  if (e.target.id === "themeToggle") { setTheme(state.theme === "dark" ? "light" : "dark"); e.target.textContent = state.theme === "dark" ? "حالت روشن" : "حالت تاریک"; }
  if (e.target.id === "resetColors") { document.documentElement.style.removeProperty("--green"); toast("رنگ اصلی بازگردانده شد."); }
  if (e.target.id === "legalOpen") showLegalPage();
});
modalBody.addEventListener("input", (e) => { if (e.target.id === "accentPicker") document.documentElement.style.setProperty("--green", e.target.value); });

function renderCategorySections() {
  const root = $("categorySections");
  root.innerHTML = CATEGORIES.map((category, index) => {
    const list = state.products.filter(p => p.category === category && p.status === "approved" && p.is_available !== false && matchesSearch(p));
    return `<section class="category-section" data-category-index="${index}"><div class="section-heading"><div><p class="eyebrow">از تولیدکننده‌های محلی</p><h2>${escapeHtml(category)}</h2></div></div><div class="product-row">${list.length ? list.map(productCard).join("") : `<p class="empty-state">هنوز محصولی در این دسته منتشر نشده است.</p>`}</div></section>`;
  }).join("");
  renderCategoryChips();
}
function renderCategoryChips() {
  const nav = $("categoryChips"); if (!nav) return;
  nav.innerHTML = CATEGORIES.map((c, i) => `<button type="button" class="chip" data-chip-index="${i}">${escapeHtml(c)}</button>`).join("");
  nav.hidden = !CATEGORIES.length;
}
$("categoryChips").addEventListener("click", e => {
  const chip = e.target.closest("[data-chip-index]"); if (!chip) return;
  const section = document.querySelector(`.category-section[data-category-index="${chip.dataset.chipIndex}"]`);
  if (section) section.scrollIntoView({ behavior: "smooth", block: "start" });
});
function matchesSearch(p) {
  const q = state.search.trim().toLocaleLowerCase("fa");
  return !q || [p.name, p.description, p.category, p.seller_name].some(v => String(v || "").toLocaleLowerCase("fa").includes(q));
}
const EYE_ICON = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>`;
function viewsBadge(p) {
  // Shown only when the database provides a counter (supabase-views-share.sql applied).
  if (typeof p.view_count !== "number") return "";
  return `<p class="card-views" title="تعداد بازدید">${EYE_ICON}<span>${p.view_count.toLocaleString("fa-IR")}</span></p>`;
}
function isNewProduct(p) {
  const t = Date.parse(p.created_at || ""); return Number.isFinite(t) && Date.now() - t < 7 * 24 * 60 * 60 * 1000;
}
function isFavorite(id) { try { return JSON.parse(localStorage.getItem("roostak-favorites") || "[]").includes(String(id)); } catch { return false; } }
function ratingBadge(p) { const r=state.ratings.get(String(p.id)); return r && r.count ? `<p class="rating-badge" aria-label="امتیاز ${r.avg.toLocaleString("fa-IR",{maximumFractionDigits:1})} از ۵">★ <span>${r.avg.toLocaleString("fa-IR",{maximumFractionDigits:1})}</span> <small>(${r.count.toLocaleString("fa-IR")})</small></p>` : ""; }
function productCard(p) {
  const img = p.cover_url || (Array.isArray(p.images) && p.images[0]) || PLACEHOLDER_IMAGE;
  return `<article class="product-card" data-product-id="${escapeHtml(p.id)}" tabindex="0" role="button" aria-label="نمایش ${escapeHtml(p.name)}">${isNewProduct(p) ? `<span class="badge-new">جدید</span>` : ""}<button type="button" class="favorite-toggle ${isFavorite(p.id)?"is-favorite":""}" data-favorite-id="${escapeHtml(p.id)}" aria-label="${isFavorite(p.id)?"حذف از علاقه‌مندی‌ها":"ذخیره در علاقه‌مندی‌ها"}" title="علاقه‌مندی" tabindex="-1">${isFavorite(p.id)?"♥":"♡"}</button><img class="product-image" src="${escapeHtml(img)}" alt="${escapeHtml(p.name)}" loading="lazy"><div class="product-card-info"><h3>${escapeHtml(p.name)}</h3><p>${escapeHtml(p.seller_name || "فروشنده محلی")}</p>${p.price ? `<p class="price">${escapeHtml(p.price)}</p>` : ""}${ratingBadge(p)}${viewsBadge(p)}</div></article>`;
}
function renderHome() {
  const top = state.products.filter(p => p.status === "approved" && p.is_available !== false && p.is_featured && matchesSearch(p));
  $("topProducts").innerHTML = top.length ? top.map(productCard).join("") : `<p class="empty-state">محصولات برتر پس از تأیید و انتخاب توسط مدیر اینجا نمایش داده می‌شوند.</p>`;
  const sellers = new Map();
  state.products.filter(p => p.status === "approved" && p.is_available !== false && p.seller_name && p.seller_is_top_seller === true).forEach(p => { if (!sellers.has(p.user_id)) sellers.set(p.user_id, { name:p.seller_name, avatar:p.seller_avatar, username:p.seller_username, address:p.seller_address, bio:p.seller_bio, social:p.seller_social, phone:p.seller_phone }); });
  state.sellerProfiles = sellers;
  $("topSellers").innerHTML = sellers.size ? [...sellers.entries()].slice(0,8).map(([id,s]) => `<button class="seller-tile" data-seller-id="${escapeHtml(id)}"><img class="seller-photo" src="${escapeHtml(s.avatar || PLACEHOLDER_IMAGE)}" alt=""><strong>${escapeHtml(s.name)}</strong></button>`).join("") : `<p class="empty-state">فروشنده‌های منتخب به‌زودی اینجا نمایش داده می‌شوند.</p>`;
  renderCategorySections();
}

/* ---------- Live search dropdown (products + sellers) ---------- */
function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[\u064A\u0649]/g, "\u06CC")          // ي ى -> ی
    .replace(/\u0643/g, "\u06A9")                  // ك -> ک
    .replace(/[\u0640\u200c\u200d\u200f\u200e]/g, "") // kashida, ZWNJ, ZWJ, direction marks
    .replace(/[\u064B-\u065F\u0670]/g, "")         // Arabic diacritics
    .replace(/[\u06F0-\u06F9]/g, d => String(d.charCodeAt(0) - 0x06F0))
    .replace(/[\u0660-\u0669]/g, d => String(d.charCodeAt(0) - 0x0660))
    .toLocaleLowerCase("fa")
    .replace(/\s+/g, " ")
    .trim();
}
function searchCatalog(query) {
  const q = normalizeText(query);
  if (!q) return { products: [], sellers: [] };
  const tokens = q.split(" ");
  const hit = (...fields) => { const hay = normalizeText(fields.filter(Boolean).join(" ")); return tokens.every(t => hay.includes(t)); };
  const live = state.products.filter(p => p.status === "approved" && p.is_available !== false);
  const products = live.filter(p => hit(p.name, p.seller_name, p.seller_username, p.category)).slice(0, 6);
  const seen = new Map();
  live.forEach(p => {
    const real = p.profiles?.display_name || p.profiles?.username;
    if (!real || seen.has(p.user_id)) return;
    if (hit(p.profiles?.display_name, p.profiles?.username)) seen.set(p.user_id, { id: p.user_id, name: p.profiles?.display_name || p.profiles?.username, username: p.profiles?.username, avatar: p.seller_avatar, count: 0 });
  });
  seen.forEach(s => { s.count = live.filter(p => p.user_id === s.id).length; });
  return { products, sellers: [...seen.values()].slice(0, 5) };
}
function renderSearchResults() {
  const box = $("searchResults"), input = $("searchInput");
  const query = input.value.trim();
  if (!query) { box.hidden = true; box.innerHTML = ""; input.setAttribute("aria-expanded", "false"); return; }
  const { products, sellers } = searchCatalog(query);
  let html = "";
  if (sellers.length) html += `<p class="search-group">فروشنده‌ها</p>` + sellers.map(s => `<button type="button" class="search-item" role="option" data-search-seller="${escapeHtml(s.id)}"><img src="${escapeHtml(s.avatar || PLACEHOLDER_IMAGE)}" alt="" class="search-thumb round"><span class="search-text"><strong>${escapeHtml(s.name)}</strong><small>${s.username ? "@" + escapeHtml(s.username) + " · " : ""}${s.count} محصول</small></span><span class="search-tag">فروشنده</span></button>`).join("");
  if (products.length) html += `<p class="search-group">محصولات</p>` + products.map(p => `<button type="button" class="search-item" role="option" data-search-product="${escapeHtml(p.id)}"><img src="${escapeHtml(p.cover_url || (Array.isArray(p.images) && p.images[0]) || PLACEHOLDER_IMAGE)}" alt="" class="search-thumb"><span class="search-text"><strong>${escapeHtml(p.name)}</strong><small>${escapeHtml(p.seller_name || "فروشنده محلی")} · ${escapeHtml(p.category || "")}</small></span><span class="search-tag product">محصول</span></button>`).join("");
  if (!html) html = state.products.length ? `<p class="search-empty">نتیجه‌ای برای «${escapeHtml(query)}» پیدا نشد.</p>` : `<p class="search-empty">محصولات هنوز بارگذاری نشده‌اند؛ چند لحظه بعد دوباره امتحان کن.</p>`;
  box.innerHTML = html; box.hidden = false; input.setAttribute("aria-expanded", "true");
}
function closeSearchResults(clear = false) {
  const box = $("searchResults"); box.hidden = true; $("searchInput").setAttribute("aria-expanded", "false");
  if (clear) { $("searchInput").value = ""; box.innerHTML = ""; }
}
function openSearchItem(item) {
  if (!item) return;
  const sellerId = item.dataset.searchSeller, productId = item.dataset.searchProduct;
  closeSearchResults(true); $("searchInput").blur();
  if (sellerId) showSeller(sellerId); else if (productId) showProduct(productId);
}
$("searchInput").addEventListener("input", renderSearchResults);
$("searchInput").addEventListener("focus", () => { if ($("searchInput").value.trim()) renderSearchResults(); });
$("searchInput").addEventListener("search", renderSearchResults);
$("searchInput").addEventListener("keydown", e => {
  const items = [...$("searchResults").querySelectorAll(".search-item")];
  const idx = items.indexOf(document.activeElement);
  if (e.key === "Escape") { closeSearchResults(); return; }
  if (e.key === "ArrowDown" && items.length) { e.preventDefault(); items[Math.min(idx + 1, items.length - 1)]?.focus(); }
  if (e.key === "Enter") { e.preventDefault(); openSearchItem(items[0]); }
});
$("searchResults").addEventListener("keydown", e => {
  const items = [...$("searchResults").querySelectorAll(".search-item")], idx = items.indexOf(document.activeElement);
  if (e.key === "ArrowDown") { e.preventDefault(); items[Math.min(idx + 1, items.length - 1)]?.focus(); }
  if (e.key === "ArrowUp") { e.preventDefault(); if (idx <= 0) $("searchInput").focus(); else items[idx - 1].focus(); }
  if (e.key === "Escape") { closeSearchResults(); $("searchInput").focus(); }
});
$("searchResults").addEventListener("click", e => openSearchItem(e.target.closest(".search-item")));
document.addEventListener("click", e => { if (!e.target.closest("#searchWrap")) closeSearchResults(); });

document.addEventListener("click", e => {
  const fav = e.target.closest("[data-favorite-id]");
  if (fav) { e.preventDefault(); e.stopPropagation(); toggleFavorite(fav.dataset.favoriteId); fav.classList.toggle("is-favorite", isFavorite(fav.dataset.favoriteId)); fav.textContent=isFavorite(fav.dataset.favoriteId)?"♥":"♡"; fav.setAttribute("aria-label",isFavorite(fav.dataset.favoriteId)?"حذف از علاقه‌مندی‌ها":"ذخیره در علاقه‌مندی‌ها"); return; }
  const seller = e.target.closest("[data-seller-id]");
  if (seller) { showSeller(seller.dataset.sellerId); return; }
  const card = e.target.closest(".product-card");
  if (card) showProduct(card.dataset.productId);
});
document.addEventListener("keydown", e => {
  if ((e.key === "Enter" || e.key === " ") && e.target.matches(".product-card")) { e.preventDefault(); showProduct(e.target.dataset.productId); }
  if ((e.key === "Enter" || e.key === " ") && e.target.matches("[data-seller-id]")) { e.preventDefault(); showSeller(e.target.dataset.sellerId); }
});
function toggleFavorite(id) { let ids=[]; try { ids=JSON.parse(localStorage.getItem("roostak-favorites")||"[]"); } catch {} ids=ids.map(String); const key=String(id); const exists=ids.includes(key); ids=exists?ids.filter(x=>x!==key):[...ids,key]; localStorage.setItem("roostak-favorites",JSON.stringify(ids)); toast(exists?"از علاقه‌مندی‌ها حذف شد.":"به علاقه‌مندی‌های این گوشی اضافه شد."); }
function showLegalPage() { openModal("قوانین و راهنمای روستاک", `<article class="legal-content"><h3>راهنمای خرید و فروش</h3><p>روستاک فضایی برای معرفی محصولات و خدمات محلی است. پیش از پرداخت، مشخصات، قیمت، روش تحویل و هویت فروشنده را مستقیم بررسی کنید.</p><h3>شرایط فروش</h3><ul><li>فروشنده باید اطلاعات واقعی و توضیحات دقیق ارائه کند.</li><li>قیمت، مقدار، تاریخ تولید/انقضا و شرایط نگهداری را شفاف بنویسید.</li><li>از پرداخت پیش از اطمینان از فروشنده و توافق روشن دربارهٔ تحویل خودداری کنید.</li><li>در صورت مشاهدهٔ محتوای نادرست یا مشکوک، از گزینهٔ گزارش تخلف استفاده کنید.</li></ul><h3>محصولات ممنوع</h3><p>ثبت کالاهای غیرقانونی، داروهای بدون مجوز، مواد مخدر، سلاح، کالای تقلبی، محصولات خطرناک و هر محصول ممنوع طبق قوانین محل مجاز نیست.</p><h3>عرقیجات، سرکه و خوراکی‌ها</h3><ul><li>ترکیبات، مواد اولیه، حجم/وزن، تاریخ تولید و شرایط نگهداری را درست درج کنید.</li><li>از ادعای درمان بیماری یا جایگزین‌کردن محصول با دارو خودداری کنید.</li><li>عرقیجات و خوراکی‌ها باید بهداشتی و مطابق مقررات مربوط تولید و عرضه شوند؛ محصول دست‌ساز به‌معنای معافیت از الزامات ایمنی نیست.</li><li>در صورت نداشتن مجوز یا اطمینان از ایمنی، محصول را منتشر نکنید.</li></ul><p class="form-note">این راهنما جایگزین مشاورهٔ حقوقی یا مقررات رسمی نیست.</p></article>`); }
function digitsOnlyPhone(phone) { return String(phone||"").replace(/[^0-9+]/g, "").replace(/^00/, "+"); }
function contactActions(phone, social) { const tel=digitsOnlyPhone(phone); let html=""; if(tel) html+=`<a class="contact-action call-action" href="tel:${escapeHtml(tel)}">☎ تماس مستقیم</a>`; const url=safeUrl(social); if(url && /t\.me|telegram\.me/i.test(url)) html+=`<a class="contact-action social-action telegram-action" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">تلگرام</a>`; if(url && /rubika\.ir|rubika\.app/i.test(url)) html+=`<a class="contact-action social-action rubika-action" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">روبیکا</a>`; return html?`<div class="contact-actions">${html}</div>`:""; }
async function loadRatings() { if(!state.client)return; try { const {data,error}=await state.client.from("product_ratings").select("product_id,rating,user_id"); if(error)throw error; const grouped=new Map(); state.ratings.clear(); state.myRatings.clear(); (data||[]).forEach(row=>{const key=String(row.product_id),v=grouped.get(key)||{sum:0,count:0};v.sum+=Number(row.rating);v.count++;grouped.set(key,v);if(state.user&&row.user_id===state.user.id)state.myRatings.set(key,Number(row.rating));}); grouped.forEach((v,k)=>state.ratings.set(k,{avg:v.sum/v.count,count:v.count})); renderHome(); } catch(e) { console.warn("Ratings unavailable; run supabase-roostak-enhancements.sql",e.message); } }
async function rateProduct(productId, rating) { if(!state.user){closeModal();return showAuth("login");} const {error}=await state.client.from("product_ratings").upsert({product_id:productId,user_id:state.user.id,rating},{onConflict:"product_id,user_id"}); if(error){toast("ثبت امتیاز انجام نشد؛ migration قابلیت‌ها را در Supabase اجرا کن.");return;} state.myRatings.set(String(productId),rating); await loadRatings(); showProduct(productId); toast("امتیازت ثبت شد؛ ممنون!"); }
async function reportProduct(p) { const reason=prompt("دلیل گزارش را انتخاب یا بنویس (مثلاً اطلاعات نادرست، کالای ممنوع یا محتوای نامناسب):"); if(!reason||!reason.trim())return; const {error}=await state.client.from("product_reports").insert({product_id:p.id,reporter_id:state.user?.id||null,reason:reason.trim().slice(0,500)}); if(error){toast("گزارش ثبت نشد؛ migration قابلیت‌ها را در Supabase اجرا کن.");return;} toast("گزارشت برای بررسی ثبت شد. ممنون."); }
function showSeller(id) {
  const products = state.products.filter(p => String(p.user_id) === String(id) && p.status === "approved" && p.is_available !== false);
  const seller = products[0] || null;
  const info = state.sellerProfiles.get(id) || (seller ? {name:seller.seller_name,avatar:seller.seller_avatar,username:seller.seller_username,address:seller.seller_address,bio:seller.seller_bio,social:seller.seller_social,phone:seller.seller_phone} : {});
  const safePhone = info.phone ? `<div class="detail-line"><strong>تلفن عمومی:</strong><a href="tel:${escapeHtml(info.phone)}">${escapeHtml(info.phone)}</a></div>` : "";
  const safeAddress = info.address ? `<div class="detail-line"><strong>محل فعالیت:</strong><span>${escapeHtml(info.address)}</span></div>` : "";
  const safeSocial = info.social ? `<div class="detail-line"><strong>شبکه اجتماعی:</strong><span>${escapeHtml(info.social)}</span></div>` : "";
  openModal(info.name || "فروشندهٔ روستاک", `<div class="seller-profile-card"><img class="seller-profile-avatar" src="${escapeHtml(info.avatar || PLACEHOLDER_IMAGE)}" alt="عکس پروفایل فروشنده"><h3>${escapeHtml(info.name || "فروشندهٔ محلی")}</h3>${info.username ? `<p class="form-note">@${escapeHtml(info.username)}</p>` : ""}${info.bio ? `<p class="seller-bio">${escapeHtml(info.bio)}</p>` : ""}<div class="detail-list">${safeAddress}${safePhone}${safeSocial}</div></div><h3 class="seller-products-title">محصولات این فروشنده</h3><div class="seller-products-grid">${products.length ? products.map(p=>`<button class="seller-product-mini" data-seller-product="${escapeHtml(p.id)}"><img src="${escapeHtml(p.cover_url || (Array.isArray(p.images)&&p.images[0]) || PLACEHOLDER_IMAGE)}" alt=""><span>${escapeHtml(p.name)}</span><b>${escapeHtml(p.price || "قیمت توافقی")}</b></button>`).join("") : `<p class="empty-state">این فروشنده فعلاً محصول تأییدشده‌ای ندارد.</p>`}</div>`);
}
modalBody.addEventListener("click", e => { const product=e.target.closest("[data-seller-product]"); if(product){ const id=product.dataset.sellerProduct; closeModal(); showProduct(id); } });

async function showProduct(id) {
  const p = state.products.find(x => String(x.id) === String(id));
  if (!p) return;
  const images = Array.isArray(p.images) ? p.images : [];
  const image = p.cover_url || images[0] || PLACEHOLDER_IMAGE;
  const phone = p.show_phone ? (p.product_phone || p.seller_phone) : "";
  const social = p.show_social ? (p.product_social || p.seller_social) : "";
  const address = p.product_address || p.seller_address || "";
  const socialUrl = safeUrl(social);
  const currentRating=state.myRatings.get(String(p.id))||0; const agg=state.ratings.get(String(p.id));
  openModal(p.name, `
    <img class="product-detail-image" src="${escapeHtml(image)}" alt="${escapeHtml(p.name)}">
    ${agg?`<p class="detail-rating">★ ${agg.avg.toLocaleString("fa-IR",{maximumFractionDigits:1})} از ۵ <small>(${agg.count.toLocaleString("fa-IR")} امتیاز)</small></p>`:""}
    <div class="rate-product"><strong>به این محصول امتیاز بده</strong><div class="star-picker" role="group" aria-label="امتیاز از یک تا پنج">${[1,2,3,4,5].map(n=>`<button type="button" data-rate="${n}" class="star-button ${n<=currentRating?"selected":""}" aria-label="${n} ستاره">★</button>`).join("")}</div></div>
    <div class="seller-detail seller-detail-clickable" data-seller-id="${escapeHtml(p.user_id)}" role="button" tabindex="0" aria-label="نمایش پروفایل فروشنده"><img src="${escapeHtml(p.seller_avatar || PLACEHOLDER_IMAGE)}" alt=""><div><strong>${escapeHtml(p.seller_name || "فروشنده محلی")}</strong><div class="form-note">برای مشاهدهٔ پروفایل و محصولات فروشنده بزن</div></div></div>
    ${p.price ? `<p class="price">${escapeHtml(p.price)}</p>` : ""}
    <p class="detail-description">${escapeHtml(p.description || "توضیحی برای این محصول ثبت نشده است.")}</p>
    ${contactActions(phone, social)}
    <div class="detail-list">
      ${phone ? `<div class="detail-line"><strong>تلفن:</strong><a href="tel:${escapeHtml(digitsOnlyPhone(phone))}">${escapeHtml(phone)}</a></div>` : ""}
      ${address ? `<div class="detail-line"><strong>محل فروش:</strong><span>${escapeHtml(address)}</span></div>` : ""}
      ${social ? `<div class="detail-line"><strong>شبکه اجتماعی:</strong>${socialUrl ? `<a href="${escapeHtml(socialUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(social)}</a>` : `<span>${escapeHtml(social)}</span>`}</div>` : ""}
      ${!phone && !address && !social ? `<p class="form-note">فروشنده اطلاعات تماس عمومی ثبت نکرده است.</p>` : ""}
    </div>
    <div class="product-extra-actions"><button type="button" class="btn btn-outline" id="favoriteDetailBtn">${isFavorite(p.id)?"♥ ذخیره‌شده":"♡ ذخیره در علاقه‌مندی‌ها"}</button><button type="button" class="btn btn-outline" id="reportProductBtn">⚑ گزارش تخلف</button></div>
  `);
  modalBody.querySelectorAll("[data-rate]").forEach(btn=>btn.addEventListener("click",()=>rateProduct(p.id,Number(btn.dataset.rate))));
  $("favoriteDetailBtn")?.addEventListener("click",()=>{toggleFavorite(p.id);showProduct(p.id);});
  $("reportProductBtn")?.addEventListener("click",()=>reportProduct(p));
  const shareBtn = $("modalShare"); if (shareBtn) { shareBtn.dataset.productId = p.id; shareBtn.hidden = false; }
  trackView(p);
}

/* ---------- View counter, sharing and shared-link opening ---------- */
async function loadViewCounts() {
  try {
    const { data, error } = await state.client.from("products").select("id,view_count").eq("status", "approved");
    if (error || !Array.isArray(data)) return; // column not created yet: simply hide the counters
    const counts = new Map(data.map(r => [String(r.id), r.view_count]));
    let any = false;
    state.products.forEach(p => { const v = counts.get(String(p.id)); if (typeof v === "number") { p.view_count = v; any = true; } });
    if (any) renderHome();
  } catch (e) { console.warn(e); }
}
function updateCardViews(p) {
  document.querySelectorAll(`.product-card[data-product-id="${CSS.escape(String(p.id))}"] .card-views span`).forEach(el => { el.textContent = p.view_count.toLocaleString("fa-IR"); });
}
async function trackView(p) {
  if (!state.client || typeof p.view_count !== "number") return;
  if (state.user && state.user.id === p.user_id) return; // owner's own views are not counted
  const KEY = "roostak-viewed", WINDOW = 6 * 60 * 60 * 1000; // one count per product per 6 hours per browser
  let seen = {}; try { seen = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch {}
  const now = Date.now();
  if (seen[p.id] && now - seen[p.id] < WINDOW) return;
  try {
    const { data, error } = await state.client.rpc("increment_product_view", { p_id: p.id });
    if (error) return;
    p.view_count = typeof data === "number" ? data : p.view_count + 1;
    updateCardViews(p);
    Object.keys(seen).forEach(k => { if (now - seen[k] > WINDOW) delete seen[k]; });
    seen[p.id] = now; localStorage.setItem(KEY, JSON.stringify(seen));
  } catch (e) { console.warn(e); }
}
function productShareURL(id) {
  const url = new URL(location.href); url.search = ""; url.hash = ""; url.searchParams.set("product", id); return url.href;
}
async function copyText(text) {
  try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; } } catch {}
  try {
    const ta = document.createElement("textarea"); ta.value = text; ta.setAttribute("readonly", ""); ta.style.cssText = "position:fixed;opacity:0;top:0;left:0";
    document.body.appendChild(ta); ta.select(); const ok = document.execCommand("copy"); ta.remove(); return ok;
  } catch { return false; }
}
async function shareProduct(id) {
  const p = state.products.find(x => String(x.id) === String(id)); if (!p) return;
  const url = productShareURL(p.id);
  const data = { title: `${p.name} | روستاک`, text: `${p.name}${p.price ? " — " + p.price : ""}\nاز ${p.seller_name || "فروشنده محلی"} در روستاک`, url };
  if (navigator.share) {
    try { await navigator.share(data); return; } catch (e) { if (e && e.name === "AbortError") return; }
  }
  toast((await copyText(url)) ? "لینک محصول کپی شد." : "کپی نشد؛ لینک: " + url);
}
$("modalShare").addEventListener("click", e => { const id = e.currentTarget.dataset.productId; if (id) shareProduct(id); });
function openSharedProductFromURL() {
  let id = null; try { id = new URL(location.href).searchParams.get("product"); } catch { return; }
  if (!id) return;
  history.replaceState(null, "", location.pathname + location.hash);
  if (state.products.some(p => String(p.id) === String(id))) showProduct(id);
  else toast("این محصول دیگر در دسترس نیست.");
}

function showAuth(mode = "login") {
  state.authMode = mode; showMain("auth");
  const signup = mode === "signup";
  $("authMain").innerHTML = `<section class="panel"><p class="eyebrow">به بازار محلی خوش آمدی</p><h1>${signup ? "ساخت حساب روستاک" : "ورود به روستاک"}</h1><p class="panel-subtitle">${signup ? "حساب بساز و محصولات محلی‌ات را معرفی کن." : "برای مدیریت حساب و محصولاتت وارد شو."}</p>
    <form id="authForm" class="form-stack" novalidate>
      <div class="field"><label for="username">نام کاربری</label><input id="username" name="username" autocomplete="username" minlength="3" maxlength="24" required placeholder="مثلاً roostak_user"><span class="form-note">۳ تا ۲۴ نویسه؛ حروف انگلیسی، عدد و زیرخط</span></div>
      <div class="field"><label for="password">رمز عبور</label><input id="password" name="password" type="password" autocomplete="${signup ? "new-password" : "current-password"}" minlength="8" required placeholder="حداقل ۸ نویسه"></div>
      ${signup ? `<div class="field"><label for="confirmPassword">تکرار رمز عبور</label><input id="confirmPassword" name="confirmPassword" type="password" autocomplete="new-password" minlength="8" required placeholder="رمز عبور را دوباره وارد کن"></div>` : ""}
      <p class="error-text" id="authError" aria-live="polite"></p>
      <div class="form-actions"><button class="btn btn-primary" id="authSubmit" type="submit" disabled>${signup ? "ساخت حساب" : "ورود"}</button>
      ${signup ? `<button class="text-button" type="button" id="switchAuth">حساب داری؟ ورود</button>` : `<button class="text-button" type="button" id="switchAuth">حساب نداری؟ ساخت حساب</button><button class="text-button" type="button" id="supportButton">ارتباط با پشتیبان</button>`}
      </div>
    </form></section>`;
  const form = $("authForm"), submit = $("authSubmit");
  const validate = () => {
    const username = $("username").value.trim();
    const password = $("password").value;
    const validUser = /^[a-zA-Z0-9_]{3,24}$/.test(username);
    const validPass = password.length >= 8;
    const validConfirm = !signup || $("confirmPassword").value === password;
    submit.disabled = !(validUser && validPass && validConfirm);
  };
  form.addEventListener("input", validate);
  $("switchAuth").addEventListener("click", () => showAuth(signup ? "login" : "signup"));
  if (!signup) $("supportButton").addEventListener("click", showSupportForm);
  form.addEventListener("submit", async e => {
    e.preventDefault(); validate(); if (submit.disabled) return;
    if (!state.client) { $("authError").textContent = "ابتدا اطلاعات پروژهٔ Supabase را در app.js تنظیم کن."; return; }
    submit.disabled = true; submit.textContent = signup ? "در حال ساخت..." : "در حال ورود...";
    const username = $("username").value.trim().toLowerCase();
    const password = $("password").value;
    try {
      if (signup) {
        const syntheticEmail = `${username}@${INTERNAL_EMAIL_DOMAIN}`;
        const { data, error } = await state.client.auth.signUp({ email: syntheticEmail, password, options: { data: { username } } });
        if (error) throw error;
        if (!data.session) throw new Error("تأیید ایمیل در Supabase هنوز فعال است. چون روستاک ایمیل واقعی نمی‌گیرد، در Authentication ← Providers ← Email گزینهٔ Confirm email را خاموش کن و دوباره ثبت‌نام کن.");
        state.user = data.user; await ensureProfile(username); await loadProfile(); await showProfileSettings(true);
      } else {
        const syntheticEmail = `${username}@${INTERNAL_EMAIL_DOMAIN}`;
        const { data, error } = await state.client.auth.signInWithPassword({ email: syntheticEmail, password });
        if (error) throw error;
        state.user = data.user; await loadProfile();
        if (!state.profile?.display_name) await showProfileSettings(true); else await showAccount();
      }
    } catch (err) { $("authError").textContent = readableAuthError(err); submit.disabled = false; submit.textContent = signup ? "ساخت حساب" : "ورود"; }
  });
}
function readableAuthError(err) {
  const msg = String(err?.message || "");
  if (/already registered|already exists|duplicate/i.test(msg)) return "این نام کاربری قبلاً ثبت شده است.";
  if (/invalid login credentials/i.test(msg)) return "نام کاربری یا رمز عبور درست نیست.";
  if (/password should be at least/i.test(msg)) return "رمز عبور باید حداقل ۸ نویسه باشد.";
  return msg || "خطایی رخ داد؛ دوباره تلاش کن.";
}
async function ensureProfile(username) {
  const { error } = await state.client.from("profiles").upsert({ id: state.user.id, username, display_name: "", phone_public: false, social_public: false }, { onConflict: "id" });
  if (error) throw error;
}
async function loadProfile() {
  if (!state.user || !state.client) return;
  const { data, error } = await state.client.from("profiles").select("*").eq("id", state.user.id).maybeSingle();
  if (error) throw error; state.profile = data;
}
async function showProfileSettings(required = false) {
  if (!state.user) return showAuth("login");
  const p = state.profile || {};
  openModal("تنظیمات پروفایل", `
    ${required ? `<p class="form-note">برای ادامه، نام نمایشی خودت را وارد کن. این فیلد الزامی است.</p>` : ""}
    <form id="profileForm" class="form-stack">
      <div class="field"><label for="displayName">نام <span aria-hidden="true">*</span></label><input id="displayName" required maxlength="60" value="${escapeHtml(p.display_name || "")}" placeholder="نامی که دیگران می‌بینند"></div>
      <div class="field avatar-upload-field"><label>عکس پروفایل</label><div class="avatar-upload-row"><img id="avatarPreview" class="avatar-preview" src="${escapeHtml(p.avatar_url || PLACEHOLDER_IMAGE)}" alt="پیش‌نمایش عکس پروفایل"><div class="avatar-upload-controls"><label class="avatar-pick-button" for="avatarFile">✦ انتخاب عکس از دستگاه</label><input id="avatarFile" type="file" accept="image/*" hidden><small class="form-note">عکس از گوشی یا کامپیوتر انتخاب کن؛ حداکثر ۵ مگابایت.</small></div></div><input id="avatarUrl" type="url" value="${escapeHtml(p.avatar_url || "")}" placeholder="یا لینک عکس را وارد کن (اختیاری)" aria-label="لینک جایگزین عکس پروفایل"></div>
      <div class="field"><label for="profileBio">معرفی کوتاه فروشنده (اختیاری)</label><textarea id="profileBio" maxlength="500" placeholder="کمی دربارهٔ خودت یا محصولاتت بنویس">${escapeHtml(p.bio || "")}</textarea></div>
      <div class="field"><label for="profilePhone">شماره تلفن (اختیاری)</label><input id="profilePhone" type="tel" value="${escapeHtml(p.phone || "")}" placeholder="شماره تماس"></div>
      <label class="checkbox-line"><input id="phonePublic" type="checkbox" ${p.phone_public ? "checked" : ""}> نمایش عمومی شماره تلفن</label>
      <div class="field"><label for="profileAddress">آدرس محل فروش (اختیاری)</label><input id="profileAddress" maxlength="200" value="${escapeHtml(p.address || "")}" placeholder="روستا، محله یا نشانی"></div>
      <div class="field"><label for="profileSocial">شبکه اجتماعی (اختیاری)</label><input id="profileSocial" maxlength="200" value="${escapeHtml(p.social || "")}" placeholder="لینک یا شناسه"></div>
      <label class="checkbox-line"><input id="socialPublic" type="checkbox" ${p.social_public ? "checked" : ""}> نمایش عمومی شبکه اجتماعی</label>
      <p class="error-text" id="profileError"></p>
      <button class="btn btn-primary" type="submit">ذخیره تنظیمات</button>
    </form>`);
  let selectedAvatar = null;
  $("avatarFile").addEventListener("change", async e => { const file=e.target.files?.[0]; if(!file)return; if(!file.type.startsWith("image/")){ $("profileError").textContent="فقط فایل تصویری انتخاب کن.";return;} if(file.size>5*1024*1024){ $("profileError").textContent="حجم عکس باید کمتر از ۵ مگابایت باشد.";e.target.value="";return;} try { selectedAvatar=await compressImage(file,450*1024); $("avatarPreview").src=URL.createObjectURL(selectedAvatar); $("avatarUrl").value=""; $("profileError").textContent=""; } catch(err){$("profileError").textContent=err.message||"خواندن عکس ناموفق بود.";} });
  $("profileForm").addEventListener("submit", async e => {
    e.preventDefault();
    const display_name = $("displayName").value.trim();
    if (!display_name) { $("profileError").textContent = "وارد کردن نام الزامی است."; return; }
    let avatar_url = safeUrl($("avatarUrl").value.trim()) || p.avatar_url || null;
    const payload = { display_name, avatar_url, bio: $("profileBio").value.trim() || null, phone: $("profilePhone").value.trim() || null, phone_public: $("phonePublic").checked, address: $("profileAddress").value.trim() || null, social: $("profileSocial").value.trim() || null, social_public: $("socialPublic").checked };
    const button = e.submitter; button.disabled = true;
    try {
      if(selectedAvatar){ const path=`${state.user.id}/${crypto.randomUUID()}.jpg`; const {error:uploadError}=await state.client.storage.from("profile-images").upload(path,selectedAvatar,{contentType:"image/jpeg",upsert:false}); if(uploadError)throw new Error(uploadError.message.includes("Bucket not found")?"فضای ذخیره عکس پروفایل ساخته نشده؛ فایل SQL قابلیت‌های جدید را در Supabase اجرا کن.":uploadError.message); const {data}=state.client.storage.from("profile-images").getPublicUrl(path); payload.avatar_url=data.publicUrl; }
      const { error } = await state.client.from("profiles").update(payload).eq("id", state.user.id);
      if (error) throw error;
      await loadProfile(); closeModal(); await showAccount(); toast("تنظیمات پروفایل ذخیره شد.");
    } catch(err) { $("profileError").textContent = err.message || "ذخیره‌سازی انجام نشد."; button.disabled = false; }
  });
}
async function showAccount() {
  if (!state.user) return showAuth("login");
  showMain("account");
  await loadProfile(); await loadMyProducts();
  const p = state.profile || {};
  $("accountEntry").innerHTML = p.avatar_url ? `<img class="avatar" src="${escapeHtml(p.avatar_url)}" alt="عکس پروفایل">` : `<span>${escapeHtml(p.display_name || "حساب من")}</span>`;
  $("accountMain").innerHTML = `<section class="panel"><div class="profile-header"><img class="profile-large" src="${escapeHtml(p.avatar_url || PLACEHOLDER_IMAGE)}" alt="عکس پروفایل"><h1>${escapeHtml(p.display_name || "نامت را تنظیم کن")}</h1><p class="username">@${escapeHtml(p.username || "")}</p><button class="text-button" id="editProfileBtn">تنظیمات پروفایل</button></div>
    <div class="account-tools"><button class="btn btn-primary" id="addProductBtn">＋ افزودن محصول</button><button class="btn btn-outline" id="supportAccountBtn">ارتباط با پشتیبان</button><button class="btn btn-outline" id="signOutBtn">خروج از حساب</button></div>
    <div class="section-heading"><h2>محصولات من</h2></div><div class="product-management-list" id="myProducts"></div></section>`;
  $("editProfileBtn").addEventListener("click", () => showProfileSettings(false));
  $("addProductBtn").addEventListener("click", () => showProductForm());
  $("supportAccountBtn").addEventListener("click", showSupportForm);
  $("signOutBtn").addEventListener("click", async () => { await state.client.auth.signOut(); state.user=null; state.profile=null; $("accountEntry").textContent="ورود"; goHome(); toast("از حساب خارج شدی."); });
  renderMyProducts();
}
async function loadMyProducts() {
  if (!state.client || !state.user) return;
  const { data, error } = await state.client.from("products").select("*").eq("user_id", state.user.id).order("created_at", { ascending:false });
  if (error) throw error; state.myProducts = data || [];
}
function renderMyProducts() {
  const root = $("myProducts"); if (!root) return;
  const list = state.myProducts || [];
  root.innerHTML = list.length ? list.map(p => `<article class="managed-product"><img src="${escapeHtml(p.cover_url || PLACEHOLDER_IMAGE)}" alt=""><div class="grow"><h3>${escapeHtml(p.name)}</h3><p>${escapeHtml(p.status === "approved" ? (p.is_available === false ? "ناموجود" : "منتشرشده") : p.status === "rejected" ? "ردشده" : "در انتظار بررسی")}</p>${p.status === "rejected" && p.rejection_reason ? `<p class="rejection-reason"><strong>دلیل رد:</strong> ${escapeHtml(p.rejection_reason)}</p>` : ""}</div><div class="managed-actions"><button class="btn btn-outline" data-edit-product="${escapeHtml(p.id)}">ویرایش</button><button class="btn btn-outline" data-toggle-availability="${escapeHtml(p.id)}">${p.is_available === false ? "موجود شد" : "ناموجود"}</button><button class="btn btn-danger" data-delete-product="${escapeHtml(p.id)}">حذف</button></div></article>`).join("") : `<p class="empty-state">هنوز محصولی ثبت نکرده‌ای.</p>`;
  root.querySelectorAll("[data-edit-product]").forEach(btn => btn.addEventListener("click", () => {
    const product = list.find(item => String(item.id) === btn.dataset.editProduct);
    if (product) showProductForm(product);
  }));
  root.querySelectorAll("[data-toggle-availability]").forEach(btn => btn.addEventListener("click", async () => {
    btn.disabled = true;
    const product = list.find(item => String(item.id) === btn.dataset.toggleAvailability);
    const nextAvailable = product?.is_available === false;
    const { error } = await state.client.rpc("set_product_availability", { product_id: btn.dataset.toggleAvailability, make_available: nextAvailable });
    if (error) { btn.disabled = false; return toast("برای فعال‌شدن این امکان، SQL به‌روزرسانی‌شده را در Supabase اجرا کن."); }
    await loadMyProducts(); renderMyProducts(); await loadPublicProducts(); toast(nextAvailable ? "محصول دوباره موجود شد." : "محصول ناموجود شد.");
  }));
  root.querySelectorAll("[data-delete-product]").forEach(btn => btn.addEventListener("click", async () => {
    if (!confirm("این محصول حذف شود؟")) return;
    const { error } = await state.client.from("products").delete().eq("id", btn.dataset.deleteProduct);
    if (error) return toast(error.message);
    await loadMyProducts(); renderMyProducts(); await loadPublicProducts(); toast("محصول حذف شد.");
  }));
}
async function showProductForm(existing = null) {
  if (!state.user) return showAuth("login");
  await loadPublicCategories();
  const p = state.profile || {}; state.images = [];
  const edit = Boolean(existing);
  const oldImages = Array.isArray(existing?.images) ? existing.images : [];
  openModal(edit ? "ویرایش محصول" : "افزودن محصول", `
    <form id="productForm" class="form-stack">
      <div class="field"><label for="productName">نام محصول / خدمت *</label><input id="productName" required maxlength="100" value="${escapeHtml(existing?.name || "")}"></div>
      <div class="field"><label for="productCategory">دسته‌بندی *</label><select id="productCategory" required><option value="">انتخاب دسته</option>${CATEGORIES.map(c=>`<option ${existing?.category === c ? "selected" : ""}>${escapeHtml(c)}</option>`).join("")}</select></div>
      <div class="field"><label for="productDescription">توضیحات</label><textarea id="productDescription" maxlength="3000" placeholder="درباره محصول یا خدمت بنویس...">${escapeHtml(existing?.description || "")}</textarea></div>
      <div class="field"><label for="productPrice">قیمت (اختیاری)</label><input id="productPrice" maxlength="80" value="${escapeHtml(existing?.price || "")}" placeholder="مثلاً ۱۵۰ هزار تومان یا توافقی"></div>
      <div class="field"><label for="productImages">عکس‌ها (حداکثر ۳ عکس، هرکدام زیر ۵۰۰ کیلوبایت)</label><input id="productImages" type="file" accept="image/*" multiple><div id="imagePreviews" class="image-preview-row"></div><p class="form-note">عکس‌ها پیش از آپلود در مرورگر فشرده می‌شوند.${edit ? " اگر عکس جدید انتخاب نکنی، عکس‌های فعلی حفظ می‌شوند." : ""}</p></div>
      <div class="field"><label for="productPhone">شماره تلفن این محصول</label><input id="productPhone" type="tel" value="${escapeHtml(existing?.product_phone ?? p.phone ?? "")}"></div>
      <label class="checkbox-line"><input id="productPhonePublic" type="checkbox" ${(existing ? existing.show_phone : p.phone_public) ? "checked" : ""}> نمایش عمومی شماره تلفن</label>
      <div class="field"><label for="productAddress">آدرس محل فروش</label><input id="productAddress" maxlength="200" value="${escapeHtml(existing?.product_address ?? p.address ?? "")}"></div>
      <div class="field"><label for="productSocial">شبکه اجتماعی</label><input id="productSocial" maxlength="200" value="${escapeHtml(existing?.product_social ?? p.social ?? "")}"></div>
      <label class="checkbox-line"><input id="productSocialPublic" type="checkbox" ${(existing ? existing.show_social : p.social_public) ? "checked" : ""}> نمایش عمومی شبکه اجتماعی</label>
      <p class="form-note">محصول پس از ثبت، برای بررسی مدیر ارسال می‌شود و تا تأیید منتشر نخواهد شد.</p>
      <p class="error-text" id="productError"></p><button class="btn btn-primary" type="submit">${edit ? "ذخیره تغییرات و ارسال برای بررسی" : "ثبت برای بررسی"}</button>
    </form>`);
  $("productImages").addEventListener("change", async e => {
    const selected = [...e.target.files];
    if (selected.length > 3) { $("productError").textContent = "حداکثر ۳ عکس می‌توانی انتخاب کنی."; e.target.value=""; return; }
    $("productError").textContent = "";
    try {
      state.images = [];
      for (const file of selected) state.images.push(await compressImage(file, 500 * 1024));
      $("imagePreviews").innerHTML = state.images.map((blob,i)=>`<div class="image-preview"><img src="${URL.createObjectURL(blob)}" alt="پیش‌نمایش ${i+1}"><button type="button" data-remove-image="${i}" aria-label="حذف عکس">×</button><small>${(blob.size/1024).toFixed(0)} KB</small></div>`).join("");
      $("imagePreviews").querySelectorAll("[data-remove-image]").forEach(btn=>btn.addEventListener("click",()=>{state.images.splice(Number(btn.dataset.removeImage),1); $("productImages").value=""; $("imagePreviews").innerHTML=state.images.map((blob,i)=>`<div class="image-preview"><img src="${URL.createObjectURL(blob)}" alt="پیش‌نمایش ${i+1}"><button type="button" data-remove-image="${i}">×</button></div>`).join("");}));
    } catch(err) { $("productError").textContent = err.message; state.images=[]; }
  });
  $("productForm").addEventListener("submit", async e => {
    e.preventDefault(); const button=e.submitter; button.disabled=true;
    try {
      const uploaded = edit && !state.images.length ? [...oldImages] : [];
      for (const blob of state.images) {
        const path = `${state.user.id}/${crypto.randomUUID()}.jpg`;
        const { error } = await state.client.storage.from("product-images").upload(path, blob, { contentType:"image/jpeg", upsert:false });
        if (error) throw error;
        const { data } = state.client.storage.from("product-images").getPublicUrl(path);
        uploaded.push(data.publicUrl);
      }
      const payload = { user_id:state.user.id, name:$("productName").value.trim(), category:$("productCategory").value, description:$("productDescription").value.trim(), price:$("productPrice").value.trim() || null, images:uploaded, cover_url:uploaded[0] || null, product_phone:$("productPhone").value.trim() || null, show_phone:$("productPhonePublic").checked, product_address:$("productAddress").value.trim() || null, product_social:$("productSocial").value.trim() || null, show_social:$("productSocialPublic").checked, status:"pending" };
      let result;
      if (edit) {
        payload.status = "pending"; // edited listings go through review again
        result = await state.client.from("products").update(payload).eq("id", existing.id).eq("user_id", state.user.id);
      } else {
        result = await state.client.from("products").insert(payload);
      }
      if (result.error) throw result.error;
      closeModal(); await loadMyProducts(); renderMyProducts(); await loadPublicProducts(); toast(edit ? "تغییرات ذخیره شد و برای بررسی فرستاده شد." : "محصول برای بررسی ثبت شد.");
    } catch(err) { $("productError").textContent = err.message || "ثبت محصول انجام نشد."; button.disabled=false; }
  });
}
async function compressImage(file, maxBytes) {
  if (!file.type.startsWith("image/")) throw new Error("فقط فایل تصویری انتخاب کن.");
  const image = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  let scale = Math.min(1, 1800 / Math.max(image.width,image.height));
  let quality = 0.86, blob = null;
  for (let attempt=0; attempt<18; attempt++) {
    canvas.width = Math.max(1, Math.round(image.width*scale)); canvas.height = Math.max(1, Math.round(image.height*scale));
    const ctx=canvas.getContext("2d"); ctx.drawImage(image,0,0,canvas.width,canvas.height);
    blob = await new Promise(resolve=>canvas.toBlob(resolve,"image/jpeg",quality));
    if (blob && blob.size < maxBytes) return blob;
    if (quality > 0.48) quality -= 0.1; else scale *= 0.82;
  }
  if (!blob || blob.size >= maxBytes) throw new Error("حجم این عکس به کمتر از ۵۰۰ کیلوبایت نرسید؛ لطفاً عکس دیگری انتخاب کن.");
  return blob;
}
function showSupportForm() {
  const username = state.profile?.username || state.user?.user_metadata?.username || "";
  openModal("ارتباط با پشتیبان", `<p class="form-note">اگر رمزت را فراموش کرده‌ای یا برای ورود مشکل داری، درخواستت را بفرست. رمز عبورت را در پیام ننویس.</p>
    <form id="supportForm" class="form-stack"><div class="field"><label>نام کاربری</label><input id="supportUsername" value="${escapeHtml(username)}" required maxlength="24"></div><div class="field"><label for="supportMessage">توضیحات درخواست</label><textarea id="supportMessage" required maxlength="1200" placeholder="مثلاً رمز عبورم را فراموش کرده‌ام..."></textarea></div><p class="error-text" id="supportError"></p><button class="btn btn-primary" type="submit">ارسال درخواست</button></form>`);
  $("supportForm").addEventListener("submit", async e=>{
    e.preventDefault();
    if (!state.client) { $("supportError").textContent="ابتدا Supabase را تنظیم کن."; return; }
    const btn=e.submitter; btn.disabled=true;
    try {
      const { error } = await state.client.from("support_requests").insert({ user_id:state.user?.id || null, username:$("supportUsername").value.trim(), message:$("supportMessage").value.trim(), request_type:"account_recovery", status:"open" });
      if (error) throw error;
      closeModal(); toast("درخواست پشتیبانی ارسال شد.");
    } catch(err) { $("supportError").textContent=err.message || "ارسال درخواست ناموفق بود."; btn.disabled=false; }
  });
}
async function loadPublicCategories() {
  if (!state.client) return;
  const {data,error}=await state.client.from("roostak_categories").select("name").eq("is_active",true).order("sort_order",{ascending:true}).order("name",{ascending:true});
  if (!error && data?.length) CATEGORIES=data.map(x=>x.name);
}
async function refreshCategories() {
  const before = CATEGORIES.join("|");
  await loadPublicCategories();
  if (CATEGORIES.join("|") !== before) renderCategorySections();
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") refreshCategories(); });
window.addEventListener("focus", () => refreshCategories());
window.addEventListener("online", () => refreshCategories());
async function loadPublicProducts() {
  if (!state.client) return;
  const { data, error } = await state.client.from("products").select("id,user_id,name,category,description,price,images,cover_url,product_phone,show_phone,product_address,product_social,show_social,status,is_featured,is_available,created_at,profiles!products_user_id_fkey(username,display_name,avatar_url,phone,phone_public,address,social,social_public,is_top_seller)").eq("status","approved").order("created_at",{ascending:false});
  if (error) { console.warn(error); renderHome(); return; }
  state.products = (data || []).map(p => ({...p, seller_name:p.profiles?.display_name || "فروشنده محلی", seller_is_top_seller:p.profiles?.is_top_seller === true, seller_username:p.profiles?.username, seller_avatar:p.profiles?.avatar_url, seller_phone:p.profiles?.phone_public ? p.profiles?.phone : null, seller_address:p.profiles?.address, seller_social:p.profiles?.social_public ? p.profiles?.social : null, seller_bio:p.profiles?.bio || p.profiles?.description || null}));
  renderHome();
  await loadViewCounts();
  await loadRatings();
  if ($("searchInput").value.trim()) renderSearchResults();
}
async function init() {
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("./sw.js").catch(()=>{});
  if ("BeforeInstallPromptEvent" in window) { /* some browsers expose event without constructor */ }
  window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); state.installPrompt=e; if (!window.matchMedia("(display-mode: standalone)").matches) $("installBtn").hidden=false; });
  window.addEventListener("appinstalled", () => { $("installBtn").hidden=true; state.installPrompt=null; toast("روستاک نصب شد."); });
  $("installBtn").addEventListener("click", async () => {
    if (!state.installPrompt) { openModal("نصب روستاک", `<p>اگر گزینهٔ نصب نمایش داده نمی‌شود، از منوی مرورگر گزینهٔ «افزودن به صفحهٔ اصلی» یا «Install app» را انتخاب کن.</p>`); return; }
    state.installPrompt.prompt(); await state.installPrompt.userChoice; state.installPrompt=null; $("installBtn").hidden=true;
  });
  if (window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true) $("installBtn").hidden=true;
  if (configured() && window.supabase) {
    state.client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: "roostak-auth", storage: window.localStorage } });
    if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
    const { data } = await state.client.auth.getSession(); state.user=data.session?.user || null;
    state.client.auth.onAuthStateChange((event, session) => {
      // Only an explicit sign-out clears the user; transient refresh/network hiccups must not log people out.
      if (event === "SIGNED_OUT") { state.user=null; state.profile=null; $("accountEntry").textContent="ورود"; }
      else if (session?.user) state.user=session.user;
    });
    if (state.user) { try { await loadProfile(); const name=state.profile?.display_name; $("accountEntry").textContent=name || "حساب من"; } catch(e) { console.warn(e); } }
    await loadPublicCategories();
    await loadPublicProducts();
    openSharedProductFromURL();
  } else {
    $("topProducts").innerHTML = `<p class="empty-state">برای فعال‌شدن حساب‌ها و محصولات، آدرس و کلید عمومی Supabase را در app.js وارد کن. ظاهر سایت در همین حال قابل مشاهده است.</p>`;
  }
}
init();
