// Stops a deploy whose Worker bundle carries the AI key.
//
// OpenNext copies the values in the project's .env files (including .env.local) into the
// Worker code it builds, at .open-next/cloudflare/next-env.mjs. A build made on a machine
// whose .env.local holds AI_API_KEY would upload the key inside the Worker. The key belongs
// in a Cloudflare secret instead (`npx wrangler secret put AI_API_KEY`).
//
// Run after `opennextjs-cloudflare build` and before deploying. Never prints the key.
import { existsSync, readFileSync } from "node:fs";

const file = ".open-next/cloudflare/next-env.mjs";
const SECRETS = ["AI_API_KEY"];

if (!existsSync(file)) process.exit(0);
const code = readFileSync(file, "utf8");
const leaked = SECRETS.filter((name) => new RegExp(`"${name}"\\s*:\\s*"[^"]+"`).test(code));

if (leaked.length > 0) {
  console.error(`
Stopped: the Worker bundle contains ${leaked.join(", ")}, copied from a local .env file.
Deploying would upload the key inside the Worker's code.

Fix:
  1. Move the AI_API_KEY line from .env.local to .env.development.local.
     \`npm run dev\` still reads it there, but production builds don't.
  2. Set the key on Cloudflare as a secret:  npx wrangler secret put AI_API_KEY
  3. Run the deploy again.
`);
  process.exit(1);
}
