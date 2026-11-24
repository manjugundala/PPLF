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
    { Name: "Trace",       Severity: 0, Color: ColorValue("#8A8886") },
    { Name: "Debug",       Severity: 1, Color: ColorValue("#605E5C") },
    { Name: "Information", Severity: 2, Color: ColorValue("#002868") },
    { Name: "Warning",     Severity: 3, Color: ColorValue("#BC4B09") },
    { Name: "Error",       Severity: 4, Color: ColorValue("#C50F1F") },
    { Name: "Critical",    Severity: 5, Color: ColorValue("#750B1C") });
PplfLevelColor(Sev: Number): Color = Coalesce(LookUp(PplfLevels, Severity = Sev).Color, Color.Gray);

// ---- Layout tokens -----------------------------------------------------
PplfGap = 16;
PplfSurface = ColorValue("#FAFAFA");
PplfCard = Color.White;
PplfMuted = ColorValue("#616161");
PplfBrand = ColorValue("#002868");   // Texas flag navy
PplfAccent = ColorValue("#BF0A30");  // Texas flag red

// ---- Self-logging (the admin app logs its own actions) -----------------
PplfSourceName = "PPLF - Configuration App";
PplfAppVersion = "1.0.0";
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
