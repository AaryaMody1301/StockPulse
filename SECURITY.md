# Security Policy

## Supported version

Security fixes target the current `main` branch. Older commits and abandoned branches are not maintained as separate supported releases.

## Reporting a vulnerability

Do not publish exploit details, credentials, database URLs, private thesis exports, or other sensitive material in a public issue.

Use GitHub private vulnerability reporting for this repository when it is enabled. If that option is unavailable, contact the repository owner through a private channel associated with their GitHub profile before public disclosure.

Include enough information to reproduce and assess the issue without attaching real secrets. Redacted request/response examples, affected routes/files, expected behavior, and a minimal proof of concept are preferred.

## Security boundaries

StockPulse is designed so that:

- provider and database credentials remain server-side;
- `.env*` files are ignored except `.env.example`;
- provider, SEC, imported, browser-storage, and AI payloads are treated as untrusted input;
- ticker inputs are normalized at request/storage boundaries;
- external URLs are restricted to safe HTTP(S) schemes where rendered;
- optional AI output is schema-validated and bound to known evidence IDs;
- production dependency advisories at high-or-higher severity fail CI;
- production deployment should sit behind the documented reverse proxy rather than exposing the Node process directly.

Repository CI cannot validate private production credentials, provider contracts, TLS termination, firewall rules, backups, or hosting configuration. Those remain operator responsibilities documented in `docs/OPERATIONS.md` and `docs/RELEASE_STATUS.md`.
