-- The `uraeda` language server, `ura lsp`: one client per checkout, attached to the markdown files
-- under a `specs/` folder holding `PRIORITIES.md`.

--- @type vim.lsp.Config
return {
  cmd = { "ura", "lsp" },
  filetypes = { "markdown" },
  root_dir = function(bufnr, on_dir)
    local name = vim.api.nvim_buf_get_name(bufnr)
    if name == "" or vim.bo[bufnr].buftype ~= "" then
      return
    end
    local root = require("uraeda").checkout(vim.fs.normalize(vim.fn.fnamemodify(name, ":p")))
    if root ~= nil then
      on_dir(root)
    end
  end,
}
