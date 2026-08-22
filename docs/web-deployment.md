# Web deployment

## Scope and default

`@pisto/app` produces an Expo static web export. The API's Cloud Run service does **not** host that
web artifact by itself. A separate HTTPS static host serves the browser app and calls the API at
`EXPO_PUBLIC_API_URL`.

The recommended first production default is **Firebase Hosting** because it provides managed HTTPS,
a CDN, custom domains, headers, redirects/rewrites, atomic deploys, and preview channels for static
or single-page applications. This repository describes that target but does not claim a Firebase
project/site is provisioned.

## Build artifact

The current Expo config uses `web.output: "static"`. Export from the app workspace through its
package script:

```sh
bun --filter @pisto/app build
```

The exact script and output directory in `apps/app/package.json` are authoritative. Expo's direct
equivalent is `expo export --platform web`, which normally writes `dist` in the app workspace.

`EXPO_PUBLIC_*` values are replaced at build time. Before exporting:

- set the production HTTPS API origin and public app scheme/identifiers for the intended environment;
- set `APP_VARIANT=production` so `app.config.ts` enforces an explicit exact HTTPS API origin,
  private scheme, and non-placeholder identifiers; retain bundle scanning and artifact smoke tests;
- ensure no secret is present under an `EXPO_PUBLIC_*` name;
- build once per public-configuration environment;
- retain the commit, environment name, dependency lock digest, and artifact checksum.

Changing a public environment variable requires a new export and deployment. Uploading the same
files while changing server environment variables does not change the compiled browser bundle.

## Route handling

Hosting rules must match Expo's output mode:

- **`static` (current):** Expo emits statically rendered HTML per route. Preserve those files and
  configure clean URLs/static-route mapping as the host requires. Direct requests to `/sign-in`,
  `/dashboard`, `/billing`, `/billing/success`, and `/settings` must return the matching document,
  not a storage 404.
- **`single`:** the export contains one SPA document. Configure a final rewrite of application routes
  to `/index.html`, after real asset/file rules. Never rewrite missing JavaScript, image, manifest, or
  source-map requests to HTML.
- **`server`:** requires a compatible server runtime. Do not deploy it as a static Firebase/Storage
  artifact; create a separate reviewed architecture/deployment path.

Authentication is still resolved at runtime. Static generation must not embed a user's session or
private API data into HTML.

## Cache policy

Apply response headers deliberately:

| Artifact | Recommended behavior |
| --- | --- |
| Fingerprinted JS/CSS/fonts/images | Public long-lived cache, for example one year with `immutable` |
| HTML route documents and `index.html` | `no-cache` or short revalidation; never immutable |
| Web manifest, service worker, route/update metadata | Revalidate; keep short enough for safe rollout |
| Source maps | Do not publish publicly unless the observability/security model explicitly allows it |

A new HTML document can reference a new asset hash, so deploy atomically and retain assets long
enough for clients with an older HTML document. Verify actual `Cache-Control` headers from the CDN,
not only configuration files.

## Firebase Hosting path

1. Create separate preview/staging/production targets or projects and restrict deploy permissions.
2. Configure the app export directory as the Hosting public directory.
3. Add route behavior appropriate to `static`; use an SPA rewrite only if output changes to `single`.
4. Configure security and cache headers, custom 404, HTTPS custom domain, and redirects.
5. Deploy a preview channel from the immutable export and run smoke tests.
6. Promote/deploy the same reviewed artifact to production and record the Hosting release ID.

Do not configure a blanket rewrite to the API Cloud Run service. The browser app and `/v1` API use
separate origins by default; if a reverse proxy is introduced, record it in an ADR and retest cookies,
CORS, Better Auth base URL, trusted origins, and caching.

## Alternatives

- **EAS Hosting:** simplest Expo-native path and the option Expo recommends for feature alignment.
  Use it when the team wants Expo-managed previews/domains and accepts the additional service.
- **Cloud Storage backend bucket + external HTTPS Application Load Balancer + optional Cloud CDN:**
  keeps the static stack in Google Cloud and offers detailed CDN/IAM/routing controls, but adds load
  balancer, certificate, DNS, cache-invalidation, public/private bucket, and cost complexity. Cloud
  Storage alone does not serve a custom domain over HTTPS.
- **Other static hosts:** acceptable when they provide HTTPS, atomic deploys, route rewrites, header
  controls, previews, access control, and rollback. Record the operational owner and provider.

Do not put the static app into the API container merely to avoid choosing a host. That couples UI
asset delivery/cache invalidation to API scaling and releases without a product requirement.

## CORS and auth coordination

For each deployed web origin:

- add the exact HTTPS origin to API `CORS_ORIGINS`;
- add it to Better Auth `TRUSTED_ORIGINS`;
- set `BETTER_AUTH_URL` to the API auth origin, not the static host unless a reviewed proxy makes
  them the same origin;
- send credentials only to the intended API origin;
- keep preview origins either explicitly enrolled or unauthenticated—do not wildcard production
  cookies for every preview URL.

## Smoke checks

- Open `/`, `/sign-in`, `/sign-up`, `/dashboard`, `/billing`, `/billing/success`, and `/settings`
  directly in a fresh browser tab; reload each path.
- Confirm HTML content type, all JS/CSS/font/image requests, and no asset request returns `index.html`.
- Inspect production bundle/config for localhost and secret-like values.
- Verify API CORS preflight and credentialed session behavior from the exact production origin.
- Verify sign-in/sign-out and direct auth callback/deep-link routes.
- On web, request an allowlisted billing slug and open only the server-returned Polar URL; do not
  complete a real production purchase during a generic smoke test.
- Verify `Cache-Control`, HTTPS certificate, redirects, CSP/security headers, custom 404, and rollback.
- Confirm API Cloud Run health separately; static-host success does not prove API health and vice
  versa.

## When to add `apps/site`

Keep Expo web as the authenticated product default. Add a separate `apps/site` only when public
marketing/content needs SEO-heavy editorial pages, a CMS, advanced server rendering, independent
content deploys, or a materially different performance/analytics lifecycle. That site can link to the
Expo product origin while sharing only intentional brand/contracts packages. Do not force the
authenticated app to become a general CMS, and do not add a second frontend preemptively.

## Official sources

- [Expo web publishing and output modes](https://docs.expo.dev/guides/publishing-websites/)
- [Expo EAS web deployment](https://docs.expo.dev/deploy/web/)
- [Firebase Hosting use cases](https://firebase.google.com/docs/hosting/use-cases)
- [Firebase Hosting rewrites and headers](https://firebase.google.com/docs/hosting/full-config)
- [Cloud Storage static site with HTTPS load balancer](https://cloud.google.com/storage/docs/hosting-static-website)
- [Cloud CDN cache behavior](https://cloud.google.com/cdn/docs/caching)
