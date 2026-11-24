# Power Pages

[`pplf-pages-logger.js`](https://github.com/manjugundala/PPLF/blob/main/src/pages/pplf-pages-logger.js) is a small browser script that batches entries and sends them to PPLF. It also captures unhandled JavaScript errors and promise rejections, and flushes when the visitor leaves the page.

## Choose a transport

| Transport | How | Target | Setup |
|---|---|---|---|
| `flow` (default) | Site cloud-flow API → **PPLF | Ingest | Power Pages** → router | Follows `pplf_LogTarget` | Add the flow to the site, give it web roles |
| `webapi` | Power Pages Web API → `pplf_log` table | Dataverse only | Site settings and a table permission |

## Set up (flow transport)

1. **Upload the script.** In the Portal Management app, create a **Web File** at the site root: partial URL `pplf-pages-logger.js`, attach `src/pages/pplf-pages-logger.js`, publishing state *Published*.
2. **Add the flow to the site.** In Power Pages design studio → **Set up** → **Cloud flows** → **+ Add cloud flow** → *PPLF | Ingest | Power Pages*. Choose the web roles allowed to log (usually *Authenticated Users*). Copy the flow's id from the list.
3. **Initialise the logger** on every page, for example in the *Footer* content snippet. Use [`samples/power-pages/pplf-logger-snippet.html`](https://github.com/manjugundala/PPLF/blob/main/samples/power-pages/pplf-logger-snippet.html) and replace `FLOW_GUID`.

```html
<script src="/pplf-pages-logger.js"></script>
<script>
  PplfLogger.init({
    sourceName: "Partner Portal",
    flowId: "00000000-0000-0000-0000-000000000000",
    userPrincipalName: "{% if user %}{{ user.emailaddress1 | escape }}{% endif %}"
  });
</script>
```

## Set up (Web API transport)

1. Site settings:

    | Name | Value |
    |---|---|
    | `Webapi/pplf_log/enabled` | `true` |
    | `Webapi/pplf_log/fields` | `pplf_name,pplf_level,pplf_severity,pplf_sourcetype,pplf_sourcename,pplf_component,pplf_operation,pplf_message,pplf_details,pplf_correlationid,pplf_sessionid,pplf_userprincipalname,pplf_appversion,pplf_runurl,pplf_clienttimestamp,pplf_clientinfo` |

2. A **table permission** on `pplf_log`: scope *Global*, privilege **Create** only, assigned to the web roles that may log.
3. `PplfLogger.init({ transport: "webapi", sourceName: "Partner Portal" })`.

Never grant **Read** on `pplf_log` to site visitors.

## API

```js
PplfLogger.info("Checkout", "Payment page opened");
PplfLogger.warn("Checkout", "Address lookup slow", { ms: 3100 });
PplfLogger.error("Checkout", "Payment failed", { code: resp.status }, { operation: "Pay", errorCode: "PAY_502" });

const corr = PplfLogger.newCorrelation();           // pass corr to your own flow calls
await PplfLogger.time("Checkout", "Pay", () => fetch(...));  // logs duration or failure
PplfLogger.flush();                                 // send now
```

| Option | Default | |
|---|---|---|
| `sourceName` | `Power Pages site` | Matches configuration rows |
| `transport` | `flow` | `flow` or `webapi` |
| `flowId` | | Required for `flow` |
| `minLevel` | `Information` | Dropped in the browser below this |
| `batchSize` | `10` | Send when this many are waiting |
| `flushIntervalMs` | `5000` | Or after this long |
| `captureErrors` | `true` | Hook `error` and `unhandledrejection` |
| `appVersion`, `userPrincipalName` | | Stamped on every entry |

## Anonymous visitors

Logging from anonymous visitors means anyone can send entries. If you need it, assign the flow to the *Anonymous Users* role, keep `minLevel` at `Warning` or higher, and add a configuration row with a short retention. Treat these entries as untrusted input when you read them.
