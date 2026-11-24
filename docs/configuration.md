# Configuration

PPLF has two layers of settings. **Environment variables** apply to the whole environment and move with the solution. **Configuration rows** are data and set behaviour per source.

## Environment variables

| Variable | Default | What it does |
|---|---|---|
| `pplf_LogTarget` | `Dataverse` | Where the router writes: `Dataverse`, `SharePoint` or `Both`. Also switches the forwarder and retention flows. |
| `pplf_DefaultMinimumLevel` | `Information` | Minimum level when no configuration row matches and there is no `*` row. |
| `pplf_DefaultRetentionDays` | `30` | Retention when the `*` row does not set one. |
| `pplf_AlertMinimumLevel` | `Critical` | Entries at or above this level send an email. `None` turns alerts off. |
| `pplf_AlertRecipients` | *(empty)* | Semicolon-separated addresses. Empty turns alerts off. |
| `pplf_SharePointSite` | *(empty)* | Data source variable: the SharePoint site. |
| `pplf_SharePointLogList` | *(empty)* | Data source variable: the `PPLF Logs` list id. |
| `pplf_SharePointConfigList` | *(empty)* | Data source variable: the `PPLF Log Config` list id. |

Change them in **PPLF Configuration App → Settings / Setup**, in **Solutions → Default solution → Environment variables**, or when importing into a new environment (use a [deployment settings file](https://learn.microsoft.com/power-platform/alm/conn-ref-env-variables-build-tools) in pipelines).

!!! info "When do changes apply?"
    Cloud flows read environment variable values when a run starts, but the platform caches them for a short time. Expect a few minutes before every run uses a new value. Canvas apps in Direct mode are not affected by `pplf_LogTarget`, because they write to the data source they were built with.

## Configuration rows

One row per source, in the `PPLF Log Configuration` table (Dataverse) or the `PPLF Log Config` list (SharePoint). The store used is the one the writer writes to.

| Column | Meaning |
|---|---|
| Source Name | Must equal the `sourceName` the app, flow, page or plug-in sends. `*` is the default row. Matching ignores case. |
| Minimum Level / Minimum Severity | Entries below this are dropped. Keep the two in step (the admin app does this for you). |
| Enabled | `No` drops everything from that source. |
| Retention (days) | Optional. Shorter retention for this source. The `*` row's value is the maximum age for **all** entries. |
| Source Type, Notes | For your own reference. |

### Examples

| Source Name | Minimum level | Enabled | Retention | Effect |
|---|---|---|---|---|
| `*` | Information | Yes | 90 | Default for everything; nothing is kept longer than 90 days |
| `Contoso Expenses` | Debug | Yes | 14 | Debug entries for one app while you investigate, kept two weeks |
| `Nightly Sync` | Warning | Yes | | Only problems from a noisy flow |
| `Legacy Portal` | Information | No | | Logging off for one source |

## Naming sources

Pick one name per app, flow or site and never change it: it is how configuration rows match and how you filter. Good names are what people call the thing: `Contoso Expenses`, `Nightly Account Sync`, `Partner Portal`.

In flows, `workflow()?['tags']?['flowDisplayName']` gives the display name; the Try/Catch template uses it.

## Levels

| Level | Use for |
|---|---|
| Trace | Step-by-step detail while debugging. Off in production. |
| Debug | Values and decisions useful to a developer. |
| Information | Things that happened: screen opened, record submitted, flow finished. |
| Warning | Something unexpected that was handled: retry succeeded, fallback used. |
| Error | An operation failed and the user or process was affected. |
| Critical | The app or process cannot continue, or data may be wrong. Alerts by default. |
