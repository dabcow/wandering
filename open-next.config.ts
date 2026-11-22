// OpenNext adapter settings for Cloudflare. The defaults are enough for this app: its one page is
// static and the AI routes run fresh on every request, so no incremental cache (R2) is set up.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({});
