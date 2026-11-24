using System;
using System.Globalization;
using Microsoft.Xrm.Sdk;

namespace Pplf.Plugins
{
    /// <summary>PPLF log levels. The Dataverse choice value is 917000000 + (int)level.</summary>
    public enum PplfLevel
    {
        Trace = 0,
        Debug = 1,
        Information = 2,
        Warning = 3,
        Error = 4,
        Critical = 5
    }

    /// <summary>
    /// Writes PPLF log entries from plug-ins and custom workflow activities.
    /// </summary>
    /// <remarks>
    /// Every entry is also written to the plug-in trace log, so nothing is lost when
    /// Dataverse rolls back the transaction: a synchronous plug-in that throws
    /// discards the pplf_log row it wrote inside the same transaction. See
    /// docs/plugins.md for the patterns that keep error entries.
    /// The logger never throws.
    /// </remarks>
    public sealed class PplfLogger
    {
        public const int LevelBase = 917000000;
        public const int SourceTypePlugin = 917000004;

        private readonly IOrganizationService _service;
        private readonly ITracingService _tracing;
        private readonly IPluginExecutionContext _context;
        private readonly string _sourceName;

        public PplfLogger(IOrganizationService service, ITracingService tracing, IPluginExecutionContext context, string sourceName)
        {
            _service = service;
            _tracing = tracing;
            _context = context;
            _sourceName = string.IsNullOrWhiteSpace(sourceName) ? "Plug-in" : sourceName;
            MinimumLevel = PplfLevel.Information;
        }

        /// <summary>Entries below this level go to the trace log only.</summary>
        public PplfLevel MinimumLevel { get; set; }

        /// <summary>Correlation id shared with the app or flow that started the work. Defaults to the platform CorrelationId.</summary>
        public string CorrelationId { get; set; }

        public Guid? Trace(string component, string message) => Log(PplfLevel.Trace, component, null, message, null);
        public Guid? Debug(string component, string message) => Log(PplfLevel.Debug, component, null, message, null);
        public Guid? Info(string component, string message) => Log(PplfLevel.Information, component, null, message, null);
        public Guid? Warn(string component, string message, string details = null) => Log(PplfLevel.Warning, component, null, message, details);
        public Guid? Error(string component, string operation, string message, string details = null, string errorCode = null) =>
            Log(PplfLevel.Error, component, operation, message, details, errorCode);
        public Guid? Error(string component, string operation, Exception ex) =>
            Log(PplfLevel.Error, component, operation, ex.Message, ex.ToString(), ex.GetType().Name);

        /// <summary>Writes one entry. Returns the new pplf_log id, or null if it was filtered out or failed.</summary>
        public Guid? Log(PplfLevel level, string component, string operation, string message, string details, string errorCode = null, int? durationMs = null)
        {
            var correlation = CorrelationId ?? _context?.CorrelationId.ToString();
            _tracing?.Trace("[PPLF {0}] {1} {2}: {3}", level, component, operation, message);
            if (level < MinimumLevel) return null;

            try
            {
                var e = new Entity("pplf_log");
                e["pplf_name"] = Cut(message ?? "(no message)", 200);
                e["pplf_level"] = new OptionSetValue(LevelBase + (int)level);
                e["pplf_severity"] = (int)level;
                e["pplf_sourcetype"] = new OptionSetValue(SourceTypePlugin);
                e["pplf_sourcename"] = Cut(_sourceName, 200);
                e["pplf_component"] = Cut(component, 200);
                e["pplf_operation"] = Cut(operation ?? (_context == null ? null : _context.MessageName + " " + _context.PrimaryEntityName), 200);
                e["pplf_message"] = Cut(message ?? "(no message)", 4000);
                e["pplf_details"] = Cut(details, 100000);
                e["pplf_correlationid"] = Cut(correlation, 100);
                e["pplf_sessionid"] = Cut(_context?.OperationId.ToString(), 100);
                e["pplf_userprincipalname"] = Cut(_context?.InitiatingUserId.ToString(), 320);
                e["pplf_environment"] = Cut(_context?.OrganizationName, 100);
                e["pplf_errorcode"] = Cut(errorCode, 100);
                if (durationMs.HasValue) e["pplf_durationms"] = durationMs.Value;
                e["pplf_clienttimestamp"] = DateTime.UtcNow;
                e["pplf_clientinfo"] = Cut(string.Format(CultureInfo.InvariantCulture, "Plug-in; stage {0}; depth {1}; mode {2}",
                    _context?.Stage, _context?.Depth, _context?.Mode), 500);
                return _service.Create(e);
            }
            catch (Exception ex)
            {
                _tracing?.Trace("[PPLF] could not write log entry: {0}", ex.Message);
                return null;
            }
        }

        private static string Cut(string s, int max) => s == null ? null : (s.Length > max ? s.Substring(0, max) : s);
    }
}
