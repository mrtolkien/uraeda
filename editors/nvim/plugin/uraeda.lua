-- Uraeda's entry: enables the `uraeda` language server, creates `:Uraeda` and the `<Plug>`
-- mappings, and sets the keys, the hints, and the inline comments where a `uraeda` client
-- attaches. Other modules load only when used.
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

local group = vim.api.nvim_create_augroup("uraeda", { clear = true })

vim.api.nvim_create_autocmd("LspAttach", {
  group = group,
  desc = "Uraeda: set the keys, enable the hints, and draw the inline comments",
  callback = function(event)
    local client = vim.lsp.get_client_by_id(event.data.client_id)
    if client and client.name == "uraeda" then
      require("uraeda.keys").attach(event.buf)
      vim.lsp.inlay_hint.enable(true, { bufnr = event.buf })
      require("uraeda.marks").show(event.buf)
    end
  end,
})

vim.api.nvim_create_autocmd("User", {
  group = group,
  pattern = "UraedaComment",
  desc = "Uraeda: redraw the inline comments",
  callback = function()
    require("uraeda.marks").refresh()
  end,
})

vim.api.nvim_create_autocmd("BufWritePost", {
  group = group,
  desc = "Uraeda: redraw the inline comments next to a saved file",
  callback = function(event)
    if vim.lsp.get_clients({ bufnr = event.buf, name = "uraeda" })[1] then
      require("uraeda.marks").refresh({ vim.api.nvim_buf_get_name(event.buf) })
    end
  end,
})
