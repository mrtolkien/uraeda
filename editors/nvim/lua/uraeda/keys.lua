-- The keys under `vim.g.uraeda.prefix`, and a few of their own like `]u`: buffer-local in each
-- buffer a `uraeda` client attaches to, and global for the actions that work from anywhere, set on
-- the first attach.
local M = {}

local global_set = false

local function set(action, prefix, buffer)
  local lhs = action.lhs or (prefix .. action.key)
  vim.keymap.set(action.modes, lhs, function()
    action.fn()
  end, { buffer = buffer, desc = action.desc, silent = true })
end

--- Sets the keys in `bufnr`, and the global keys once: an action's `key` under the prefix, or its
--- own `lhs`. Does nothing when the prefix is `false`.
--- @param bufnr integer
function M.attach(bufnr)
  local prefix = require("uraeda").config().prefix
  if prefix == false then
    return
  end
  for _, action in ipairs(require("uraeda.actions").list) do
    if action.key or action.lhs then
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
