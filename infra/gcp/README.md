# Inactive deployment reference

This directory is not Pisto's active runtime or a selected hosting architecture. Development uses
local Expo, Bun/Hono and PostgreSQL under
[ADR 0017](../../docs/adrs/0017-portable-postgres-and-hosting.md). Do not run deployment commands or
provision resources from these files without a separate approved hosting task.

The scripts remain because `.github/workflows/ci.yml` exercises their credential-free safeguards:

```sh
python3 -m unittest discover -s infra/gcp -p 'test_*.py'
bash -n infra/gcp/release.sh
```

These tests use a fake provider command and verify failure stops, immutable artifact identity,
separate migration execution, disabled billing and no automatic traffic/IAM promotion. They do not
establish live provider compatibility, permissions or deployed resources. Re-evaluate the entire
reference before any approved use; the removed historical deployment manuals are not prerequisites.

Use [getting started](../../docs/getting-started.md) for the current local environment. Removing these
executable scripts would also require a separately scoped CI change; this documentation cleanup does
not alter them or remove their tests.
