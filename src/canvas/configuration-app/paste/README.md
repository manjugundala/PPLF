# Build PPLF - Configuration App in Power Apps Studio

Power Apps Studio can't import `*.pa.yaml` source files directly. Until the app is exported into `src/solution`, build it once from these paste files: about 10 minutes.

Tip: on GitHub, open each file and use the **Copy raw file** button so the clipboard gets exactly the file's text.

## 1. Create the app

1. [make.powerapps.com](https://make.powerapps.com) → your environment → **Solutions → PPLF → New → App → Canvas app**.
2. Name **PPLF - Configuration App**, format **Tablet**, **Create**.

## 2. Add data and flows

- **Data → Add data**: `PPLF | Logs`, `PPLF | Configurations`, `Environment Variable Definitions`, `Environment Variable Values`.
- **… → Power Automate → Add flow**: `PPLF | Ingest | Power Apps`, `PPLF | Setup | Provision SharePoint`.

## 3. App properties

Select **App** in the Tree view, choose the property in the dropdown left of the formula bar, click in the formula bar and paste:

| Property | File |
|---|---|
| Formulas | [`App.Formulas.fx`](App.Formulas.fx) |
| OnStart | [`App.OnStart.fx`](App.OnStart.fx) |
| OnError | [`App.OnError.fx`](App.OnError.fx) |

## 4. Screens

1. **New screen → Blank** four times. Rename them (double-click the name) to `scrHome`, `scrLogs`, `scrSettings`, `scrSetup`. Delete `Screen1`.
2. For each screen: select it in the Tree view, copy its file, press **Ctrl+V**. Then set the screen's **Fill** and **OnVisible** as listed at the top of the file.

| Screen | File |
|---|---|
| scrHome | [`scrHome.controls.yaml`](scrHome.controls.yaml) |
| scrLogs | [`scrLogs.controls.yaml`](scrLogs.controls.yaml) |
| scrSettings | [`scrSettings.controls.yaml`](scrSettings.controls.yaml) |
| scrSetup | [`scrSetup.controls.yaml`](scrSetup.controls.yaml) |

Paste the screens in this order. Until all four exist, `Navigate(...)` formulas that point at a later screen show an error; they clear by themselves.

3. **App → StartScreen** (optional): [`App.StartScreen.fx`](App.StartScreen.fx). The first screen in Tree view opens by default, so you can skip this if scrHome is first.

## 5. Save and check

1. **Save** and **Publish**.
2. Open **App checker** (stethoscope icon). If Studio offers to update a modern control version, accept.
3. Run the app: **Setup → Send test entry** should report "Accepted 1 entry".

## If a paste fails

Studio rejects the whole paste and adds nothing, so you can fix and paste again.

- **"The clipboard doesn't contain any YAML code to paste"**: you copied a file that starts with `Screens:`. Use the `*.controls.yaml` files here; they start with `- conXxxRoot:`.
- **`PA2108 Unknown property 'X'`**: the control doesn't have that property in your Studio version. Remove the line in `../Src`, add it to `REJECTED` in `tools/build/lint-payaml.py`, and regenerate.
- **`PA2105 ... older than the current version`**: only a warning, but raise the version in `../Src` and `MIN_VERSION` so it stays quiet.
- **Copying the error text replaces your clipboard.** Copy the controls file again before you retry.

## Afterwards

Export the solution (**Export solution from dev** workflow). From then on the app's real source lives in `src/solution`, and these paste files are only needed to rebuild from scratch.

These files are generated from `../Src` by `tools/build/paste-files.py`. Edit the source, then rerun the script.
