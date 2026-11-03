/**
 * Builds the service-account credentials JSON from a private key you generated yourself, for when the organisation allows
 * uploading a public key but not downloading a Google-made one. Runs locally; nothing is sent anywhere.
 *
 *   node scripts/make-sa-key.mjs --private sa-private.pem --cert sa-public.pem --key-id <Key ID> \
 *     --email <name>@<project>.iam.gserviceaccount.com --client-id <Unique ID> --project <project id> --out sa.json
 *
 * Add --compact to write a single line (the form to paste into a Vercel environment variable).
 */
import { createPublicKey, X509Certificate } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";

const { values: a } = parseArgs({
  options: {
    private: { type: "string" }, cert: { type: "string" }, "key-id": { type: "string" }, email: { type: "string" },
    "client-id": { type: "string" }, project: { type: "string" }, out: { type: "string" }, compact: { type: "boolean" },
  },
});

const missing = ["private", "key-id", "email", "client-id", "project", "out"].filter((k) => !a[k]);
if (missing.length) {
  console.error(`Missing: ${missing.map((m) => `--${m}`).join(", ")}. See the comment at the top of this file.`);
  process.exit(1);
}

const privateKey = readFileSync(a.private, "utf8").replace(/\r\n/g, "\n").trim() + "\n";
if (!privateKey.startsWith("-----BEGIN PRIVATE KEY-----")) {
  console.error("The private key must be PKCS#8 text starting with -----BEGIN PRIVATE KEY-----.");
  process.exit(1);
}

// Catch the usual mistake of pairing a key with a certificate from a different run.
if (a.cert) {
  const fromKey = createPublicKey(privateKey).export({ type: "spki", format: "pem" });
  const fromCert = new X509Certificate(readFileSync(a.cert)).publicKey.export({ type: "spki", format: "pem" });
  if (fromKey !== fromCert) {
    console.error("This private key does not belong to that certificate. Use the pair from the same openssl command.");
    process.exit(1);
  }
}

const credentials = {
  type: "service_account",
  project_id: a.project,
  private_key_id: a["key-id"],
  private_key: privateKey,
  client_email: a.email,
  client_id: a["client-id"],
  token_uri: "https://oauth2.googleapis.com/token",
};
writeFileSync(a.out, JSON.stringify(credentials, null, a.compact ? 0 : 2) + "\n", { mode: 0o600 });
console.log(`Wrote ${a.out}. Keep it out of the project folder and never commit it.`);
