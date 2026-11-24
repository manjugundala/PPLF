# 0006 - Power Fx user-defined functions instead of a component library

**Status:** Accepted · **Date:** 2026-11-23

## Context
The usual way to share canvas logic is a component library. Components can't own data sources, need "access app scope" to reach them, and make the calling syntax awkward for an action like "write a log entry". User-defined functions, including behaviour functions with side effects, are generally available in canvas apps.

## Decision
The canvas logger is a block of named formulas and user-defined functions pasted into `App.Formulas`, with an optional `App.OnError` block.

## Consequences
- Calls read naturally: `PplfError("scrSubmit", "Submit", FirstError.Message, "")`.
- The logger is part of each app's source, visible in diffs, with no library version to keep in sync.
- Updating the logger in many apps means pasting the new block into each. Release notes call out when that's needed.
