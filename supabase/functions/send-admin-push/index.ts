import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json" },
});

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST required" }, 405);
  const webhookSecret = Deno.env.get("PUSH_WEBHOOK_SECRET");
  const suppliedSecret = req.headers.get("x-roostak-push-secret");
  if (!webhookSecret || !suppliedSecret || suppliedSecret !== webhookSecret) return json({ error: "Unauthorized" }, 401);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const subject = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@roostak06.github.io";
  if (!url || !serviceKey || !publicKey || !privateKey) return json({ error: "Push secrets are not configured" }, 500);

  let payload: any;
  try { payload = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const record = payload?.record;
  if (payload?.type !== "INSERT" || payload?.table !== "admin_notifications" || !record?.event_type) {
    return json({ ok: true, skipped: true });
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  const db = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: rows, error } = await db.from("push_subscriptions").select("id,subscription");
  if (error) return json({ error: "Could not load push subscriptions" }, 500);

  const message = JSON.stringify({
    title: record.title || "اعلان جدید روستاک",
    body: record.body || "یک مورد جدید برای بررسی وجود دارد.",
    url: "./admin.html",
    tag: `roostak-${record.id || Date.now()}`,
  });
  let sent = 0;
  const expired: string[] = [];
  for (const row of rows || []) {
    try { await webpush.sendNotification(row.subscription, message); sent++; }
    catch (err) {
      const status = (err as { statusCode?: number })?.statusCode;
      if (status === 404 || status === 410) expired.push(row.id);
    }
  }
  if (expired.length) await db.from("push_subscriptions").delete().in("id", expired);
  return json({ ok: true, sent, expired: expired.length });
});
