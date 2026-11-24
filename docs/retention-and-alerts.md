# Retention and alerts

## Retention

**PPLF - Retention Cleanup** runs every day at 07:00 UTC.

1. The maximum age for **all** entries is the `*` configuration row's *Retention (days)*, or `pplf_DefaultRetentionDays` if that is empty.
2. A source row with its own *Retention (days)* deletes that source's entries sooner.
3. It cleans Dataverse unless the target is SharePoint, and SharePoint unless the target is Dataverse.

Each rule deletes up to 5,000 entries per run. If you write more than that per day, either run the flow more often (change its recurrence), or for Dataverse create a recurring **bulk deletion job** (*Settings → Data management → Bulk record deletion*) on PPLF Logs with *Created On older than X days*, and keep the flow for per-source rules.

Changing the retention never brings deleted entries back. Export what you need first.

## Alerts

The router sends one email per batch for entries at or above `pplf_AlertMinimumLevel` (default **Critical**) to `pplf_AlertRecipients`. The email lists level, source, component, message, correlation id and time.

- Turn alerts off with `None` or by clearing the recipients.
- Alerts only cover entries that go through the router (Router-mode canvas apps, flows, Power Pages). For Direct-mode canvas apps, model-driven apps and plug-ins, add your own flow on *When a row is added* to `PPLF Logs` filtered on `pplf_severity ge 4`, or use a SharePoint list alert.
- Want Teams instead of email? Copy the router, replace *Send alert email* with *Post message in a chat or channel*, and keep the copy in your own solution layered on top. That way PPLF upgrades don't overwrite your change.
