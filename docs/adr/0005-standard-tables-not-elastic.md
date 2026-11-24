# 0005 - Standard tables, not elastic tables

**Status:** Accepted · **Date:** 2026-11-23

## Context
Dataverse elastic tables suit high-volume, append-only data and support automatic expiry (time to live), which fits logs well.

## Decision
Use standard tables for v1.

## Reasons
- Power Pages Web API, some canvas features and model-driven views have limitations with elastic tables.
- Standard tables work with every client PPLF supports today, and with familiar tools (views, Advanced find, bulk delete).
- Retention is handled by a flow, with bulk deletion jobs documented for high volume.

## Revisit when
An environment needs more than a few million entries a day, or elastic tables reach parity in Power Pages. The schema can gain an `elastic` flag and the deployer a second table type without changing clients.
