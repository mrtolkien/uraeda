-- Uraeda's options, read from `vim.g.uraeda`: no `setup()` is needed.
local M = {}

local defaults = {
  prefix = "<leader>a",
  lsp = true,
  cmd = { "ura", "lsp" },
  inline_comments = true,
}

--- The checkout of the file at `path`: the folder above the nearest `specs/` folder holding
--- `PRIORITIES.md` among the file's parents, or nil. The `uraeda` server's root.
--- @param path string an absolute, normalized path
--- @return string?
function M.checkout(path)
  for dir in vim.fs.parents(path) do
    if
      vim.fs.basename(dir) == "specs"
      and vim.uv.fs_stat(vim.fs.joinpath(dir, "PRIORITIES.md")) ~= nil
    then
      return vim.fs.dirname(dir)
    end
  end
end

--- `vim.g.uraeda` merged over the defaults, validated. `clipboard` is nil unless set.
--- @return { prefix: string|false, lsp: boolean, cmd: string[], inline_comments: boolean, clipboard: string[]? }
function M.config()
  local options = vim.g.uraeda or {}
  vim.validate("vim.g.uraeda", options, "table")
  local config = vim.tbl_extend("force", defaults, options)
  vim.validate("vim.g.uraeda.prefix", config.prefix, function(prefix)
    return prefix == false or type(prefix) == "string"
  end, "a string, or false")
  vim.validate("vim.g.uraeda.lsp", config.lsp, "boolean")
  local function command(cmd)
    return vim.islist(cmd)
      and #cmd > 0
      and vim.iter(cmd):all(function(part)
        return type(part) == "string"
      end)
  end
  vim.validate("vim.g.uraeda.cmd", config.cmd, command, "a list of strings")
  vim.validate("vim.g.uraeda.clipboard", config.clipboard, function(cmd)
    return cmd == nil or command(cmd)
  end, "a list of strings")
  vim.validate("vim.g.uraeda.inline_comments", config.inline_comments, "boolean")
  return config
end

return M
