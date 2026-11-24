# Canvas apps

Canvas logging is a block of [user-defined functions](https://learn.microsoft.com/power-platform/power-fx/reference/object-app#user-defined-functions) you paste into **App → Formulas**. There is no component to import and nothing to keep in sync: the functions are part of your app's source and show up in its diffs.

## Pick a variant

| File | Writes to | Data sources to add | Licence |
|---|---|---|---|
| [`PplfLogger.Dataverse.fx`](https://github.com/manjugundala/power-platform-logging-framework/blob/main/src/canvas/snippets/PplfLogger.Dataverse.fx) | Dataverse, directly | `PPLF Logs`, `PPLF Log Configurations` | Premium |
| [`PplfLogger.SharePoint.fx`](https://github.com/manjugundala/power-platform-logging-framework/blob/main/src/canvas/snippets/PplfLogger.SharePoint.fx) | SharePoint, directly | `PPLF Logs`, `PPLF Log Config` lists | Standard |
| [`PplfLogger.Router.fx`](https://github.com/manjugundala/power-platform-logging-framework/blob/main/src/canvas/snippets/PplfLogger.Router.fx) | Wherever `pplf_LogTarget` says, through a flow | Flow `PPLF | Ingest | Power Apps` | Standard |

All three expose the same functions, so you can switch variants without touching the rest of the app. [Architecture](architecture.md#two-ways-for-canvas-apps-to-log) compares them.

## Set up

1. **App → Formulas**: paste the variant. Set `PplfSourceName` (must match the configuration row, if you add one) and `PplfAppVersion`.
2. Add the data sources or the flow named in the table above.
3. **App → OnError**: paste [`App.OnError.fx`](https://github.com/manjugundala/power-platform-logging-framework/blob/main/src/canvas/snippets/App.OnError.fx). Every unhandled error is now logged and still shown to the user.
4. Router variant only: in each screen's **OnHidden**, add `PplfFlush()`.

## Functions

| Function | Use |
|---|---|
| `PplfTrace(Component, Message)` | Step-by-step detail |
| `PplfDebug(Component, Message)` | Developer detail |
| `PplfInfo(Component, Message)` | Something happened |
| `PplfWarn(Component, Message)` | Unexpected but handled |
| `PplfError(Component, Operation, Message, DetailsJson)` | An operation failed |
| `PplfCritical(Component, Operation, Message, DetailsJson)` | The app cannot continue |
| `PplfLog(Level, Component, Operation, Message, DetailsJson)` | Any level |
| `PplfNewCorrelation()` | Start a new correlation id in `gblPplfCorrelationId` |
| `PplfStart(Operation)` / `PplfStop(Component, Operation)` | Time an operation |
| `PplfFlush()` | Router only: send the buffer now |

`Component` is usually the screen or control name; `Operation` is what the user was doing (`SubmitExpense`). `DetailsJson` is text; build it with `JSON()`.

## Patterns

### Handle and log an error

```powerfx
IfError(
    Patch(Expenses, Defaults(Expenses), frmExpense.Updates),
    PplfError("scrSubmit", "SubmitExpense", FirstError.Message,
        JSON({ kind: Text(FirstError.Kind), status: FirstError.Details.HttpStatusCode }));
    Notify("We couldn't save the expense. It has been reported.", NotificationType.Error)
)
```

### Follow one action across the app and its flows

```powerfx
PplfNewCorrelation();
PplfInfo("scrSubmit", "Submitting expense");
SubmitExpenseFlow.Run(ThisItem.ID, gblPplfCorrelationId)
```

In the flow, pass the correlation id to **PPLF | Logger | Write Log** (`CorrelationId` input). In **PPLF - Configuration App → Logs**, select any entry and **Show everything with this correlation id**.

### Time something slow

```powerfx
PplfStart("LoadDashboard");
ClearCollect(colOrders, Filter(Orders, Status = "Open"));
PplfStop("scrDashboard", "LoadDashboard")
```

### Log navigation

In each screen's **OnVisible**: `PplfInfo(App.ActiveScreen.Name, "Opened")`. Set that source's minimum level to Warning in production if this is too noisy.

## What gets captured automatically

Every entry includes: user email, session id (one per app session), correlation id, app version, client timestamp, OS and browser user agent, and the source type `Canvas App`.

## Notes and limits

- Logging failures never stop your formula: Direct mode puts failed entries in `colPplfFailed`, Router mode keeps the buffer for the next flush (up to 200 entries).
- The configuration lookups (`PplfSourceConfig`, `PplfDefaultConfig`) are named formulas, evaluated when first used and cached. Call `Refresh('PPLF | Configurations')` to pick up changes during a session.
- If the flow appears under a different name in your app (for example `'PPLF|Ingest|PowerApps'_1`), change the name in `PplfFlush`.
- Never put passwords, tokens or more personal data than needed into `Message` or `Details`. See [security](security.md).
