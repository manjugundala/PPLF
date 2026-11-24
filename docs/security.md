# Security and privacy

Logs are a common way for personal data and secrets to leak. PPLF gives you the controls; what you put in a log entry is your decision.

## Rules for callers

1. **Never log** passwords, tokens, API keys, connection strings, full card or account numbers, or government ids.
2. **Log ids, not people.** Prefer `expenseId: E-1042` to the employee's name and address.
3. **Keep `Details` small and structured.** Use `JSON()` on a record you built on purpose, not on a whole form or response.
4. **Assume logs are read by administrators.** Do not log anything they should not see.

`User` (user principal name) is stamped on canvas, model-driven and Pages entries. If you must not keep user identities, remove the `User` field from the snippet you use, and set a short retention.

## Access model

| Store | Who can write | Who can read |
|---|---|---|
| Dataverse | Users with **PPLF | Log Writer** (create only) | **PPLF | Log Administrator** and system administrators |
| SharePoint | Users with Contribute on the `PPLF Logs` list (Direct mode), or the flow connection (Router mode) | Anyone with Read on the list |

For SharePoint, **break permission inheritance** on both lists. Give administrators Full Control or Edit. If app users write directly, create a custom permission level with *Add Items* only and grant it on `PPLF Logs`, so users can add entries but not read other people's.

The `pplf_log` and `pplf_logconfig` tables are organization-owned, so there is no per-row sharing to manage.

## Power Pages

- The ingestion flow can be called by any visitor in the web roles you assign. Prefer *Authenticated Users*.
- With the Web API transport, grant **Create only** in the table permission. Never grant Read on `pplf_log` to site users.
- Treat entries from Power Pages as untrusted input: don't render `Message` or `Details` as HTML anywhere.

## Retention and deletion

- Retention runs daily; see [retention and alerts](retention-and-alerts.md).
- To erase one person's entries (for example for a data-subject request), filter Logs by `User` in Dataverse (Advanced find → Delete) or SharePoint (filter the list → delete), and remember the flow run history in Power Automate, which keeps inputs for 28 days.

## Secrets in this repository

There are none, and the `.gitignore` keeps local settings and key files out. Pipelines read environment URLs and service principal secrets from GitHub Actions secrets only. Report vulnerabilities through [SECURITY.md](https://github.com/manjugundala/PPLF/blob/main/SECURITY.md).
