-- The keys under `vim.g.uraeda.prefix`: buffer-local in each buffer a `uraeda` client attaches to,
-- and global for the actions that work from anywhere, set on the first attach.
local M = {}

local global_set = false

local function set(action, prefix, buffer)
  vim.keymap.set(action.modes, prefix .. action.key, function()
    action.fn()
  end, { buffer = buffer, desc = action.desc, silent = true })
end

--- Sets the keys in `bufnr`, and the global keys once. Does nothing when the prefix is `false`.
--- @param bufnr integer
function M.attach(bufnr)
  local prefix = require("uraeda").config().prefix
  if prefix == false then
    return
  end
  for _, action in ipairs(require("uraeda.actions").list) do
    if action.key then
      if action.buffer_local then
        set(action, prefix, bufnr)
      elseif not global_set then
        set(action, prefix, nil)
      end
    end
  end
  global_set = true
end

return M
