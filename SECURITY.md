# Security policy

## Supported versions

The latest minor release receives security fixes.

## Reporting a vulnerability

Please **do not open a public issue** for security problems.
Use GitHub's private reporting: **Security → Report a vulnerability** on this repository.
You will get an acknowledgement within 5 working days and a plan within 15.

## Scope notes for users

- Log entries can contain whatever callers put in them. Read [docs/security.md](docs/security.md) before logging anything that may include personal data.
- The Power Pages ingestion flow is reachable by any visitor in the web roles you assign. Do not assign it to anonymous users unless you accept that risk.
- Never commit environment URLs with credentials, client secrets or `.snk` files from production pipelines.
