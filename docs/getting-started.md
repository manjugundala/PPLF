# Getting started

This guide takes you from nothing to a working log entry in about 20 minutes.

## Before you start

You need:

- A Power Platform environment **with Dataverse** (a developer environment is fine). The solution, its environment variables and the admin app live in Dataverse, even if logs go to SharePoint.
- **System Administrator** or **System Customizer** in that environment.
- For the SharePoint target: a site where you can create lists (**Manage Lists** permission, or site owner).

## Step 1 - Install the solution

Pick one of the three ways.

=== "Import a release (recommended)"

    1. Download `PPLF_managed.zip` from the latest [release](https://github.com/manjugundala/power-platform-logging-framework/releases).
    2. Go to [make.powerapps.com](https://make.powerapps.com) → your environment → **Solutions** → **Import solution**.
    3. When asked for connections, create or pick a **Dataverse**, **SharePoint** and **Office 365 Outlook** connection.
    4. When asked for environment variables, keep the defaults. You can leave the SharePoint ones empty for now.
    5. After import, open the solution and turn on the flows if they are off (children first: *Writer Dataverse*, *Writer SharePoint*, *Log Router*, then the rest).

    Use the unmanaged zip only in a development environment where you plan to change PPLF itself.

=== "Browser deployer (no install)"

    Builds the solution from source directly in your environment, using your signed-in session.

    1. Open your environment, e.g. `https://yourorg.crm.dynamics.com/main.aspx`, and sign in.
    2. Open the browser developer tools (F12) → **Console**.
    3. Paste the contents of [`dist/pplf-deployer.browser.js`](https://github.com/manjugundala/power-platform-logging-framework/blob/main/dist/pplf-deployer.browser.js) and press Enter.
    4. Run `await PplfDeployer.deploy()`. It prints every component it creates; running it again only adds what is missing.
    5. In **Solutions → Power Platform Logging Framework → Connection references**, set a connection on each of the three references.
    6. Run `await PplfDeployer.activate()` to turn on the flows.

=== "Node CLI"

    ```bash
    git clone https://github.com/manjugundala/power-platform-logging-framework.git
    cd power-platform-logging-framework
    export PPLF_TOKEN=$(az account get-access-token --resource https://yourorg.crm.dynamics.com --query accessToken -o tsv)
    node tools/deployer/cli.mjs deploy --env https://yourorg.crm.dynamics.com
    # bind connection references in the maker portal, then:
    node tools/deployer/cli.mjs activate --env https://yourorg.crm.dynamics.com
    ```

    Add `--dry-run` to see every request without changing anything.

!!! note "What the deployer does not create"
    The canvas **PPLF Configuration App** app is built from `src/canvas/admin-app` in Power Apps Studio (or comes with the release zip). The plug-in assembly is optional and built from `src/plugins`.

## Step 2 - Give people access

Assign the security roles that the solution adds, together with **Basic User**:

| Role | Who |
|---|---|
| **PPLF | Log Writer** | Everyone who runs an app, page or flow that logs to Dataverse. It allows creating log rows and reading settings, nothing else. |
| **PPLF | Log Administrator** | People who read logs and change settings. |

Share the **PPLF Configuration App** app with the administrators.

For the SharePoint target, app users need **Contribute** on the `PPLF Logs` list (only if you use canvas Direct mode; Router mode writes with the flow owner's connection).

## Step 3 - Choose where logs go

Open **PPLF Configuration App** → **Setup**.

1. Choose **Dataverse**, **SharePoint** or **Both**.
2. For SharePoint or Both: enter the site URL and select **Create lists**. The *PPLF | Setup | Provision SharePoint* flow creates both lists with indexed columns and stores their ids in the environment variables.
3. Select **Save log target**.
4. Select **Send test entry**, then **Find it in Logs**.

Without the admin app you can do the same from the console with `await PplfDeployer.setTarget('SharePoint')`, after running `await PplfDeployer.provisionSharePoint()` on the SharePoint site and setting the three `pplf_SharePoint*` environment variables in the solution.

## Step 4 - Log from your first app

1. Open a canvas app in Studio, go to **App** → **Formulas**.
2. Paste [`PplfLogger.Dataverse.fx`](https://github.com/manjugundala/power-platform-logging-framework/blob/main/src/canvas/snippets/PplfLogger.Dataverse.fx) (or the SharePoint or Router variant) and change `PplfSourceName`.
3. Add the data sources the snippet names.
4. Paste [`App.OnError.fx`](https://github.com/manjugundala/power-platform-logging-framework/blob/main/src/canvas/snippets/App.OnError.fx) into **App** → **OnError**.
5. Call it anywhere:

```powerfx
PplfInfo("scrHome", "Opened home screen");
IfError(
    Patch(Expenses, Defaults(Expenses), frmExpense.Updates),
    PplfError("scrSubmit", "SubmitExpense", FirstError.Message, JSON(frmExpense.Updates, JSONFormat.IgnoreUnsupportedTypes))
)
```

Next: [canvas apps](canvas-apps.md) · [flows](power-automate.md) · [Power Pages](power-pages.md) · [model-driven apps](model-driven-apps.md) · [plug-ins](plugins.md)
