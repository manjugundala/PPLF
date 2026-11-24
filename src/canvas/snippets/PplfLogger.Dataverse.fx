// =============================================================================
// PPLF Logger for canvas apps - DIRECT mode, Dataverse target
// =============================================================================
// Paste into App.Formulas. Add the "PPLF Logs" and "PPLF Log Configurations"
// tables as data sources. Needs a premium (Dataverse) licence, which apps that
// already use Dataverse have.
//
// Writes straight to Dataverse with Patch: fastest, no flow runs consumed.
// Honors the per-source Minimum Level from PPLF Log Configurations.
// Logging never breaks the app: failures go to colPplfFailed.
//
// Use:   PplfInfo("scrHome", "Opened home screen");
//        PplfError("scrSubmit", "SubmitExpense", "Patch failed", JSON({id: ThisItem.ID}));
//        PplfNewCorrelation();   // at the start of a user action that calls flows
// =============================================================================

// ---- Settings: edit these two lines ---------------------------------------
PplfSourceName = "My Canvas App";
PplfAppVersion = "1.0.0";

// ---- Configuration lookup (cached by the app, refreshed with Refresh()) ----
PplfSourceConfig = LookUp('PPLF | Configurations', 'Source Name' = PplfSourceName);
PplfDefaultConfig = LookUp('PPLF | Configurations', 'Source Name' = "*");
PplfEnabled = Coalesce(PplfSourceConfig.Enabled, PplfDefaultConfig.Enabled, true);
PplfMinSeverity = Coalesce(PplfSourceConfig.'Minimum Severity', PplfDefaultConfig.'Minimum Severity', 2);

PplfSeverity(Level: Text): Number =
    Switch(Level, "Trace", 0, "Debug", 1, "Information", 2, "Warning", 3, "Error", 4, "Critical", 5, 2);

PplfClientInfo = Host.OSType & "; " & Left(Host.BrowserUserAgent, 400);

// ---- Correlation ------------------------------------------------------------
// Call at the start of a user action; pass gblPplfCorrelationId to flows so
// the app entry and the flow entries share one id.
PplfNewCorrelation(): Void = {
    Set(gblPplfCorrelationId, GUID())
};

// ---- Core -------------------------------------------------------------------
PplfLog(Level: Text, Component: Text, Operation: Text, Message: Text, Details: Text): Void = {
    If(IsBlank(gblPplfSessionId), Set(gblPplfSessionId, GUID()));
    If(PplfEnabled && PplfSeverity(Level) >= PplfMinSeverity,
        IfError(
            Patch('PPLF | Logs', Defaults('PPLF | Logs'), {
                Title: Left(Coalesce(Message, "(no message)"), 200),
                Level: Switch(Level,
                    "Trace", 'PPLF | Log Level'.Trace,
                    "Debug", 'PPLF | Log Level'.Debug,
                    "Warning", 'PPLF | Log Level'.Warning,
                    "Error", 'PPLF | Log Level'.Error,
                    "Critical", 'PPLF | Log Level'.Critical,
                    'PPLF | Log Level'.Information),
                Severity: PplfSeverity(Level),
                'Source Type': 'PPLF | Source Type'.'Canvas App',
                'Source Name': PplfSourceName,
                Component: Left(Component, 200),
                Operation: Left(Operation, 200),
                Message: Left(Coalesce(Message, "(no message)"), 4000),
                'Details (JSON)': Details,
                'Correlation Id': Coalesce(gblPplfCorrelationId, gblPplfSessionId),
                'Session Id': gblPplfSessionId,
                User: User().Email,
                'App Version': PplfAppVersion,
                'Client Timestamp': Now(),
                'Client Info': PplfClientInfo
            }),
            Collect(colPplfFailed, { Level: Level, Message: Message, Error: FirstError.Message, At: Now() })
        )
    )
};

// ---- Shortcuts --------------------------------------------------------------
PplfTrace(Component: Text, Message: Text): Void = { PplfLog("Trace", Component, "", Message, "") };
PplfDebug(Component: Text, Message: Text): Void = { PplfLog("Debug", Component, "", Message, "") };
PplfInfo(Component: Text, Message: Text): Void = { PplfLog("Information", Component, "", Message, "") };
PplfWarn(Component: Text, Message: Text): Void = { PplfLog("Warning", Component, "", Message, "") };
PplfError(Component: Text, Operation: Text, Message: Text, Details: Text): Void = { PplfLog("Error", Component, Operation, Message, Details) };
PplfCritical(Component: Text, Operation: Text, Message: Text, Details: Text): Void = { PplfLog("Critical", Component, Operation, Message, Details) };

// ---- Timing -----------------------------------------------------------------
// PplfStart("SubmitExpense"); ...work...; PplfStop("scrSubmit", "SubmitExpense");
PplfStart(Operation: Text): Void = { Set(gblPplfTimerStart, Now()); Set(gblPplfTimerOp, Operation) };
PplfStop(Component: Text, Operation: Text): Void = {
    PplfLog("Information", Component, Operation,
        Operation & " took " & Text(DateDiff(gblPplfTimerStart, Now(), TimeUnit.Milliseconds)) & " ms",
        JSON({ durationMs: DateDiff(gblPplfTimerStart, Now(), TimeUnit.Milliseconds) }))
};
