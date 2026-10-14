# uraeda

The web UI of [Uraeda](https://github.com/mrtolkien/uraeda), an asynchronous, git-driven development
workflow for coding agents.

In a git repository, with Node 24 or later:

```sh
npx uraeda
```

The server starts on `http://127.0.0.1:4310`, adds the repository to its list, and opens its page in
the browser. Run it again in another repository while the server runs, and that repository opens in
the same server. `npx uraeda --help` lists the options.

Sessions run Claude Code, which must be installed and signed in.

## How this package is built

`vp run --filter uraeda build`, in a checkout of the repository, after the web UI's build, writes:

- `dist/uraeda.mjs`: the server, bundled into one file;
- `dist/binding.js`: the native binding's loader, as napi-rs generates it;
- `web/`: the built web UI;
- `plugin/`: the agents' plugin, with a copy of the skill.

The native binding comes from one `uraeda-binding-<platform>` package per platform, which npm
installs as an optional dependency.
`node packages/uraeda/scripts/smoke.ts --binding packages/binding` packs and checks the package from
a temporary folder, as part of `vp run ready`.
