// Función "stripe-webhook": Stripe avisa aquí de pagos, renovaciones y bajas.
// Despliégala SIN verificación JWT (Stripe no inicia sesión). Secretos: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET.
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


Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");
  const raw = await req.text();
  const ok = await verifyStripeSignature(raw, req.headers.get("stripe-signature") ?? "", Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "");
  if (!ok) return new Response("firma no válida", { status: 400 });
  const ev = JSON.parse(raw);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const save = async (sub: any, userId?: string) => {
    const uid = userId || sub.metadata?.user_id;
    const end = sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end;
    const row = {
      stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer?.id,
      stripe_subscription_id: sub.id,
      status: sub.status,
      current_period_end: end ? new Date(end * 1000).toISOString() : null,
      updated_at: new Date().toISOString(),
    };
    if (uid) await admin.from("subscriptions").upsert({ user_id: uid, ...row });
    else await admin.from("subscriptions").update(row).eq("stripe_customer_id", row.stripe_customer_id);
  };

  try {
    const o = ev.data?.object ?? {};
    if (ev.type === "checkout.session.completed" && o.mode === "subscription" && o.subscription) {
      await save(await stripe("subscriptions/" + o.subscription, {}, "GET"), o.client_reference_id);
    } else if (ev.type?.startsWith("customer.subscription.")) {
      await save(o);
    }
  } catch (e) {
    console.error(e);
    return new Response("error", { status: 500 }); // Stripe lo reintentará
  }
  return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
});
