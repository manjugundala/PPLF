// =============================================================================
// PPLF Logger for canvas apps - ROUTER mode (target-agnostic)
// =============================================================================
// Paste into App.Formulas and add the "PPLF | Ingest | Power Apps" flow to
// the app (Power Automate pane). The app never needs to know where logs go:
// the PPLF Log Target environment variable decides, so an admin can move from
// SharePoint to Dataverse without touching the app.
//
// Entries are buffered in colPplfBuffer and sent in one flow call when:
//   * an Error or Critical entry is logged (sent at once)
//   * the buffer reaches PplfBatchSize entries
//   * you call PplfFlush() (do it in each screen's OnHidden)
// The flow applies the per-source Minimum Level; PplfClientMinSeverity drops
// noise before it leaves the device.
//
// If the flow has a different name in your app, change 'PPLF|Ingest|PowerApps'
// in PplfFlush below to match.
// =============================================================================

PplfSourceName = "My Canvas App";
PplfAppVersion = "1.0.0";
PplfClientMinSeverity = 2;  // 0=Trace ... 5=Critical
PplfBatchSize = 20;

PplfSeverity(Level: Text): Number =
    Switch(Level, "Trace", 0, "Debug", 1, "Information", 2, "Warning", 3, "Error", 4, "Critical", 5, 2);

PplfClientInfo = Left(Host.OSType & "; " & Host.BrowserUserAgent, 255);

PplfNewCorrelation(): Void = {
    Set(gblPplfCorrelationId, GUID())
};

PplfFlush(): Void = {
    If(CountRows(colPplfBuffer) > 0,
        IfError(
            'PPLF|Ingest|PowerApps'.Run(JSON(colPplfBuffer, JSONFormat.IgnoreBinaryData));
            Clear(colPplfBuffer),
            // Keep entries for the next attempt, but never let the buffer grow without bound.
            If(CountRows(colPplfBuffer) > 200, Clear(colPplfBuffer))
        )
    )
};

PplfLog(Level: Text, Component: Text, Operation: Text, Message: Text, Details: Text): Void = {
    If(IsBlank(gblPplfSessionId), Set(gblPplfSessionId, GUID()));
    If(PplfSeverity(Level) >= PplfClientMinSeverity,
        Collect(colPplfBuffer, {
            level: Level,
            message: Left(Coalesce(Message, "(no message)"), 4000),
            sourceName: PplfSourceName,
            sourceType: "Canvas App",
            component: Left(Component, 200),
            operation: Left(Operation, 200),
            details: Details,
            correlationId: Coalesce(gblPplfCorrelationId, gblPplfSessionId),
            sessionId: gblPplfSessionId,
            userPrincipalName: User().Email,
            appVersion: PplfAppVersion,
            clientTimestamp: Text(Now(), DateTimeFormat.UTC),
            clientInfo: PplfClientInfo
        });
        If(PplfSeverity(Level) >= 4 || CountRows(colPplfBuffer) >= PplfBatchSize, PplfFlush())
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
