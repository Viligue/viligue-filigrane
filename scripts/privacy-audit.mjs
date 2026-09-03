import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const clientPath = new URL("../app/filigrane-client.tsx", import.meta.url);
const nextConfigPath = new URL("../next.config.ts", import.meta.url);
const headersPath = new URL("../public/_headers", import.meta.url);
const packagePath = new URL("../package.json", import.meta.url);

const [client, nextConfig, headers, packageText] = await Promise.all([
  readFile(clientPath, "utf8"),
  readFile(nextConfigPath, "utf8"),
  readFile(headersPath, "utf8"),
  readFile(packagePath, "utf8"),
]);

const forbiddenClientApis = [
  ["fetch", /\bfetch\s*\(/],
  ["XMLHttpRequest", /\bXMLHttpRequest\b/],
  ["WebSocket", /\bWebSocket\b/],
  ["EventSource", /\bEventSource\b/],
  ["sendBeacon", /\bsendBeacon\b/],
  ["localStorage", /\blocalStorage\b/],
  ["sessionStorage", /\bsessionStorage\b/],
  ["IndexedDB", /\bindexedDB\b/i],
  ["Cache API", /\bcaches\s*\./],
  ["service worker", /serviceWorker\s*\.\s*register/],
];

for (const [name, pattern] of forbiddenClientApis) {
  assert.doesNotMatch(client, pattern, `API interdite dans le client : ${name}`);
}

assert.doesNotMatch(client, /<form\b/i, "Un formulaire réseau a été ajouté au client.");
assert.doesNotMatch(
  client.replaceAll("https://github.com/Viligue/viligue-filigrane", ""),
  /https?:\/\//i,
  "Une URL distante inattendue est présente dans le client.",
);

for (const [name, source] of [
  ["next.config.ts", nextConfig],
  ["public/_headers", headers],
]) {
  assert.match(source, /connect-src 'none'/, `${name} doit bloquer les connexions clientes.`);
  assert.match(source, /form-action 'none'/, `${name} doit bloquer les formulaires réseau.`);
  assert.match(source, /no-store/, `${name} doit interdire la mise en cache.`);
}

const packageJson = JSON.parse(packageText);
const allowedDependencies = new Set([
  "lucide-react",
  "next",
  "pdf-lib",
  "pdfjs-dist",
  "react",
  "react-dom",
]);

for (const dependency of Object.keys(packageJson.dependencies ?? {})) {
  assert.ok(
    allowedDependencies.has(dependency),
    `Dépendance applicative non examinée par l'audit : ${dependency}`,
  );
}

console.log("Audit de confidentialité réussi : aucun mécanisme client de transfert ou de stockage détecté.");
