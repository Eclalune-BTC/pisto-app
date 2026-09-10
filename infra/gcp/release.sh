#!/usr/bin/env bash
set -euo pipefail

python3 infra/gcp/validate.py

# An existing service is required so --no-traffic preserves a known traffic target.
# First deployment is a separate private bootstrap described in the runbook.
gcloud run services describe "$PISTO_SERVICE" \
  --project="$PISTO_PROJECT" --region="$PISTO_REGION" \
  --format='value(metadata.name)' >/dev/null

digest=$(gcloud artifacts docker images describe "$PISTO_IMAGE_TAG" \
  --project="$PISTO_PROJECT" --format='value(image_summary.digest)')
if [[ ! "$digest" =~ ^sha256:[a-f0-9]{64}$ ]]; then
  echo "Artifact Registry did not return a valid immutable image digest." >&2
  exit 2
fi
image="${PISTO_IMAGE_TAG%:*}@$digest"
migration_job="$PISTO_MIGRATION_JOB-$PISTO_BUILD_ID"

gcloud run jobs deploy "$migration_job" \
  --project="$PISTO_PROJECT" --region="$PISTO_REGION" \
  --image="$image" \
  --service-account="$PISTO_MIGRATION_SERVICE_ACCOUNT@$PISTO_PROJECT.iam.gserviceaccount.com" \
  --clear-cloudsql-instances \
  --set-secrets="DATABASE_URL=pisto-migration-database-url:$PISTO_MIGRATION_SECRET_VERSION" \
  --set-env-vars=DATABASE_SSL=verify-full,DATABASE_MAX_CONNECTIONS=2 \
  --command=bun --args=packages/db/dist/bundled-migrate.js \
  --tasks=1 --max-retries=0 --task-timeout=10m --cpu=1 --memory=512Mi --quiet

gcloud run jobs execute "$migration_job" \
  --project="$PISTO_PROJECT" --region="$PISTO_REGION" --wait --quiet

gcloud run deploy "$PISTO_SERVICE" \
  --project="$PISTO_PROJECT" --region="$PISTO_REGION" \
  --image="$image" --platform=managed --execution-environment=gen2 \
  --service-account="$PISTO_SERVICE_ACCOUNT@$PISTO_PROJECT.iam.gserviceaccount.com" \
  --clear-cloudsql-instances \
  --set-secrets="DATABASE_URL=pisto-database-url:$PISTO_DATABASE_SECRET_VERSION,BETTER_AUTH_SECRET=pisto-auth-secret:$PISTO_AUTH_SECRET_VERSION" \
  --set-env-vars="^@^NODE_ENV=production@BETTER_AUTH_URL=$PISTO_API_URL@CORS_ORIGINS=$PISTO_APP_URL@TRUSTED_ORIGINS=$PISTO_APP_URL,$PISTO_APP_SCHEME://@EXPO_SCHEME=$PISTO_APP_SCHEME@DATABASE_SSL=verify-full@DATABASE_MAX_CONNECTIONS=5@BILLING_ENABLED=false@REVENUECAT_ENABLED=false@PRODUCT_WRITES_ENABLED=$PISTO_PRODUCT_WRITES_ENABLED@PRODUCT_READ_LIMIT_PER_MINUTE=$PISTO_PRODUCT_READ_LIMIT_PER_MINUTE@PRODUCT_WRITE_LIMIT_PER_MINUTE=$PISTO_PRODUCT_WRITE_LIMIT_PER_MINUTE" \
  --port=3001 --cpu=1 --memory=512Mi --concurrency=40 \
  --min-instances=0 --max-instances=2 --timeout=60s \
  --startup-probe=httpGet.path=/ready,httpGet.port=3001,timeoutSeconds=3,periodSeconds=5,failureThreshold=24 \
  --liveness-probe=httpGet.path=/health,httpGet.port=3001,timeoutSeconds=3,periodSeconds=30,failureThreshold=3 \
  --no-traffic --tag=candidate --quiet

# The candidate tag is reachable directly under the service's existing IAM.
# Do not change service IAM or promote traffic from the build.
gcloud run services describe "$PISTO_SERVICE" \
  --project="$PISTO_PROJECT" --region="$PISTO_REGION" \
  --format='json(status.latestReadyRevisionName,status.traffic,status.url)'
printf 'Candidate image: %s\n' "$image"
echo "Candidate deployed. Authenticated smoke, image scan, and explicit promotion remain required."
