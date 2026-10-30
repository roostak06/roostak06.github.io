(() => {
  "use strict";
  const SUPABASE_URL = "https://livlnryfpbsmsnzixxqy.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_CSFsOwJ2-ekzxrKMN5ceQA_MP2KXsbZ";
  const VAPID_PUBLIC_KEY = "REPLACE_WITH_VAPID_PUBLIC_KEY"; // Replace after generating VAPID keys; never put the private key here.
  const DEFAULT_CATEGORIES = ["خوراکی محلی","عرقیجات و سرکه","محصولات کشاورزی","خدمات حضوری","صنایع دستی"];
  let CATEGORIES = [...DEFAULT_CATEGORIES];
  const $ = id => document.getElementById(id);
  const state = { client:null, user:null, products:[], profiles:[], support:[], reports:[], view:"overview", categories:[], notifications:[], notificationChannel:null };
  const labels = { pending:"در انتظار بررسی", approved:"تأییدشده", rejected:"ردشده", unavailable:"ناموجود" };
  const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  function toast(message){const el=$("toast");el.textContent=message;el.classList.add("show");clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove("show"),3000)}
  function init(){
    if(!window.supabase){$("loginMessage").textContent="کتابخانهٔ Supabase بارگذاری نشد؛ اتصال اینترنت را بررسی کن.";return}
    state.client=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:"roostak-auth",storage:window.localStorage}});
    $("loginBtn").addEventListener("click",login);
    $("logoutBtn").addEventListener("click",logout);
    $("refreshBtn").addEventListener("click",loadAll);
    $("notificationBell")?.addEventListener("click",()=>$("notificationPanel")?.classList.toggle("hidden"));
    $("markNotificationsRead")?.addEventListener("click",markNotificationsRead);
    $("notificationList")?.addEventListener("click",openNotification);
    $("pushEnableBtn")?.addEventListener("click",enablePushNotifications);
    $("reloadProducts").addEventListener("click",loadProducts);
    $("reloadSupport").addEventListener("click",loadSupport);if($("reloadReports"))$("reloadReports").addEventListener("click",loadReports);
    $("productSearch").addEventListener("input",renderProducts);
    $("productStatus").addEventListener("change",renderProducts);
    $("categoryFilter").addEventListener("change",renderProducts);
    $("sellerSearch").addEventListener("input",renderSellers);
    $("reloadCategories").addEventListener("click",loadCategories);
    $("categoryForm").addEventListener("submit",addCategory);
    $("categoriesList").addEventListener("click",handleCategoryAction);
    bindCategoryReorder();
    $("nav").addEventListener("click",e=>{const b=e.target.closest("[data-view]");if(b)showView(b.dataset.view)});
    document.querySelectorAll("[data-goto]").forEach(b=>b.addEventListener("click",()=>showView(b.dataset.goto)));
    $("menuToggle").addEventListener("click",()=>$("sidebar")?.classList.toggle("open"));
    // Sidebar itself has no id in markup; query it directly.
    $("menuToggle").addEventListener("click",()=>document.querySelector(".sidebar").classList.toggle("open"));
    $("loginPassword").addEventListener("keydown",e=>{if(e.key==="Enter")login()});

    state.client.auth.getSession().then(({data})=>{if(data.session&&!state.user)handleSession(data.session);else if(!data.session)showLogin()});
    state.client.auth.onAuthStateChange((event,session)=>{
      // Never await Supabase calls inside this callback (deadlock risk): defer with setTimeout.
      if(event==="SIGNED_OUT"){setTimeout(showLogin,0);return}
      if(session&&(event==="SIGNED_IN"||event==="INITIAL_SESSION")&&!state.user)setTimeout(()=>handleSession(session),0);
    });
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
    if(error){$("loginMessage").textContent="بررسی دسترسی مدیر انجام نشد (مشکل شبکه یا جدول admin_users). دوباره امتحان کن: "+error.message;showLogin();return}
    if(!data){$("loginMessage").textContent="این حساب دسترسی مدیر ندارد. با حساب مدیر وارد شو.";showLogin();return}
    $("loginPanel").classList.add("hidden");$("dashboard").classList.remove("hidden");$("logoutBtn").classList.remove("hidden");$("adminEmail").textContent=session.user.email||"مدیر";
    await loadAll();
    await initNotifications();
  }
  async function logout(){await state.client.auth.signOut();showLogin()}
  function showView(view){
    state.view=view;
    document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
    document.querySelectorAll(".view").forEach(v=>v.classList.toggle("hidden",v.id!==`view-${view}`));
    const names={overview:"نمای کلی",products:"مدیریت محصولات",sellers:"فروشندگان",categories:"مدیریت دسته‌بندی‌ها",reports:"گزارش تخلف‌ها",support:"درخواست‌های پشتیبانی",settings:"تنظیمات"};
    $("pageTitle").textContent=names[view]||"پنل مدیریت";
    document.querySelector(".sidebar").classList.remove("open");
    if(view==="products")renderProducts();if(view==="sellers")renderSellers();if(view==="categories")loadCategories();if(view==="support")renderSupport();if(view==="reports")loadReports();
  }
  async function initNotifications(){
    if(!state.user||!state.client)return;
    await loadNotifications();
    if(state.notificationChannel){try{await state.client.removeChannel(state.notificationChannel)}catch(_){}}
    state.notificationChannel=state.client.channel("roostak-admin-notifications-"+state.user.id)
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"admin_notifications"},async(payload)=>{
        const row=payload.new||{}; await loadNotifications();
        if(row.event_type==="product_pending"){await loadProducts();toast("محصول جدید برای بررسی ثبت شد.");}
        if(row.event_type==="product_report"){await loadReports();toast("گزارش تخلف جدید دریافت شد.");}
      }).subscribe();
    updatePushButton();
  }
  async function loadNotifications(){
    if(!state.client||!state.user)return;
    const {data,error}=await state.client.from("admin_notifications").select("id,event_type,title,body,entity_id,read_at,created_at").order("created_at",{ascending:false}).limit(30);
    if(error){if($("notificationList"))$("notificationList").innerHTML='<p class="empty">اعلان‌ها آماده نیستند؛ فایل supabase-admin-notifications.sql را اجرا کن.</p>';return;}
    state.notifications=data||[];renderNotifications();
  }
  function renderNotifications(){
    const unread=state.notifications.filter(n=>!n.read_at).length;
    const badge=$("notificationBadge");if(badge){badge.textContent=unread>99?"99+":String(unread);badge.classList.toggle("hidden",unread===0)}
    const root=$("notificationList");if(!root)return;
    root.innerHTML=state.notifications.length?state.notifications.map(n=>`<button type="button" class="notification-item ${n.read_at?"":"unread"}" data-notification-id="${escapeHTML(n.id)}" data-notification-type="${escapeHTML(n.event_type)}" data-notification-entity="${escapeHTML(n.entity_id||"")}"><b>${escapeHTML(n.title||"اعلان روستاک")}</b><span>${escapeHTML(n.body||"")}</span><small>${escapeHTML(new Date(n.created_at).toLocaleString("fa-IR"))}</small></button>`).join(""):'<p class="empty">اعلان جدیدی نداری 🌿</p>';
  }
  async function markNotificationsRead(){
    const unread=state.notifications.filter(n=>!n.read_at).map(n=>n.id);if(!unread.length)return;
    const {error}=await state.client.from("admin_notifications").update({read_at:new Date().toISOString()}).in("id",unread);
    if(error){toast("به‌روزرسانی اعلان‌ها انجام نشد.");return;}await loadNotifications();
  }
  async function openNotification(e){
    const b=e.target.closest("[data-notification-id]");if(!b)return;
    const n=state.notifications.find(x=>String(x.id)===b.dataset.notificationId);
    if(n&&!n.read_at){await state.client.from("admin_notifications").update({read_at:new Date().toISOString()}).eq("id",n.id);}
    $("notificationPanel")?.classList.add("hidden");
    if(b.dataset.notificationType==="product_report")showView("reports");else showView("products");
    if(b.dataset.notificationEntity&&b.dataset.notificationType!=="product_report")openProduct(b.dataset.notificationEntity);
    await loadNotifications();
  }
  function urlBase64ToUint8Array(base64String){const padding="=".repeat((4-base64String.length%4)%4);const base64=(base64String+padding).replace(/-/g,"+").replace(/_/g,"/");const raw=atob(base64);return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)));}
  async function updatePushButton(){
    const btn=$("pushEnableBtn");if(!btn)return;
    if(!("serviceWorker" in navigator)||!("PushManager" in window)||!("Notification" in window)){btn.textContent="Push پشتیبانی نمی‌شود";btn.disabled=true;return;}
    if(VAPID_PUBLIC_KEY.startsWith("REPLACE_")){btn.textContent="تنظیم اعلان پوش";btn.title="ابتدا کلید عمومی VAPID را در admin.js تنظیم کن";return;}
    try{const reg=await navigator.serviceWorker.ready;const sub=await reg.pushManager.getSubscription();btn.textContent=sub?"اعلان روی این دستگاه فعال است":"فعال‌سازی اعلان";}catch(_){btn.textContent="فعال‌سازی اعلان";}
  }
  async function enablePushNotifications(){
    if(VAPID_PUBLIC_KEY.startsWith("REPLACE_")){toast("برای فعال‌سازی Push، کلید عمومی VAPID را طبق راهنمای فایل ZIP تنظیم کن.");return;}
    if(!state.user||!state.client)return;
    if(!window.isSecureContext){toast("اعلان پوش فقط روی HTTPS کار می‌کند.");return;}
    try{
      const permission=await Notification.requestPermission();if(permission!=="granted"){toast("مجوز اعلان داده نشد.");return;}
      const reg=await navigator.serviceWorker.ready;
      let sub=await reg.pushManager.getSubscription();if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(VAPID_PUBLIC_KEY)});
      const {error}=await state.client.from("push_subscriptions").upsert({admin_user_id:state.user.id,endpoint:sub.endpoint,subscription:sub.toJSON()},{onConflict:"endpoint"});
      if(error)throw error;toast("اعلان روی این دستگاه فعال شد.");await updatePushButton();
    }catch(e){console.error(e);toast("فعال‌سازی اعلان انجام نشد؛ تنظیمات Push و جدول دیتابیس را بررسی کن.");}
  }
  async function loadAll(){if(!state.user)return;await Promise.all([loadProducts(),loadProfiles(),loadCategories()]);await loadSupport();await loadReports();renderOverview()}
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
  async function loadReports(){
    if(!state.user)return;
    const {data,error}=await state.client.from("product_reports").select("id,product_id,reporter_id,reason,status,created_at,products(name,category)").order("created_at",{ascending:false}).limit(300);
    if(error){$("reportsList").innerHTML=`<div class="empty">گزارش‌ها در دسترس نیستند؛ فایل supabase-roostak-enhancements.sql را اجرا کن. ${escapeHTML(error.message)}</div>`;return;}
    state.reports=data||[];$("reportsBadge").textContent=state.reports.filter(r=>r.status==="pending").length;
    $("reportsList").innerHTML=state.reports.length?state.reports.map(r=>`<article class="support-row"><div class="support-info"><b>${escapeHTML(r.products?.name||"محصول حذف‌شده")}</b><small>${escapeHTML(r.products?.category||"")} · ${escapeHTML(r.status||"pending")} · ${escapeHTML(r.created_at||"")}</small><p>${escapeHTML(r.reason)}</p></div><div class="row-actions"><button class="secondary" data-report-status="reviewed" data-report-id="${escapeHTML(r.id)}">بررسی شد</button><button class="secondary" data-report-status="dismissed" data-report-id="${escapeHTML(r.id)}">رد گزارش</button><button class="primary" data-open-product="${escapeHTML(r.product_id)}">مشاهده محصول</button></div></article>`).join(""):`<div class="empty">گزارشی ثبت نشده است.</div>`;
    $("reportsList").querySelectorAll("[data-report-status]").forEach(b=>b.addEventListener("click",async()=>{const {error}=await state.client.from("product_reports").update({status:b.dataset.reportStatus}).eq("id",b.dataset.reportId);if(error){toast("ذخیره وضعیت انجام نشد: "+error.message);return;}toast("وضعیت گزارش ذخیره شد.");await loadReports();}));
    $("reportsList").querySelectorAll("[data-open-product]").forEach(b=>b.addEventListener("click",()=>openProduct(b.dataset.openProduct)));
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
    let rejection_reason=null;
    if(status==="rejected"){rejection_reason=prompt("دلیل رد محصول را برای فروشنده بنویس:");if(rejection_reason===null)return;if(!rejection_reason.trim()){toast("برای رد محصول باید دلیل بنویسی.");return;}rejection_reason=rejection_reason.trim().slice(0,1000);}
    const payload=status==="rejected"?{status,rejection_reason}:{status,rejection_reason:null};
    const {error}=await state.client.from("products").update(payload).eq("id",id);
    if(error){toast("تغییر انجام نشد: "+error.message);return}
    toast(status==="approved"?"محصول تأیید شد":"محصول رد شد و دلیل برای فروشنده ذخیره شد");await loadProducts();
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
    if(!userId){toast("شناسهٔ کاربر پیدا نشد.");return}
    const password=prompt(`رمز جدید برای «${name}» را وارد کن (حداقل ۸ نویسه):`);if(password===null)return;
    if(password.length<8){toast("رمز باید حداقل ۸ نویسه داشته باشد.");return}
    // Make sure the session token is fresh before calling the Edge Function.
    const {data:sess}=await state.client.auth.getSession();
    if(!sess.session){toast("نشست منقضی شده؛ دوباره وارد شو.");showLogin();return}
    const {data,error}=await state.client.functions.invoke("admin-reset-password",{body:{userId,password}});
    if(error){
      let detail="";
      try{const ctx=error.context;if(ctx&&typeof ctx.json==="function"){const j=await ctx.json();detail=j?.error||""}else if(ctx&&typeof ctx.text==="function"){detail=await ctx.text()}}catch(_){}
      const status=error.context?.status;
      let hint="";
      if(status===404||/not\s*found|Failed to send|FunctionsFetchError/i.test(error.message+detail))hint=" (تابع admin-reset-password روی Supabase دیپلوی نشده است)";
      else if(status===403)hint=" (این حساب در جدول admin_users نیست)";
      else if(status===401)hint=" (نشست نامعتبر؛ خروج و ورود دوباره)";
      toast("تغییر رمز انجام نشد"+hint+(detail?": "+detail:""));console.error(error,detail);return}
    if(data?.error){toast("تغییر رمز انجام نشد: "+data.error);return}
    toast("رمز حساب با موفقیت تغییر کرد.");
  }
  function supportResetTarget(s){
    if(s.user_id)return s.user_id;
    const uname=(s.username||"").trim().toLowerCase();
    const p=state.profiles.find(x=>(x.username||"").toLowerCase()===uname);
    return p?(p.user_id||p.id):"";
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
    renderCategoriesList();
    renderProducts();
  }
  function syncCategoryViews(){
    CATEGORIES=state.categories.filter(c=>c.is_active).map(c=>c.name);
    if($("settingsCategories"))$("settingsCategories").innerHTML=CATEGORIES.map(c=>`<span>${escapeHTML(c)}</span>`).join("");
  }
  function renderCategoriesList(){
    const list=state.categories,last=list.length-1;
    $("categoriesList").innerHTML=list.length?list.map((c,i)=>`<div class="category-admin-row" draggable="true" data-cat-id="${escapeHTML(c.id)}"><div class="cat-main"><span class="drag-handle" title="برای جابه‌جایی بکشید" aria-hidden="true">⠿</span><div><b>${escapeHTML(c.name)}</b><small>${c.is_active?"فعال":"غیرفعال"}</small></div></div><div class="category-actions"><button class="secondary move-btn" data-move-category="${escapeHTML(c.id)}" data-dir="-1" aria-label="انتقال به بالا" ${i===0?"disabled":""}>▲</button><button class="secondary move-btn" data-move-category="${escapeHTML(c.id)}" data-dir="1" aria-label="انتقال به پایین" ${i===last?"disabled":""}>▼</button><button class="secondary" data-edit-category="${escapeHTML(c.id)}">ویرایش</button><button class="secondary" data-delete-category="${escapeHTML(c.id)}">حذف</button></div></div>`).join(""):`<div class="empty">هنوز دسته‌ای ثبت نشده است.</div>`;
  }
  let savingOrder=false;
  async function saveCategoryOrder(newList){
    if(savingOrder)return;
    savingOrder=true;
    const old=state.categories;
    state.categories=newList;renderCategoriesList();syncCategoryViews();
    try{
      const changed=newList.map((c,i)=>({c,i})).filter(({c,i})=>c.sort_order!==i);
      const results=await Promise.all(changed.map(({c,i})=>state.client.from("roostak_categories").update({sort_order:i}).eq("id",c.id)));
      const bad=results.find(r=>r.error);
      if(bad)throw bad.error;
      newList.forEach((c,i)=>{c.sort_order=i});
      toast("ترتیب دسته‌ها ذخیره شد.");
    }catch(err){
      state.categories=old;renderCategoriesList();syncCategoryViews();
      toast("ذخیرهٔ ترتیب انجام نشد: "+(err?.message||err));
    }finally{savingOrder=false}
  }
  function moveCategory(id,dir){
    const list=[...state.categories],i=list.findIndex(c=>String(c.id)===String(id)),j=i+dir;
    if(i<0||j<0||j>=list.length)return;
    [list[i],list[j]]=[list[j],list[i]];
    saveCategoryOrder(list);
  }
  let dragCatId=null;
  function bindCategoryReorder(){
    const box=$("categoriesList");
    box.addEventListener("click",e=>{const b=e.target.closest("[data-move-category]");if(b&&!b.disabled)moveCategory(b.dataset.moveCategory,Number(b.dataset.dir))});
    box.addEventListener("dragstart",e=>{const row=e.target.closest?.(".category-admin-row");if(!row)return;dragCatId=row.dataset.catId;row.classList.add("dragging");if(e.dataTransfer){e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("text/plain",dragCatId)}});
    box.addEventListener("dragover",e=>{if(!dragCatId)return;e.preventDefault();const row=e.target.closest(".category-admin-row");box.querySelectorAll(".drag-over").forEach(r=>r.classList.remove("drag-over"));if(row&&row.dataset.catId!==dragCatId)row.classList.add("drag-over")});
    box.addEventListener("dragend",()=>{dragCatId=null;box.querySelectorAll(".dragging,.drag-over").forEach(r=>r.classList.remove("dragging","drag-over"))});
    box.addEventListener("drop",e=>{
      if(!dragCatId)return;e.preventDefault();
      const row=e.target.closest(".category-admin-row"),from=dragCatId;dragCatId=null;
      box.querySelectorAll(".dragging,.drag-over").forEach(r=>r.classList.remove("dragging","drag-over"));
      if(!row||row.dataset.catId===from)return;
      const list=[...state.categories],i=list.findIndex(c=>String(c.id)===String(from)),j=list.findIndex(c=>String(c.id)===String(row.dataset.catId));
      if(i<0||j<0)return;
      const [moved]=list.splice(i,1);list.splice(j,0,moved);
      saveCategoryOrder(list);
    });
  }
  async function addCategory(e){e.preventDefault();const name=$("categoryName").value.trim();if(!name)return;if(state.categories.some(c=>c.name.toLocaleLowerCase("fa")===name.toLocaleLowerCase("fa"))){toast("این دسته قبلاً ثبت شده است.");return}const {error}=await state.client.from("roostak_categories").insert({name,is_active:true,sort_order:state.categories.length});if(error){toast("افزودن دسته انجام نشد: "+error.message);return}$("categoryName").value="";toast("دسته‌بندی اضافه شد.");await loadCategories();}
  async function handleCategoryAction(e){const edit=e.target.closest("[data-edit-category]");const del=e.target.closest("[data-delete-category]");if(edit){const cat=state.categories.find(c=>String(c.id)===edit.dataset.editCategory);if(!cat)return;const name=prompt("نام جدید دسته‌بندی:",cat.name);if(name===null)return;const clean=name.trim();if(!clean){toast("نام دسته خالی است.");return}const {error}=await state.client.from("roostak_categories").update({name:clean}).eq("id",cat.id);if(error){toast("ویرایش انجام نشد: "+error.message);return}toast("دسته‌بندی ویرایش شد.");await loadCategories();}if(del){const cat=state.categories.find(c=>String(c.id)===del.dataset.deleteCategory);if(!cat)return;const {count,error:countError}=await state.client.from("products").select("id",{count:"exact",head:true}).eq("category",cat.name);if(countError){toast("بررسی محصولات این دسته ممکن نشد: "+countError.message);return}if(count>0){const ok=confirm(`این دسته ${count} محصول دارد. حذف دسته باعث می‌شود محصولات فعلی بدون دستهٔ فعال بمانند. ابتدا دستهٔ محصولات را تغییر بده یا حذف را لغو کن.`);if(!ok)return;toast("برای جلوگیری از خراب‌شدن دستهٔ محصولات، ابتدا محصولات این دسته را به دستهٔ دیگری منتقل کن.");return}if(!confirm(`دستهٔ «${cat.name}» حذف شود؟`))return;const {error}=await state.client.from("roostak_categories").delete().eq("id",cat.id);if(error){toast("حذف انجام نشد: "+error.message);return}toast("دسته حذف شد.");await loadCategories();}}
  function renderSupport(){
    $("supportList").innerHTML=state.support.length?state.support.map(s=>`<article class="support-row"><div class="support-info"><b>${escapeHTML(s.subject||s.type||"درخواست پشتیبانی")}</b><small>${escapeHTML(s.username||s.user_id||"کاربر")} · ${escapeHTML(s.status||"ثبت‌شده")}</small><p>${escapeHTML(s.message||s.description||"بدون توضیح")}</p><small>${escapeHTML(s.created_at||"")}</small></div><div class="row-actions"><button class="primary" data-support-reset="${escapeHTML(supportResetTarget(s))}" data-reset-name="${escapeHTML(s.username||"کاربر")}">تنظیم رمز جدید</button><button class="secondary" data-support-done="${escapeHTML(s.id)}">بستن درخواست</button></div></article>`).join(""):`<div class="empty">درخواستی ثبت نشده یا جدول در دسترس نیست.</div>`;
    $("supportList").querySelectorAll("[data-support-reset]").forEach(b=>b.addEventListener("click",()=>resetSellerPassword(b.dataset.supportReset,b.dataset.resetName)));
    $("supportList").querySelectorAll("[data-support-done]").forEach(b=>b.addEventListener("click",()=>closeSupport(b.dataset.supportDone)));
  }
  async function closeSupport(id){
    const s=state.support.find(x=>String(x.id)===String(id));if(!s)return;
    const {error}=await state.client.from("support_requests").update({status:"closed"}).eq("id",id);
    if(error){toast("تغییر وضعیت درخواست انجام نشد: "+error.message);return}
    toast("درخواست بسته شد");await loadSupport();
  }
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&state.user){loadProducts();loadReports();}});
  window.setInterval(()=>{if(document.visibilityState==="visible"&&state.user){loadProducts();loadReports();}},60000);
  document.addEventListener("DOMContentLoaded",init);
})();