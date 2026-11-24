/*!
 * PPLF logger for model-driven apps (web resource pplf_/scripts/logger.js)
 * Power Platform Logging Framework - MIT licence
 *
 * Writes to the PPLF Log table with Xrm.WebApi. When the Log Target is
 * SharePoint, the "PPLF | Forwarder | Dataverse to SharePoint" flow moves
 * the rows to SharePoint, so form scripts never need to know the target.
 *
 * Register on a form:
 *   Library: pplf_/scripts/logger.js
 *   OnLoad : Pplf.Logger.onFormLoad   (pass execution context = yes)
 *
 * From your own scripts:
 *   Pplf.Logger.error("Account form", "ValidateVat", "VAT check failed", { vat: v });
 */
var Pplf = Pplf || {};

Pplf.Logger = (function () {
  'use strict';

  var LEVELS = ['Trace', 'Debug', 'Information', 'Warning', 'Error', 'Critical'];
  var LEVEL_BASE = 917000000;
  var SOURCE_TYPE_MODEL_DRIVEN = 917000001;
  var sessionId = newId();
  var minSeverity = 2;
  var configLoaded = null;

  function newId() {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  function severity(level) {
    var i = LEVELS.indexOf(level);
    return i < 0 ? 2 : i;
  }

  function cut(s, n) {
    if (s === undefined || s === null) return '';
    s = String(s);
    return s.length > n ? s.slice(0, n) : s;
  }

  /** Reads the minimum severity for this app from PPLF Log Configuration (once per page). */
  function loadConfig(sourceName) {
    if (configLoaded) return configLoaded;
    var filter = "?$select=pplf_name,pplf_minimumseverity,pplf_enabled&$filter=pplf_name eq '*' or pplf_name eq '" + sourceName.replace(/'/g, "''") + "'";
    configLoaded = Xrm.WebApi.retrieveMultipleRecords('pplf_logconfig', filter).then(function (r) {
      var own = r.entities.filter(function (e) { return e.pplf_name !== '*'; })[0];
      var def = r.entities.filter(function (e) { return e.pplf_name === '*'; })[0];
      var cfg = own || def;
      if (cfg) minSeverity = cfg.pplf_enabled === false ? 99 : cfg.pplf_minimumseverity;
    }, function () { /* no read access: keep the default */ });
    return configLoaded;
  }

  var sourceNamePromise = null;
  function sourceName() {
    if (sourceNamePromise) return sourceNamePromise;
    var g = Xrm.Utility.getGlobalContext();
    sourceNamePromise = (g.getCurrentAppProperties ? g.getCurrentAppProperties() : Promise.resolve({}))
      .then(function (p) { return (p && p.displayName) || 'Model-driven app'; }, function () { return 'Model-driven app'; });
    return sourceNamePromise;
  }

  /**
   * Writes one entry. Never throws; returns a promise that resolves to the new row id or null.
   * @param {string} level      Trace | Debug | Information | Warning | Error | Critical
   * @param {string} component  form, ribbon command or script name
   * @param {string} operation  what was being attempted
   * @param {string} message
   * @param {object|string} [details]
   * @param {object} [extra]    { correlationId, errorCode, durationMs }
   */
  function log(level, component, operation, message, details, extra) {
    extra = extra || {};
    return sourceName().then(function (src) {
      return loadConfig(src).then(function () {
        var sev = severity(level);
        if (sev < minSeverity) return null;
        var g = Xrm.Utility.getGlobalContext();
        var d = details === undefined || details === null ? '' : (typeof details === 'string' ? details : JSON.stringify(details));
        return Xrm.WebApi.createRecord('pplf_log', {
          pplf_name: cut(message || '(no message)', 200),
          pplf_level: LEVEL_BASE + sev,
          pplf_severity: sev,
          pplf_sourcetype: SOURCE_TYPE_MODEL_DRIVEN,
          pplf_sourcename: cut(src, 200),
          pplf_component: cut(component, 200),
          pplf_operation: cut(operation, 200),
          pplf_message: cut(message || '(no message)', 4000),
          pplf_details: cut(d, 100000),
          pplf_correlationid: extra.correlationId || sessionId,
          pplf_sessionid: sessionId,
          pplf_userprincipalname: cut(g.userSettings.userName, 320),
          pplf_environment: cut(g.getOrgUniqueName(), 100),
          pplf_appversion: cut(g.getVersion(), 50),
          pplf_runurl: cut(window.location.href, 500),
          pplf_durationms: typeof extra.durationMs === 'number' ? Math.round(extra.durationMs) : null,
          pplf_errorcode: cut(extra.errorCode, 100),
          pplf_clienttimestamp: new Date().toISOString(),
          pplf_clientinfo: cut(g.client.getClient() + '; ' + g.client.getFormFactor() + '; ' + navigator.userAgent, 500)
        }).then(function (r) { return r.id; });
      });
    }).catch(function (e) {
      if (window.console) console.warn('[PPLF] could not write log', e && e.message);
      return null;
    });
  }

  /** Form OnLoad handler: logs unhandled script errors raised on this form. */
  function onFormLoad(executionContext) {
    var formContext = executionContext.getFormContext();
    var entity = formContext.data.entity.getEntityName();
    if (!window.__pplfErrorsHooked) {
      window.__pplfErrorsHooked = true;
      window.addEventListener('error', function (ev) {
        log('Error', entity + ' form', 'Unhandled', ev.message, { file: ev.filename, line: ev.lineno, stack: ev.error && ev.error.stack });
      });
      window.addEventListener('unhandledrejection', function (ev) {
        var r = ev.reason || {};
        log('Error', entity + ' form', 'UnhandledRejection', r.message || String(r), { stack: r.stack });
      });
    }
  }

  return {
    log: log,
    trace: function (c, o, m, d) { return log('Trace', c, o, m, d); },
    debug: function (c, o, m, d) { return log('Debug', c, o, m, d); },
    info: function (c, o, m, d) { return log('Information', c, o, m, d); },
    warn: function (c, o, m, d) { return log('Warning', c, o, m, d); },
    error: function (c, o, m, d, x) { return log('Error', c, o, m, d, x); },
    critical: function (c, o, m, d, x) { return log('Critical', c, o, m, d, x); },
    onFormLoad: onFormLoad,
    newCorrelation: function () { return newId(); },
    get sessionId() { return sessionId; }
  };
})();
