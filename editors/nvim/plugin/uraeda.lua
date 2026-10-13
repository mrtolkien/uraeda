-- Uraeda's entry: enables the `uraeda` language server. Modules load only when used.
if vim.fn.has("nvim-0.11") == 0 or vim.g.loaded_uraeda then
  return
end
vim.g.loaded_uraeda = true

local config = require("uraeda").config()
if config.lsp then
  vim.lsp.config("uraeda", { cmd = config.cmd })
  vim.lsp.enable("uraeda")
end
