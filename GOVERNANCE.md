# Governance

## Roles

| Role | Who | Responsibilities |
|---|---|---|
| **Maintainer** | [@manjugundala](https://github.com/manjugundala) (creator and lead) | Roadmap, reviews and merges, releases, security response |
| **Contributor** | Anyone who opens an issue, discussion or pull request | Follow [CONTRIBUTING.md](CONTRIBUTING.md) and the [code of conduct](CODE_OF_CONDUCT.md) |

Contributors with a record of good pull requests may be invited to become maintainers.

## Decisions

- Small changes are decided in the pull request.
- Changes to the log schema, the storage model or public functions need an issue first and are recorded as an
  [architecture decision record](docs/adr/README.md).
- The schema is a public contract: breaking changes only in a major version, announced in the [changelog](CHANGELOG.md).

## Releases

[Semantic Versioning](https://semver.org/). A tag `vX.Y.Z` on `main` runs the Release workflow, which publishes managed and
unmanaged solutions, the plug-in assembly and the browser deployer. The solution version in Dataverse is `X.Y.Z.0`.
