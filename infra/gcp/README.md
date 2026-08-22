# Google Cloud deployment reference

The default production target is a Cloud Run service connected to Cloud SQL for PostgreSQL.
Artifact Registry stores immutable API images and Secret Manager injects runtime secrets.
Cloud Run can scale the HTTP service to zero; use Cloud Run Jobs or Cloud Tasks for work
that must continue independently of a request.

## Required resources

Create a Google Cloud project with billing enabled, then provision:

- an Artifact Registry Docker repository named pisto
- a Cloud SQL PostgreSQL instance and application database/user
- separate pisto-api and pisto-migrate service accounts with minimum runtime and migration roles
- Secret Manager values named pisto-database-url, pisto-migration-database-url,
  pisto-auth-secret, pisto-polar-token, pisto-polar-webhook-secret, and pisto-polar-products
- a Cloud Build trigger that uses infra/gcp/cloudbuild.yaml

Override every substitution in cloudbuild.yaml for the target project. In particular, never
deploy the replace-project or example.com defaults. The first build step rejects those placeholders
and non-HTTPS application URLs before it can build an image or touch the database.

Database URLs should use the Cloud SQL Unix socket exposed to Cloud Run. Percent-encode
special characters in database credentials and give the migration identity a distinct database
role. The build file configures and executes a one-task Cloud Run migration job, waits for it to
succeed, and only then deploys the API revision. API instances never run migrations at startup.

## Production checks

- Use a dedicated service account, not the default Compute Engine identity.
- Restrict Secret Manager access to individual secrets.
- Configure a custom domain and update Better Auth trusted origins.
- Set a minimum instance only when latency requirements justify the idle cost.
- Send structured logs and alert on readiness failures and webhook dead letters.
- Back up Cloud SQL and test restoration before accepting production data.

Primary references:

- https://cloud.google.com/run/docs/deploying-source-code
- https://cloud.google.com/run/docs/configuring/services/cloud-sql
- https://cloud.google.com/run/docs/configuring/services/secrets
- https://cloud.google.com/build/docs/building/build-containers
- https://cloud.google.com/sql/docs/postgres/backup-recovery/backups
