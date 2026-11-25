# How PPLF compares

Power Platform already has monitoring tools. PPLF does not replace them; it fills the gap between them.
This page explains where each fits, so you can decide whether you need PPLF.

## At a glance

| | PPLF | Application Insights integration | Flow run history | Power Apps Monitor | Plug-in trace log | CoE Starter Kit |
|---|---|---|---|---|---|---|
| What it records | Business events you choose to log, from every product | Platform telemetry and `Trace()` calls | Each flow run and action | A live session of one app | Plug-in `ITracingService` output | Inventory and usage of apps, flows, makers |
| Products covered | Canvas, model-driven, flows, Power Pages, plug-ins | Canvas apps, Dataverse, flows (separately configured) | Power Automate | Canvas and model-driven apps | Plug-ins | Whole tenant |
| One format across products | Yes | Different schemas per source | No | No | No | n/a |
| Correlation id across app → flow → plug-in | Yes, passed by the caller | Partly (operation ids within one product) | No | No | No | No |
| Who can read it | Anyone you grant the PPLF roles, in a model-driven view, the Configuration App or SharePoint | People with access to the Azure resource and KQL | Flow owners and co-owners | The person running Monitor | System administrators | CoE admins |
| Needs an Azure subscription | No | Yes | No | No | No | No |
| Standard-licence option | Yes (SharePoint target) | n/a | n/a | n/a | n/a | No |
| Retention | You choose, per source | Azure retention settings | 28 days | Session only | 24 hours by default | Kit-managed |
| Turn verbosity up for one app without redeploying | Yes (configuration row) | No | No | n/a | No | n/a |

## When to use what

- **Use PPLF** when you want one place where makers, support teams and admins can read *business-level* events from all
  your Power Platform components, follow one user action end to end, and change logging levels without redeploying.
  It works without Azure, and has a standard-licence path through SharePoint.
- **Use Application Insights** for platform telemetry at scale (performance, dependency calls, usage analytics) and
  when your team already works in Azure Monitor. A planned PPLF *sink* will forward PPLF entries to Application Insights,
  so the two work together rather than compete. See the [roadmap](https://github.com/manjugundala/PPLF#roadmap).
- **Use flow run history, Monitor and plug-in traces** for debugging a single run or session in detail.
  PPLF entries link to the flow run (`Run Url`), so you can jump from a log entry to the run.
- **Use the CoE Starter Kit** for governance: what exists in the tenant and who owns it. It does not log what happens inside apps.

## What is original in PPLF

1. **One log contract for every Power Platform product.** A single JSON schema
   ([`schema/log-entry.schema.json`](https://github.com/manjugundala/PPLF/blob/main/schema/log-entry.schema.json))
   used by Power Fx, Power Automate, JavaScript and C# clients, so entries from different products can be read and
   queried together.
2. **Storage that can be switched.** The same schema is generated for a Dataverse table and a SharePoint list
   ([ADR 0002](adr/0002-same-schema-in-both-stores.md)), and one environment variable chooses the target at run time,
   so an organisation can start on standard licences and move to Dataverse without changing any app.
3. **Configuration as data.** Minimum level, on/off and retention per source live in a table, read at run time,
   so verbosity changes without a redeploy.
4. **Schema-as-code for low-code.** Tables, lists, choices, environment variables, roles and all ten flows are generated
   from one schema file ([ADR 0001](adr/0001-schema-as-code.md)), tested in CI and deployed by a zero-dependency deployer.

## Limitations

- PPLF logs what you tell it to log. It does not capture platform telemetry automatically, apart from unhandled errors
  through `App.OnError` and `window.onerror`.
- Router mode adds a flow call per entry; for very high volumes use direct mode or batching
  ([ADR 0003](adr/0003-canvas-direct-and-router-modes.md)).
- Standard Dataverse tables are not designed for billions of rows; see [ADR 0005](adr/0005-standard-tables-not-elastic.md)
  and set retention accordingly.
