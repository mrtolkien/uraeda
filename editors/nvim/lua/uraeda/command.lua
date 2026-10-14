-- `:Uraeda <name>`: runs an action of `actions.list`, its names completed, and the files after
-- `:Uraeda image`.
local M = {}

--- The names of the actions starting with `lead`.
--- @param lead string
--- @return string[]
function M.complete(lead)
  return vim
    .iter(require("uraeda.actions").list)
    :map(function(action)
      return action.name
    end)
    :filter(function(name)
      return vim.startswith(name, lead)
    end)
    :totable()
end

--- Runs the action named by the command's first argument, with the command's opts.
--- @param opts vim.api.keyset.create_user_command.command_args
function M.run(opts)
  local name = opts.fargs[1]
  local action = name and require("uraeda.actions").get(name)
  if action == nil then
    local names = table.concat(M.complete(""), ", ")
    vim.notify(
      ("Uraeda: unknown action %q, expected one of %s."):format(name or "", names),
      vim.log.levels.ERROR,
      { title = "Uraeda" }
    )
    return
  end
  action.fn(opts)
end

--- Creates `:Uraeda`.
function M.create()
  vim.api.nvim_create_user_command("Uraeda", M.run, {
    nargs = "*",
    range = true,
    desc = "Uraeda: run an action",
    complete = function(lead, line)
      -- Only the first argument names an action; `image` takes a file after it.
      local action = line:match("^%s*%S+%s+(%S+)%s")
      if action == "image" then
        return vim.fn.getcompletion(lead, "file")
      elseif action then
        return {}
      end
      return M.complete(lead)
    end,
  })
end

return M
