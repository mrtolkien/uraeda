-- The plugin's main actions on the real `ura lsp`: a workflow file attaches and shows diagnostics,
-- a code action sets a field, the waiting list opens a round, a comment is written, and a verdict
-- approves and commits. Each test reads what the file or git holds, never a window's wording.
local helpers = dofile("tests/helpers.lua")
local eq = MiniTest.expect.equality

-- The day an approval writes, read by the server from its environment, inherited from the child.
local saved_today

local child = helpers.new_child()
local T = MiniTest.new_set({
  hooks = {
    pre_case = function()
      saved_today, vim.env.URA_TODAY = vim.env.URA_TODAY, "2026-10-14"
      child.setup()
      -- Notifications as { message, level }; `vim.ui.select` picks the item shown as `_G.picks[1]`.
      child.lua([[
        _G.notes, _G.picks, _G.saved = {}, {}, 0
        vim.notify = function(message, level)
          table.insert(_G.notes, { message, level })
        end
        vim.ui.select = function(items, opts, on_choice)
          local shown = vim.tbl_map(opts.format_item or tostring, items)
          local pick = table.remove(_G.picks, 1)
          for i, text in ipairs(shown) do
            if text == pick then
              return on_choice(items[i], i)
            end
          end
          on_choice(nil, nil)
        end
        vim.api.nvim_create_autocmd("User", {
          pattern = "UraedaComment",
          callback = function() _G.saved = _G.saved + 1 end,
        })
      ]])
    end,
    post_case = function()
      vim.env.URA_TODAY = saved_today
    end,
    post_once = child.stop,
  },
})

local example = "specs/2026-10-06-recurring-tasks/"
local branch = "2026-10-13-nvim-plugin"
local feature = "specs/" .. branch .. "/"

local function read(path)
  local file = io.open(path, "rb")
  if file == nil then
    return nil
  end
  local text = file:read("*a")
  file:close()
  return text
end

--- Waits up to 5 s for `cond`, a Lua expression in the child, and returns whether it held.
local function wait(cond)
  return child.lua_get(("vim.wait(5000, function() return %s end, 20)"):format(cond))
end

--- The error notifications so far.
local function errors()
  return child.lua_get(
    "vim.tbl_filter(function(note) return note[2] == vim.log.levels.ERROR end, _G.notes)"
  )
end

--- Edits `path`, and waits for its client.
local function open(path)
  helpers.edit(child, path)
  eq(helpers.wait_client(child), true)
end

--- A repository of the example project, with the feature's branch checked out in its worktree:
--- the example's proposal and its spec waiting for the human; returns the repository and the
--- worktree's spec.
local function waiting_spec()
  local files = helpers.example()
  local spec = files[example .. "spec.md"]:gsub("status: approved", "status: awaiting-human", 1)
  local repo = helpers.repo(files, {
    [branch] = {
      [feature .. "proposal.md"] = files[example .. "proposal.md"],
      [feature .. "spec.md"] = spec,
    },
  })
  return repo, repo .. "/.worktrees/" .. branch .. "/" .. feature .. "spec.md"
end

T["a workflow file shows its diagnostics"] = function()
  local repo = helpers.repo(helpers.example())
  open(repo .. "/" .. example .. "spec.md")
  eq(child.lua_get("vim.api.nvim_buf_get_lines(0, 4, 5, false)"), { "risk-tier: high" })
  eq(child.lua_get("#vim.diagnostic.get(0)"), 0)

  child.lua("vim.api.nvim_buf_set_lines(0, 4, 5, false, { 'risk-tier: extreme' })")

  eq(wait("#vim.diagnostic.get(0) > 0"), true)
  eq(
    child.lua_get("vim.tbl_map(function(d) return { d.lnum, d.source } end, vim.diagnostic.get(0))"),
    { { 4, "uraeda" } }
  )
end

