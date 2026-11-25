# Exported solution

This folder holds the **unpacked** `PPLF` solution: canvas app source, flows, tables, environment variables and security roles as exported from the dev environment.

Do not edit it by hand. It is written by the **Export solution from dev** workflow (`.github/workflows/export-from-dev.yml`), which opens a pull request with the changes. The **Release** workflow packs it into managed and unmanaged zips.

To change tables, columns or flows, edit `schema/pplf.schema.json` or `tools/build/flows.mjs`, run `npm run build`, deploy to dev with the deployer, then run the export workflow. See [docs/alm-and-git.md](../../docs/alm-and-git.md).

## What is in here

| Folder | Contents |
|---|---|
| `Entities/` | `pplf_log` and `pplf_logconfig` tables: columns, forms, views |
| `OptionSets/` | Global choices: log level, source type, log target |
| `Roles/` | PPLF \| Log Writer and PPLF \| Log Administrator |
| `Workflows/` | The ten cloud flows (definition JSON and metadata) |
| `environmentvariabledefinitions/` | The eight environment variables. **Values are deliberately not included**: each environment sets its own. |
| `CanvasApps/` | PPLF - Configuration App as an `.msapp` package. Its readable source is in [`src/canvas/configuration-app/Src`](../canvas/configuration-app/Src). |
| `Other/` | `Solution.xml`, `Customizations.xml`, relationships |

Connection references are defined in `Other/Customizations.xml` and bound at import time.
