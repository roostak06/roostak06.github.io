import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  },
});

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!url || !serviceKey || !token) return json({ error: "Server configuration or authentication missing" }, 401);

  const adminClient = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: { user: caller }, error: authError } = await adminClient.auth.getUser(token);
  if (authError || !caller) return json({ error: "Unauthorized" }, 401);
  const { data: adminRow, error: adminError } = await adminClient.from("admin_users").select("user_id").eq("user_id", caller.id).maybeSingle();
  if (adminError || !adminRow) return json({ error: "Admin access required" }, 403);

  let body: { userId?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const userId = body.userId?.trim() || "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId) || userId === caller.id) return json({ error: "Invalid userId" }, 400);

  // Preserve auth.users and all FK-linked data; block future sign-in instead of hard deletion.
  const { error } = await adminClient.auth.admin.updateUserById(userId, { ban_duration: "876000h" });
  if (error) return json({ error: "Account archived, but sign-in ban failed" }, 400);
  return json({ success: true });
});
