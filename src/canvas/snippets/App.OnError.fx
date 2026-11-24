// =============================================================================
// PPLF - catch every unhandled error in a canvas app
// =============================================================================
// Paste into the App object's OnError property (works with any of the three
// PplfLogger variants). Every error that isn't handled by IfError is logged
// with its kind, source control, property and HTTP status, then re-raised so
// the user still sees the normal error banner.
// =============================================================================
ForAll(AllErrors,
    PplfLog(
        If(ThisRecord.Kind = ErrorKind.Network || ThisRecord.Kind = ErrorKind.Unknown, "Critical", "Error"),
        Coalesce(Text(ThisRecord.Source), App.ActiveScreen.Name),
        Coalesce(Text(ThisRecord.Observed), "Unhandled"),
        ThisRecord.Message,
        JSON({
            kind: Text(ThisRecord.Kind),
            source: Text(ThisRecord.Source),
            observed: Text(ThisRecord.Observed),
            screen: App.ActiveScreen.Name,
            httpStatus: ThisRecord.Details.HttpStatusCode
        }, JSONFormat.IgnoreUnsupportedTypes)
    )
);
Error(AllErrors)
