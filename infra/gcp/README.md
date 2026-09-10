# Optional Cloud Run deployment reference

The API runs as a portable Bun container with **Neon PostgreSQL** through a standard TLS database
URL. No Cloud SQL instance, socket, connector, or Cloud SQL IAM role is required. The application
does not depend on a Neon SDK or proprietary database API.

Read [the cloud runbook](../../docs/cloud-deployment.md) and
[Neon setup](../../docs/neon-deployment.md) before configuring a target.

Provide an Artifact Registry repository, existing Cloud Run service, separate API/migration service
accounts, and these Secret Manager secrets with explicitly chosen numeric versions:

- `pisto-database-url`: runtime role's PostgreSQL connection URL;
- `pisto-migration-database-url`: migration role's direct PostgreSQL connection URL;
- `pisto-auth-secret`: high-entropy Better Auth secret.

Set the real API/app origins and all three secret-version substitutions in `cloudbuild.yaml`.
Validation rejects missing/placeholder origins and unpinned versions before migration. The pipeline
builds one image, resolves its digest, waits for a separate migration job, and deploys the digest
as a candidate without changing normal traffic or public IAM. Polar and RevenueCat remain disabled.

Migration jobs include the build UUID to prevent configuration races. Serialize database migrations
and candidate promotion for each target environment; no distributed release lock is implemented.
Review `_PRODUCT_WRITES_ENABLED` for every release and set it to `false` during a write suspension.
The runbook specifies private first-service bootstrap, candidate-tag exposure, smoke, image-scan,
promotion, capacity, recovery, and rollback requirements. A successful build is not a production
release. The scripts neither provision Neon nor read secret values.

Credential-free checks:

```sh
python3 -m unittest discover -s infra/gcp -p 'test_*.py'
bash -n infra/gcp/release.sh
```

The shell orchestration tests use a fake `gcloud` command on Linux or Windows Git Bash. They verify failure
stops, the shared image digest, disabled billing, and no automatic traffic/IAM promotion. They do
not prove live Google Cloud behavior or account permissions.
