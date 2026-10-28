(() => {
  "use strict";
  const SUPABASE_URL = "https://livlnryfpbsmsnzixxqy.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_CSFsOwJ2-ekzxrKMN5ceQA_MP2KXsbZ";
  const DEFAULT_CATEGORIES = ["خوراکی محلی","عرقیجات و سرکه","محصولات کشاورزی","خدمات حضوری","صنایع دستی"];
  let CATEGORIES = [...DEFAULT_CATEGORIES];
  const $ = id => document.getElementById(id);
  const state = { client:null, user:null, products:[], profiles:[], support:[], view:"overview", categories:[] };
  const labels = { pending:"در انتظار بررسی", approved:"تأییدشده", rejected:"ردشده", unavailable:"ناموجود" };
  const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  function toast(message){const el=$("toast");el.textContent=message;el.classList.add("show");clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove("show"),3000)}
  function init(){
    if(!window.supabase){$("loginMessage").textContent="کتابخانهٔ Supabase بارگذاری نشد؛ اتصال اینترنت را بررسی کن.";return}
    state.client=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    $("loginBtn").addEventListener("click",login);
    $("logoutBtn").addEventListener("click",logout);
    $("refreshBtn").addEventListener("click",loadAll);
    $("reloadProducts").addEventListener("click",loadProducts);
    $("reloadSupport").addEventListener("click",loadSupport);
    $("productSearch").addEventListener("input",renderProducts);
    $("productStatus").addEventListener("change",renderProducts);
    $("categoryFilter").addEventListener("change",renderProducts);
    $("sellerSearch").addEventListener("input",renderSellers);
    $("reloadCategories").addEventListener("click",loadCategories);
    $("categoryForm").addEventListener("submit",addCategory);
    $("categoriesList").addEventListener("click",handleCategoryAction);
    $("nav").addEventListener("click",e=>{const b=e.target.closest("[data-view]");if(b)showView(b.dataset.view)});
    document.querySelectorAll("[data-goto]").forEach(b=>b.addEventListener("click",()=>showView(b.dataset.goto)));
    $("menuToggle").addEventListener("click",()=>$("sidebar")?.classList.toggle("open"));
    // Sidebar itself has no id in markup; query it directly.
    $("menuToggle").addEventListener("click",()=>document.querySelector(".sidebar").classList.toggle("open"));
    $("loginPassword").addEventListener("keydown",e=>{if(e.key==="Enter")login()});

    state.client.auth.getSession().then(({data})=>{if(data.session)handleSession(data.session);else showLogin()});
    state.client.auth.onAuthStateChange((_event,session)=>{if(session)handleSession(session);else showLogin()});
  }
  function showLogin(){state.user=null;$("loginPanel").classList.remove("hidden");$("dashboard").classList.add("hidden");$("logoutBtn").classList.add("hidden");$("adminEmail").textContent="وارد نشده"}
  async function login(){
    const identity=$("loginIdentity").value.trim(), password=$("loginPassword").value;
    if(!identity||!password){$("loginMessage").textContent="نام کاربری و رمز عبور را وارد کن.";return}
    $("loginMessage").textContent="در حال بررسی…";
    // The current prototype uses a synthetic email derived from username.
    const email=identity.includes("@")?identity:`${identity.toLowerCase()}@users.roostak.invalid`;
    const {data,error}=await state.client.auth.signInWithPassword({email,password});
    if(error){$("loginMessage").textContent="ورود ناموفق بود. اطلاعات را بررسی کن؛ اگر ورود با نام کاربری پشتیبانی نشده، باید روش احراز هویت سایت اصلاح شود.";return}
    await handleSession(data.session);
  }
  async function handleSession(session){
    if(!session?.user)return;
    state.user=session.user;
    // Check admin role in database; never trust a client-side-only flag.
    const {data,error}=await state.client.from("admin_users").select("user_id").eq("user_id",session.user.id).maybeSingle();
    if(error||!data){await state.client.auth.signOut();$("loginMessage").textContent="این حساب دسترسی مدیر ندارد یا جدول admin_users آماده نیست.";showLogin();return}
    $("loginPanel").classList.add("hidden");$("dashboard").classList.remove("hidden");$("logoutBtn").classList.remove("hidden");$("adminEmail").textContent=session.user.email||"مدیر";
    await loadAll();
  }
  async function logout(){await state.client.auth.signOut();showLogin()}
  function showView(view){
    state.view=view;
    document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
    document.querySelectorAll(".view").forEach(v=>v.classList.toggle("hidden",v.id!==`view-${view}`));
    const names={overview:"نمای کلی",products:"مدیریت محصولات",sellers:"فروشندگان",categories:"مدیریت دسته‌بندی‌ها",support:"درخواست‌های پشتیبانی",settings:"تنظیمات"};
    $("pageTitle").textContent=names[view]||"پنل مدیریت";
    document.querySelector(".sidebar").classList.remove("open");
    if(view==="products")renderProducts();if(view==="sellers")renderSellers();if(view==="categories")loadCategories();if(view==="support")renderSupport();
  }
  async function loadAll(){if(!state.user)return;await Promise.all([loadProducts(),loadProfiles(),loadSupport(),loadCategories()]);renderOverview()}
  async function loadProducts(){
    const {data,error}=await state.client.from("products").select("*").order("created_at",{ascending:false}).limit(500);
    if(error){$("productsList").innerHTML=`<div class="empty">خطا در دریافت محصولات: ${escapeHTML(error.message)}</div>`;return}
    state.products=data||[];renderProducts();renderOverview();
  }
  async function loadProfiles(){
    const {data,error}=await state.client.from("profiles").select("*").limit(500);
    if(error){$("sellersList").innerHTML=`<div class="empty">خطا در دریافت فروشندگان: ${escapeHTML(error.message)}</div>`;return}
    state.profiles=data||[];renderSellers();renderOverview();
  }
  async function loadSupport(){
    const {data,error}=await state.client.from("support_requests").select("*").order("created_at",{ascending:false}).limit(200);
    if(error){$("supportList").innerHTML=`<div class="empty">خطا در دریافت درخواست‌ها: ${escapeHTML(error.message)}</div>`;return}
    state.support=data||[];renderSupport();
  }
  function sellerName(id){const p=state.profiles.find(x=>x.id===id||x.user_id===id);return p?.display_name||p?.username||"فروشنده"}
  function sellerAvatar(id){const p=state.profiles.find(x=>x.id===id||x.user_id===id);return p?.avatar_url||""}
  function productStatus(p){if(p.is_available===false)return "unavailable";return p.status||"pending"}
  function renderOverview(){
    const pending=state.products.filter(p=>productStatus(p)==="pending");
    $("statPending").textContent=pending.length;$("statApproved").textContent=state.products.filter(p=>productStatus(p)==="approved").length;$("statUnavailable").textContent=state.products.filter(p=>productStatus(p)==="unavailable").length;$("statSellers").textContent=state.profiles.length;$("pendingBadge").textContent=pending.length;
    $("overviewPending").innerHTML=pending.length?pending.slice(0,5).map(p=>miniProduct(p)).join(""):`<div class="empty">محصولی در انتظار بررسی نیست 🌿</div>`;
    $("overviewPending").querySelectorAll("[data-open-product]").forEach(b=>b.addEventListener("click",()=>openProduct(b.dataset.openProduct)));
  }
  function miniProduct(p){return `<div class="seller-row"><img src="${escapeHTML((p.images||[])[0]||"")}" alt=""><div class="seller-info"><b>${escapeHTML(p.name||p.title||"بدون نام")}</b><small>${escapeHTML(sellerName(p.user_id||p.seller_id))} · ${escapeHTML(p.category||"بدون دسته")}</small></div><button class="secondary" data-open-product="${escapeHTML(p.id)}">بررسی</button></div>`}
  function renderProducts(){
    const q=$("productSearch").value.trim().toLowerCase(),status=$("productStatus").value,category=$("categoryFilter").value;
    const filtered=state.products.filter(p=>{
      const name=(p.name||p.title||"").toLowerCase(), seller=sellerName(p.user_id||p.seller_id).toLowerCase();
      return (!q||name.includes(q)||seller.includes(q))&&(status==="all"||productStatus(p)===status)&&(category==="all"||p.category===category);
    });
    $("productsList").innerHTML=filtered.length?filtered.map(p=>{
      const st=productStatus(p), image=Array.isArray(p.images)?p.images[0]:(p.image_url||"");
      return `<article class="product-row"><img src="${escapeHTML(image)}" alt=""><div><h3>${escapeHTML(p.name||p.title||"بدون نام")}</h3><p>${escapeHTML(sellerName(p.user_id||p.seller_id))} · ${escapeHTML(p.category||"بدون دسته")}</p><p>${escapeHTML(p.price?`${p.price} تومان`:"قیمت توافقی")} · <span class="pill ${st}">${escapeHTML(labels[st]||st)}</span></p></div><div class="row-actions"><button class="secondary" data-open-product="${escapeHTML(p.id)}">جزئیات</button>${st==="pending"?`<button class="primary" data-approve="${escapeHTML(p.id)}">تأیید</button><button class="secondary" data-reject="${escapeHTML(p.id)}">رد</button>`:""}${st==="approved"?`<button class="secondary" data-feature="${escapeHTML(p.id)}">${p.is_featured?"حذف از برترها":"محصول برتر"}</button>`:""}</div></article>`;
    }).join(""):`<div class="empty">محصولی با این فیلتر پیدا نشد.</div>`;
    $("productsList").querySelectorAll("[data-open-product]").forEach(b=>b.addEventListener("click",()=>openProduct(b.dataset.openProduct)));
    $("productsList").querySelectorAll("[data-approve]").forEach(b=>b.addEventListener("click",()=>setProductStatus(b.dataset.approve,"approved")));
    $("productsList").querySelectorAll("[data-reject]").forEach(b=>b.addEventListener("click",()=>setProductStatus(b.dataset.reject,"rejected")));
    $("productsList").querySelectorAll("[data-feature]").forEach(b=>b.addEventListener("click",()=>toggleFeatured(b.dataset.feature)));
  }
  async function setProductStatus(id,status){
    const {error}=await state.client.from("products").update({status}).eq("id",id);
    if(error){toast("تغییر انجام نشد: "+error.message);return}
    toast(status==="approved"?"محصول تأیید شد":"محصول رد شد");await loadProducts();
  }
  async function toggleFeatured(id){
    const p=state.products.find(x=>String(x.id)===String(id));if(!p)return;
    const {error}=await state.client.from("products").update({is_featured:!p.is_featured}).eq("id",id);
    if(error){toast("تغییر انجام نشد؛ ممکن است ستون is_featured وجود نداشته باشد.");return}
    toast("وضعیت محصول برتر تغییر کرد");await loadProducts();
  }
  function openProduct(id){
    const p=state.products.find(x=>String(x.id)===String(id));if(!p)return;
    const images=Array.isArray(p.images)?p.images:(p.image_url?[p.image_url]:[]);
    $("productDialogContent").innerHTML=`<h3>${escapeHTML(p.name||p.title||"محصول")}</h3><p>فروشنده: ${escapeHTML(sellerName(p.user_id||p.seller_id))}</p><p>دسته‌بندی: <b>${escapeHTML(p.category||"ثبت نشده")}</b></p><p>قیمت: ${escapeHTML(p.price||"توافقی")}</p><p>${escapeHTML(p.description||"توضیحی ثبت نشده")}</p>${images.map(src=>`<img src="${escapeHTML(src)}" alt="عکس محصول">`).join("")}<div class="dialog-actions">${productStatus(p)==="pending"?`<button class="primary" id="dialogApprove">تأیید محصول</button><button class="secondary" id="dialogReject">رد محصول</button>`:""}<button class="secondary" id="dialogClose">بستن</button></div>`;
    $("productDialog").showModal();
    $("dialogClose").addEventListener("click",()=>$("productDialog").close());
    if($("dialogApprove"))$("dialogApprove").addEventListener("click",async()=>{await setProductStatus(id,"approved");$("productDialog").close()});
    if($("dialogReject"))$("dialogReject").addEventListener("click",async()=>{await setProductStatus(id,"rejected");$("productDialog").close()});
  }
  function renderSellers(){
    const q=$("sellerSearch").value.trim().toLowerCase();
    const list=state.profiles.filter(p=>(p.display_name||p.username||"").toLowerCase().includes(q));
    $("sellersList").innerHTML=list.length?list.map(p=>`<div class="seller-row"><img src="${escapeHTML(p.avatar_url||"")}" alt=""><div class="seller-info"><b>${escapeHTML(p.display_name||p.username||"بدون نام")}</b><small>${escapeHTML(p.username||"")} · ${state.products.filter(x=>(x.user_id||x.seller_id)===(p.id||p.user_id)).length} محصول</small></div><label><input type="checkbox" data-top-seller="${escapeHTML(p.user_id||p.id)}" ${p.is_top_seller?"checked":""}> فروشندهٔ برتر</label><button class="secondary" data-reset-password="${escapeHTML(p.user_id||p.id)}" data-reset-name="${escapeHTML(p.display_name||p.username||"فروشنده")}">تغییر رمز</button></div>`).join(""):`<div class="empty">فروشنده‌ای پیدا نشد.</div>`;
    $("sellersList").querySelectorAll("[data-top-seller]").forEach(ch=>ch.addEventListener("change",()=>setTopSeller(ch.dataset.topSeller,ch.checked)));
    $("sellersList").querySelectorAll("[data-reset-password]").forEach(b=>b.addEventListener("click",()=>resetSellerPassword(b.dataset.resetPassword,b.dataset.resetName)));
  }
  async function resetSellerPassword(userId,name){
    if(!confirm(`برای حساب «${name}» رمز جدید تنظیم شود؟`))return;
    const password=prompt("رمز جدید را وارد کن (حداقل ۸ نویسه):");if(password===null)return;if(password.length<8){toast("رمز باید حداقل ۸ نویسه داشته باشد.");return}
    const {data,error}=await state.client.functions.invoke("admin-reset-password",{body:{userId,password}});
    if(error || data?.ok !== true){toast("تغییر رمز انجام نشد. تابع امن admin-reset-password و مجوز مدیر را بررسی کن.");console.error(error || data);return}
    toast("رمز حساب با موفقیت تغییر کرد.");
  }
  async function setTopSeller(id,checked){
    const profile=state.profiles.find(p=>String(p.user_id||p.id)===String(id));if(!profile)return;
    const key="user_id" in profile?"user_id":"id";
    const {error}=await state.client.from("profiles").update({is_top_seller:checked}).eq(key,profile[key]);
    if(error){toast("ذخیره نشد؛ ممکن است ستون is_top_seller یا سیاست دسترسی وجود نداشته باشد.");return}
    toast("تنظیم فروشنده ذخیره شد");await loadProfiles();
  }
  async function loadCategories(){
    const {data,error}=await state.client.from("roostak_categories").select("id,name,is_active,sort_order").order("sort_order",{ascending:true}).order("name",{ascending:true});
    if(error){$("categoriesList").innerHTML=`<div class="empty">جدول دسته‌بندی‌ها آماده نیست. فایل supabase-roostak-features.sql را در SQL Editor اجرا کن. (${escapeHTML(error.message)})</div>`;return}
    state.categories=data||[]; CATEGORIES=state.categories.filter(c=>c.is_active).map(c=>c.name);
    $("settingsCategories").innerHTML=CATEGORIES.map(c=>`<span>${escapeHTML(c)}</span>`).join("");
    const select=$("categoryFilter"), chosen=select.value||"all"; select.innerHTML='<option value="all">همه دسته‌ها</option>'+CATEGORIES.map(c=>`<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join(""); if(CATEGORIES.includes(chosen))select.value=chosen;
    $("categoriesList").innerHTML=state.categories.length?state.categories.map(c=>`<div class="category-admin-row"><div><b>${escapeHTML(c.name)}</b><small>${c.is_active?"فعال":"غیرفعال"}</small></div><div class="category-actions"><button class="secondary" data-edit-category="${escapeHTML(c.id)}">ویرایش</button><button class="secondary" data-delete-category="${escapeHTML(c.id)}">حذف</button></div></div>`).join(""):`<div class="empty">هنوز دسته‌ای ثبت نشده است.</div>`;
    renderProducts();
  }
  async function addCategory(e){e.preventDefault();const name=$("categoryName").value.trim();if(name.length<2||name.length>60){toast("نام دسته باید بین ۲ تا ۶۰ نویسه باشد.");return}if(state.categories.some(c=>c.name.toLocaleLowerCase("fa")===name.toLocaleLowerCase("fa"))){toast("این دسته قبلاً ثبت شده است.");return}const {error}=await state.client.from("roostak_categories").insert({name,is_active:true,sort_order:state.categories.length});if(error){toast("افزودن دسته انجام نشد: "+error.message);return}$("categoryName").value="";toast("دسته‌بندی اضافه شد.");await loadCategories();}
  async function handleCategoryAction(e){const edit=e.target.closest("[data-edit-category]");const del=e.target.closest("[data-delete-category]");if(edit){const cat=state.categories.find(c=>String(c.id)===edit.dataset.editCategory);if(!cat)return;const name=prompt("نام جدید دسته‌بندی:",cat.name);if(name===null)return;const clean=name.trim();if(clean.length<2||clean.length>60){toast("نام دسته باید بین ۲ تا ۶۰ نویسه باشد.");return}if(state.categories.some(c=>String(c.id)!==String(cat.id)&&c.name.toLocaleLowerCase("fa")===clean.toLocaleLowerCase("fa"))){toast("این نام قبلاً برای دستهٔ دیگری استفاده شده است.");return}const {error}=await state.client.from("roostak_categories").update({name:clean}).eq("id",cat.id);if(error){toast("ویرایش انجام نشد: "+error.message);return}toast("دسته‌بندی ویرایش شد.");await loadCategories();}if(del){const cat=state.categories.find(c=>String(c.id)===del.dataset.deleteCategory);if(!cat)return;const {count,error:countError}=await state.client.from("products").select("id",{count:"exact",head:true}).eq("category",cat.name);if(countError){toast("بررسی محصولات این دسته ممکن نشد: "+countError.message);return}if((count||0)>0){toast(`حذف نشد؛ ${count} محصول به این دسته متصل است. ابتدا محصولات را به دستهٔ دیگری منتقل کن.`);return}if(!confirm(`دستهٔ «${cat.name}» حذف شود؟`))return;const {error}=await state.client.from("roostak_categories").delete().eq("id",cat.id);if(error){toast("حذف انجام نشد: "+error.message);return}toast("دسته حذف شد.");await loadCategories();}}
  function renderSupport(){
    $("supportList").innerHTML=state.support.length?state.support.map(s=>`<article class="support-row"><div class="support-info"><b>${escapeHTML(s.subject||s.type||"درخواست پشتیبانی")}</b><small>${escapeHTML(s.username||s.user_id||"کاربر")} · ${escapeHTML(s.status||"ثبت‌شده")}</small><p>${escapeHTML(s.message||s.description||"بدون توضیح")}</p><small>${escapeHTML(s.created_at||"")}</small></div><button class="secondary" data-support-done="${escapeHTML(s.id)}">بستن درخواست</button></article>`).join(""):`<div class="empty">درخواستی ثبت نشده یا جدول در دسترس نیست.</div>`;
    $("supportList").querySelectorAll("[data-support-done]").forEach(b=>b.addEventListener("click",()=>closeSupport(b.dataset.supportDone)));
  }
  async function closeSupport(id){
    const s=state.support.find(x=>String(x.id)===String(id));if(!s)return;
    const {error}=await state.client.from("support_requests").update({status:"closed"}).eq("id",id);
    if(error){toast("تغییر وضعیت درخواست انجام نشد: "+error.message);return}
    toast("درخواست بسته شد");await loadSupport();
  }
  document.addEventListener("DOMContentLoaded",init);
})();