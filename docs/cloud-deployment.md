# Portable API deployment and the Cloud Run reference

The selected managed database is **Neon PostgreSQL**, reached through the existing standard
PostgreSQL driver. The Bun API remains a portable Docker image. Cloud Run is a maintained deployment
reference; using Neon does not require Cloud Run, a Neon SDK, or a provider-specific data API. See
[Neon deployment](neon-deployment.md) for database setup, privileges, capacity, recovery, and exit.

Configuration in this repository is not evidence that resources exist or traffic is released. The
Expo web export is a separate artifact; [Web deployment](web-deployment.md) describes its requirements.

## Container contract

`apps/api/Dockerfile` builds Linux-compatible bundled API and migration artifacts, includes committed
SQL migrations, and runs the API as the non-root `bun` user. It must listen on `0.0.0.0` at the
runtime's `PORT`, remain stateless, and complete bounded shutdown. Migrations never run at API startup.

```sh
docker build --pull -t pisto-api:local -f apps/api/Dockerfile .
docker run --rm -p 8080:8080 --env-file .env -e PORT=8080 pisto-api:local
```

The local run requires reviewed local configuration. Keep credentials out of image layers, build
arguments, logs, and client bundles. Production images must be scanned and identified by digest;
the versioned base tag alone is not an immutable artifact.

## Cloud Run resources and identities

Provision only the resources required for the selected environment:

- Artifact Registry repository for the image;
- Cloud Run service and a separately authorized one-task migration job;
- dedicated API, migration, and deployer identities;
- Secret Manager references for the runtime database URL, migration database URL, and auth secret;
- logs, alerts, access restrictions, and a documented operational owner.

Neither workload needs a Cloud SQL attachment or Cloud SQL IAM role. Database access is normal
outbound TLS to Neon. Select nearby compute/database regions and measure the actual latency.
Grant Secret Accessor on individual secrets to the relevant runtime identity. Use workload identity
for CI and attached service accounts at runtime rather than downloaded service-account keys.

The API database role must not own schema objects or have migration privileges. The migration
identity alone gets its separate credential. Database recovery remains required even when hosting
and database providers differ.

## Reviewable candidate pipeline

`infra/gcp/cloudbuild.yaml` and `infra/gcp/release.sh` implement this sequence:

1. Validate exact public HTTPS origins, private app scheme, and numeric secret versions before building.
2. Build and push a unique `build-$BUILD_ID` image tag.
3. Verify the target service already exists and resolve the pushed image to one immutable digest.
4. Configure a build-specific migration job from that digest with its separate secret/identity; execute once with
   zero retries and wait for success. Failure prevents API deployment.
5. Deploy the same digest using `--no-traffic --tag=candidate` and the existing service IAM policy.
6. Emit candidate revision/traffic information and digest for the release record. Stop before promotion.

Migration job names include the full build UUID, so another build cannot replace a job's image or
credential between configuration and execution. Retain execution evidence before retiring old jobs.
Serialize releases for one environment: only one build/operator may migrate its database or update
the candidate tag at a time. The scripts do not implement a distributed release lock. Database
changes must be compatible with the currently serving revision before this sequence begins.

Required substitutions are the real `_API_URL`, `_APP_URL`, `_DATABASE_SECRET_VERSION`,
`_MIGRATION_SECRET_VERSION`, and `_AUTH_SECRET_VERSION`. Numeric versions pin rollback configuration;
`latest` is rejected. Review project, region, repository, service/job names, identities, and scheme.
Set `_PRODUCT_WRITES_ENABLED=false` to preserve an operational suspension; its baseline default is
`true`. Review `_PRODUCT_READ_LIMIT_PER_MINUTE` and `_PRODUCT_WRITE_LIMIT_PER_MINUTE` alongside it.
Substitutions enter scripts as environment values, not interpolated shell source.

The template is a complete baseline configuration: it replaces the candidate's ordinary environment
and secret references. It explicitly disables Polar/RevenueCat, removes Cloud SQL attachments, and
defaults to 300 reads / 60 writes per minute. Do not apply it unchanged to a service
with a different enabled capability set or an active operational write suspension. Billing requires
its own reviewed configuration and provider evidence before enablement.

The initial capacity is two maximum instances with five PostgreSQL connections each. Budget for
overlapping revisions, migration connections, probes, and administrative reserve before accepting load;
this configuration is not performance evidence. The startup probe uses `/ready` with a bounded
database check. Liveness uses `/health` so a database outage does not itself cause liveness restarts.
Cloud Run supplies `PORT`; the command configures `--port=3001` without setting the reserved variable.

## First deployment

The candidate script intentionally requires an existing service. For a new environment, first run
the reviewed migration image once, then create the first API revision privately with
`--no-allow-unauthenticated`, the same pinned digest/secrets, and the documented probes. Complete
authenticated operator smoke checks before granting public invocation or enrolling the browser
origin. Record this bootstrap separately; the first revision has no prior traffic target to preserve.

Do not reuse a live service's public IAM settings to describe a new deployment as private.
`--no-traffic` excludes the candidate from the normal traffic split, but its tag URL remains directly
reachable under the service's IAM policy. Candidate code therefore needs all normal authorization,
rate limits, write controls, and data safeguards before deployment.

## Smoke, promotion, and rollback

Before promotion, record the source commit, image digest and scan outcome, migration execution,
revision, secret version references, database endpoint identity (never credentials), origins, IAM,
capacity budget, and previous revision. Verify:

- health/readiness, denied unauthenticated routes, and an authorized persisted operation;
- real browser sign-in/sign-out, cookies, exact CORS, and the forwarded-IP rate-limit contract;
- rate limits, write suspension, sensitive-log redaction, and invalid webhook rejection;
- the exact web artifact against the API; provider/device checks for any enabled capability;
- monitoring, backup/restore evidence, and the compatible rollback target.

Use the reviewed concrete revision names, not `LATEST`, when shifting traffic:

```sh
gcloud run services update-traffic SERVICE --region REGION --to-revisions NEW_REVISION=5,PREVIOUS_REVISION=95
gcloud run services update-traffic SERVICE --region REGION --to-revisions NEW_REVISION=100
```

Observe errors, latency, connections, denied requests, and business outcomes between steps. Record
the actual traffic result before calling the release complete. Rollback sends traffic to the prior
compatible revision; it does not reverse database writes or migrations. Remove the candidate tag
when no longer needed. A failed migration uses its reviewed restore/forward-fix plan.

## Source review

Reviewed on **2026-09-10**. Recheck before changing deployment flags, health behavior, secret delivery,
runtime topology, or database provider:

- [Cloud Run container contract](https://cloud.google.com/run/docs/container-contract)
- [Reserved environment variables](https://cloud.google.com/run/docs/configuring/services/environment-variables)
- [Cloud Run deploy flags](https://cloud.google.com/sdk/gcloud/reference/run/deploy)
- [Health checks](https://cloud.google.com/run/docs/configuring/healthchecks)
- [Traffic migration and tags](https://cloud.google.com/run/docs/rollouts-rollbacks-traffic-migration)
- [Cloud Run Jobs](https://cloud.google.com/run/docs/create-jobs)
- [Artifact Registry image inspection](https://cloud.google.com/sdk/gcloud/reference/artifacts/docker/images/describe)
- [Cloud Run secrets](https://cloud.google.com/run/docs/configuring/services/secrets)
- [Neon connection pooling](https://neon.com/docs/connect/connection-pooling)
