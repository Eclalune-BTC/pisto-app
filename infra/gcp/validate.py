"""Validate non-secret release configuration before a migration can run."""

import ipaddress
import os
import re
from urllib.parse import urlsplit


def validate_environment(env):
    if not re.fullmatch(r"[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}", env.get("PISTO_BUILD_ID", "")):
        raise ValueError("PISTO_BUILD_ID must be the Cloud Build UUID")
    if not re.fullmatch(r"[a-z][a-z0-9-]{0,24}[a-z0-9]", env.get("PISTO_MIGRATION_JOB", "")):
        raise ValueError("PISTO_MIGRATION_JOB must be a lowercase job prefix of 2-26 characters")
    for name in ("PISTO_API_URL", "PISTO_APP_URL"):
        value = env.get(name, "")
        try:
            parsed = urlsplit(value)
            host = (parsed.hostname or "").lower().rstrip(".")
            valid = (
                parsed.scheme == "https"
                and parsed.netloc
                and not parsed.username
                and not parsed.password
                and not parsed.path
                and not parsed.query
                and not parsed.fragment
                and parsed.port is None
                and re.fullmatch(r"[a-z0-9.-]+", host)
                and "." in host
                and value == "https://" + host
            )
            try:
                ipaddress.ip_address(host)
                valid = False
            except ValueError:
                pass
            reserved = ("localhost", "test", "invalid", "example", "example.com", "example.net", "example.org")
            if not valid or any(host == item or host.endswith("." + item) for item in reserved):
                raise ValueError()
        except ValueError:
            raise ValueError(f"{name} must be an exact public HTTPS origin without a port or placeholders") from None

    scheme = env.get("PISTO_APP_SCHEME", "")
    if not re.fullmatch(r"[a-z][a-z0-9+.-]*", scheme) or scheme in {"http", "https", "file", "data", "blob", "javascript"}:
        raise ValueError("PISTO_APP_SCHEME must be a private lowercase URI scheme")

    for name in ("PISTO_DATABASE_SECRET_VERSION", "PISTO_MIGRATION_SECRET_VERSION", "PISTO_AUTH_SECRET_VERSION"):
        if not re.fullmatch(r"[1-9][0-9]*", env.get(name, "")):
            raise ValueError(f"{name} must name an explicit positive numeric Secret Manager version")

    if env.get("PISTO_PRODUCT_WRITES_ENABLED") not in ("true", "false"):
        raise ValueError("PISTO_PRODUCT_WRITES_ENABLED must be explicitly true or false")
    for name, maximum in (("PISTO_PRODUCT_READ_LIMIT_PER_MINUTE", 10000), ("PISTO_PRODUCT_WRITE_LIMIT_PER_MINUTE", 1000)):
        value = env.get(name, "")
        if not re.fullmatch(r"[1-9][0-9]*", value) or int(value) > maximum:
            raise ValueError(f"{name} must be an integer from 1 to {maximum}")


if __name__ == "__main__":
    try:
        validate_environment(os.environ)
    except ValueError as error:
        raise SystemExit(str(error)) from None
    print("Release origins, app scheme, and secret versions are valid.")
