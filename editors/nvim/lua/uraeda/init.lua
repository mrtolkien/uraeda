-- Uraeda's options, read from `vim.g.uraeda`: no `setup()` is needed.
local M = {}

local defaults = {
  prefix = "<leader>a",
  lsp = true,
  cmd = { "ura", "lsp" },
  inline_comments = true,
}

--- `vim.g.uraeda` merged over the defaults, validated.
--- @return { prefix: string|false, lsp: boolean, cmd: string[], inline_comments: boolean }
function M.config()
  local options = vim.g.uraeda or {}
  vim.validate("vim.g.uraeda", options, "table")
  local config = vim.tbl_extend("force", defaults, options)
  vim.validate("vim.g.uraeda.prefix", config.prefix, function(prefix)
    return prefix == false or type(prefix) == "string"
  end, "a string, or false")
  vim.validate("vim.g.uraeda.lsp", config.lsp, "boolean")
  vim.validate("vim.g.uraeda.cmd", config.cmd, function(cmd)
    return vim.islist(cmd)
      and #cmd > 0
      and vim.iter(cmd):all(function(part)
        return type(part) == "string"
      end)
  end, "a list of strings")
  vim.validate("vim.g.uraeda.inline_comments", config.inline_comments, "boolean")
  return config
end

return M
