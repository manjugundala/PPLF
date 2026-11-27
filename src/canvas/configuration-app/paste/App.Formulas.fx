// ---- Environment variables ---------------------------------------------
PplfEnvDefault(Name: Text): Text =
    LookUp('Environment Variable Definitions', 'Schema Name' = Name).'Default Value';
PplfEnv(Name: Text): Text =
    Coalesce(
        LookUp('Environment Variable Values', 'Environment Variable Definition'.'Schema Name' = Name).Value,
        PplfEnvDefault(Name));

PplfSetEnv(Name: Text, NewValue: Text): Void = {
    With({
            def: LookUp('Environment Variable Definitions', 'Schema Name' = Name),
            cur: LookUp('Environment Variable Values', 'Environment Variable Definition'.'Schema Name' = Name)
        },
        If(IsBlank(cur),
            Patch('Environment Variable Values', Defaults('Environment Variable Values'), {
                'Schema Name': Name & "_value",
                Value: NewValue,
                'Environment Variable Definition': def
            }),
            Patch('Environment Variable Values', cur, { Value: NewValue })
        )
    );
    Refresh('Environment Variable Values')
};

PplfTarget = PplfEnv("pplf_LogTarget");

// ---- Levels ------------------------------------------------------------
PplfLevels = Table(
    { Name: "Trace",       Severity: 0 },
    { Name: "Debug",       Severity: 1 },
    { Name: "Information", Severity: 2 },
    { Name: "Warning",     Severity: 3 },
    { Name: "Error",       Severity: 4 },
    { Name: "Critical",    Severity: 5 });
// Level colors follow the PPMF BrandTheme palette. Kept as a function, not a
// table of colors, because color records in named formulas can render blank
// in the published player (see PPMF power-apps/theme/README.md).
PplfLevelColor(Sev: Number): Color =
    Switch(Sev,
        5, RGBA(154, 10, 50, 1),    // Critical  #9A0A32 (BrandTheme.AccentDark)
        4, RGBA(191, 13, 62, 1),    // Error     #BF0D3E (BrandTheme.Error)
        3, RGBA(138, 90, 0, 1),     // Warning   #8A5A00 (BrandTheme.Warning)
        2, RGBA(0, 40, 104, 1),     // Information #002868 (BrandTheme.Primary)
        RGBA(100, 100, 100, 1));    // Trace/Debug #646464 (BrandTheme.TextSecondary)

// ---- Layout ------------------------------------------------------------
// Colors live in the BrandTheme global set in App.OnStart (shared with PPMF).
PplfGap = 16;

// ---- Self-logging (the admin app logs its own actions) -----------------
PplfSourceName = "PPLF - Configuration App";
PplfAppVersion = "1.0.1";
PplfAdminLog(Level: Text, Component: Text, Message: Text): Void = {
    If(IsBlank(gblPplfSessionId), Set(gblPplfSessionId, GUID()));
    IfError(
        Patch('PPLF | Logs', Defaults('PPLF | Logs'), {
            Title: Left(Message, 200),
            Level: Switch(Level, "Warning", 'PPLF | Log Level'.Warning, "Error", 'PPLF | Log Level'.Error, 'PPLF | Log Level'.Information),
            Severity: Switch(Level, "Warning", 3, "Error", 4, 2),
            'Source Type': 'PPLF | Source Type'.'Canvas App',
            'Source Name': PplfSourceName,
            Component: Component,
            Message: Message,
            'Session Id': gblPplfSessionId,
            'Correlation Id': gblPplfSessionId,
            User: User().Email,
            'App Version': PplfAppVersion,
            'Client Timestamp': Now()
        });
        true,
        false
    )
};
