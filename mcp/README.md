# Server MCP di TurboRipassi

Permette a Claude di creare e gestire i ripassi programmati. Gira in locale (stdio), entra in Supabase **come te** (email + password + chiave pubblica) e quindi vede solo i tuoi dati, grazie alla sicurezza per riga. Scrive con le stesse RPC dell'app e calcola le date con `src/model/ripassi/occorrenzeDates.ts`: un ripasso creato da Claude ha lo stesso calendario di uno creato a mano.

## Setup
Serve Node ≥ 22.18 (importa direttamente il `.ts` delle date).
```bash
cd mcp && npm install
cp .env.example .env     # URL, chiave publishable, email e password
```
**Claude Code**: dalla radice, `cp .mcp.example.json .mcp.json` (già ignorato da git).
**Claude Desktop**: in `claude_desktop_config.json`:
```json
{ "mcpServers": { "turboripassi": {
  "command": "node",
  "args": ["--env-file=/percorso/turboRipassi/mcp/.env", "/percorso/turboRipassi/mcp/server.mjs"]
} } }
```
Se entri solo con Google, imposta prima una password per lo stesso indirizzo (le identità si collegano a email verificata, vedi `docs/account-identita.md`).

## Strumenti
`crea_ripasso`, `elenca_ripassi`, `ripassi_di_oggi`, `leggi_ripasso`, `aggiorna_ripasso` (anche archivia), `completa_occorrenza`, `aggiungi_occorrenza`, `sposta_occorrenza`, `elimina_ripasso` (richiede `conferma: true`).

Esempio: «Crea un ripasso su "Curva dell'oblio", domanda "Perché la ripetizione dilazionata funziona?", studiato ieri alle 18».

## Test
`npm test` (usa un repo finto, niente rete).
