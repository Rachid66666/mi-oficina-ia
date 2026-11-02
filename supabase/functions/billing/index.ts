// Función "billing": estado del plan, abrir el pago de la suscripción y abrir el portal de cliente.
// Secretos: STRIPE_SECRET_KEY, STRIPE_PRICE_ID (el precio mensual creado en Stripe), TRIAL_DAYS opcional.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

// ---- stripe ----
// Llamadas a la API de Stripe sin librerías (formulario codificado).
export async function stripe(path: string, params: Record<string, string> = {}, method = "POST") {
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key) throw new Error("Falta STRIPE_SECRET_KEY en los secretos");
  const body = new URLSearchParams(params).toString();
  const r = await fetch("https://api.stripe.com/v1/" + path + (method === "GET" && body ? "?" + body : ""), {
    method,
    headers: { Authorization: "Bearer " + key, "Content-Type": "application/x-www-form-urlencoded" },
    body: method === "GET" ? undefined : body,
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error?.message ?? "Error de Stripe");
  return j;
}

// Comprueba la firma "Stripe-Signature" (t=...,v1=...) con el secreto del webhook.
export async function verifyStripeSignature(raw: string, header: string, secret: string, toleranceSec = 300) {
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=", 2) as [string, string]));
  const t = parts["t"];
  const sigs = header.split(",").filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  if (!t || !sigs.length) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > toleranceSec) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${raw}`)));
  const hex = [...mac].map((b) => b.toString(16).padStart(2, "0")).join("");
  return sigs.some((s) => s.length === hex.length && [...s].reduce((d, c, i) => d | (c.charCodeAt(0) ^ hex.charCodeAt(i)), 0) === 0);
}


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
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = Deno.env.get("SUPABASE_URL")!;
  const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: { code: "unauthorized", message: "Inicia sesión" } }, 401);
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  let body: { action?: string; returnUrl?: string } = {};
  try { body = await req.json(); } catch { /* vacío */ }
  const back = body.returnUrl && /^https?:\/\//.test(body.returnUrl) ? body.returnUrl : new URL(req.url).origin;

  try {
    const plan = await planOf(admin, user);
    if (body.action === "status" || !body.action) {
      return json({ paid: plan.paid, trial: plan.trial, trialEnd: plan.trialEnd, status: plan.sub?.status ?? null, periodEnd: plan.sub?.current_period_end ?? null });
    }
    if (body.action === "checkout") {
      const price = Deno.env.get("STRIPE_PRICE_ID");
      if (!price) throw new Error("Falta STRIPE_PRICE_ID en los secretos");
      const p: Record<string, string> = {
        mode: "subscription",
        "line_items[0][price]": price,
        "line_items[0][quantity]": "1",
        success_url: back + (back.includes("?") ? "&" : "?") + "pago=ok",
        cancel_url: back,
        client_reference_id: user.id,
        "subscription_data[metadata][user_id]": user.id,
        allow_promotion_codes: "true",
        locale: "auto",
      };
      if (plan.sub?.stripe_customer_id) p.customer = plan.sub.stripe_customer_id;
      else if (user.email) p.customer_email = user.email;
      const s = await stripe("checkout/sessions", p);
      return json({ url: s.url });
    }
    if (body.action === "portal") {
      if (!plan.sub?.stripe_customer_id) return json({ error: { code: "no_customer", message: "Todavía no tienes una suscripción" } }, 400);
      const s = await stripe("billing_portal/sessions", { customer: plan.sub.stripe_customer_id, return_url: back });
      return json({ url: s.url });
    }
    return json({ error: { code: "bad_request", message: "Acción desconocida" } }, 400);
  } catch (e) {
    return json({ error: { code: "billing", message: (e as Error).message } }, 500);
  }
});
