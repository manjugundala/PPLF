# Prerequisites

Everything you need before you install or contribute to PPLF, in one place.
If you only want to try PPLF, a free [Power Apps Developer Plan](https://learn.microsoft.com/power-platform/developer/plan) environment covers every row marked **Required**.

## To install and use PPLF

### Environment

| Requirement | Required? | Notes |
|---|---|---|
| Power Platform environment **with Dataverse** | Required | The solution, environment variables, flows and the Configuration App live in Dataverse, even when logs go to SharePoint. A developer, sandbox or production environment all work. |
| Dataverse **base language English (1033)** | Recommended | Labels ship in English. Other languages work; labels show in English until translated. |
| [Modern controls and themes](https://learn.microsoft.com/power-apps/maker/canvas-apps/controls/modern-controls/overview-modern-controls) turned on | Required for the Configuration App | On by default in new environments. |
| [User-defined functions](https://learn.microsoft.com/power-platform/power-fx/reference/object-app#user-defined-functions) (named formulas with parameters) | Required for canvas logging | Generally available. Older apps may need **Settings → Updates → User-defined functions** turned on. |
| A SharePoint Online site | Only for the SharePoint target | You need **Manage Lists** permission (site owner or member with design rights) to create the two lists. |

### People and permissions

| Who | Needs | For |
|---|---|---|
| The person installing | **System Administrator** or **System Customizer** in the environment | Importing the solution, setting environment variables, turning on flows |
| The person installing | Rights to create **connections** for Dataverse, SharePoint and Office 365 Outlook | Binding the three connection references |
| Flow owner (a service account is recommended) | A licence that covers the flows' connectors, see [Licensing](licensing.md) | Running the router, writers, retention and alerts |
| App and flow users that write logs | **PPLF \| Log Writer** security role | Create rights on the log table, read on the configuration table |
| Administrators of PPLF | **PPLF \| Log Administrator** security role | Full rights on both tables, using the Configuration App |

### Connectors and data loss prevention (DLP)

PPLF uses three connectors. If your tenant has DLP policies, they must be in the **same group** (usually *Business*) in the environment's policy:

| Connector | Used by | Required? |
|---|---|---|
| Microsoft Dataverse | Dataverse writer, configuration lookups, retention, forwarder | Required |
| SharePoint | SharePoint writer, list provisioning | Only for the SharePoint or Both target |
| Office 365 Outlook | Alert emails | Only if you set alert recipients |

### Licensing

Dataverse is a premium data source. PPLF has a **standard-licence path** (SharePoint target with direct canvas logging) for users without premium licences.
Read [Licensing](licensing.md) before you roll out to production; it lists which scenario needs which licence.

### Browser

Any current Edge, Chrome or Firefox. The browser deployer needs the developer tools console (F12), which some organisations block; use the release zip in that case.

## To contribute or build from source

| Tool | Version | Used for |
|---|---|---|
| [Git](https://git-scm.com/) | 2.40+ | Cloning and pull requests |
| [Node.js](https://nodejs.org/) | 22 LTS or later | Generators, deployer, unit tests (no npm packages to install) |
| [Python](https://www.python.org/) with `pyyaml` | 3.10+ | Canvas source lint and paste-file generation (`pip install pyyaml`) |
| [.NET SDK](https://dotnet.microsoft.com/download) | 8.0 | Building the plug-in assembly (targets .NET Framework 4.6.2) |
| [Power Platform CLI](https://learn.microsoft.com/power-platform/developer/cli/introduction) (`pac`) | Latest | Optional locally: packing and unpacking the solution. CI installs it for you. |
| A developer environment and a test SharePoint site | | Testing changes end to end |

Check your setup:

```bash
node --version      # v22 or later
python3 -c "import yaml; print('pyyaml ok')"
npm test            # 31 tests, no network needed
npm run check       # generated files are up to date
```

## For the ALM workflows (maintainers)

The **Export solution from dev** workflow signs in with a service principal. Create these repository secrets
(**Settings → Secrets and variables → Actions**):

| Secret | Value |
|---|---|
| `PPLF_DEV_URL` | `https://<org>.crm.dynamics.com` |
| `PPLF_APP_ID` | Client ID of an Entra ID app registration, added to the dev environment as an [application user](https://learn.microsoft.com/power-platform/admin/manage-application-users) with System Customizer |
| `PPLF_CLIENT_SECRET` | A client secret for that app registration |
| `PPLF_TENANT_ID` | Your Entra ID tenant ID |

Without a service principal you can still export by hand; see [ALM and Git](alm-and-git.md#exporting-without-a-service-principal).

## Checklist

- [ ] Environment with Dataverse, and you are System Administrator or System Customizer
- [ ] Dataverse, SharePoint and Office 365 Outlook connectors in the same DLP group
- [ ] Decided the target: Dataverse, SharePoint or Both ([Licensing](licensing.md) helps)
- [ ] For SharePoint: a site where you can create lists
- [ ] A service account to own the flows (recommended for production)
- [ ] Security roles planned: **PPLF | Log Writer** for app and flow users, **PPLF | Log Administrator** for admins

Next: [Getting started](getting-started.md).
