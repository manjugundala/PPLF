# 0002 - Same schema in both stores, configuration matched by name

**Status:** Accepted · **Date:** 2026-11-23

## Context
Users must be able to switch the target without changing reports, queries or app formulas. SharePoint has no relationships worth using at log volume, and lookup columns slow list writes and count against the lookup threshold.

## Decision
- Every log column exists in both stores with the **same display name**. Internal names differ (`pplf_component` vs `PplfComponent`) because each platform has its own rules; the schema maps them.
- Severity is stored twice: as a choice (readable) and as an integer (filterable the same way in both stores, and comparable in flow expressions).
- Configuration rows are matched to entries by **source name**, not by lookup. A `*` row is the default.

## Consequences
- Canvas formulas that use display names work against either store.
- Renaming a source means updating its configuration row too. The docs say to pick names once.
- Severity must be kept in step with Level; every writer sets both from one value.
