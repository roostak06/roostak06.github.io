import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json" },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const subject = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@roostak06.github.io";
  if (!supabaseUrl || !anonKey || !serviceKey || !publicKey || !privateKey) {
    return json({ error: "Push secrets are not configured" }, 500);
  }

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Authentication required" }, 401);
  const caller = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
  const { data: authData, error: authError } = await caller.auth.getUser();
  const senderId = authData.user?.id;
  if (authError || !senderId) return json({ error: "Invalid session" }, 401);

  let input: { conversationId?: string; messageId?: string };
  try { input = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  if (!input.conversationId || !input.messageId) return json({ error: "conversationId and messageId required" }, 400);

  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: message, error: messageError } = await db.from("roostak_messages")
    .select("id,conversation_id,sender_id,body,created_at")
    .eq("id", input.messageId).eq("conversation_id", input.conversationId).maybeSingle();
  if (messageError || !message) return json({ error: "Message not found" }, 404);
  if (message.sender_id !== senderId) return json({ error: "Message sender mismatch" }, 403);

  const { data: conversation, error: conversationError } = await db.from("roostak_conversations")
    .select("id,buyer_id,seller_id,product_id")
    .eq("id", input.conversationId).maybeSingle();
  if (conversationError || !conversation) return json({ error: "Conversation not found" }, 404);
  if (senderId !== conversation.buyer_id && senderId !== conversation.seller_id) return json({ error: "Not a participant" }, 403);
  const recipientId = senderId === conversation.buyer_id ? conversation.seller_id : conversation.buyer_id;

  const { data: product } = await db.from("products").select("name").eq("id", conversation.product_id).maybeSingle();
  const { data: subscriptions, error: subscriptionError } = await db.from("roostak_push_subscriptions")
    .select("endpoint,subscription").eq("user_id", recipientId);
  if (subscriptionError) return json({ error: "Could not load recipient subscriptions" }, 500);

  webpush.setVapidDetails(subject, publicKey, privateKey);
  const payload = JSON.stringify({
    title: `پیام جدید از چت: ${product?.name || "محصول"}`,
    body: message.body,
    url: "./index.html",
    conversationId: conversation.id,
    tag: `roostak-chat-${conversation.id}`,
  });
  let sent = 0;
  const expired: string[] = [];
  for (const row of subscriptions || []) {
    try { await webpush.sendNotification(row.subscription, payload); sent++; }
    catch (err) {
      const status = (err as { statusCode?: number })?.statusCode;
      if (status === 404 || status === 410) expired.push(row.endpoint);
      else console.error("Push delivery failed", status, (err as Error)?.message);
    }
  }
  if (expired.length) await db.from("roostak_push_subscriptions").delete().in("endpoint", expired);
  return json({ ok: true, sent, expired: expired.length });
});
