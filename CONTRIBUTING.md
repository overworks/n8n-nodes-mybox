# Contributing

`@overworks/n8n-nodes-mybox` is an n8n community node package for the NAVER MYBOX Open API. It uses TypeScript and the programmatic node structure provided by `@n8n/node-cli`.

The package is in development and has not been published to npm. Automated tests use mocked HTTP responses; integration testing with a real MYBOX account is still pending. Keep these distinctions accurate in documentation and release notes.

## Repository layout

- `credentials/MyboxApi.credentials.ts`: personal access token authentication and credential connection test.
- `nodes/Mybox/Mybox.node.ts`: node definition, per-item execution, output item linking, and error handling.
- `nodes/Mybox/descriptions.ts` and `*Descriptions.ts`: resource and operation selectors, fields, defaults, and display conditions.
- `nodes/Mybox/read.ts`, `files.ts`, `manage.ts`, and `trash.ts`: operation implementations.
- `nodes/Mybox/transport.ts`: authenticated API requests, validation, pagination, rate-limit retries, and cancellation.
- `tests/*.test.cjs`: tests using Node.js's built-in test runner against the compiled output.
- `tests/helpers.cjs`: mocked n8n execution context and HTTP helpers.
- `examples/storage-check.json`: workflow for checking storage with a real credential.
- [README.md](README.md): English usage documentation.
- [README.ko.md](README.ko.md): Korean usage documentation.
- [CONTRIBUTING.md](CONTRIBUTING.md): shared development guidelines.
- [AGENTS.md](AGENTS.md): instructions specific to coding agents.
- `dist/`: generated build output; do not edit it directly.

## Development and validation

Install dependencies, run the automated checks, and build an installable package:

```sh
npm ci --ignore-scripts
npm test
npm run lint
npm pack
```

`npm test` builds the TypeScript source and checks API contracts, pagination, binary transfer handling, field visibility and defaults, and error, retry, and cancellation behavior. Tests use mocked HTTP responses and do not access a real MYBOX account. `npm pack` builds the package and creates an installable `.tgz` archive.

Use `npm run build` to compile the node and credentials without running tests, or `npm run dev` to start a development server. See the [official development CLI documentation](https://docs.n8n.io/integrations/creating-nodes/build/n8n-node/).

For code changes, run `npm test` and `npm run lint`. Add or update focused tests when behavior changes. Use `npm pack` when validating package contents or manual installation. For documentation-only changes, check local links and run `git diff --check`; a build is not required.

To test the package with a real account, follow the [Docker installation and testing guide](README.md#testing-with-an-existing-docker-n8n-instance) after building the archive.

## Publishing

The [publish workflow](.github/workflows/publish.yml) runs when a version tag such as `v0.1.0` is pushed. The tag must exactly match `v` followed by the version in `package.json`. It checks out the tagged commit, so releases can be made from the `0.x` branch.

The workflow uses Node.js 24 and npm 11, installs dependencies from the lockfile, builds and tests the package, runs lint, and publishes with npm provenance. Stable versions use the `latest` npm tag; prerelease versions such as `0.2.0-beta.1` use `next`.

Before pushing a release tag, complete real-account integration testing and configure npm [Trusted Publishing](https://docs.npmjs.com/trusted-publishers/) for the package. Create the package entry first if it does not yet exist; npm supports this through [staged publishing](https://docs.npmjs.com/staged-publishing/).

Register GitHub Actions as a trusted publisher with owner `overworks`, repository `n8n-nodes-mybox`, and workflow filename `publish.yml`. Allow `npm publish` and leave the environment name empty, since this workflow does not use a GitHub Environment. Authentication uses OIDC and does not require an `NPM_TOKEN` secret. Configure the publisher when ready to release: npm requires its first successful publish within two days of registration.

Commit and push the workflow and release changes before creating and pushing the matching version tag. A regular branch push does not publish the package.

## Implementation conventions

- Follow the strict TypeScript configuration and existing module boundaries. Formatting uses tabs, single quotes, trailing commas, and a 100-character print width.
- Keep operation fields, defaults, and display conditions consistent with the implementation.
- Use the shared transport helpers for MYBOX API requests and validation, and n8n helpers for binary data handling.
- Preserve per-item parameter evaluation, `pairedItem` output links, and continue-on-fail behavior. Cancellation must stop execution even when continue-on-fail is enabled.
- Keep personal access tokens in n8n credentials. Do not add the PAT to upload or download URL requests, or expose signed transfer URLs in error messages.
- Preserve the retry policy: only API `GET` requests receiving HTTP 429 are retried, at most twice. Honor `Retry-After`, use a 60-second fallback, and return an error if the requested delay exceeds 60 seconds. Do not automatically retry mutations or file transfers.
- Keep overwrite disabled by default and distinguish moving to trash from permanent deletion. Emptying trash affects the entire account.
- Automated tests must use mocked requests and must not require real credentials. Do not commit tokens, signed URLs, or private account responses.

## Documentation

Write `AGENTS.md`, `CONTRIBUTING.md`, and `README.md` in English. Maintain `README.ko.md` as the Korean counterpart to `README.md`, and keep the language links and documented behavior synchronized. Preserve runnable commands, operation names, parameter names, and example paths when translating.

Keep installation and usage instructions in the READMEs, shared development guidelines in this file, and instructions specific to coding agents in `AGENTS.md`. Link to the relevant guide to avoid duplicating development rules.
