# uraeda.nvim

Uraeda's workflow files in Neovim: answer questions, comment on a spec, approve it or request
changes, draft a line of `PRIORITIES.md`, start a draft, paste an image, and commit, without leaving
the editor.

The plugin holds no workflow rules. It runs the `uraeda` language server, `ura lsp`, which gives
diagnostics as you type, completion and code actions for frontmatter values, document symbols, and
each feature's step next to its line in `PRIORITIES.md`. Actions that write another file or commit
run only when you ask.

## Requirements

- Neovim 0.11 or later
- `ura`, with `ura lsp`: see [Install](../../README.md#install), and `ura upgrade` to keep it
  current
- `git`
- Optional: [snacks.nvim](https://github.com/folke/snacks.nvim), for the waiting picker's preview
- Optional, for `:Uraeda image` to read the clipboard: `wl-paste` (wl-clipboard) on Wayland, `xclip`
  on X11, `pngpaste` on macOS, or PowerShell on Windows and WSL

`:checkhealth uraeda` checks them.

## Install

With [lazy.nvim](https://github.com/folke/lazy.nvim), from a checkout of this repository:

```lua
{ dir = "~/Development/ai/uraeda/editors/nvim", name = "uraeda.nvim" }
```

No `setup()` is needed. Options go in `vim.g.uraeda`, set before the plugin loads; these are the
defaults:

```lua
vim.g.uraeda = {
  prefix = "<leader>a", -- false sets no keys
  lsp = true,           -- false: the plugin does not enable the language server
  cmd = { "ura", "lsp" },
  inline_comments = true,
  clipboard = nil,      -- the command writing the clipboard's image to its output; nil finds it
}
```

## Keys

Set in the workflow files the language server attaches to: the markdown files under a `specs/`
folder that holds `PRIORITIES.md`. `<leader>aw` works from any buffer.

| Key          | Command            | Action                                                  |
| ------------ | ------------------ | ------------------------------------------------------- |
| `<leader>an` | `:Uraeda draft`    | Draft the `PRIORITIES.md` line under the cursor         |
| `<leader>ap` | `:Uraeda start`    | Start the draft or backlog file as a feature            |
| `<leader>ag` | `:Uraeda commit`   | Commit the draft, backlog file, proposal, or priorities |
| `<leader>ai` | `:Uraeda image`    | Add the clipboard's image, or a file's, at the cursor   |
| `<leader>am` | `:Uraeda comment`  | Comment on the line, or the visual selection            |
| `<leader>ae` | `:Uraeda field`    | Set a frontmatter field                                 |
| `<leader>av` | `:Uraeda verdict`  | Approve, request changes, or submit answers, and commit |
| `<leader>at` | `:Uraeda comments` | Hide or show the comments drawn under their lines       |
| `<leader>aw` | `:Uraeda waiting`  | List the files waiting on you                           |
| `]u`         | `:Uraeda next`     | Jump to the next question or comment                    |
| `[u`         | `:Uraeda prev`     | Jump to the previous question or comment                |

Each action is also a `<Plug>` mapping, like `<Plug>(uraeda-verdict)`, to map keys of your own.

## Help

Everything else, the options, the comment and verdict windows, highlight groups, and how the
language server attaches, is in the help: `:help uraeda`, from [doc/uraeda.txt](doc/uraeda.txt).

## Development

The tests use mini.test, against the `ura` built by cargo, from the repository's root:

```sh
cargo build -p uraeda-cli
nix develop -c vp run test:nvim
```

Committing `.lua` files in this repository needs `stylua`, which the commit hook runs: it is in
`nix develop`.
