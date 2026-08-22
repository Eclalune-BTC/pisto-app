# Google Cloud deployment

## Target topology

| Component | Google Cloud service | Purpose |
| --- | --- | --- |
| API container | Cloud Run service | Stateless public Hono API |
| Container registry | Artifact Registry | Immutable application images |
| PostgreSQL | Cloud SQL for PostgreSQL | Durable relational data |
| Controlled migrations | Cloud Run Job or CI release step | One executor, separately authorized |
| Asynchronous HTTP work | Cloud Tasks | Retryable, scheduled delivery to private handlers |
| User objects | Cloud Storage | Durable private object storage |
| Secrets | Secret Manager | Runtime credentials and signing secrets |
| Identity/access | Dedicated service accounts and IAM | Least-privilege workload identity |

This is a target operating model, not evidence that a project, service, or deployment currently
exists.

The repository includes `apps/api/Dockerfile` and `infra/gcp/cloudbuild.yaml` as build/deploy
references. The Cloud Build file configures and executes a one-task `pisto-migrate` Cloud Run Job,
waits for success, and only then deploys the API. Their presence proves only that the configuration
is reviewable; it does not prove an image was published, a Google Cloud resource was provisioned, a
migration ran, or a revision received traffic.

The Expo static export is a separate artifact and is not served merely because the API is on Cloud
Run. See [Web deployment](web-deployment.md) for the Firebase Hosting default and Google Cloud/EAS
alternatives.

## Container contract

The API image must:

- be Linux `amd64` compatible (or a multi-architecture image including it);
- listen on `0.0.0.0` using Cloud Run's injected `PORT`;
- start without running migrations, seeding data, or provisioning providers;
- write logs to stdout/stderr and remain stateless;
- handle termination and bounded in-flight shutdown;
- run as a non-root user where the chosen Bun image supports it;
- contain only the Bun runtime, bundled application/migration artifacts, and SQL migration files.

Use a multi-stage Dockerfile, a small trusted base, `.dockerignore`, a fixed working directory, and a
non-root runtime stage. Pin the base version and record the deployed image digest. Rebuild regularly
for base security updates; a tag alone does not prove identical content.

The current release stage copies `apps/api/dist/bundled-index.js`,
`packages/db/dist/bundled-migrate.js`, and `packages/db/migrations`; it does not copy the build-stage
`node_modules`. Its normal entrypoint runs only the bundled API.

Test locally without deployment:

```sh
docker build --pull -t pisto-api:local -f apps/api/Dockerfile .
docker run --rm -p 8080:8080 --env-file .env -e PORT=8080 pisto-api:local
```

The Dockerfile path above matches this repository. The run command remains an illustrative local
smoke invocation and requires suitable local configuration. Never bake `.env`, service-account
JSON, or registry credentials into an image or build argument.

## Cloud Run service

- Use one dedicated runtime service account, not a default Editor account.
- Keep ingress and authentication as restrictive as product routing permits. Public API routes still
  perform application authentication; private task handlers require Google OIDC.
- Set minimum/maximum instances and request concurrency from measured behavior.
- Bound database pool size so maximum instances cannot exhaust Cloud SQL.
- Configure startup/liveness probes against non-mutating health endpoints.
- Inject secrets by Secret Manager reference and ordinary non-sensitive settings as environment
  variables.
- Use revision labels, image digests, and gradual traffic migration. Verify before 100% traffic.

Cloud Run revisions are immutable. Configuration changes create a new revision and should pass the
same release evidence as code.

## Cloud SQL

Production uses PostgreSQL with automated backups and point-in-time recovery appropriate to the
environment. Prefer a private-IP/VPC path when the project network design supports it; otherwise use
an officially supported Cloud SQL connector/Unix socket with IAM and encryption controls.

Rules:

- API service account receives only the Cloud SQL access it needs.
- Database application credentials are separate from migration credentials.
- Pool maximum and Cloud Run maximum instances share one documented connection budget.
- Migrations are run once before traffic promotion and never by every starting instance.
- High-risk migrations have a tested restore/forward-fix plan.
- Production access is audited and human direct access is time-bounded.

## Cloud Run Job for migrations

The included Cloud Build reference deploys `pisto-migrate` from the exact API image, uses the
distinct `pisto-migrate` service account and `pisto-migration-database-url` secret, runs
`bun packages/db/dist/bundled-migrate.js` as one task with zero automatic retries, and waits for
completion before the API deploy step. Provisioning must give that identity a distinct migration
database role and only the required Cloud SQL/secret permissions. A failed execution stops that
build sequence.

The YAML is deployment configuration, not evidence that the job, service account, secret, database
role, or a successful execution exists in any Google Cloud project.

Do not make the API container's normal command conditional on an environment variable that could
accidentally run migrations in all instances.

## Cloud Tasks

