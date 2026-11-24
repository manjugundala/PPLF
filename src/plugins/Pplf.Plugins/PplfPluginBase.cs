using System;
using System.Diagnostics;
using Microsoft.Xrm.Sdk;

namespace Pplf.Plugins
{
    /// <summary>
    /// Optional base class: gives every plug-in a <see cref="PplfLogger"/>, times the
    /// execution, and logs unexpected exceptions before re-throwing them.
    /// </summary>
    /// <example>
    /// public class ValidateAccount : PplfPluginBase
    /// {
    ///     public ValidateAccount() : base("Contoso Account Plug-ins") { }
    ///     protected override void ExecuteCore(LocalContext ctx)
    ///     {
    ///         ctx.Log.Info(nameof(ValidateAccount), "Validating account");
    ///     }
    /// }
    /// </example>
    public abstract class PplfPluginBase : IPlugin
    {
        private readonly string _sourceName;

        protected PplfPluginBase(string sourceName)
        {
            _sourceName = sourceName;
        }

        /// <summary>Log a timing entry for every execution at this level (null = off).</summary>
        protected PplfLevel? TimingLevel { get; set; } = PplfLevel.Debug;

        public void Execute(IServiceProvider serviceProvider)
        {
            if (serviceProvider == null) throw new ArgumentNullException(nameof(serviceProvider));
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            var tracing = (ITracingService)serviceProvider.GetService(typeof(ITracingService));
            var factory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
            // Write logs as SYSTEM so callers do not need the PPLF | Log Writer role.
            var systemService = factory.CreateOrganizationService(null);
            var userService = factory.CreateOrganizationService(context.UserId);
            var log = new PplfLogger(systemService, tracing, context, _sourceName);
            var local = new LocalContext(context, userService, systemService, tracing, log);
            var component = GetType().Name;
            var watch = Stopwatch.StartNew();

            try
            {
                ExecuteCore(local);
                if (TimingLevel.HasValue)
                {
                    log.Log(TimingLevel.Value, component, context.MessageName, component + " completed in " + watch.ElapsedMilliseconds + " ms", null, null, (int)watch.ElapsedMilliseconds);
                }
            }
            catch (InvalidPluginExecutionException ex)
            {
                // Business-rule failures shown to the user. Logged as Warning; note that in a
                // synchronous step this row is rolled back with the transaction (trace log keeps it).
                log.Log(PplfLevel.Warning, component, context.MessageName, ex.Message, null, "InvalidPluginExecution", (int)watch.ElapsedMilliseconds);
                throw;
            }
            catch (Exception ex)
            {
                log.Log(PplfLevel.Error, component, context.MessageName, ex.Message, ex.ToString(), ex.GetType().Name, (int)watch.ElapsedMilliseconds);
                throw new InvalidPluginExecutionException(
                    "An unexpected error occurred. Reference: " + context.CorrelationId, ex);
            }
        }

        protected abstract void ExecuteCore(LocalContext context);

        public sealed class LocalContext
        {
            internal LocalContext(IPluginExecutionContext execution, IOrganizationService userService, IOrganizationService systemService, ITracingService tracing, PplfLogger log)
            {
                Execution = execution;
                UserService = userService;
                SystemService = systemService;
                Tracing = tracing;
                Log = log;
            }

            public IPluginExecutionContext Execution { get; }
            public IOrganizationService UserService { get; }
            public IOrganizationService SystemService { get; }
            public ITracingService Tracing { get; }
            public PplfLogger Log { get; }
        }
    }
}
