# Plug-ins and the Custom API

`src/plugins/Pplf.Plugins` is a small .NET Framework 4.6.2 assembly with:

| Type | Use |
|---|---|
| `PplfLogger` | Write entries from any plug-in or custom workflow activity |
| `PplfPluginBase` | Optional base class: a logger in every plug-in, timing, and exception logging |
| `WriteLogApi` | Implements the `pplf_WriteLog` Custom API |

## Build and register

```bash
cd src/plugins/Pplf.Plugins
sn -k Pplf.Plugins.snk           # once; plug-in assemblies must be strong-named
dotnet build -c Release
pac auth create --environment https://yourorg.crm.dynamics.com
pac plugin push --pluginFile bin/Release/net462/Pplf.Plugins.dll   # after the first registration
```

Register the assembly the first time with the Plug-in Registration Tool (or `pac plugin init` projects), then create the **PPLF Write Log** Custom API (`pplf_WriteLog`, unbound action) with the request parameters and response properties listed in `schema/pplf.schema.json` → `customApis`, and point it at the `Pplf.Plugins.WriteLogApi` plug-in type.

## Use `PplfLogger`

```csharp
public class AccountVatCheck : PplfPluginBase
{
    public AccountVatCheck() : base("Contoso Account Plug-ins") { }

    protected override void ExecuteCore(LocalContext ctx)
    {
        var target = (Entity)ctx.Execution.InputParameters["Target"];
        ctx.Log.Debug(nameof(AccountVatCheck), "Checking VAT for " + target.Id);

        if (!IsValid(target))
        {
            ctx.Log.Warn(nameof(AccountVatCheck), "VAT number rejected", "{\"id\":\"" + target.Id + "\"}");
            throw new InvalidPluginExecutionException("The VAT number is not valid.");
        }
    }
}
```

`PplfPluginBase` writes as SYSTEM, so callers don't need the PPLF | Log Writer role. It logs a Debug timing entry for every run (set `TimingLevel = null` to turn that off). It also logs any unexpected exception as Error with the stack trace before raising a friendly error that includes the correlation id.

## The transaction caveat

!!! warning "Rolled-back entries"
    A **synchronous** plug-in runs inside the Dataverse transaction. If it throws, Dataverse rolls back everything it wrote, **including its `pplf_log` rows**.

PPLF handles this in three ways:

1. Every entry is also written to the **plug-in trace log** (`ITracingService`), which is kept even when the transaction rolls back. Turn on plug-in trace logging (*Settings → Administration → System Settings → Customization → Enable logging to plug-in trace log*: Exception).
2. Steps registered as **asynchronous**, and **PreValidation** steps that are not called from another operation, run outside the main transaction, so their entries survive.
3. The caller (canvas app, flow or Power Pages) sees the failure and logs it through its own logger with the same correlation id.

## Use the Custom API

The Custom API gives every client one server-side way to log:

```http
POST https://yourorg.crm.dynamics.com/api/data/v9.2/pplf_WriteLog
Content-Type: application/json

{ "Level": "Error", "Message": "Sync failed", "SourceName": "ERP Connector", "SourceType": "Custom",
  "Component": "OrdersSync", "Details": "{\"batch\":17}", "CorrelationId": "c-42" }
```

```powerfx
// Power Fx (canvas) with the Environment data source added
Environment.pplf_WriteLog({ Level: "Information", Message: "Hello", SourceName: "My App" })
```

Response: `{ "LogId": "<guid>", "Written": true }`.
