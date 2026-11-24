/*!
 * PPLF logger for Power Pages
 * Power Platform Logging Framework - MIT licence
 *
 * Two transports:
 *   "flow"   (default) - posts batches to the "PPLF | Ingest | Power Pages" cloud flow
 *                         through the site's cloud flow API. Follows the PPLF Log Target
 *                         environment variable, so it works with SharePoint and Dataverse.
 *   "webapi"            - writes straight to the pplf_log table through the Power Pages
 *                         Web API. Dataverse only; needs table permissions and site settings.
 *
 * Setup: see docs/power-pages.md. Then, in a web template or the site's footer:
 *
 *   <script src="/pplf-pages-logger.js"></script>
 *   <script>
 *     PplfLogger.init({ sourceName: "Contoso Partner Portal", flowId: "<cloud flow guid>" });
 *     PplfLogger.info("Home", "Page loaded");
 *   </script>
 *
 * Never log passwords, tokens or more personal data than you need.
 */
(function (global) {
  'use strict';

  var LEVELS = ['Trace', 'Debug', 'Information', 'Warning', 'Error', 'Critical'];
  var SOURCE_TYPE = 'Power Pages';

  var settings = {
    sourceName: 'Power Pages site',
    transport: 'flow',          // "flow" | "webapi"
    flowId: null,               // required for transport "flow"
    minLevel: 'Information',    // entries below this are dropped in the browser
    batchSize: 10,
    flushIntervalMs: 5000,
    captureErrors: true,        // window.onerror and unhandledrejection
    appVersion: '',
    userPrincipalName: ''       // set from Liquid: '{{ user.emailaddress1 }}'
  };

  var buffer = [];
  var timer = null;
  var sending = false;
  var sessionId = newId();
  var correlationId = null;

  function newId() {
    if (global.crypto && global.crypto.randomUUID) return global.crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  function severity(level) {
    var i = LEVELS.indexOf(level);
    return i < 0 ? 2 : i;
  }

  function truncate(s, n) {
    if (s === undefined || s === null) return '';
    s = String(s);
    return s.length > n ? s.slice(0, n) : s;
  }

  function toDetails(details) {
    if (details === undefined || details === null || details === '') return '';
    if (typeof details === 'string') return truncate(details, 100000);
    try { return truncate(JSON.stringify(details), 100000); } catch (e) { return ''; }
  }

  /** Gets the anti-forgery token that the Power Pages APIs require. */
  function getToken() {
    if (global.shell && typeof global.shell.getTokenDeferred === 'function') {
      return new Promise(function (resolve, reject) {
        global.shell.getTokenDeferred().done(resolve).fail(function () { reject(new Error('Could not get the request verification token')); });
      });
    }
    return fetch('/_layout/tokenhtml').then(function (r) { return r.text(); }).then(function (html) {
      var m = /value="([^"]+)"/.exec(html);
      if (!m) throw new Error('Could not get the request verification token');
      return m[1];
    });
  }

  function sendViaFlow(entries) {
    if (!settings.flowId) return Promise.reject(new Error('PplfLogger: flowId is not set'));
    return getToken().then(function (token) {
      return fetch('/_api/cloudflow/v1.0/trigger/' + settings.flowId, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', __RequestVerificationToken: token },
        body: JSON.stringify({ eventData: JSON.stringify({ LogsJson: JSON.stringify(entries) }) })
      });
    }).then(function (r) { if (!r.ok) throw new Error('Flow call failed: ' + r.status); });
  }

  function toRow(e) {
    return {
      pplf_name: truncate(e.message, 200),
      pplf_level: 917000000 + severity(e.level),
      pplf_severity: severity(e.level),
      pplf_sourcetype: 917000003,
      pplf_sourcename: truncate(e.sourceName, 200),
      pplf_component: truncate(e.component, 200),
      pplf_operation: truncate(e.operation, 200),
      pplf_message: truncate(e.message, 4000),
      pplf_details: e.details,
      pplf_correlationid: e.correlationId,
      pplf_sessionid: e.sessionId,
      pplf_userprincipalname: e.userPrincipalName,
      pplf_appversion: e.appVersion,
      pplf_runurl: truncate(e.runUrl, 500),
      pplf_clienttimestamp: e.clientTimestamp,
      pplf_clientinfo: e.clientInfo
    };
  }

  function sendViaWebApi(entries) {
    return getToken().then(function (token) {
      return Promise.all(entries.map(function (e) {
        return fetch('/_api/pplf_logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', __RequestVerificationToken: token },
          body: JSON.stringify(toRow(e))
        }).then(function (r) { if (!r.ok) throw new Error('Web API write failed: ' + r.status); });
      }));
    });
  }

  function flush() {
    if (sending || buffer.length === 0) return Promise.resolve();
    var batch = buffer.splice(0, buffer.length);
    sending = true;
    var send = settings.transport === 'webapi' ? sendViaWebApi : sendViaFlow;
    return send(batch).catch(function (err) {
      // Put the entries back once; drop them if the buffer is already large.
      if (buffer.length < 200) buffer = batch.concat(buffer);
      if (global.console) console.warn('[PPLF]', err.message);
    }).then(function () { sending = false; });
  }

  function schedule() {
    if (timer) return;
    timer = setTimeout(function () { timer = null; flush(); }, settings.flushIntervalMs);
  }

  function log(level, component, message, details, extra) {
    if (severity(level) < severity(settings.minLevel)) return;
    extra = extra || {};
    buffer.push({
      level: LEVELS[severity(level)],
      message: truncate(message || '(no message)', 4000),
      sourceName: settings.sourceName,
      sourceType: SOURCE_TYPE,
      component: truncate(component || global.location.pathname, 200),
      operation: truncate(extra.operation, 200),
      details: toDetails(details),
      correlationId: extra.correlationId || correlationId || sessionId,
      sessionId: sessionId,
      userPrincipalName: settings.userPrincipalName,
      appVersion: settings.appVersion,
      runUrl: truncate(global.location.href.split('?')[0], 500),
      durationMs: typeof extra.durationMs === 'number' ? Math.round(extra.durationMs) : undefined,
      errorCode: extra.errorCode,
      clientTimestamp: new Date().toISOString(),
      clientInfo: truncate(global.navigator.userAgent, 255)
    });
    if (severity(level) >= 4 || buffer.length >= settings.batchSize) flush();
    else schedule();
  }

  function captureErrors() {
    global.addEventListener('error', function (ev) {
      log('Error', 'window.onerror', ev.message, { file: ev.filename, line: ev.lineno, column: ev.colno, stack: ev.error && ev.error.stack });
    });
    global.addEventListener('unhandledrejection', function (ev) {
      var r = ev.reason || {};
      log('Error', 'unhandledrejection', r.message || String(r), { stack: r.stack });
    });
    // Send what is left when the user leaves the page.
    global.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flush(); });
  }

  var api = {
    init: function (options) {
      for (var k in options) if (Object.prototype.hasOwnProperty.call(options, k)) settings[k] = options[k];
      if (settings.captureErrors) captureErrors();
      return api;
    },
    log: log,
    trace: function (c, m, d) { log('Trace', c, m, d); },
    debug: function (c, m, d) { log('Debug', c, m, d); },
    info: function (c, m, d) { log('Information', c, m, d); },
    warn: function (c, m, d) { log('Warning', c, m, d); },
    error: function (c, m, d, extra) { log('Error', c, m, d, extra); },
    critical: function (c, m, d, extra) { log('Critical', c, m, d, extra); },
    /** Starts a new correlation id for a user action and returns it. */
    newCorrelation: function () { correlationId = newId(); return correlationId; },
    /** Times an async operation and logs its duration. */
    time: function (component, operation, promiseFactory) {
      var start = performance.now();
      return Promise.resolve().then(promiseFactory).then(function (v) {
        log('Information', component, operation + ' completed', null, { operation: operation, durationMs: performance.now() - start });
        return v;
      }, function (err) {
        log('Error', component, operation + ' failed: ' + (err && err.message), { stack: err && err.stack }, { operation: operation, durationMs: performance.now() - start });
        throw err;
      });
    },
    flush: flush,
    get sessionId() { return sessionId; }
  };

  global.PplfLogger = api;
})(window);
