/**
 * Edge Function — segnala-problema.
 *
 * Turns a problem report written inside the app into a formatted email.
 *
 * Reports used to go to Sentry and nowhere else, which is the wrong shape for
 * this particular message: a crash is telemetry, but a person writing "ho
 * allegato una foto e non è stata caricata" is writing to someone. Sentry is
 * where you go looking; email is where something reaches you. So the report
 * now lands in an inbox, formatted, with the context the app already knew —
 * the account, the last error shown, the platform, the version — laid out
 * instead of buried in a JSON blob.
 *
 * The recipient and the API key live here rather than in the app: an address
 * shipped inside a mobile binary is an address anyone who unzips the APK can
 * spam, and a Resend key shipped inside one is a key anyone can send mail
 * with. The client only says what happened; where it goes is decided here.
 *
 * Deploy:
 *   supabase secrets set RESEND_API_KEY=re_...
 *   supabase functions deploy segnala-problema
 *
 * Optional secrets:
 *   SEGNALAZIONI_A         destinatario (default: nikita.piraino3@gmail.com)
 *   SEGNALAZIONI_MITTENTE  mittente verificato su Resend
 *                          (default: onboarding@resend.dev, che Resend accetta
 *                          senza dominio verificato ma consegna solo
 *                          all'indirizzo del proprietario dell'account)
 */

const DESTINATARIO = Deno.env.get("SEGNALAZIONI_A") ?? "nikita.piraino3@gmail.com";
const MITTENTE =
  Deno.env.get("SEGNALAZIONI_MITTENTE") ?? "TurboRipassi <onboarding@resend.dev>";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

/** Longest report accepted, so one client cannot post a novel. */
const MAX_DESCRIZIONE = 4000;
const MAX_CAMPO = 500;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * Everything that reaches the template goes through here first: the body is
 * written by whoever is holding the phone, and it is about to be interpolated
 * into HTML.
 */
function escapeHtml(v: unknown, max = MAX_CAMPO): string {
  return String(v ?? "")
    .slice(0, max)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface Segnalazione {
  descrizione?: unknown;
  email?: unknown;
  ultimoErrore?: unknown;
  piattaforma?: unknown;
  versioneApp?: unknown;
}

function riga(etichetta: string, valore: string): string {
  return `
    <tr>
      <td style="padding:8px 14px;border-bottom:1px solid #e7e5e4;color:#78716c;font-size:13px;white-space:nowrap;vertical-align:top;">${etichetta}</td>
      <td style="padding:8px 14px;border-bottom:1px solid #e7e5e4;color:#1c1917;font-size:13px;">${valore}</td>
    </tr>`;
}

function corpoHtml(d: Segnalazione, quando: string): string {
  const descrizione = escapeHtml(d.descrizione, MAX_DESCRIZIONE).replace(/\n/g, "<br>");
  const email = escapeHtml(d.email) || "—";
  const ultimoErrore = escapeHtml(d.ultimoErrore) || "nessuno";

  return `<!doctype html>
<html lang="it">
  <body style="margin:0;padding:24px;background:#faf9f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e7e5e4;border-radius:12px;border-collapse:separate;overflow:hidden;">
      <tr>
        <td style="padding:20px 22px;background:#1c1917;">
          <div style="color:#a8a29e;font-size:11px;letter-spacing:.08em;text-transform:uppercase;">TurboRipassi</div>
          <div style="color:#ffffff;font-size:19px;font-weight:700;margin-top:2px;">Segnalazione di un problema</div>
        </td>
      </tr>
      <tr>
        <td style="padding:22px;">
          <div style="color:#78716c;font-size:11px;letter-spacing:.08em;text-transform:uppercase;margin-bottom:8px;">Cosa è successo</div>
          <div style="color:#1c1917;font-size:15px;line-height:1.6;white-space:pre-wrap;">${descrizione}</div>
        </td>
      </tr>
      <tr>
        <td style="padding:0 22px 22px;">
          <table role="presentation" width="100%" style="border:1px solid #e7e5e4;border-radius:8px;border-collapse:collapse;overflow:hidden;">
            ${riga("Account", email)}
            ${riga("Ultimo errore", ultimoErrore)}
            ${riga("Piattaforma", escapeHtml(d.piattaforma) || "—")}
            ${riga("Versione app", escapeHtml(d.versioneApp) || "—")}
            ${riga("Ricevuta", escapeHtml(quando))}
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function corpoTesto(d: Segnalazione, quando: string): string {
  return [
    "TurboRipassi — segnalazione di un problema",
    "",
    String(d.descrizione ?? "").slice(0, MAX_DESCRIZIONE),
    "",
    `Account:      ${d.email ?? "—"}`,
    `Ultimo errore: ${d.ultimoErrore ?? "nessuno"}`,
    `Piattaforma:  ${d.piattaforma ?? "—"}`,
    `Versione app: ${d.versioneApp ?? "—"}`,
    `Ricevuta:     ${quando}`,
  ].join("\n");
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const json = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  if (req.method !== "POST") return json({ errore: "Metodo non consentito" }, 405);

  if (!RESEND_API_KEY) {
    console.error("[segnala-problema] RESEND_API_KEY non configurata.");
    return json({ errore: "Invio non configurato" }, 501);
  }

  let dati: Segnalazione;
  try {
    dati = (await req.json()) as Segnalazione;
  } catch {
    return json({ errore: "Corpo non valido" }, 400);
  }

  const descrizione = typeof dati.descrizione === "string" ? dati.descrizione.trim() : "";
  if (descrizione === "") return json({ errore: "Descrizione mancante" }, 400);

  const quando = new Date().toLocaleString("it-IT", { timeZone: "Europe/Rome" });
  const mittenteUtente = typeof dati.email === "string" ? dati.email.trim() : "";

  const risposta = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: MITTENTE,
      to: [DESTINATARIO],
      // Replying to the mail answers the person who wrote it, which is the
      // only thing anyone reading this inbox will want to do.
      ...(mittenteUtente.includes("@") ? { reply_to: mittenteUtente } : {}),
      subject: `[TurboRipassi] ${descrizione.slice(0, 70).replace(/\s+/g, " ")}`,
      html: corpoHtml({ ...dati, descrizione }, quando),
      text: corpoTesto({ ...dati, descrizione }, quando),
    }),
  });

  if (!risposta.ok) {
    console.error("[segnala-problema] Resend ha risposto", risposta.status, await risposta.text());
    return json({ errore: "Invio non riuscito" }, 502);
  }

  return json({ ok: true }, 200);
});
