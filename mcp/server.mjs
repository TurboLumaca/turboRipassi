#!/usr/bin/env node
/**
 * Server MCP di TurboRipassi (stdio): permette a Claude di creare e gestire
 * i ripassi programmati. Configurazione solo da variabili d'ambiente.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { creaRepo } from "./lib/repo.mjs";
import { registraStrumenti } from "./lib/tools.mjs";

const env = process.env;
const config = {
  url: env.TURBORIPASSI_SUPABASE_URL ?? env.EXPO_PUBLIC_SUPABASE_URL,
  anonKey: env.TURBORIPASSI_SUPABASE_ANON_KEY ?? env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  email: env.TURBORIPASSI_EMAIL,
  password: env.TURBORIPASSI_PASSWORD,
};
const mancanti = Object.entries({
  "TURBORIPASSI_SUPABASE_URL": config.url,
  "TURBORIPASSI_SUPABASE_ANON_KEY": config.anonKey,
  "TURBORIPASSI_EMAIL": config.email,
  "TURBORIPASSI_PASSWORD": config.password,
}).filter(([, v]) => !v).map(([k]) => k);

if (mancanti.length) {
  console.error(`turboripassi-mcp: variabili mancanti: ${mancanti.join(", ")}`);
  process.exit(1);
}

const repo = await creaRepo(config);
const server = new McpServer({ name: "turboripassi", version: "1.0.0" });
registraStrumenti(server, repo);
await server.connect(new StdioServerTransport());
