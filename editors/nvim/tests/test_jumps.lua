local helpers = dofile("tests/helpers.lua")
local eq = MiniTest.expect.equality

local child = helpers.new_child()
local T = MiniTest.new_set({
  hooks = {
    pre_case = function()
      child.setup()
      child.lua([[
        _G.notes = {}
        vim.notify = function(message, level)
          table.insert(_G.notes, { message, level })
        end
      ]])
    end,
    post_once = child.stop,
  },
})

local example = "specs/2026-10-06-recurring-tasks/"
local branch = "2026-10-13-nvim-plugin"
local feature = "specs/" .. branch .. "/"

--- A round whose `## Q1` heading is on line 32, `### Q1.A` on line 48, and `## Q2` on line 64, as
--- the server's tests write it.
local round = "---\nstatus: awaiting-human\n---\n\n"
  .. "# Clarifications, round 01: X\n\n"
  .. "> [!IMPORTANT]\n>\n> 2 questions and 1 follow-up, about 5 minutes.\n>\n> - Verdict: worth building as proposed.\n\n"
  .. "## Context\n\n"
  .. "### Goal\n\n"
  .. "A goal.\n\n"
  .. "### Today\n\n"
  .. "Some context.\nMore context.\n\n"
  .. "### Scope\n\n"
  .. "A scope.\n\n"
  .. "### Sources\n\n"
  .. "- The code.\n\n"
  .. "## Q1: First?\n\n"
  .. "Context.\n\n"
  .. "Why it matters: it decides the rest.\n\n"
  .. "- **A (recommended). One.**\n  - [pro] p\n  - [con] c\n  - Why recommended: it is small.\n- **B. Two.**\n  - [pro] p\n  - [con] c\n\n"
  .. "**Answer:**\n\n"
  .. "### Q1.A: Follow-up?\n\n"
  .. "Only if you picked A in Q1.\n\n"
  .. "Why it matters: it decides the rest.\n\n"
  .. "- **A (recommended). One.**\n  - [pro] p\n  - [con] c\n  - Why recommended: it is small.\n- **B. Two.**\n  - [pro] p\n  - [con] c\n\n"
  .. "**Answer:**\n\n"
  .. "## Q2: Second?\n\n"
  .. "Context.\n\n"
  .. "Why it matters: it decides the rest.\n\n"
  .. "- **A (recommended). One.**\n  - [pro] p\n  - [con] c\n  - Why recommended: it is small.\n- **B. Two.**\n  - [pro] p\n  - [con] c\n\n"
  .. "**Answer:**\n\n"
  .. "## Settled without the human\n\n"
  .. "### Behaviour\n\n"
  .. "- **A point** settled.\n\n"
  .. "**Notes:**\n"

--- A repository holding the example project, with a feature's branch checked out in its worktree,
--- holding the example's proposal and `files` (name → text) in the feature's folder; returns the
--- feature's folder in the worktree.
local function with_feature(files)
  local example_files = helpers.example()
  local branch_files = { [feature .. "proposal.md"] = example_files[example .. "proposal.md"] }
  for name, text in pairs(files) do
    branch_files[feature .. name] = text
  end
  local repo = helpers.repo(example_files, { [branch] = branch_files })
  return repo .. "/.worktrees/" .. branch .. "/" .. feature
end

--- Edits `path`, and waits for its client.
local function open(path)
  helpers.edit(child, path)
  eq(helpers.wait_client(child), true)
end

--- Sets the cursor on `line`, types `keys`, and returns the cursor's line once it moved, or after
--- 1 s if it did not.
local function jump(line, keys)
  child.api.nvim_win_set_cursor(0, { line, 0 })
  child.type_keys(keys)
  child.lua(
    "local line = ... vim.wait(1000, function() return vim.fn.line('.') ~= line end, 20)",
    { line }
  )
  return child.lua_get("vim.fn.line('.')")
end

T["]u goes from question to question"] = function() -- US8.2
  local folder = with_feature({ ["clarifications-01.md"] = round })
  open(folder .. "clarifications-01.md")

  eq(jump(34, "]u"), 48)
  eq(child.api.nvim_get_current_line(), "### Q1.A: Follow-up?")
  eq(jump(48, "]u"), 64)
  eq(child.api.nvim_get_current_line(), "## Q2: Second?")
  -- No wrap past the last item.
  eq(jump(64, "]u"), 64)
  eq(jump(64, "[u"), 48)
  eq(jump(48, "[u"), 32)
  eq(jump(32, "[u"), 32)
  eq(child.lua_get("_G.notes"), {})
end

T["]u goes from comment to comment"] = function() -- US8.3
  local spec =
    helpers.example()[example .. "spec.md"]:gsub("status: approved", "status: awaiting-human", 1)
  local folder = with_feature({ ["spec.md"] = spec })
  open(folder .. "spec.md")
  child.lua([[
    local done = 0
    local client = require("uraeda.client")
    client.command(0, "uraeda.comment", { line = 12, endLine = 12, text = "Another." }, nil,
      function()
        client.command(0, "uraeda.comment", { line = 50, endLine = 52, text = "Rename this field" },
          nil, function() done = 1 end)
      end)
    vim.wait(5000, function() return done == 1 end, 20)
    _G.notes = {}
  ]])

  eq(jump(20, "]u"), 50)
  eq(jump(50, "]u"), 50)
  eq(jump(20, "[u"), 12)
  child.cmd("Uraeda next")
  child.lua("vim.wait(1000, function() return vim.fn.line('.') ~= 12 end, 20)")
  eq(child.lua_get("vim.fn.line('.')"), 50)
  child.type_keys("<Plug>(uraeda-prev)")
  child.lua("vim.wait(1000, function() return vim.fn.line('.') ~= 50 end, 20)")
  eq(child.lua_get("vim.fn.line('.')"), 12)
  eq(child.lua_get("_G.notes"), {})
end

return T
