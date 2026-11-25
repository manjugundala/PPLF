# FAQ

**Do I need Dataverse if I log to SharePoint?**
Yes. The solution, environment variables, flows and the Configuration App live in Dataverse. Only the log entries go to SharePoint.

**Can users without a premium licence write logs?**
Yes, with the SharePoint target and direct canvas logging (the SharePoint connector is standard). See [Licensing](licensing.md).

**Does logging slow my app down?**
Direct mode is one `Patch` per entry, the same cost as any write. Router mode adds a flow call. Log decisions and failures,
not every keystroke, and keep Debug and Trace off except when investigating. See [Canvas apps](canvas-apps.md).

**Can I change the log level without republishing an app?**
Yes. Add or edit a row for the app's source name in **PPLF | Configuration** (or on the Settings screen of the
Configuration App). Apps and flows read it at run time.

**How do I follow one user action across an app, a flow and a plug-in?**
Create a correlation id in the app (`GUID()`), pass it to the flow and on to Dataverse, and log it everywhere.
The Logs screen's **Show everything with this correlation id** shows the whole chain.

**What happens if logging fails?**
The canvas, JavaScript and plug-in loggers catch their own errors, so a failed log write does not break the app,
page or plug-in that called it. In flows, call the logger from a step that runs after failure as well as success
(the Try/Catch template shows how).

**How long are logs kept?**
`PPLF | Maintenance | Retention Cleanup` runs daily. Entries older than the `*` row's retention (or the default,
30 days) are deleted, and a source with a shorter retention of its own is cleaned sooner.
See [Retention and alerts](retention-and-alerts.md).

**Is personal data stored?**
The user's UPN is stored with each entry. Don't log passwords, tokens or sensitive personal data in messages or details.
See [Security and privacy](security.md).

**Does PPLF replace Application Insights?**
No. It covers business-level logging that admins can read without Azure. See [How PPLF compares](comparison.md).

**Is this a Microsoft product?**
No. PPLF is an independent open-source project under the MIT licence.
