# Feature: Github Releases

## Goals

- throw away current release-please flow

- automated github release creation on merge to main
- cross-platform binaries should be published as release artifacts
- changelog included in release description
- simple versioning scheme based on semver, starting with 0.1.0
- installs served via mise straight from the GitHub release assets (no npm, no private registry)

## Implementation

beta/release flow based on opencode publishing/versioning method in <https://github.com/anomalyco/opencode/blob/dev/.github/workflows/publish.yml#L58>, <https://github.com/anomalyco/opencode/blob/dev/script/version.ts>, <https://github.com/anomalyco/opencode/releases>

### Pre-releases

- pushes to a PR branch should create/update a beta (GH beta release) associated with that branch.
- release name e.g. `PR #12345: foo bar title`
- once a PR is merged, we'll close the beta release

### Main-channel releases

- create a manual dispatch action for `create-release`.
- runs on main branch
- increments git release tag with input from manual dispatch (or defaults to incrementing patch version in package.json.
- does a package.json bump with desired new version, commits, tags with desired tag.
- createa a github release for main channel as in <https://github.com/anomalyco/opencode/blob/dev/script/version.ts>
- collects release notes from git history since last release
