# Release guide: the first npm release

What you do, once, so that CI can publish `uraeda` and its four platform packages from a version
tag, through npm's trusted publishing, with no npm token in the repository. Each step names the npm
page it was checked against, on 2026-10-15. After this first release, a release is step 5 alone.

The five names, all free on npm today:

- `uraeda-binding-linux-x64-gnu`
- `uraeda-binding-linux-arm64-gnu`
- `uraeda-binding-darwin-x64`
- `uraeda-binding-darwin-arm64`
- `uraeda`

## 0. Before merging the pull request

The `npm` workflow runs on the pull request: its `binaries`, `package`, and `smoke` jobs must be
green. Its `publish` job is skipped on pull requests.

## 1. Sign in to npm, with two-factor authentication

On npmjs.com: your profile picture, then Account, then "Two-Factor Authentication", then "Enable
2FA". `npm trust` refuses an account without it. Then sign in from a terminal, with npm 11.15.0 or
later (`npm --version`; `npm install --global npm@latest` otherwise):

```sh
npm login
```

It opens the browser to sign in, its default `web` sign-in.

Checked against: [npm login](https://docs.npmjs.com/cli/v11/commands/npm-login),
[configuring two-factor authentication](https://docs.npmjs.com/configuring-two-factor-authentication).

## 2. Publish each name once, as a `0.0.0` placeholder

A trusted publisher is set on a package that exists, so each name needs one version first. In bash
or zsh, outside the checkout (its `devEngines` asks for pnpm, which npm refuses):

```bash
cd "$(mktemp -d)"
for name in uraeda-binding-linux-x64-gnu uraeda-binding-linux-arm64-gnu \
  uraeda-binding-darwin-x64 uraeda-binding-darwin-arm64 uraeda; do
  mkdir "$name"
  cat > "$name/package.json" <<EOF
{
  "name": "$name",
  "version": "0.0.0",
  "description": "Placeholder: install the latest version",
  "license": "MIT OR Apache-2.0",
  "repository": { "type": "git", "url": "git+https://github.com/mrtolkien/uraeda.git" }
}
EOF
  (cd "$name" && npm publish --access public)
done
```

npm asks for your second factor on each publish. No `--tag` is needed: `0.0.0` is not a prerelease,
so it goes to `latest`, which the real release then takes over. A name and version can never be
published twice, even after `npm unpublish`: `0.0.0` stays the placeholder for good.

Checked against: [npm publish](https://docs.npmjs.com/cli/v11/commands/npm-publish): "`access`
Default: 'public' for new packages", "`tag` Default: 'latest'".

## 3. Add a trusted publisher to each package

Do this at most 2 days before step 5: "A newly created trusted publisher configuration must complete
its first successful publish within 2 days", or it expires and can no longer be used or edited.

From the terminal, still outside the checkout:

```bash
for name in uraeda-binding-linux-x64-gnu uraeda-binding-linux-arm64-gnu \
  uraeda-binding-darwin-x64 uraeda-binding-darwin-arm64 uraeda; do
  npm trust github "$name" --file npm.yml --repo mrtolkien/uraeda --allow-publish
done
```

`--allow-publish` is required: the workflow runs `npm publish`, which a trusted publisher allows
only when asked. A package has one trusted publisher: to replace it, `npm trust list` shows its id,
and `npm trust revoke --id <id>` removes it.

Or on npmjs.com, for each package: Settings, then "Trusted Publisher", then GitHub Actions, with:

- Organization or user: `mrtolkien`
- Repository: `uraeda`
- Workflow filename: `npm.yml`
- Environment name: empty
- Allowed actions: allow `npm publish`

Every package's `repository.url` is already `git+https://github.com/mrtolkien/uraeda.git`, which
trusted publishing requires to match the repository exactly.

Checked against: [trusted publishers](https://docs.npmjs.com/trusted-publishers),
[npm trust](https://docs.npmjs.com/cli/v11/commands/npm-trust): "npm@11.15.0 or above is required",
"The package you're configuring must already exist on the npm registry", and at least one of
`--allow-publish` or `--allow-stage-publish`.

## 4. Deprecate the placeholders

```sh
npm deprecate uraeda@0.0.0 "Placeholder: install the latest version"
npm deprecate uraeda-binding-linux-x64-gnu@0.0.0 "Placeholder: install the latest version"
npm deprecate uraeda-binding-linux-arm64-gnu@0.0.0 "Placeholder: install the latest version"
npm deprecate uraeda-binding-darwin-x64@0.0.0 "Placeholder: install the latest version"
npm deprecate uraeda-binding-darwin-arm64@0.0.0 "Placeholder: install the latest version"
```

Checked against: [npm deprecate](https://docs.npmjs.com/cli/v11/commands/npm-deprecate):
`npm deprecate <package-spec> <message>`, for a single version or a range.

## 5. Release: bump the version, tag it, push the tag

Once the pull request is merged, on `main`, the way `v0.4.0` was released: set the version in
`Cargo.toml`'s `[workspace.package]`, here `0.5.0`, then:

```sh
cargo check                          # updates Cargo.lock
git commit -am "chore: release v0.5.0"
git tag v0.5.0
git push origin main v0.5.0
```

The tag starts two workflows: `release.yml` releases `ura`, and `npm.yml` builds the four binaries,
runs the smoke test on Linux x64 and macOS arm64, then publishes the four platform packages, then
`uraeda`, with provenance. A tag with a prerelease suffix, like `v0.6.0-rc.1`, publishes to the
`next` dist-tag, never `latest`.

Checked against: [trusted publishers](https://docs.npmjs.com/trusted-publishers): npm 11.5.1 or
later and Node 22.14.0 or later in CI (the workflow installs npm 11.5.1 or later on Node 24), and
the `id-token: write` permission (the `publish` job has it).

## 6. Check it on a clean machine

```sh
npx uraeda@latest --version          # prints 0.5.0
cd path/to/a/repository && npx uraeda
```

The browser opens the repository. On npmjs.com, each package's version shows its provenance.

## 7. If the workflow stopped part way

Never tag a new version for it. Run `npm.yml` again with the same tag: in the repository's Actions
tab, the "npm" workflow, "Run workflow", with `v0.5.0` as the tag. Or:

```sh
gh workflow run npm.yml -f tag=v0.5.0
```

It skips each package npm already has at that version, and publishes the rest, platforms first.

## 8. Optional, once it works: disallow tokens

On npmjs.com, for each package: Settings, then "Publishing access", then "Require two-factor
authentication and disallow tokens". Trusted publishing keeps working: the setting only affects
token publishing.

Checked against: [trusted publishers](https://docs.npmjs.com/trusted-publishers), which recommends
it.
