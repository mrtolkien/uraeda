local helpers = dofile("tests/helpers.lua")
local eq = MiniTest.expect.equality

local child = helpers.new_child()
local T = MiniTest.new_set({
  hooks = {
    pre_case = function()
      child.setup()
    end,
    post_once = child.stop,
  },
})

local doc = vim.fs.joinpath(helpers.root, "editors", "nvim", "doc", "uraeda.txt")

--- Puts a copy of the help, with its tags generated, first on the child's runtimepath: the
--- plugin's `doc/` holds no `tags` file, which plugin managers generate.
local function help_tags()
  local dir = vim.fn.tempname()
  vim.fn.mkdir(vim.fs.joinpath(dir, "doc"), "p")
  eq(vim.uv.fs_copyfile(doc, vim.fs.joinpath(dir, "doc", "uraeda.txt")), true)
  child.lua(
    [[local dir = ...
      vim.cmd.helptags(vim.fn.fnameescape(vim.fs.joinpath(dir, "doc")))
      vim.opt.runtimepath:prepend(dir)]],
    { dir }
  )
end

--- The tags the help must define: a subcommand and a `<Plug>` mapping per action, and an option.
local function tags()
  local found = {}
  local names = child.lua_get([[vim.tbl_map(function(action)
    return action.name
  end, require("uraeda.actions").list)]])
  for _, name in ipairs(names) do
    table.insert(found, ":Uraeda-" .. name)
    table.insert(found, ("<Plug>(uraeda-%s)"):format(name))
  end
  local keys = child.lua_get([[vim.tbl_keys(require("uraeda").config())]])
  table.sort(keys)
  for _, key in ipairs(keys) do
    table.insert(found, "vim.g.uraeda." .. key)
  end
  return found
end

T["the help names every subcommand, Plug mapping, and option"] = function()
  local text = table.concat(vim.fn.readfile(doc), "\n")
  local missing = vim.tbl_filter(function(tag)
    return not text:find("*" .. tag .. "*", 1, true)
  end, tags())
  eq(missing, {})
end

T[":help uraeda opens"] = function()
  help_tags()
  child.cmd("help uraeda")
  eq(child.lua_get("vim.fs.basename(vim.api.nvim_buf_get_name(0))"), "uraeda.txt")
  eq(child.lua_get("vim.bo.filetype"), "help")
  for _, tag in ipairs(tags()) do
    child.cmd("help " .. tag)
    eq(
      { tag, child.lua_get("vim.fs.basename(vim.api.nvim_buf_get_name(0))") },
      { tag, "uraeda.txt" }
    )
  end
end

return T
