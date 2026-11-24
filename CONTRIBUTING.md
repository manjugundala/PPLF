# Contributing

Thanks for helping. Bug reports, docs fixes, new clients and new targets are all welcome.

## Ground rules

- Open an issue before a large change, so we can agree on the approach.
- Keep pull requests focused: one change, with tests and docs.
- Be kind. See the [code of conduct](CODE_OF_CONDUCT.md).

## Set up

```bash
git clone https://github.com/OWNER/power-platform-logging-framework.git
cd power-platform-logging-framework
npm test
```

Node 22+ and Python 3 with PyYAML (`pip install pyyaml`). There are no npm dependencies.

For changes that touch Power Platform you also need a **developer environment** (free with the [Power Apps Developer Plan](https://learn.microsoft.com/power-platform/developer/plan)) and, for SharePoint, a test site.

## Where to make a change

| You want to… | Edit | Then |
|---|---|---|
| Add or change a column, choice, environment variable or role | `schema/pplf.schema.json` | `npm run build`, update tests if needed |
| Change flow logic | `tools/build/flows.mjs` | `npm run build`, redeploy to your dev environment, test both targets |
| Change the canvas loggers | `src/canvas/snippets/*.fx` | Test in a real app; keep the three variants' function signatures identical |
| Change PPLF Admin | Studio in your dev environment | Export with the workflow, or copy the changed `*.pa.yaml` into `src/canvas/admin-app/Src` |
| Change Power Pages / model-driven / plug-in loggers | `src/pages`, `src/webresources`, `src/plugins` | Test against a dev site, form or plug-in step |
| Fix docs | `docs/` | `mkdocs serve` to preview (optional) |

**Never hand-edit generated files** (`src/flows/*.json`, `src/sharepoint/lists.json`, `dist/`, `docs/reference/schema.md`); CI rejects them if they don't match the generator.

## Compatibility rules

- Within a major version, do not rename or remove columns, choice values, environment variables or flow names. Add instead.
- Choice values are `917000000 + n` and must never be reused for a different meaning.
- Every writer must set every column (tests enforce this).
- A logger must never throw into the caller.

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/): `feat(flows): add Teams alerts`, `fix(canvas): keep buffer on flow error`, `docs: clarify licensing`. Release notes are generated from them.

## Pull request checklist

The [PR template](.github/pull_request_template.md) has it. CI runs the generator check, unit tests, YAML lint, JavaScript syntax checks, a deployer dry run and the plug-in build.

## Releasing (maintainers)

1. Export from dev and merge the PR.
2. Update `CHANGELOG.md` and `schema.version`.
3. Tag: `git tag v1.1.0 && git push --tags`. The release workflow attaches the managed and unmanaged solutions, the browser deployer and the plug-in DLL.
