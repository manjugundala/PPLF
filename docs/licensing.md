# Licensing

!!! warning "Not licensing advice"
    This page explains how PPLF's design relates to Microsoft's published licensing rules as the maintainers understand them. Licensing terms change. Check the [Power Platform Licensing Guide](https://go.microsoft.com/fwlink/?linkid=2085130) and your Microsoft account team before you rely on it.

## What Microsoft's rules say (summary)

- **Dataverse is a premium data source.** Apps and flows that use it need premium entitlements.
- **Instant flows**, including flows started from Power Apps, run in the licence context of the user who starts them. If an instant flow uses premium connectors, every user who runs it needs a premium licence, or the flow needs a Process licence. ([Power Automate licensing FAQ](https://learn.microsoft.com/power-platform/admin/power-automate-licensing/faqs))
- **Child flows** use the context of the parent flow that calls them. ([same FAQ](https://learn.microsoft.com/power-platform/admin/power-automate-licensing/faqs))
- **Automated and scheduled flows** with premium connectors need the owner to be licensed (or a Process licence).

## What that means for PPLF

| Scenario | Connectors used | Users need |
|---|---|---|
| Canvas Direct mode, Dataverse target | Dataverse | Premium (the app is already premium if it uses Dataverse) |
| Canvas Direct mode, SharePoint target | SharePoint | Standard (Microsoft 365) |
| Canvas Router mode, Dataverse or Both target | Flow → router → Dataverse writer | Premium |
| Canvas Router mode, SharePoint target | Flow → router → SharePoint writer | Treat as **premium**: the router can call the Dataverse writer, so assume the whole chain counts as premium. Use Direct SharePoint mode for standard-only users. |
| Flow calls **PPLF | Logger | Write Log** | Router chain | As above, through the parent flow |
| Flow calls **PPLF | Writers | SharePoint** directly | SharePoint | Standard |
| Power Pages (flow transport) | Router chain | Power Pages capacity, plus a Power Automate licence for the flow ([Power Pages docs](https://learn.microsoft.com/power-pages/configure/cloud-flow-integration)) |
| Model-driven apps, plug-ins | Dataverse | Already premium |
| Retention, forwarder flows | Dataverse and SharePoint, scheduled/automated | The flow owner (a service account) needs premium |
| PPLF - Configuration App | Dataverse | Premium, admins only |

## The standard-licence path, in one line

**Target = SharePoint, canvas apps use `PplfLogger.SharePoint.fx`, flows call `PPLF | Writers | SharePoint`.** Nothing in that path touches a premium connector.

The solution itself still lives in a Dataverse environment (environment variables, flows in solutions). That is about where it is installed, not what your app users run.

## Capacity

- Each router call is one flow run plus its child flows; each entry written is one action. Batching (Router mode, Power Pages) keeps this low. See [Power Platform request limits](https://learn.microsoft.com/power-platform/admin/api-request-limits-allocations).
- Dataverse log rows use database capacity. Set a retention that fits your capacity: roughly 1 KB to 3 KB per entry, more with large `Details`.
- SharePoint lists handle millions of items when queries use indexed columns. PPLF indexes Level, Severity, Source Type, Source Name, Correlation Id, Client Timestamp and Created.
