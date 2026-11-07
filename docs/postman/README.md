# API collection (Postman or Bruno)

This folder contains a Postman v2.1 collection and a local environment. It calls
every Pisto route plus every Better Auth endpoint the app uses:

- `pisto.postman_collection.json`: 147 requests in 16 folders, from health checks and sign-up
  through catalog, inventory, cash, expenses, sales, receivables, reports and billing. It also
  includes negative checks for validation, authentication, foreign origins, unknown records,
  idempotency conflicts and session revocation.
- `pisto-local.postman_environment.json`: `baseUrl` (`http://localhost:3001`) and `webOrigin`
  (`http://localhost:8081`).
- `pisto-production.postman_environment.json`: the same two values for the hosted demo.

To use it:

1. **Postman:** choose *Import*, select both files, choose the **Pisto local** environment, then
   *Run collection* in its listed order with a **1000 ms delay** between requests. **Bruno:** choose *Import Collection*, then *Postman
   Collection*.
2. Each run signs up a new demo account and business, stores the ids it creates and checks every
   response. The session is the HttpOnly `pisto.session_token` cookie, which the client keeps
   automatically.
3. From a terminal, with the API running:

   ```sh
   npx newman run docs/postman/pisto.postman_collection.json -e docs/postman/pisto-local.postman_environment.json --delay-request 1000
   ```

Run one collection at a time and leave 10 seconds between runs, because Better Auth allows three
sign-up or sign-in attempts per 10 seconds. One run makes more business writes than the 60 per minute each user may make, so
the delay keeps it under that limit. Locally the AI assistant requests accept 503 unless Workers AI
credentials are configured; against the hosted Worker they return the draft.
If the API runs on another port, change `baseUrl`. `webOrigin` must be one of the origins in
`CORS_ORIGINS` and `TRUSTED_ORIGINS`. [The API guide](../api-elysia.md#public-surface) lists
each route with its permission.