T["a code action sets a field in the buffer"] = function()
  local repo = helpers.repo(helpers.example())
  local proposal = repo .. "/" .. example .. "proposal.md"
  open(proposal)
  eq(child.fn.getline(2), "discovery: high")
  child.api.nvim_win_set_cursor(0, { 2, 0 })

  child.lua([[vim.lsp.buf.code_action({
    apply = true,
    filter = function(action) return action.title:find("discovery to low", 1, true) ~= nil end,
  })]])

  eq(wait("vim.fn.getline(2) == 'discovery: low'"), true)
  eq(child.bo.modified, true)
  eq(read(proposal):find("discovery: high", 1, true) ~= nil, true, "the disk is untouched")
end

T["the waiting list opens a round of another worktree"] = function()
  local proposal = helpers.example()[example .. "proposal.md"]
  local round = "---\nstatus: awaiting-human\n---\n\n# Clarifications, round 01: Codex runtime\n\n"
    .. "> [!IMPORTANT]\n>\n> 1 question, about 5 minutes.\n>\n> - A point.\n\n"
    .. "## Context\n\n### Goal\n\nA goal.\n\n### Today\n\nToday.\n\n### Scope\n\nA scope.\n\n"
    .. "### Sources\n\n- The code.\n\n## Q1: Question?\n\nContext.\n\nWhy it matters: it decides.\n\n"
    .. "- **A (recommended). One.**\n  - [pro] p\n  - [con] c\n  - Why recommended: it is small.\n"
    .. "- **B. Two.**\n  - [pro] p\n  - [con] c\n\n**Answer:**\n\n"
    .. "## Settled without the human\n\n### Behaviour\n\n- **A point** settled.\n\n**Notes:**\n"
  local name = "2026-10-14-codex-runtime"
  local repo = helpers.repo({
    ["specs/README.md"] = "# Specs\n",
    ["specs/PRIORITIES.md"] = "# Priorities\n\n## Now\n\n1. [Codex runtime]("
      .. name
      .. "/proposal.md)\n\n## Next\n\n## Later\n\n## Blocked\n",
    ["README.md"] = "# Readme\n",
  }, {
    [name] = {
      ["specs/" .. name .. "/proposal.md"] = proposal,
      ["specs/" .. name .. "/clarifications-01.md"] = round,
    },
  })
  child.cmd("cd " .. vim.fn.fnameescape(repo))
  helpers.edit(child, repo .. "/README.md")
  child.lua(
    [[_G.picks = { "codex-runtime · clarifications-01.md · 1 question, about 5 minutes." }]]
  )

  child.cmd("Uraeda waiting")

  eq(wait("vim.api.nvim_buf_get_name(0):find('clarifications-01.md', 1, true) ~= nil"), true)
  eq(
    child.lua_get("vim.api.nvim_buf_get_name(0)"),
    repo .. "/.worktrees/" .. name .. "/specs/" .. name .. "/clarifications-01.md"
  )
  eq(errors(), {})
end

T["a comment is written to the spec's review"] = function()
  local _, spec = waiting_spec()
  open(spec)
  child.api.nvim_win_set_cursor(0, { 74, 0 })

  child.type_keys("V2j", "\\am")

  eq(wait("vim.bo.buftype == 'acwrite'"), true)
  child.type_keys("Rename this field", "<Esc>", ":w<CR>")
  eq(wait("_G.saved >= 1"), true)

  local review = read(vim.fs.dirname(spec) .. "/spec-review.md")
  eq(review:find("verdict: pending", 1, true) ~= nil, true)
  eq(review:find("\nRename this field\n", 1, true) ~= nil, true)
  eq(child.lua_get("vim.api.nvim_buf_get_name(0)"), spec)
  eq(errors(), {})
end

T["a verdict approves the spec and commits"] = function()
  local repo, spec = waiting_spec()
  open(spec)
  child.lua([[_G.picks = { "Approve" }]])

  child.type_keys("\\av")

  eq(wait("vim.api.nvim_win_get_config(0).relative ~= ''"), true)
  child.type_keys("<C-s>")

  eq(wait("#vim.api.nvim_list_wins() == 1"), true)
  local subject = helpers.git(repo, { "log", "-1", "--format=%s", branch })
  eq(vim.trim(subject), "spec(nvim-plugin): approve")
  eq(read(spec):find("status: approved\n", 1, true) ~= nil, true)
  eq(child.lua_get("vim.bo.modified"), false)
  eq(errors(), {})
end

return T
