/* Roostak starter — configure Supabase values before enabling account features. */
const SUPABASE_URL = "https://livlnryfpbsmsnzixxqy.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpdmxucnlmcGJzbXNueml4eHF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMxOTc0MDYsImV4cCI6MjEwODc3MzQwNn0.WUyEBpPMyP73r4uougxmX35t2YxPtLaFzJfo4SOzGDE";
const CATEGORIES = ["خوراکی محلی", "عرقیجات و سرکه", "محصولات کشاورزی", "خدمات حضوری", "صنایع دستی"];
const INTERNAL_EMAIL_DOMAIN = "users.roostak.invalid";
const PLACEHOLDER_IMAGE = "data:image/svg+xml;charset=UTF-8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300"><rect width="300" height="300" fill="#e7ebe2"/><path d="M60 220l60-70 40 45 35-40 45 65z" fill="#b7c8b4"/><circle cx="196" cy="92" r="24" fill="#d9a441"/></svg>');
const $ = (id) => document.getElementById(id);
const state = { client: null, user: null, profile: null, products: [], installPrompt: null, authMode: "login", images: [], theme: "light", search: "" };
const modal = $("appModal");
const modalBody = $("modalBody");
const modalTitle = $("modalTitle");

function configured() {
  return /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(SUPABASE_URL) && Boolean(SUPABASE_ANON_KEY) && !SUPABASE_ANON_KEY.includes("YOUR-");
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
  // Auth is a focused standalone screen: no home header or bottom navigation.
  document.querySelector(".site-header").hidden = which !== "home";
  document.querySelector(".bottom-nav").hidden = which !== "home";
  document.body.classList.toggle("auth-screen", which === "auth");
  document.body.classList.toggle("account-screen", which === "account");
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function goHome() { showMain("home"); renderHome(); }
$("homeLink").addEventListener("click", (e) => { e.preventDefault(); goHome(); });
$("accountEntry").addEventListener("click", () => state.user ? showAccount() : showAuth("login"));
$("accountNav").addEventListener("click", () => state.user ? showAccount() : showAuth("login"));
$("categoriesNav").addEventListener("click", () => openModal("دسته‌بندی‌ها", `<div class="form-stack">${CATEGORIES.map((c,i)=>`<button class="btn btn-outline category-jump" data-index="${i}">${escapeHtml(c)}</button>`).join("")}</div>`));
modalBody.addEventListener("click", (e) => {
  const jump = e.target.closest(".category-jump");
  if (jump) { closeModal(); showMain("home"); document.querySelector(`[data-category-index="${jump.dataset.index}"]`)?.scrollIntoView({behavior:"smooth",block:"start"}); }
});
$("settingsNav").addEventListener("click", () => openModal("تنظیمات ظاهر", `
  <div class="settings-row"><div><strong>حالت نمایش</strong><p class="form-note">روشن یا تاریک</p></div><button class="btn btn-outline" id="themeToggle">${state.theme === "dark" ? "حالت روشن" : "حالت تاریک"}</button></div>
  <div class="settings-row"><div><strong>رنگ تأکیدی</strong><p class="form-note">رنگ اصلی رابط کاربری</p></div><input id="accentPicker" class="color-input" type="color" value="${getComputedStyle(document.body).getPropertyValue("--green").trim() || "#246B45"}"></div>
  <button class="btn btn-outline" id="resetColors">بازگشت به رنگ اصلی</button>
`));
modalBody.addEventListener("click", (e) => {
  if (e.target.id === "themeToggle") { setTheme(state.theme === "dark" ? "light" : "dark"); e.target.textContent = state.theme === "dark" ? "حالت روشن" : "حالت تاریک"; }
  if (e.target.id === "resetColors") { document.documentElement.style.removeProperty("--green"); toast("رنگ اصلی بازگردانده شد."); }
});
modalBody.addEventListener("input", (e) => { if (e.target.id === "accentPicker") document.documentElement.style.setProperty("--green", e.target.value); });

function renderCategorySections() {
  const root = $("categorySections");
  root.innerHTML = CATEGORIES.map((category, index) => {
    const list = state.products.filter(p => p.category === category && p.status === "approved" && p.is_available !== false && matchesSearch(p));
    return `<section class="category-section" data-category-index="${index}"><div class="section-heading"><div><p class="eyebrow">از تولیدکننده‌های محلی</p><h2>${escapeHtml(category)}</h2></div></div><div class="product-row">${list.length ? list.map(productCard).join("") : `<p class="empty-state">هنوز محصولی در این دسته منتشر نشده است.</p>`}</div></section>`;
  }).join("");
}
function matchesSearch(p) {
  const q = state.search.trim().toLocaleLowerCase("fa");
  return !q || [p.name, p.description, p.category, p.seller_name].some(v => String(v || "").toLocaleLowerCase("fa").includes(q));
}
function productCard(p) {
  const img = p.cover_url || (Array.isArray(p.images) && p.images[0]) || PLACEHOLDER_IMAGE;
  return `<article class="product-card" data-product-id="${escapeHtml(p.id)}" tabindex="0" role="button" aria-label="نمایش ${escapeHtml(p.name)}"><img class="product-image" src="${escapeHtml(img)}" alt="${escapeHtml(p.name)}" loading="lazy"><div class="product-card-info"><h3>${escapeHtml(p.name)}</h3><p>${escapeHtml(p.seller_name || "فروشنده محلی")}</p>${p.price ? `<p class="price">${escapeHtml(p.price)}</p>` : ""}</div></article>`;
}
function renderHome() {
  const top = state.products.filter(p => p.status === "approved" && p.is_available !== false && p.is_featured && matchesSearch(p));
  $("topProducts").innerHTML = top.length ? top.map(productCard).join("") : `<p class="empty-state">محصولات برتر پس از تأیید و انتخاب توسط مدیر اینجا نمایش داده می‌شوند.</p>`;
  const sellers = new Map();
  state.products.filter(p => p.status === "approved" && p.is_available !== false && p.seller_name && p.seller_is_top_seller).forEach(p => { if (!sellers.has(p.user_id)) sellers.set(p.user_id, { name:p.seller_name, avatar:p.seller_avatar }); });
  $("topSellers").innerHTML = sellers.size ? [...sellers.entries()].slice(0,8).map(([id,s]) => `<button class="seller-tile" data-seller-id="${escapeHtml(id)}"><img class="seller-photo" src="${escapeHtml(s.avatar || PLACEHOLDER_IMAGE)}" alt=""><strong>${escapeHtml(s.name)}</strong></button>`).join("") : `<p class="empty-state">فروشنده‌های منتخب به‌زودی اینجا نمایش داده می‌شوند.</p>`;
  renderCategorySections();
}
$("searchInput").addEventListener("input", e => { state.search = e.target.value; renderHome(); });
document.addEventListener("click", e => {
  const card = e.target.closest(".product-card");
  if (card) showProduct(card.dataset.productId);
});
document.addEventListener("keydown", e => {
  if ((e.key === "Enter" || e.key === " ") && e.target.matches(".product-card")) { e.preventDefault(); showProduct(e.target.dataset.productId); }
});
async function showProduct(id) {
  const p = state.products.find(x => String(x.id) === String(id));
  if (!p) return;
  const images = Array.isArray(p.images) ? p.images : [];
  const image = p.cover_url || images[0] || PLACEHOLDER_IMAGE;
  const phone = p.show_phone ? (p.product_phone || p.seller_phone) : "";
  const social = p.show_social ? (p.product_social || p.seller_social) : "";
  const address = p.product_address || p.seller_address || "";
  const socialUrl = safeUrl(social);
  openModal(p.name, `
    <img class="product-detail-image" src="${escapeHtml(image)}" alt="${escapeHtml(p.name)}">
    <div class="seller-detail"><img src="${escapeHtml(p.seller_avatar || PLACEHOLDER_IMAGE)}" alt=""><div><strong>${escapeHtml(p.seller_name || "فروشنده محلی")}</strong><div class="form-note">فروشندهٔ روستاک</div></div></div>
    ${p.price ? `<p class="price">${escapeHtml(p.price)}</p>` : ""}
    <p class="detail-description">${escapeHtml(p.description || "توضیحی برای این محصول ثبت نشده است.")}</p>
    <div class="detail-list">
      ${phone ? `<div class="detail-line"><strong>تلفن:</strong><a href="tel:${escapeHtml(phone)}">${escapeHtml(phone)}</a></div>` : ""}
      ${address ? `<div class="detail-line"><strong>محل فروش:</strong><span>${escapeHtml(address)}</span></div>` : ""}
      ${social ? `<div class="detail-line"><strong>شبکه اجتماعی:</strong>${socialUrl ? `<a href="${escapeHtml(socialUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(social)}</a>` : `<span>${escapeHtml(social)}</span>`}</div>` : ""}
      ${!phone && !address && !social ? `<p class="form-note">فروشنده اطلاعات تماس عمومی ثبت نکرده است.</p>` : ""}
    </div>
  `);
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
      <div class="field"><label for="avatarFile">عکس پروفایل (اختیاری)</label><input id="avatarFile" type="file" accept="image/*"><div class="avatar-upload-preview"><img id="avatarPreview" src="${escapeHtml(p.avatar_url || PLACEHOLDER_IMAGE)}" alt="پیش‌نمایش عکس پروفایل"><span>از دستگاهت عکس انتخاب کن؛ نیازی به لینک عکس نیست.</span></div></div>
      <div class="field"><label for="profilePhone">شماره تلفن (اختیاری)</label><input id="profilePhone" type="tel" value="${escapeHtml(p.phone || "")}" placeholder="شماره تماس"></div>
      <label class="checkbox-line"><input id="phonePublic" type="checkbox" ${p.phone_public ? "checked" : ""}> نمایش عمومی شماره تلفن</label>
      <div class="field"><label for="profileAddress">آدرس محل فروش (اختیاری)</label><input id="profileAddress" maxlength="200" value="${escapeHtml(p.address || "")}" placeholder="روستا، محله یا نشانی"></div>
      <div class="field"><label for="profileSocial">شبکه اجتماعی (اختیاری)</label><input id="profileSocial" maxlength="200" value="${escapeHtml(p.social || "")}" placeholder="لینک یا شناسه"></div>
      <label class="checkbox-line"><input id="socialPublic" type="checkbox" ${p.social_public ? "checked" : ""}> نمایش عمومی شبکه اجتماعی</label>
      <p class="error-text" id="profileError"></p>
      <button class="btn btn-primary" type="submit">ذخیره تنظیمات</button>
    </form>`);
  $("avatarFile").addEventListener("change", async () => {
    const file = $("avatarFile").files?.[0];
    if (!file) return;
    try {
      if (!file.type.startsWith("image/")) throw new Error("لطفاً یک فایل تصویری انتخاب کن.");
      const compressed = await compressImage(file, 500 * 1024);
      $("avatarPreview").src = URL.createObjectURL(compressed);
    } catch (err) { $("profileError").textContent = err.message; $("avatarFile").value = ""; }
  });
  $("profileForm").addEventListener("submit", async e => {
    e.preventDefault();
    const display_name = $("displayName").value.trim();
    if (!display_name) { $("profileError").textContent = "وارد کردن نام الزامی است."; return; }
    let avatar_url = state.profile?.avatar_url || null;
    const payload = { display_name, avatar_url, phone: $("profilePhone").value.trim() || null, phone_public: $("phonePublic").checked, address: $("profileAddress").value.trim() || null, social: $("profileSocial").value.trim() || null, social_public: $("socialPublic").checked };
    const button = e.submitter; button.disabled = true;
    try {
      const file = $("avatarFile").files?.[0];
      if (file) {
        const blob = await compressImage(file, 500 * 1024);
        const path = `${state.user.id}/avatar-${Date.now()}.jpg`;
        const { error: uploadError } = await state.client.storage.from("product-images").upload(path, blob, { contentType: "image/jpeg", upsert: false });
        if (uploadError) throw uploadError;
        const { data: publicData } = state.client.storage.from("product-images").getPublicUrl(path);
        avatar_url = publicData.publicUrl;
      }
      payload.avatar_url = avatar_url;
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
  $("accountMain").innerHTML = `<button class="btn btn-outline account-home-button" id="accountHomeBtn" type="button">← بازگشت به صفحهٔ خانه</button><section class="panel"><div class="profile-header"><img class="profile-large" src="${escapeHtml(p.avatar_url || PLACEHOLDER_IMAGE)}" alt="عکس پروفایل"><h1>${escapeHtml(p.display_name || "نامت را تنظیم کن")}</h1><p class="username">@${escapeHtml(p.username || "")}</p><button class="text-button" id="editProfileBtn">تنظیمات پروفایل</button></div>
    <div class="account-tools"><button class="btn btn-primary" id="addProductBtn">＋ افزودن محصول</button><button class="btn btn-outline" id="supportAccountBtn">ارتباط با پشتیبان</button><button class="btn btn-outline" id="signOutBtn">خروج از حساب</button></div>
    <div class="section-heading"><h2>محصولات من</h2></div><div class="product-management-list" id="myProducts"></div></section>`;
  $("accountHomeBtn").addEventListener("click", goHome);
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
  root.innerHTML = list.length ? list.map(p => `<article class="managed-product"><img src="${escapeHtml(p.cover_url || PLACEHOLDER_IMAGE)}" alt=""><div class="grow"><h3>${escapeHtml(p.name)}</h3><p>${escapeHtml(p.status === "approved" ? (p.is_available === false ? "ناموجود" : "منتشرشده") : p.status === "rejected" ? "ردشده" : "در انتظار بررسی")}</p></div><div class="managed-actions"><button class="btn btn-outline" data-edit-product="${escapeHtml(p.id)}">ویرایش</button><button class="btn btn-outline" data-toggle-availability="${escapeHtml(p.id)}">${p.is_available === false ? "موجود شد" : "ناموجود"}</button><button class="btn btn-danger" data-delete-product="${escapeHtml(p.id)}">حذف</button></div></article>`).join("") : `<p class="empty-state">هنوز محصولی ثبت نکرده‌ای.</p>`;
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
function showProductForm(existing = null) {
  if (!state.user) return showAuth("login");
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
async function loadPublicProducts() {
  if (!state.client) return;
  const { data, error } = await state.client.from("products").select("id,user_id,name,category,description,price,images,cover_url,product_phone,show_phone,product_address,product_social,show_social,status,is_featured,is_available,created_at,profiles!products_user_id_fkey(display_name,avatar_url,phone,phone_public,address,social,social_public,is_top_seller)").eq("status","approved").order("created_at",{ascending:false});
  if (error) { console.warn(error); return; }
  state.products = (data || []).map(p => ({...p, seller_name:p.profiles?.display_name || "فروشنده محلی", seller_avatar:p.profiles?.avatar_url, seller_phone:p.profiles?.phone_public ? p.profiles?.phone : null, seller_address:p.profiles?.address, seller_social:p.profiles?.social_public ? p.profiles?.social : null, seller_is_top_seller: p.profiles?.is_top_seller === true}));
  renderHome();
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
    state.client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storage: window.localStorage } });
    const { data } = await state.client.auth.getSession(); state.user=data.session?.user || null;
    state.client.auth.onAuthStateChange((_event, session) => {
      state.user = session?.user || null;
      if (!state.user) { state.profile = null; $("accountEntry").textContent = "ورود"; }
      else if (state.profile?.avatar_url) $("accountEntry").innerHTML = `<img class="avatar" src="${escapeHtml(state.profile.avatar_url)}" alt="عکس پروفایل">`;
    });
    if (state.user) { try { await loadProfile(); const name=state.profile?.display_name; $("accountEntry").innerHTML=state.profile?.avatar_url ? `<img class="avatar" src="${escapeHtml(state.profile.avatar_url)}" alt="عکس پروفایل">` : escapeHtml(name || "حساب من"); } catch(e) { console.warn(e); } }
    await loadPublicProducts();
  } else {
    $("topProducts").innerHTML = `<p class="empty-state">برای فعال‌شدن حساب‌ها و محصولات، آدرس و کلید عمومی Supabase را در app.js وارد کن. ظاهر سایت در همین حال قابل مشاهده است.</p>`;
  }
}
init();
