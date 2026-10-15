# `@uraeda/ui`

The web UI of [Uraeda](https://github.com/mrtolkien/uraeda), an asynchronous, git-driven development
workflow for coding agents. In a git repository, with Node 24 or later:

```sh
npx @uraeda/ui
```

In a repository whose `package.json` asks for another package manager in `devEngines`, npm refuses
to run `npx`: in a pnpm project, use `pnpm dlx @uraeda/ui`; anywhere, `npm i -g @uraeda/ui` then
`uraeda`.

See the [repository](https://github.com/mrtolkien/uraeda) for how Uraeda works, its options, and how
to install the rest of it.
