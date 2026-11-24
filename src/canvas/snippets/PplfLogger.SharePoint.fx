// =============================================================================
// PPLF Logger for canvas apps - DIRECT mode, SharePoint target
// =============================================================================
// Paste into App.Formulas. Add the "PPLF Logs" and "PPLF Log Config" SharePoint
// lists as data sources (created by the PPLF Admin setup wizard, the
// "PPLF - Provision SharePoint" flow or tools/sharepoint). Standard licence only.
//
// Same function names as the Dataverse variant, so you can switch targets by
// swapping this block and the data sources. The column display names are the
// same in both stores.
// =============================================================================

// ---- Settings: edit these two lines ---------------------------------------
PplfSourceName = "My Canvas App";
PplfAppVersion = "1.0.0";

PplfSourceConfig = LookUp('PPLF Log Config', Title = PplfSourceName);
PplfDefaultConfig = LookUp('PPLF Log Config', Title = "*");
PplfEnabled = Coalesce(PplfSourceConfig.Enabled, PplfDefaultConfig.Enabled, true);
PplfMinSeverity = Coalesce(PplfSourceConfig.'Minimum Severity', PplfDefaultConfig.'Minimum Severity', 2);

PplfSeverity(Level: Text): Number =
    Switch(Level, "Trace", 0, "Debug", 1, "Information", 2, "Warning", 3, "Error", 4, "Critical", 5, 2);

PplfClientInfo = Left(Host.OSType & "; " & Host.BrowserUserAgent, 255);

PplfNewCorrelation(): Void = {
    Set(gblPplfCorrelationId, GUID())
};

PplfLog(Level: Text, Component: Text, Operation: Text, Message: Text, Details: Text): Void = {
    If(IsBlank(gblPplfSessionId), Set(gblPplfSessionId, GUID()));
    If(PplfEnabled && PplfSeverity(Level) >= PplfMinSeverity,
        IfError(
            Patch('PPLF Logs', Defaults('PPLF Logs'), {
                Title: Left(Coalesce(Message, "(no message)"), 200),
                Level: { Value: Level },
                Severity: PplfSeverity(Level),
                'Source Type': { Value: "Canvas App" },
                'Source Name': PplfSourceName,
                Component: Left(Component, 200),
                Operation: Left(Operation, 200),
                Message: Left(Coalesce(Message, "(no message)"), 4000),
                'Details (JSON)': Left(Details, 60000),
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

PplfTrace(Component: Text, Message: Text): Void = { PplfLog("Trace", Component, "", Message, "") };
PplfDebug(Component: Text, Message: Text): Void = { PplfLog("Debug", Component, "", Message, "") };
PplfInfo(Component: Text, Message: Text): Void = { PplfLog("Information", Component, "", Message, "") };
PplfWarn(Component: Text, Message: Text): Void = { PplfLog("Warning", Component, "", Message, "") };
PplfError(Component: Text, Operation: Text, Message: Text, Details: Text): Void = { PplfLog("Error", Component, Operation, Message, Details) };
PplfCritical(Component: Text, Operation: Text, Message: Text, Details: Text): Void = { PplfLog("Critical", Component, Operation, Message, Details) };

PplfStart(Operation: Text): Void = { Set(gblPplfTimerStart, Now()); Set(gblPplfTimerOp, Operation) };
PplfStop(Component: Text, Operation: Text): Void = {
    PplfLog("Information", Component, Operation,
        Operation & " took " & Text(DateDiff(gblPplfTimerStart, Now(), TimeUnit.Milliseconds)) & " ms",
        JSON({ durationMs: DateDiff(gblPplfTimerStart, Now(), TimeUnit.Milliseconds) }))
};
