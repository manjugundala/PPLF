# Architecture

PPLF has one idea at its centre: **every Power Platform component writes the same log entry shape, and one setting decides where it is stored.**

## Overview

```mermaid
flowchart LR
  subgraph Sources
    CA[Canvas apps]
    MD[Model-driven apps]
    PF[Cloud flows]
    PP[Power Pages]
    PL[Plug-ins / Custom API]
  end

  subgraph PPLF["PPLF solution"]
    direction TB
    IPA["Ingest from Power Apps"]
    IPP["Ingest from Power Pages"]
    WL["Write Log (child flow)"]
    R{{"Log Router<br/>reads pplf_LogTarget"}}
    WDV["Writer Dataverse"]
    WSP["Writer SharePoint"]
    FWD["Forward Dataverse → SharePoint"]
    ALERT["Email alert"]
  end

  subgraph Stores
    DV[("Dataverse<br/>PPLF Log<br/>PPLF Log Configuration")]
    SP[("SharePoint<br/>PPLF Logs<br/>PPLF Log Config")]
  end

  CA -- "Router mode" --> IPA --> R
  CA -- "Direct mode (Patch)" --> DV
  CA -- "Direct mode (Patch)" --> SP
  PF -- "Run a Child Flow" --> WL --> R
  PP -- "cloud flow API" --> IPP --> R
  PP -- "Web API" --> DV
  MD -- "Xrm.WebApi" --> DV
  PL -- "IOrganizationService" --> DV
  R -- Dataverse / Both --> WDV --> DV
  R -- SharePoint / Both --> WSP --> SP
  R -. "level ≥ alert level" .-> ALERT
  DV -- "target = SharePoint" --> FWD --> SP
```

## Components

| Component | What it is | Where |
|---|---|---|
| **Schema** | Tables, columns, SharePoint fields, choices, environment variables, connection references and roles in one JSON file | `schema/pplf.schema.json` |
| **Wire format** | The JSON shape of a log entry that every client sends | `schema/log-entry.schema.json` |
| **Tables** | `pplf_log` (entries) and `pplf_logconfig` (per-source settings), organization-owned | Dataverse |
| **Lists** | `PPLF Logs` and `PPLF Log Config`, same columns, indexed | SharePoint |
| **Router** | Child flow that reads `pplf_LogTarget` and calls the writer(s); sends alerts | `src/flows/log-router.json` |
| **Writers** | One per store. Apply the per-source minimum level, then write | `src/flows/writer-*.json` |
| **Entry points** | Flows that Power Apps, Power Pages and other flows call | `src/flows/ingest-*.json`, `write-log.json` |
| **Client loggers** | Power Fx functions, Power Pages script, model-driven web resource, C# logger | `src/canvas`, `src/pages`, `src/webresources`, `src/plugins` |
| **Admin app** | Canvas app to set the target, provision SharePoint, manage settings and read logs | `src/canvas/admin-app` |
| **Deployer** | Builds everything above in an environment from the schema | `tools/deployer`, `dist/pplf-deployer.browser.js` |

## Two ways for canvas apps to log

Canvas apps can either write straight to the store or send entries through the router. Both use the same function names (`PplfInfo`, `PplfError`, …), so switching is a paste.

```mermaid
sequenceDiagram
  autonumber
  participant App as Canvas app
  participant Flow as Ingest from Power Apps
  participant Router as Log Router
  participant Writer as Writer (DV / SP)
  participant Store as Dataverse / SharePoint

  rect rgb(235, 243, 252)
  note over App,Store: Direct mode - fastest, app knows the target
  App->>Store: Patch('PPLF Logs', …)
  end

  rect rgb(244, 244, 244)
  note over App,Store: Router mode - target-agnostic, batched
  App->>App: Collect(colPplfBuffer, entry)
  App->>Flow: Run(JSON(colPplfBuffer)) on Error, batch size or PplfFlush()
  Flow->>Router: LogsJson
  Router->>Writer: LogsJson (per pplf_LogTarget)
  Writer->>Writer: filter by PPLF Log Configuration
  Writer->>Store: create rows/items
  Router-->>App: accepted = n
  end
```

