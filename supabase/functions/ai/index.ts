// Función "ai": recibe la conversación del programa, comprueba que el usuario ha iniciado sesión,
// cuenta su consumo diario y se la pasa a Claude con la clave guardada en el servidor.
// Secretos necesarios (Supabase > Edge Functions > Secrets):
//   ANTHROPIC_API_KEY  tu clave de https://console.anthropic.com
//   AI_MODEL           opcional, por defecto claude-sonnet-5-5
//   AI_DAILY_LIMIT     opcional, consultas de IA por usuario y día (por defecto 150)
//   TRIAL_DAYS         opcional, días de prueba gratis (por defecto 14); pon BILLING_OFF=1 para no exigir pago
import { createClient } from "npm:@supabase/supabase-js@2.117.3";

// ---- plan ----
// Reglas del plan: prueba gratis desde el alta y después suscripción activa en Stripe.
// TRIAL_DAYS (secreto opcional) = días de prueba, por defecto 14.

export const ACTIVE = ["active", "trialing", "past_due"];

export async function planOf(admin: any, user: any) {
  const trialDays = Number(Deno.env.get("TRIAL_DAYS") ?? "14");
  const trialEnd = new Date(new Date(user.created_at).getTime() + trialDays * 86400000);
  const { data: sub } = await admin.from("subscriptions").select("*").eq("user_id", user.id).maybeSingle();
  const paid = !!sub && ACTIVE.includes(sub.status ?? "");
  return { paid, trial: !paid && trialEnd > new Date(), trialEnd: trialEnd.toISOString(), sub };
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const fail = (code: string, message: string, status: number) => json({ error: { code, message } }, status);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return fail("method", "Usa POST", 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return fail("config", "Falta ANTHROPIC_API_KEY en los secretos de la función", 500);

  const userClient = createClient(url, anon, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return fail("unauthorized", "Inicia sesión para usar la IA", 401);

  const limit = Number(Deno.env.get("AI_DAILY_LIMIT") ?? "150");
  const admin = createClient(url, service);
  const { data: au } = await admin.from("app_users").select("blocked,code").eq("user_id", user.id).maybeSingle();
  if (au && au.blocked) return fail("blocked", "Tu cuenta está pausada. Habla con quien te dio el código de acceso.", 403);
  if (au && !au.code) {
    const { data: adm } = await admin.from("app_admins").select("user_id").eq("user_id", user.id).maybeSingle();
    if (!adm) return fail("code", "Pon tu código de acceso para usar el programa.", 403);
  }
  if (Deno.env.get("BILLING_OFF") !== "1") {
    const plan = await planOf(admin, user);
    if (!plan.paid && !plan.trial) return fail("subscription", "Tu prueba gratis ha terminado. Suscríbete para seguir usando la IA (tus datos siguen guardados).", 402);
  }
  const { data: allowed, error: usageErr } = await admin.rpc("bump_ai_usage", { p_user: user.id, p_limit: limit });
  if (usageErr) return fail("usage", "No se pudo comprobar tu consumo de IA", 500);
  if (!allowed) return fail("rate_limited", "Has llegado al límite de IA de hoy. Mañana se renueva.", 429);

  let body: { messages?: unknown[]; tools?: unknown[]; system?: string; max_tokens?: number };
  try { body = await req.json(); } catch { return fail("bad_request", "Petición no válida", 400); }
  if (!Array.isArray(body.messages) || !body.messages.length) return fail("bad_request", "Faltan mensajes", 400);

  const payload: Record<string, unknown> = {
    model: Deno.env.get("AI_MODEL") ?? "claude-sonnet-5-5",
    max_tokens: Math.min(Number(body.max_tokens) || 2048, 8192),
    messages: body.messages,
  };
  if (body.system) payload.system = body.system;
  if (Array.isArray(body.tools) && body.tools.length) payload.tools = body.tools;

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const out = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = (out as { error?: { message?: string } })?.error?.message ?? "La IA no ha respondido";
    return fail(r.status === 429 || r.status === 529 ? "rate_limited" : "ai_error", msg, r.status === 429 || r.status === 529 ? 429 : 502);
  }
  return json(out);
});
