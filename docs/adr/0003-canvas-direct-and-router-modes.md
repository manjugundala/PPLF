# 0003 - Canvas apps: Direct and Router modes with one API

**Status:** Accepted · **Date:** 2026-11-23

## Context
Calling a flow for every log entry adds a second or more of latency and uses flow runs. Writing straight to the store is fast but ties the app to one store, and for Dataverse it needs premium licences.

## Decision
Ship three snippets with identical function names:
- **Direct Dataverse** and **Direct SharePoint**: `Patch` to the store, configuration read once per session.
- **Router**: buffer entries in a collection and send a batch to *Ingest from Power Apps* on Error/Critical, at the batch size or on `PplfFlush()`.

## Consequences
- Busy apps log with no flow cost; apps that must follow the central target can.
- Switching mode is a paste, not a rewrite.
- Router mode can lose a buffered batch if the app closes before a flush; Error and Critical entries are sent immediately to limit what matters.
