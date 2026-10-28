import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader = req.headers.get("Authorization");
  if (!url || !serviceKey || !authHeader) return json({ error: "Server configuration or authentication missing" }, 401);

  const adminClient = createClient(url, serviceKey, { auth: { persistSession: false } });
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const { data: { user: caller }, error: authError } = await adminClient.auth.getUser(token);
  if (authError || !caller) return json({ error: "Unauthorized" }, 401);
  const { data: adminRow, error: adminError } = await adminClient.from("admin_users").select("user_id").eq("user_id", caller.id).maybeSingle();
  if (adminError || !adminRow) return json({ error: "Admin access required" }, 403);

  let body: { userId?: string; password?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const userId = body.userId?.trim();
  const password = body.password || "";
  if (!userId || password.length < 8 || password.length > 128) return json({ error: "User ID and a password of 8–128 characters are required" }, 400);
  const { error } = await adminClient.auth.admin.updateUserById(userId, { password });
  if (error) return json({ error: "Password update failed" }, 400);
  return json({ ok: true });
});
