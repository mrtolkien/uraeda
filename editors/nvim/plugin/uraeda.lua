-- Uraeda's entry: enables the `uraeda` language server, creates `:Uraeda` and the `<Plug>`
-- mappings, and sets the keys where a `uraeda` client attaches. Other modules load only when used.
if vim.fn.has("nvim-0.11") == 0 or vim.g.loaded_uraeda then
  return
end
vim.g.loaded_uraeda = true

local config = require("uraeda").config()
if config.lsp then
  vim.lsp.config("uraeda", { cmd = config.cmd })
  vim.lsp.enable("uraeda")
end

require("uraeda.command").create()

for _, action in ipairs(require("uraeda.actions").list) do
  vim.keymap.set(action.modes, ("<Plug>(uraeda-%s)"):format(action.name), function()
    action.fn()
  end, { desc = action.desc, silent = true })
end

vim.api.nvim_create_autocmd("LspAttach", {
  group = vim.api.nvim_create_augroup("uraeda.keys", { clear = true }),
  desc = "Uraeda: set the keys",
  callback = function(event)
    local client = vim.lsp.get_client_by_id(event.data.client_id)
    if client and client.name == "uraeda" then
      require("uraeda.keys").attach(event.buf)
    end
  end,
})
