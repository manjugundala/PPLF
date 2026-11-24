# Model-driven apps

The web resource `pplf_/scripts/logger.js` writes entries with `Xrm.WebApi`. It reads the app's own configuration row once per page, so entries below the minimum level are never sent.

When the log target is **SharePoint**, the *PPLF | Forwarder | Dataverse to SharePoint* flow moves these rows to SharePoint, so form scripts never need to know the target.

## Set up

1. Add the web resource to your solution: type **Script (JScript)**, name `pplf_/scripts/logger.js`, content from [`src/webresources/pplf_/scripts/logger.js`](https://github.com/manjugundala/PPLF/blob/main/src/webresources/pplf_/scripts/logger.js).
2. On each form that should log: **Form libraries** → add `pplf_/scripts/logger.js`.
3. Optional: **Events** → **On Load** → `Pplf.Logger.onFormLoad`, with *Pass execution context* on. This logs unhandled script errors on the form.
4. Users need **PPLF | Log Writer**.

## Use from your scripts

```js
// In another library that loads after pplf_/scripts/logger.js
async function onSave(executionContext) {
  const form = executionContext.getFormContext();
  try {
    await validateVat(form);
  } catch (e) {
    Pplf.Logger.error("Account form", "ValidateVat", e.message, { vat: form.getAttribute("vatnumber").getValue() });
    throw e;
  }
}
```

Every call returns a promise with the new row id (or `null`) and never throws. The source name is the model-driven app's display name.

| Function | |
|---|---|
| `Pplf.Logger.trace/debug/info/warn(component, operation, message, details)` | |
| `Pplf.Logger.error/critical(component, operation, message, details, { correlationId, errorCode, durationMs })` | |
| `Pplf.Logger.log(level, component, operation, message, details, extra)` | |
| `Pplf.Logger.onFormLoad(executionContext)` | Hooks unhandled errors |

## Ribbon commands

Use the same functions inside command JavaScript. For commands that start a flow, create a correlation id with `Pplf.Logger.newCorrelation()` and pass it to the flow.
