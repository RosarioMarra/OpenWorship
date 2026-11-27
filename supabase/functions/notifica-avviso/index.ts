// =====================================================================
// OPEN WORSHIP - Funzione "notifica-avviso" (Supabase Edge Function,
// pubblicata con il nome "hyper-responder")
// Viene chiamata da un Database Webhook quando si inserisce un avviso
// e invia una notifica push ai membri approvati e agli amministratori.
//
// Non si fida della richiesta: rilegge l'avviso dal database e lo
// notifica una volta sola (colonna avvisi.notificato_il). Così anche
// chiamandola di proposito non si possono mandare notifiche finte
// né ripetere quelle vere.
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
  // Il webhook manda: { type: "INSERT", table: "avvisi", record: { id, ... } }
  let payload: { type?: string; table?: string; record?: { id?: unknown } };
  try {
    payload = await req.json();
  } catch {
    return json({ errore: "Richiesta non valida" }, 400);
  }
  const avvisoId = payload.record?.id;
  if (!avvisoId || payload.table !== "avvisi" || payload.type !== "INSERT") {
    return json({ ignorato: true });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Si "prenota" la notifica: riesce una volta sola, e solo per avvisi che esistono davvero.
  // Titolo e testo arrivano dal database, non dalla richiesta.
  const { data: righe, error } = await supabase
    .from("avvisi")
    .update({ notificato_il: new Date().toISOString() })
    .eq("id", String(avvisoId))
    .is("notificato_il", null)
    .select("*");
  if (error) return json({ errore: error.message }, 500);
  if (!righe || !righe.length) return json({ ignorato: true, motivo: "avviso inesistente o già notificato" });
  const avviso = righe[0];

  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const subject = Deno.env.get("VAPID_SUBJECT") ?? "https://rosariomarra.github.io/OpenWorship/";
  if (!publicKey || !privateKey) return json({ errore: "Chiavi VAPID mancanti nei Secrets" }, 500);
  webpush.setVapidDetails(subject, publicKey, privateKey);

  // Solo i dispositivi dei membri approvati e degli amministratori
  const { data: subs, error: subsErr } = await supabase.rpc("push_membri");
  if (subsErr) return json({ errore: subsErr.message }, 500);

  const desc = String(avviso.desc ?? "");
  const message = JSON.stringify({
    title: `Nuovo avviso: ${String(avviso.title ?? "")}`,
    body: desc.length > 140 ? desc.slice(0, 140) + "…" : desc,
    avvisoId: avviso.id ?? null,
  });

  const results = await Promise.allSettled(
    (subs ?? []).map((s: { endpoint: string; p256dh: string; auth: string }) =>
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
    if (code === 404 || code === 410) scaduti.push((subs as { id: string }[])[i].id);
  });
  if (scaduti.length) await supabase.from("push_subscriptions").delete().in("id", scaduti);

  return json({
    dispositivi: subs?.length ?? 0,
    inviate: results.filter((r) => r.status === "fulfilled").length,
    rimossi: scaduti.length,
  });
});