| | Direct mode | Router mode |
|---|---|---|
| Latency | One `Patch` | One flow call per batch |
| Flow runs used | None | One per batch (plus child flows) |
| Changing the target | Swap the snippet and data source | Change one environment variable |
| Licence for SharePoint target | Standard | Standard (see [licensing](licensing.md)) |
| Works offline | Failures kept in `colPplfFailed` | Buffer kept until the next successful flush |

Choose **Direct** for busy apps, and **Router** for apps whose target must change without republishing. The reasons are recorded in [ADR 0003](adr/0003-canvas-direct-and-router-modes.md).

## A request end to end, with correlation

A correlation id ties together everything one user action causes, across products.

```mermaid
sequenceDiagram
  participant U as User
  participant A as Canvas app
  participant F as Business flow
  participant W as PPLF | Logger | Write Log
  participant P as Plug-in
  participant S as Store

  U->>A: Submit
  A->>A: PplfNewCorrelation() → c-42
  A->>S: Information "Submit started" (c-42)
  A->>F: Run(..., gblPplfCorrelationId)
  F->>P: Dataverse update (plug-in runs)
  P->>S: Error "VAT check failed" (CorrelationId = c-42 if passed in shared variables)
  F->>W: Error "Update failed" (c-42, run link)
  W->>S: via router
  note over S: Filter Logs by c-42 to see the whole story
```

## Configuration resolution

Every writer decides whether to keep an entry like this:

```mermaid
flowchart TD
  E[Entry from source X at level L] --> A{"Row for X in<br/>Log Configuration?"}
  A -- yes --> C[Use X's Enabled and Minimum Level]
  A -- no --> B{"Row named * ?"}
  B -- yes --> D[Use * row]
  B -- no --> F[Use pplf_DefaultMinimumLevel, enabled]
  C --> G{"Enabled and<br/>severity(L) ≥ minimum?"}
  D --> G
  F --> G
  G -- yes --> W[Write]
  G -- no --> X[Drop]
```

Canvas Direct mode and the model-driven logger apply the same rule on the client, so dropped entries never leave the device.

## Data model

```mermaid
erDiagram
  PPLF_LOG {
    string pplf_name "Title (200)"
    choice pplf_level "Trace..Critical"
    int pplf_severity "0..5"
    choice pplf_sourcetype
    string pplf_sourcename
    string pplf_component
    string pplf_operation
    memo pplf_message "4,000"
    memo pplf_details "JSON, 100,000"
    string pplf_correlationid
    string pplf_sessionid
    string pplf_userprincipalname
    string pplf_environment
    string pplf_appversion
    url pplf_runurl
    int pplf_durationms
    string pplf_errorcode
    datetime pplf_clienttimestamp
    string pplf_clientinfo
  }
  PPLF_LOGCONFIG {
    string pplf_name "Source name or *"
    choice pplf_sourcetype
    choice pplf_minimumlevel
    int pplf_minimumseverity
    bool pplf_enabled
    int pplf_retentiondays
    memo pplf_notes
  }
  PPLF_LOGCONFIG ||..o{ PPLF_LOG : "matches by source name"
```

The match is by name rather than a lookup column on purpose: SharePoint has no cheap equivalent, a missing config row must never block logging, and log rows must stay cheap to write. See [ADR 0002](adr/0002-same-schema-in-both-stores.md).

Full column list: [schema reference](reference/schema.md).

## Design principles

1. **Logging never breaks the caller.** Every client catches its own failures; flows return success to the app even when an alert email fails.
2. **One schema, generated everything.** The flows, SharePoint fields, docs and deployer all come from `schema/pplf.schema.json`, and CI fails if they drift.
3. **Standard-licence path exists.** SharePoint logging works without premium connectors.
4. **Configuration is data.** Levels, retention and alerting change without republishing anything.
5. **Source control first.** Every component is text, reviewed in pull requests, and released as managed and unmanaged solutions.
