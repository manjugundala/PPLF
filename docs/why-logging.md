# Why logging is a necessity

Every production system needs a record of what it did, when, for whom, and what went wrong. Code-first teams take
this for granted. Low-code solutions often ship without it, because the platform makes building easy and the
problems only show up later, in production, on someone else's device.

## What happens without logging

| Situation | Without logging | With PPLF |
|---|---|---|
| A user says "it didn't save" | You ask for a screenshot, try to reproduce it, and usually can't. The error happened on their device and is gone. | Search their UPN or the screen name and read the exact error, the record and the time. |
| A flow failed last month | Flow run history is kept for 28 days by default.[^flowruns] Older failures are gone, and only the flow's owners and admins can see them. | Failures are kept for as long as you set, in one place, readable by your support team. |
| A plug-in throws in production | The plug-in trace log is meant for debugging and is usually off in production. Its entries are kept for 24 hours.[^tracelog] | The plug-in writes an entry with the error code and details, kept like every other entry. |
| One click starts an app, a flow and a plug-in | Three products, three tools, no shared id. You line them up by timestamps and guesswork. | One correlation id shows the whole chain in order. |
| An `IfError` hides a failure from the user | Nobody finds out. The data is quietly wrong. | The `IfError` branch logs the failure, and alerts can email you. |
| An auditor asks who changed the configuration | There's no record. | The Configuration App logs every target, level and retention change with the user and time. |

## What logging gives you

1. **Faster support.** Diagnose from evidence instead of reproduction. Most support time goes on finding out what happened;
   a log entry with the user, screen, operation and error answers that in seconds.
2. **Failures you would never hear about.** Many errors are caught and hidden from users on purpose. Without a log,
   a caught error is a lost error. With alerts, you know before users complain.
3. **One view across products.** Power Apps, Power Automate, Power Pages, model-driven apps and plug-ins each have their
   own diagnostics. A shared log format and correlation id let you follow a business process end to end.
4. **Audit and compliance evidence.** Many organisations must show who did what, and when, in business processes and in
   configuration. Logs are that evidence, under the retention you choose.
5. **Safer releases.** After a deployment, compare error counts by app version. A spike after release 1.4.0 tells you what
   to roll back, before the help desk tells you.
6. **Performance and usage facts.** `Duration (ms)` on operations shows what is slow; entry counts per screen or flow show
   what is used. Decisions get made on data instead of opinion.
7. **Knowledge that outlives the maker.** Low-code apps are often built by one person. A log of what the app does in
   production helps whoever maintains it next.

## Why the built-in tools are not enough on their own

Power Platform's diagnostics are good for debugging one run or one session, but each covers one product, keeps data for a
short time or only while you watch, and is readable only by owners or administrators. Application Insights covers telemetry
at scale but needs an Azure subscription and Kusto skills. See [How PPLF compares](comparison.md) for the details.

PPLF does not replace these tools. It adds the business-level log that sits across them.

## What good logging looks like

- **Structured**: the same fields every time, so entries can be filtered and counted, not just read.
- **Levelled**: Trace and Debug off in production, turned up for one app when needed, without redeploying.
- **Correlated**: one id per user action, passed from app to flow to plug-in.
- **Safe**: no passwords, tokens or unnecessary personal data. See [Security and privacy](security.md).
- **Bounded**: a retention period, so the log stays fast and you keep only what you need.
- **Never in the way**: a failed log write must not break the app or process that called it.

PPLF is built around these rules. [Get started](getting-started.md).

## Sources

[^flowruns]: Microsoft Learn, [Missing runs or triggers history for a flow](https://learn.microsoft.com/troubleshoot/power-platform/power-automate/flow-run-issues/missing-runs-or-triggers-history-for-a-flow) and [Manage cloud flow run history in Dataverse](https://learn.microsoft.com/power-automate/dataverse/cloud-flow-run-metadata). Admins can store run history in Dataverse, but that covers flows only.
[^tracelog]: Microsoft Learn, [Plug-ins: tracing and logging](https://learn.microsoft.com/power-apps/developer/data-platform/logging-tracing) and [Write telemetry to Application Insights using ILogger](https://learn.microsoft.com/power-apps/developer/data-platform/application-insights-ilogger) (trace log data is stored for 24 hours).
