// The one Workers module the Cloudflare entry imports; wrangler provides it at build time.
declare module "cloudflare:workers" {
  export const env: Record<string, unknown>;
}
