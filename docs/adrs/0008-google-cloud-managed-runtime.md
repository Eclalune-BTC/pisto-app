# ADR 0008: Google Cloud managed runtime

- Status: Accepted
- Date: 2026-08-22
- Owners: platform and API maintainers
- Supersedes: none

## Context

The service needs autoscaled stateless HTTP compute, managed PostgreSQL, controlled asynchronous
delivery, private object storage, secrets, and least-privilege workload identities without operating
a Kubernetes cluster. Migrations need a separately authorized one-shot executor.

## Decision

Deploy the API as an immutable Docker image on Cloud Run. Use Cloud SQL for PostgreSQL, Cloud Run Job
or controlled CI step for migrations, Cloud Tasks with OIDC for asynchronous HTTP work, private Cloud
Storage with short-lived signed URLs, Secret Manager for runtime secrets, Artifact Registry for
images, and dedicated service accounts for runtime/task/migration/deploy roles.

Use gradual Cloud Run traffic migration and retain a compatible prior revision. Do not infer that
this target exists until deployment evidence confirms it.

## Consequences

- Operations focus on configuration/IAM/scaling rather than cluster nodes.
- API must be stateless, bind `0.0.0.0:$PORT`, and respect ephemeral local disk.
- Connection budgeting couples Cloud Run max instances to Cloud SQL pool size.
- Tasks are at-least-once and require idempotent handlers.
- Signed URLs and attached identities become bearer/privilege boundaries.
- Cloud/provider configuration needs release evidence outside the Git diff.

## Alternatives considered

- GKE: greater control, unnecessary cluster/operational overhead now.
- Long-lived VM: simple but manual scaling/patching and broader host boundary.
- API-hosted background loops/local files: unreliable under autoscaling/ephemeral instances.
- Run migrations in API startup: concurrent execution and excessive runtime privilege.

## Validation

- local container contract and image scan
- no-traffic revision smoke test and gradual traffic metrics
- Cloud SQL connection-budget/load test and restore exercise
- OIDC-rejected/accepted task calls plus replay test
- Storage signed URL scope/expiry test
- IAM/Secret Manager least-privilege review

## Official sources

- [Cloud Run container contract](https://cloud.google.com/run/docs/container-contract)
- [Cloud Run traffic migration](https://cloud.google.com/run/docs/rollouts-rollbacks-traffic-migration)
- [Cloud Run Jobs](https://cloud.google.com/run/docs/create-jobs)
- [Connect Cloud Run to Cloud SQL](https://cloud.google.com/sql/docs/postgres/connect-run)
- [Cloud Tasks HTTP targets](https://cloud.google.com/tasks/docs/creating-http-target-tasks)
- [Cloud Storage signed URLs](https://cloud.google.com/storage/docs/access-control/signed-urls)
- [Cloud Run secrets](https://cloud.google.com/run/docs/configuring/services/secrets)
- [Service-account security](https://cloud.google.com/iam/docs/best-practices-service-accounts)
