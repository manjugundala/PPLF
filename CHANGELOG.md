# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).
The solution version in Dataverse is the same number with a fourth part (1.0.0 → 1.0.0.0).

## [Unreleased]

## [1.0.1] - 2026-11-24

### Changed
- Overview: the level count cards use solid Flat UI colours with white text (Critical, Errors, Warnings, All entries),
  and the label no longer overlaps the count.

### Fixed
- Logs: the level filter shows "All levels" and "≥ <level>" instead of record numbers.
- Settings: level dropdowns show level names, and labels are no longer cut off.
- The unpack workflow also blanks tenant values that flows capture in their parameter defaults.

### Documentation
- Why logging: Microsoft Learn sources for the 28-day flow run history and 24-hour plug-in trace retention.

## [1.0.0] - 2026-11-24

### Added
- PPLF - Configuration App built and published in the dev environment, with the Texas flag theme shared with PPMF
  (`BrandTheme` in `App.OnStart`), title bands, and nav icons; app icon in `brand/`.
- Exported, unpacked solution in `src/solution` (environment variable values excluded) and the
  *Unpack solution drop* workflow for exports made without a service principal.
- Studio paste files and guide for the Configuration App, with a lint that blocks properties Studio rejects.
- Documentation: prerequisites, Configuration App guide, comparison with Power Platform monitoring tools, FAQ;
  `SUPPORT.md` and `GOVERNANCE.md`.
- Schema-as-code (`schema/pplf.schema.json`): one definition for the Dataverse tables, the SharePoint lists, environment variables, connection references and security roles.
- `PPLF Log` and `PPLF Log Configuration` Dataverse tables with global choices for level and source type.
- SharePoint lists with the same columns (indexed for large lists), created by a flow, a browser script or the CLI.
- Ten cloud flows: router, Dataverse writer, SharePoint writer, Write Log child flow, ingestion for Power Apps and Power Pages, SharePoint provisioning, retention cleanup, Dataverse-to-SharePoint forwarder and a Try/Catch template.
- Canvas logging with user-defined functions in three variants (Dataverse direct, SharePoint direct, router), plus `App.OnError` capture.
- PPLF - Configuration App canvas app with modern controls: overview, log viewer, settings and setup wizard.
- Power Pages logger (cloud flow or Web API transport) with automatic error capture.
- Model-driven app web resource logger.
- Plug-in logger, plug-in base class and `pplf_WriteLog` Custom API.
- Zero-dependency deployer (Node CLI and browser bundle), unit tests, GitHub Actions for CI, export, release and docs.
