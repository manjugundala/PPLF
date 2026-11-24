using System;
using Microsoft.Xrm.Sdk;

namespace Pplf.Plugins
{
    /// <summary>
    /// Implements the pplf_WriteLog Custom API: one unbound action every client can call.
    ///
    ///   JavaScript:  Xrm.WebApi.online.execute({ Level: "Error", Message: "...", SourceName: "...", getMetadata: ... })
    ///   Web API:     POST [org]/api/data/v9.2/pplf_WriteLog { "Level": "Error", "Message": "...", "SourceName": "..." }
    ///   Power Fx:    Environment.pplf_WriteLog({ Level: "Error", Message: "...", SourceName: "..." })
    ///   Flows:       Dataverse "Perform an unbound action" -> pplf_WriteLog
    ///
    /// Register on the main operation (stage 30) of the Custom API message.
    /// </summary>
    public sealed class WriteLogApi : IPlugin
    {
        private static readonly string[] SourceTypes = { "Canvas App", "Model-driven App", "Cloud Flow", "Power Pages", "Plug-in", "Custom" };

        public void Execute(IServiceProvider serviceProvider)
        {
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            var tracing = (ITracingService)serviceProvider.GetService(typeof(ITracingService));
            var factory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
            var service = factory.CreateOrganizationService(null);

            string Get(string name) => context.InputParameters.Contains(name) ? context.InputParameters[name] as string : null;

            var levelText = Get("Level");
            if (!Enum.TryParse(levelText, true, out PplfLevel level))
            {
                throw new InvalidPluginExecutionException("Level must be Trace, Debug, Information, Warning, Error or Critical.");
            }

            var sourceName = Get("SourceName");
            if (string.IsNullOrWhiteSpace(sourceName)) throw new InvalidPluginExecutionException("SourceName is required.");
            if (string.IsNullOrWhiteSpace(Get("Message"))) throw new InvalidPluginExecutionException("Message is required.");

            var logger = new PplfLogger(service, tracing, context, sourceName)
            {
                MinimumLevel = PplfLevel.Trace,
                CorrelationId = Get("CorrelationId")
            };

            var id = logger.Log(level, Get("Component"), Get("Operation"), Get("Message"), Get("Details"));

            // The logger stamps "Plug-in"; honour the caller's source type when it is a known one.
            var sourceType = Array.IndexOf(SourceTypes, Get("SourceType") ?? string.Empty);
            if (id.HasValue && sourceType >= 0 && sourceType != 4)
            {
                var update = new Entity("pplf_log", id.Value);
                update["pplf_sourcetype"] = new OptionSetValue(PplfLogger.LevelBase + sourceType);
                service.Update(update);
            }

            context.OutputParameters["LogId"] = id ?? Guid.Empty;
            context.OutputParameters["Written"] = id.HasValue;
        }
    }
}
