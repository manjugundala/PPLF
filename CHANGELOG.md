# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).
The solution version in Dataverse is the same number with a fourth part (1.0.0 → 1.0.0.0).

## [Unreleased]

## [1.0.0] - 2026-11-23

### Added
- Schema-as-code (`schema/pplf.schema.json`): one definition for the Dataverse tables, the SharePoint lists, environment variables, connection references and security roles.
- `PPLF Log` and `PPLF Log Configuration` Dataverse tables with global choices for level and source type.
- SharePoint lists with the same columns (indexed for large lists), created by a flow, a browser script or the CLI.
- Ten cloud flows: router, Dataverse writer, SharePoint writer, Write Log child flow, ingestion for Power Apps and Power Pages, SharePoint provisioning, retention cleanup, Dataverse-to-SharePoint forwarder and a Try/Catch template.
- Canvas logging with user-defined functions in three variants (Dataverse direct, SharePoint direct, router), plus `App.OnError` capture.
- PPLF Admin canvas app with modern controls: overview, log viewer, settings and setup wizard.
- Power Pages logger (cloud flow or Web API transport) with automatic error capture.
- Model-driven app web resource logger.
- Plug-in logger, plug-in base class and `pplf_WriteLog` Custom API.
- Zero-dependency deployer (Node CLI and browser bundle), unit tests, GitHub Actions for CI, export, release and docs.
