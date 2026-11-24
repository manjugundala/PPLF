# 0004 - Target in an environment variable, levels as data

**Status:** Accepted · **Date:** 2026-11-23

## Context
The target is environment-wide and must move with deployments (dev might use Dataverse, production SharePoint). Log levels change often during incidents and should not need a deployment.

## Decision
- `pplf_LogTarget`, default level, retention and alerting are **environment variables**, set per environment at import (deployment settings file) or in the Admin app.
- SharePoint site and lists are **data-source environment variables**, so flows and apps bind to them natively, standard connectors only.
- Per-source levels and retention are **rows** in the configuration table or list.

## Consequences
- An admin can raise one app to Debug for an hour without touching any solution.
- Environment variable values are cached briefly by the platform, so target changes take a few minutes.
