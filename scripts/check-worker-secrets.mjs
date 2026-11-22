// Keeps the AI key out of the Worker that gets deployed.
//
// OpenNext copies the values in the project's .env files into the Worker code it builds, at
// .open-next/cloudflare/next-env.mjs, as one set per mode: production, development and test.
// The deployed Worker only uses the production set (NEXTJS_ENV is not set), but all three are
// uploaded. So this script, run after `opennextjs-cloudflare build` and before deploying:
//   1. empties the development and test sets, which hold whatever .env.development.local and
//      the like contain (where the key lives for `npm run dev`), and
//   2. stops the deploy if the production set (from .env and .env.local) still has the key.
// On Cloudflare the key is a secret instead (`npx wrangler secret put AI_API_KEY`).
// Never prints the key.
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const file = ".open-next/cloudflare/next-env.mjs";
const SECRETS = ["AI_API_KEY"];

if (!existsSync(file)) process.exit(0);

// 1. Only the production values are used on Cloudflare; drop the others.
const code = readFileSync(file, "utf8").replace(/export const (development|test) = \{[^\n]*\};/g, "export const $1 = {};");
writeFileSync(file, code);

// 2. Whatever is left must not include a secret.
const leaked = SECRETS.filter((name) => new RegExp(`"${name}"\\s*:\\s*"[^"]+"`).test(code));
if (leaked.length > 0) {
  console.error(`
Stopped: the Worker bundle contains ${leaked.join(", ")}, copied from .env or .env.local.
Deploying would upload the key inside the Worker's code.

Fix:
  1. Move the AI_API_KEY line from .env.local (or .env) to .env.development.local.
     \`npm run dev\` still reads it there, and this script keeps it out of the Worker.
  2. Set the key on Cloudflare as a secret:  npx wrangler secret put AI_API_KEY
  3. Run the deploy again.
`);
  process.exit(1);
}
console.log("Worker bundle checked: no AI key in it.");
