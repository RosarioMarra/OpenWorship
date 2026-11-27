// =====================================================================
// OPEN WORSHIP - Funzione "notifica-richiesta" (Supabase Edge Function)
// Chiamata dal database (trigger su public.membri) quando qualcuno entra
// per la prima volta e chiede l'accesso: avvisa con una notifica push
// tutti gli amministratori che hanno attivato le notifiche.
//
// Non si fida della richiesta: rilegge il membro dal database e notifica
// solo richieste vere, in attesa, recenti e non ancora notificate.
// Così anche chiamandola di proposito non si possono mandare notifiche
// finte né ripeterle.
//
// Secrets usati (già presenti per le notifiche degli avvisi):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sono già disponibili.
// =====================================================================
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  // Il trigger manda: { type: "INSERT", table: "membri", record: { user_id, ... } }
  let payload: { type?: string; table?: string; record?: { user_id?: string } };
  try {
    payload = await req.json();
  } catch {
    return json({ errore: "Richiesta non valida" }, 400);
  }
  const userId = payload.record?.user_id;
  if (payload.table !== "membri" || payload.type !== "INSERT" || !userId) {
    return json({ ignorato: true });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Si "prenota" la notifica: riesce una volta sola, e solo per richieste
  // in attesa arrivate negli ultimi 10 minuti
  const dieciMinutiFa = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: righe, error } = await supabase
    .from("membri")
    .update({ notificato_il: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("stato", "in_attesa")
    .is("notificato_il", null)
    .gte("richiesto_il", dieciMinutiFa)
    .select("nome, email");
  if (error) return json({ errore: error.message }, 500);
  if (!righe || !righe.length) return json({ ignorato: true, motivo: "richiesta non valida o già notificata" });
  const membro = righe[0];

  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const subject = Deno.env.get("VAPID_SUBJECT") ?? "https://rosariomarra.github.io/OpenWorship/";
  if (!publicKey || !privateKey) return json({ errore: "Chiavi VAPID mancanti nei Secrets" }, 500);
  webpush.setVapidDetails(subject, publicKey, privateKey);

  // Solo i dispositivi degli amministratori
  const { data: subs, error: subsErr } = await supabase.rpc("push_amministratori");
  if (subsErr) return json({ errore: subsErr.message }, 500);

  const chi = String(membro.nome || membro.email || "Una persona");
  const message = JSON.stringify({
    title: "Nuova richiesta di accesso",
    body: `${chi} vuole entrare in Open Worship. Tocca per approvare o rifiutare.`,
    tipo: "richiesta",
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

  // Dispositivi non più validi: si eliminano
  const scaduti: string[] = [];
  results.forEach((r, i) => {
    const code = r.status === "rejected" ? (r.reason as { statusCode?: number })?.statusCode : undefined;
    if (code === 404 || code === 410) scaduti.push((subs as { id: string }[])[i].id);
  });
  if (scaduti.length) await supabase.from("push_subscriptions").delete().in("id", scaduti);

  return json({
    amministratori_dispositivi: subs?.length ?? 0,
    inviate: results.filter((r) => r.status === "fulfilled").length,
    rimossi: scaduti.length,
  });
});