Use Cloud Tasks for short, bounded asynchronous HTTP work that benefits from scheduling, rate
control, and retry. It is at-least-once delivery: every handler needs an idempotency key and a durable
deduplication/result record.

- Queue and target should be in a deliberate region.
- Target the Cloud Run `run.app` URL and attach an OIDC token from a dedicated invoker service account.
- Validate issuer, audience, and target authorization through Cloud Run/IAM.
- Do not expose the task handler as an unauthenticated alternate API.
- Return 2xx only after durable success. Classify permanent 4xx failures separately from retryable
  dependency errors.
- Keep task payloads minimal; store large data in PostgreSQL/Storage and send an opaque reference.
- Configure retry/backoff, rate, concurrency, and dead-letter/alert handling from workload behavior.

Cloud Tasks is not the source of truth for billing webhook receipt. Persist/deduplicate the provider
event before enqueueing optional downstream work.

## Cloud Storage

- Buckets are private with uniform bucket-level access.
- Separate environments and data classifications into appropriate buckets/projects.
- Object names are server-generated opaque IDs, not trusted user paths.
- Validate declared type, detected type, size, and ownership before marking an upload usable.
- Use short-lived V4 signed URLs for one object and one method. A signed URL is a bearer credential;
  never log it and keep its lifetime minimal.
- Configure lifecycle/retention according to product and legal requirements.
- Grant the API service account object permissions only on required buckets/prefixes.

Do not treat a successful upload as safe content. Malware scanning or transformation should occur in
an isolated asynchronous flow before distribution when the product accepts untrusted files.

## Secret Manager

Store at least these server secrets there when enabled:

- `DATABASE_URL` or its password component;
- `BETTER_AUTH_SECRET` / rotation set;
- `POLAR_ACCESS_TOKEN` and `POLAR_WEBHOOK_SECRET`;
- RevenueCat webhook Authorization value and any server API secret;
- signing/encryption keys introduced by future features.

Reference a specific secret version for deterministic rollback or use an explicit rotation process.
Grant `Secret Manager Secret Accessor` on individual secrets to the exact workload identity. Avoid
long-lived service-account key files; Cloud Run uses its attached identity.

Google recommends avoiding secrets in environment variables when feasible because accidental debug
logging can expose process environments. Cloud Run supports mounted secret files and environment
references; choose deliberately, prevent logging, and understand rotation behavior for the selected
delivery mechanism.

## IAM split

Use separate identities for:

- API runtime: Cloud SQL client, narrow Storage access, Tasks enqueue, selected secrets;
- task invoker: invoke only the private task handler;
- migration job: Cloud SQL client and migration secret/database role;
- deployer: Cloud Run deploy and service-account user, without runtime secret access where possible;
- CI federation: Workload Identity Federation instead of downloaded service-account keys.

Avoid project-wide Owner/Editor and default service accounts. Review unused permissions with IAM
recommendations and audit logs.

## Release sequence

1. Run repository checks and build the Docker image.
2. Scan dependencies/image, push to Artifact Registry, and record the digest/SBOM if available.
3. Back up/verify recovery posture; let the included Cloud Build sequence configure and execute the
   one-task migration job, and require its successful `--wait` result.
4. Deploy a no-traffic Cloud Run revision with pinned image digest and configuration.
5. Verify startup, readiness, auth, database, webhook route behavior, and critical smoke tests.
6. Shift a small traffic percentage, observe errors/latency/database connections, then increase.
7. Keep the prior revision deployable and record release evidence.

Rollback routes traffic to a known-good revision. It does not automatically reverse database or
external provider changes.

## Official sources

- [Cloud Run container contract](https://cloud.google.com/run/docs/container-contract)
- [Deploying Cloud Run containers](https://cloud.google.com/run/docs/deploying)
- [Cloud Run health checks](https://cloud.google.com/run/docs/configuring/healthchecks)
- [Cloud Run rollouts and rollbacks](https://cloud.google.com/run/docs/rollouts-rollbacks-traffic-migration)
- [Cloud Run Jobs](https://cloud.google.com/run/docs/create-jobs)
- [Connect Cloud Run to Cloud SQL for PostgreSQL](https://cloud.google.com/sql/docs/postgres/connect-run)
- [Cloud SQL connection management](https://cloud.google.com/sql/docs/postgres/manage-connections)
- [Cloud Tasks HTTP targets and OIDC](https://cloud.google.com/tasks/docs/creating-http-target-tasks)
- [Cloud Storage signed URLs](https://cloud.google.com/storage/docs/access-control/signed-urls)
- [Cloud Run secrets](https://cloud.google.com/run/docs/configuring/services/secrets)
- [Secret Manager best practices](https://cloud.google.com/secret-manager/docs/best-practices)
- [Service-account security](https://cloud.google.com/iam/docs/best-practices-service-accounts)
- [Docker build best practices](https://docs.docker.com/build/building/best-practices/)
