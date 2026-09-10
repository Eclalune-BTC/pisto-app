import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

from validate import validate_environment


def valid_environment():
    return {
        "PISTO_BUILD_ID": "12345678-1234-1234-1234-123456789abc",
        "PISTO_MIGRATION_JOB": "pisto-migrate",
        "PISTO_API_URL": "https://api.pisto.app",
        "PISTO_APP_URL": "https://app.pisto.app",
        "PISTO_APP_SCHEME": "pisto",
        "PISTO_DATABASE_SECRET_VERSION": "2",
        "PISTO_MIGRATION_SECRET_VERSION": "3",
        "PISTO_AUTH_SECRET_VERSION": "4",
        "PISTO_PRODUCT_WRITES_ENABLED": "false",
        "PISTO_PRODUCT_READ_LIMIT_PER_MINUTE": "300",
        "PISTO_PRODUCT_WRITE_LIMIT_PER_MINUTE": "60",
    }


class ReleaseValidationTests(unittest.TestCase):
    def test_accepts_explicit_public_configuration(self):
        validate_environment(valid_environment())

    def test_rejects_unsafe_origins_without_echoing_the_value(self):
        for url in (
            "", "http://app.pisto.app", "https://localhost", "https://127.0.0.1",
            "https://api.example.com", "https://app.pisto.app/path",
            "https://app.pisto.app/", "https://app.pisto.app?token=private",
            "https://user:private@app.pisto.app", "https://app.pisto.app:443",
            "https://app.pisto.app@attacker.invalid", "https://app.pisto.app\n",
        ):
            with self.subTest(url=url):
                env = valid_environment() | {"PISTO_API_URL": url}
                with self.assertRaises(ValueError) as caught:
                    validate_environment(env)
                self.assertNotIn("private", str(caught.exception))

    def test_requires_pinned_secret_versions_and_a_private_scheme(self):
        for name, value in (("PISTO_AUTH_SECRET_VERSION", "latest"), ("PISTO_DATABASE_SECRET_VERSION", "0"), ("PISTO_MIGRATION_SECRET_VERSION", ""), ("PISTO_APP_SCHEME", "https"), ("PISTO_APP_SCHEME", "pisto@BILLING_ENABLED=true"), ("PISTO_PRODUCT_WRITES_ENABLED", ""), ("PISTO_PRODUCT_READ_LIMIT_PER_MINUTE", "0"), ("PISTO_BUILD_ID", "")):
            with self.subTest(name=name, value=value), self.assertRaises(ValueError):
                validate_environment(valid_environment() | {name: value})


BASH = str(Path(os.environ.get("ProgramFiles", "C:/Program Files")) / "Git/bin/bash.exe") if os.name == "nt" else shutil.which("bash")


@unittest.skipUnless(BASH and Path(BASH).is_file(), "Bash is required for release orchestration tests")
class ReleaseSequenceTests(unittest.TestCase):
    def run_release(self, failure=""):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            if os.name == "nt":
                # Git Bash can exercise the exact Linux script with the installed
                # Python interpreter; no cloud command or credential is involved.
                (root / "python3").write_text('#!/usr/bin/env bash\nexec "' + Path(sys.executable).as_posix() + '" "$@"\n')
            fake = root / "gcloud"
            fake.write_text("""#!/usr/bin/env python3
import json, os, sys
args = sys.argv[1:]
with open(os.environ['CALL_LOG'], 'a') as out:
    out.write(json.dumps(args) + '\\n')
if os.environ.get('FAIL_STEP') and ' '.join(args).startswith(os.environ['FAIL_STEP']):
    sys.exit(1)
if args[:4] == ['artifacts', 'docker', 'images', 'describe']:
    print('sha256:' + 'a' * 64)
""")
            fake.chmod(0o755)
            log = root / "calls.jsonl"
            env = os.environ | valid_environment() | {
                "PATH": str(root) + os.pathsep + os.environ["PATH"],
                "CALL_LOG": str(log), "FAIL_STEP": failure,
                "PISTO_PROJECT": "pisto-ci", "PISTO_REGION": "us-central1",
                "PISTO_SERVICE": "pisto-api", "PISTO_SERVICE_ACCOUNT": "pisto-api",
                "PISTO_MIGRATION_JOB": "pisto-migrate", "PISTO_MIGRATION_SERVICE_ACCOUNT": "pisto-migrate",
                "PISTO_IMAGE_TAG": "us-central1-docker.pkg.dev/pisto-ci/pisto/pisto-api:build-test",
            }
            result = subprocess.run([BASH, "infra/gcp/release.sh"], cwd=Path(__file__).resolve().parents[2], env=env, capture_output=True, text=True)
            calls = [json.loads(line) for line in log.read_text().splitlines()]
            return result, calls

    def test_migrations_and_candidate_use_the_same_digest_without_promotion(self):
        result, calls = self.run_release()
        self.assertEqual(result.returncode, 0, result.stderr)
        job = next(args for args in calls if args[:3] == ["run", "jobs", "deploy"])
        deploy = next(args for args in calls if args[:2] == ["run", "deploy"])
        self.assertEqual(next(arg for arg in job if arg.startswith("--image=")), next(arg for arg in deploy if arg.startswith("--image=")))
        self.assertIn("@sha256:", next(arg for arg in deploy if arg.startswith("--image=")))
        self.assertEqual(job[3], "pisto-migrate-12345678-1234-1234-1234-123456789abc")
        execution = next(args for args in calls if args[:3] == ["run", "jobs", "execute"])
        self.assertEqual(execution[3], job[3])
        self.assertIn("--no-traffic", deploy)
        self.assertIn("--tag=candidate", deploy)
        self.assertFalse(any("--allow-unauthenticated" in args or "update-traffic" in args for args in calls))
        settings = next(arg for arg in deploy if arg.startswith("--set-env-vars="))
        self.assertIn("BILLING_ENABLED=false", settings)
        self.assertIn("DATABASE_SSL=verify-full", settings)
        self.assertIn("PRODUCT_WRITES_ENABLED=false", settings)
        self.assertNotIn("@PORT=", settings)
        self.assertNotIn("pisto-polar", " ".join(deploy))

    def test_failed_migration_prevents_api_deployment(self):
        result, calls = self.run_release("run jobs execute")
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(any(args[:2] == ["run", "deploy"] for args in calls))

    def test_missing_service_prevents_migrations(self):
        result, calls = self.run_release("run services describe")
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(len(calls), 1)


if __name__ == "__main__":
    unittest.main()
