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

local priorities =
  "# Priorities\n\n## Now\n\n## Next\n\n## Later\n\n- Codex runtime\n\n## Blocked\n"

--- Opens the priorities of a new repository, and waits for its client.
local function open()
  local repo = helpers.repo({ ["specs/PRIORITIES.md"] = priorities })
  helpers.edit(child, repo .. "/specs/PRIORITIES.md")
  eq(helpers.wait_client(child), true)
  return repo
end

--- The child's mappings, in `mode`, whose description starts with `Uraeda`, as { lhs = desc }:
--- the buffer's when `buffer`, else the global ones.
local function uraeda_keys(mode, buffer)
  return child.lua(
    [[local mode, buffer = ...
      local maps = buffer and vim.api.nvim_buf_get_keymap(0, mode) or vim.api.nvim_get_keymap(mode)
      local found = {}
      for _, map in ipairs(maps) do
        if map.desc and map.desc:find("^Uraeda") and not map.lhs:find("^<Plug>") then
          found[map.lhs] = map.desc
        end
      end
      return found]],
    { mode, buffer }
  )
end

T["every action has a key, a subcommand, and a Plug mapping"] = function()
  open()
  local actions = child.lua_get([[vim.tbl_map(function(action)
    return { name = action.name, modes = action.modes, buffer_local = action.buffer_local,
      key = action.key, desc = action.desc }
  end, require("uraeda.actions").list)]])
  local names = vim.tbl_map(function(action)
    return action.name
  end, actions)
  for _, name in ipairs({ "draft", "start", "commit" }) do
    eq(vim.tbl_contains(names, name), true)
  end
  eq(child.lua_get("vim.fn.getcompletion('Uraeda ', 'cmdline')"), names)
  eq(child.lua_get("vim.fn.getcompletion('Uraeda d', 'cmdline')"), { "draft" })

  local leader = "\\"
  for _, action in ipairs(actions) do
    eq(action.desc:find("^Uraeda") ~= nil, true)
    for _, mode in ipairs(action.modes) do
      local plug = child.lua_get(
        "vim.fn.maparg(...).desc",
        { ("<Plug>(uraeda-%s)"):format(action.name), mode, false, true }
      )
      eq(plug, action.desc)
      local key = uraeda_keys(mode, action.buffer_local)[leader .. "a" .. action.key]
      eq(key, action.desc)
    end
  end
  eq(uraeda_keys("n", true)["\\an"], "Uraeda: draft the priorities line")
end

T["no key collides under <leader>a"] = function()
  -- LazyVim's AI keys, mapped before any buffer attaches.
  child.lua([[for _, key in ipairs({ "a", "b", "c", "C", "d", "f", "r", "s" }) do
    vim.keymap.set({ "n", "x" }, "<leader>a" .. key, "<Nop>", { desc = "AI " .. key })
  end]])
  open()
  eq(vim.tbl_isempty(uraeda_keys("n", true)), false)
  for _, mode in ipairs({ "n", "x" }) do
    for _, buffer in ipairs({ true, false }) do
      for lhs in pairs(uraeda_keys(mode, buffer)) do
        local key = lhs:sub(#"\\a" + 1)
        eq(vim.tbl_contains({ "a", "b", "c", "C", "d", "f", "r", "s" }, key), false)
      end
    end
    for _, key in ipairs({ "a", "b", "c", "C", "d", "f", "r", "s" }) do
      eq(
        child.lua_get("vim.fn.maparg(...).desc", { "<leader>a" .. key, mode, false, true }),
        "AI " .. key
      )
    end
  end
end

T["prefix false sets no keys"] = function()
  child.setup({ prefix = false })
  open()
  eq(uraeda_keys("n", true), {})
  eq(uraeda_keys("n", false), {})
  eq(child.lua_get("vim.fn.maparg('<Plug>(uraeda-draft)', 'n') ~= ''"), true)
  eq(child.lua_get("vim.fn.exists(':Uraeda')"), 2)
end

T["keys use the configured prefix"] = function()
  child.setup({ prefix = "<leader>au" })
  open()
  local keys = uraeda_keys("n", true)
  eq(keys["\\aun"], "Uraeda: draft the priorities line")
  eq(keys["\\an"], nil)
end

T["keys are set only in workflow files"] = function()
  local repo = open()
  helpers.write(repo .. "/README.md", "# R\n")
  helpers.edit(child, repo .. "/README.md")
  eq(uraeda_keys("n", true), {})
end

return T
