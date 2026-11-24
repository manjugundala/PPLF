# 0001 - Schema as code

**Status:** Accepted · **Date:** 2026-11-23

## Context
PPLF stores the same data in two systems (Dataverse and SharePoint) and writes it from ten flows, four client libraries and an admin app. Hand-maintained copies of column names, choice values and environment variable names drift. Solution XML can't be reviewed easily and can't describe SharePoint lists at all.

## Decision
`schema/pplf.schema.json` is the single definition of tables, columns, SharePoint fields, choices, environment variables, connection references, roles and the Custom API. `tools/build/generate.mjs` produces the flow definitions, the SharePoint list definitions, the browser deployer and the schema reference page from it. CI runs `npm run check` and fails if any generated file is stale. Tests check that the writers set every column.

## Consequences
- A new column is one schema edit plus `npm run build`; both writers, the provisioning flow and the docs pick it up.
- Flow logic lives in JavaScript (`tools/build/flows.mjs`), which is less familiar to makers than the designer. Makers can still prototype in the designer and port the change.
- The exported solution in `src/solution` is the deployable truth for apps; the schema is the truth for data.
