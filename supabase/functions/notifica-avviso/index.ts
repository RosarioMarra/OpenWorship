// =====================================================================
// OPEN WORSHIP - Funzione "notifica-avviso" (Supabase Edge Function)
// Viene chiamata da un Database Webhook quando si inserisce un avviso
// e invia una notifica push a tutti i dispositivi registrati.
//
// Secrets richiesti (Supabase > Edge Functions > Secrets):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sono già disponibili.
// =====================================================================
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  // Il webhook manda: { type: "INSERT", table: "avvisi", record: {...} }
  let payload: { type?: string; table?: string; record?: Record<string, unknown> };
  try {
    payload = await req.json();
  } catch {
    return json({ errore: "Richiesta non valida" }, 400);
  }
  const avviso = payload.record;
  if (!avviso || payload.table !== "avvisi" || payload.type !== "INSERT") {
    return json({ ignorato: true });
  }

  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const subject = Deno.env.get("VAPID_SUBJECT") ?? "https://rosariomarra.github.io/OpenWorship/";
  if (!publicKey || !privateKey) return json({ errore: "Chiavi VAPID mancanti nei Secrets" }, 500);
  webpush.setVapidDetails(subject, publicKey, privateKey);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth");
  if (error) return json({ errore: error.message }, 500);

  const desc = String(avviso.desc ?? "");
  const message = JSON.stringify({
    title: `Nuovo avviso: ${String(avviso.title ?? "")}`,
    body: desc.length > 140 ? desc.slice(0, 140) + "…" : desc,
    avvisoId: avviso.id ?? null,
  });

  const results = await Promise.allSettled(
    (subs ?? []).map((s) =>
      webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        message,
        { TTL: 60 * 60 * 24 },
      )
    ),
  );

  // Dispositivi non più validi (app disinstallata, permesso revocato): si eliminano
  const scaduti: string[] = [];
  results.forEach((r, i) => {
    const code = r.status === "rejected" ? (r.reason as { statusCode?: number })?.statusCode : undefined;
    if (code === 404 || code === 410) scaduti.push(subs![i].id);
  });
  if (scaduti.length) await supabase.from("push_subscriptions").delete().in("id", scaduti);

  return json({
    dispositivi: subs?.length ?? 0,
    inviate: results.filter((r) => r.status === "fulfilled").length,
    rimossi: scaduti.length,
  });
});
