local helpers = dofile("tests/helpers.lua")
local eq = MiniTest.expect.equality

local child = helpers.new_child()
local T = MiniTest.new_set({
  hooks = {
    pre_case = function()
      child.setup()
      -- Every notification, as { message, level }; `vim.ui.select` picks the item shown as
      -- `_G.picks[n]`, and records what it showed.
      child.lua([[
        _G.notes, _G.selects, _G.picks = {}, {}, {}
        vim.notify = function(message, level)
          table.insert(_G.notes, { message, level })
        end
        vim.ui.select = function(items, opts, on_choice)
          local shown = vim.tbl_map(opts.format_item or tostring, items)
          table.insert(_G.selects, { kind = opts.kind, prompt = opts.prompt, items = shown })
          local pick = table.remove(_G.picks, 1)
          for i, text in ipairs(shown) do
            if text == pick then
              return on_choice(items[i], i)
            end
          end
          on_choice(nil, nil)
        end
      ]])
    end,
    post_once = child.stop,
  },
})

local branch = "2026-10-14-codex-runtime"
local item = "codex-runtime · clarifications-01.md · 7 questions, about 25 minutes."

--- A repository whose feature `codex-runtime`, on its branch checked out in its worktree, has a
--- round of questions waiting for the human; returns the repository and the round's path.
local function with_round()
  local proposal = helpers.example()["specs/2026-10-06-recurring-tasks/proposal.md"]
  local round = "---\nstatus: awaiting-human\n---\n\n# Clarifications, round 01: Codex runtime\n\n"
    .. "> [!IMPORTANT]\n>\n> 7 questions, about 25 minutes.\n>\n> - A point.\n\n"
    .. "## Context\n\nContext.\n\n## Q1: Question?\n\nWhy.\n\n"
    .. "- **A (recommended). One.**\n  - [pro] p\n- **B. Two.**\n  - [con] c\n\n**Answer:**\n"
  local repo = helpers.repo({
    ["specs/README.md"] = "# Specs\n",
    ["specs/PRIORITIES.md"] = "# Priorities\n\n## Now\n\n1. [Codex runtime]("
      .. branch
      .. "/proposal.md)\n\n## Next\n\n## Later\n\n## Blocked\n",
    ["README.md"] = "# Readme\n",
  }, {
    [branch] = {
      ["specs/" .. branch .. "/proposal.md"] = proposal,
      ["specs/" .. branch .. "/clarifications-01.md"] = round,
    },
  })
  return repo, repo .. "/.worktrees/" .. branch .. "/specs/" .. branch .. "/clarifications-01.md"
end

--- Waits up to 5 s for `cond`, a Lua expression in the child, to be true.
local function wait(cond)
  return child.lua_get(("vim.wait(5000, function() return %s end, 20)"):format(cond))
end

T["waiting lists a round of another worktree"] = function() -- US8.1
  local repo, round = with_round()
  child.cmd("cd " .. vim.fn.fnameescape(repo))
  helpers.edit(child, repo .. "/README.md")
  eq(child.lua_get("#vim.lsp.get_clients({ name = 'uraeda' })"), 0)
  child.lua("_G.picks = { ... }", { item })

  child.cmd("Uraeda waiting")

  eq(wait("#_G.selects > 0"), true)
  eq(child.lua_get("_G.selects"), {
    { kind = "uraeda_waiting", prompt = "Uraeda · waiting on you", items = { item } },
  })
  eq(child.lua_get("vim.api.nvim_buf_get_name(0)"), round)
  eq(child.lua_get("vim.api.nvim_win_get_cursor(0)"), { 7, 0 })
  eq(child.lua_get("_G.notes"), {})
end

T["waiting uses snacks when present"] = function()
  local repo, round = with_round()
  -- A stub of snacks' picker, recording its options.
  child.lua([[
    _G.picked = nil
    _G.Snacks = { picker = { pick = function(opts) _G.picked = opts end } }
  ]])
  helpers.edit(child, repo .. "/specs/PRIORITIES.md")
  eq(helpers.wait_client(child), true)

  child.type_keys("\\aw")

  eq(wait("_G.picked ~= nil"), true)
  local picked = child.lua_get([[{
    title = _G.picked.title, format = _G.picked.format, preview = _G.picked.preview,
    confirm = _G.picked.confirm, items = _G.picked.items }]])
  eq(picked, {
    title = "Uraeda · waiting on you",
    format = "text",
    preview = "file",
    confirm = "jump",
    items = { { text = item, file = round, pos = { 7, 0 } } },
  })
  eq(child.lua_get("_G.selects"), {})
end

T["waiting outside a checkout says so"] = function()
  local dir = vim.fn.tempname()
  vim.fn.mkdir(dir, "p")
  child.cmd("cd " .. vim.fn.fnameescape(dir))

  child.cmd("Uraeda waiting")

  eq(child.lua_get("_G.notes"), {
    { "This file is not a Uraeda workflow file.", vim.log.levels.ERROR },
  })
  eq(child.lua_get("#vim.lsp.get_clients({ name = 'uraeda' })"), 0)
end

T["nothing waiting says so"] = function()
  local repo = helpers.repo({ ["specs/PRIORITIES.md"] = "# Priorities\n\n## Now\n" })
  child.cmd("cd " .. vim.fn.fnameescape(repo))

  child.cmd("Uraeda waiting")

  eq(wait("#_G.notes > 0"), true)
  eq(child.lua_get("_G.notes"), { { "Nothing waits on you.", vim.log.levels.INFO } })
  eq(child.lua_get("_G.selects"), {})
end

return T
