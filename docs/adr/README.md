# Architecture decision records

Short records of the decisions that shape PPLF, so contributors know why things are the way they are. Format: [Michael Nygard's ADR template](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions).

| # | Decision | Status |
|---|---|---|
| [0001](0001-schema-as-code.md) | One JSON schema generates flows, lists and docs | Accepted |
| [0002](0002-same-schema-in-both-stores.md) | Identical columns in Dataverse and SharePoint; config matched by name | Accepted |
| [0003](0003-canvas-direct-and-router-modes.md) | Canvas apps get Direct and Router modes with one API | Accepted |
| [0004](0004-environment-variables-for-routing.md) | The target is an environment variable; levels are data | Accepted |
| [0005](0005-standard-tables-not-elastic.md) | Standard tables, not elastic tables, for logs | Accepted |
| [0006](0006-user-defined-functions-over-components.md) | Power Fx user-defined functions instead of a component library | Accepted |

New decision? Copy the newest file, give it the next number, and open a pull request.
