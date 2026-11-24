ForAll(AllErrors,
    PplfAdminLog("Error", Coalesce(Text(ThisRecord.Source), App.ActiveScreen.Name), ThisRecord.Message));
Error(AllErrors)
