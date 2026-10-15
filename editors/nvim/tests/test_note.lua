local helpers = dofile("tests/helpers.lua")
local eq = MiniTest.expect.equality

local child = helpers.new_child()
local T = MiniTest.new_set({
  hooks = {
    pre_case = function()
      child.setup()
      -- Every notification, as { message, level }; `vim.ui.input` answers with `_G.inputs[n]` and
      -- records its prompt; `vim.ui.select` picks the item shown as `_G.picks[n]`, and records
      -- what it showed.
      child.lua([[
        _G.notes, _G.prompts, _G.inputs, _G.selects, _G.picks = {}, {}, {}, {}, {}
        vim.notify = function(message, level)
          table.insert(_G.notes, { message, level })
        end
        vim.ui.input = function(opts, on_confirm)
          table.insert(_G.prompts, opts.prompt)
          on_confirm(table.remove(_G.inputs, 1))
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

local INFO = vim.log.levels.INFO
local fixture = vim.fs.joinpath(helpers.root, "fixtures", "repo", "main", "specs", "INBOX.md")

local function read(path)
  local file = assert(io.open(path, "rb"))
  local text = file:read("*a")
  file:close()
  return text
end

--- A repository on `main` with the fixture's inbox, under `## UI` and `## CLI`, and the branch
--- `feat`, checked out in `.worktrees/feat`, whose own inbox has `## Feat`: categories read from
--- the worktree's file would differ from the default branch's. Returns the repository and the
--- worktree.
local function with_inbox()
  local repo = helpers.repo({
    ["specs/PRIORITIES.md"] = "# Priorities\n\n## Now\n\n## Next\n\n## Later\n\n## Blocked\n",
    ["specs/INBOX.md"] = read(fixture),
    ["README.md"] = "# Readme\n",
  }, { feat = { ["specs/INBOX.md"] = "# Inbox\n\n## Feat\n" } })
  return repo, repo .. "/.worktrees/feat"
end

--- Waits up to 5 s for `cond`, a Lua expression in the child, to be true.
local function wait(cond)
  return child.lua_get(("vim.wait(5000, function() return %s end, 20)"):format(cond))
end

local function subjects(path)
  return vim.split(vim.trim(helpers.git(path, { "log", "--format=%s", "main" })), "\n")
end

--- The 1-based line of `text` in the file at `path`.
local function line_of(path, text)
  for number, line in ipairs(vim.split(read(path), "\n")) do
    if line == text then
      return number
    end
  end
end

T["a note goes to a new category, and the inbox opens at it"] = function() -- US7.1, C2
  local repo, worktree = with_inbox()
  child.cmd("cd " .. vim.fn.fnameescape(worktree))
  helpers.edit(child, worktree .. "/README.md")
  child.lua(
    "_G.inputs, _G.picks = ...",
    { { "Hints flicker on save", "Editor" }, { "New category…" } }
  )

  child.cmd("Uraeda note")

  local inbox = repo .. "/specs/INBOX.md"
  eq(wait(("vim.api.nvim_buf_get_name(0) == %q"):format(inbox)), true)
  eq(child.lua_get("_G.selects"), {
    {
      kind = "uraeda_category",
      prompt = "Category",
      items = { "No category", "UI", "CLI", "New category…" },
    },
  })
  eq(child.lua_get("_G.prompts"), { "Note: ", "New category: " })
  eq(
    read(inbox):sub(-#"\n## Editor\n\n- Hints flicker on save\n"),
    "\n## Editor\n\n- Hints flicker on save\n"
  )
  eq(
    child.lua_get("vim.api.nvim_win_get_cursor(0)"),
    { line_of(inbox, "- Hints flicker on save"), 0 }
  )
  eq(read(worktree .. "/specs/INBOX.md"), "# Inbox\n\n## Feat\n")
  eq(subjects(repo)[1], "chore: start")
  eq(wait("#_G.notes >= 2"), true)
  eq(child.lua_get("_G.notes"), {
    { "Adding a note…", INFO },
    { "Added to the inbox, not committed", INFO },
  })
end

T["a note without a category goes before the first one"] = function()
  local repo = with_inbox()
  child.cmd("cd " .. vim.fn.fnameescape(repo))
  child.lua("_G.inputs, _G.picks = ...", { { "Hints flicker on save" }, { "No category" } })

  child.cmd("Uraeda note")

  local inbox = repo .. "/specs/INBOX.md"
  eq(wait(("vim.api.nvim_buf_get_name(0) == %q"):format(inbox)), true)
  local line = line_of(inbox, "- Hints flicker on save")
  eq(line, line_of(inbox, "- We need a home icon") + 1)
  eq(child.lua_get("vim.api.nvim_win_get_cursor(0)"), { line, 0 })
end

T["a note in an existing category opens at its line"] = function()
  local repo = with_inbox()
  child.cmd("cd " .. vim.fn.fnameescape(repo))
  child.lua("_G.inputs, _G.picks = ...", { { "Hints flicker on save" }, { "UI" } })

  child.cmd("Uraeda note")

  local inbox = repo .. "/specs/INBOX.md"
  eq(wait(("vim.api.nvim_buf_get_name(0) == %q"):format(inbox)), true)
  local line = line_of(inbox, "- Hints flicker on save")
  eq(line, line_of(inbox, "- Text input feels laggy on the sessions page") + 1)
  eq(child.lua_get("vim.api.nvim_win_get_cursor(0)"), { line, 0 })
end

T["a note that cannot open the inbox leaves the cursor alone"] = function()
  local repo = with_inbox()
  child.cmd("cd " .. vim.fn.fnameescape(repo))
  helpers.edit(child, repo .. "/README.md")
  -- An unsaved buffer that cannot be hidden: `:edit` of the inbox fails.
  child.lua([[
    vim.o.hidden = false
    local lines = {}
    for i = 1, 40 do
      lines[i] = "line " .. i
    end
    vim.api.nvim_buf_set_lines(0, 0, -1, false, lines)
  ]])
  child.lua("_G.inputs, _G.picks = ...", { { "Hints flicker on save" }, { "UI" } })

  child.cmd("Uraeda note")

  eq(wait("#_G.notes >= 2"), true)
  eq(line_of(repo .. "/specs/INBOX.md", "- Hints flicker on save") ~= nil, true)
  child.lua("vim.wait(200)")
  eq(child.lua_get("vim.fs.basename(vim.api.nvim_buf_get_name(0))"), "README.md")
  eq(child.lua_get("vim.api.nvim_win_get_cursor(0)"), { 1, 0 })
end

T["a cancelled note writes nothing"] = function()
  local repo = with_inbox()
  child.cmd("cd " .. vim.fn.fnameescape(repo))
  helpers.edit(child, repo .. "/README.md")
  local inbox = read(repo .. "/specs/INBOX.md")

  -- Cancelled at the text, then at the category, then at the new category's name.
  child.lua("_G.inputs = {}")
  child.cmd("Uraeda note")
  child.lua("_G.inputs, _G.picks = ...", { { "Hints flicker on save" }, {} })
  child.cmd("Uraeda note")
  eq(wait("#_G.selects == 1"), true)
  child.lua("_G.inputs, _G.picks = ...", { { "Hints flicker on save" }, { "New category…" } })
  child.cmd("Uraeda note")
  eq(wait("#_G.selects == 2"), true)
  child.lua("vim.wait(200)")

  eq(read(repo .. "/specs/INBOX.md"), inbox)
  eq(child.lua_get("vim.fs.basename(vim.api.nvim_buf_get_name(0))"), "README.md")
  eq(child.lua_get("_G.notes"), {})
end

T["a blank note is refused by the server"] = function()
  local repo = with_inbox()
  child.cmd("cd " .. vim.fn.fnameescape(repo))
  local inbox = read(repo .. "/specs/INBOX.md")
  child.lua("_G.inputs, _G.picks = ...", { { "  " }, { "No category" } })

  child.cmd("Uraeda note")

  local ERROR = vim.log.levels.ERROR
  eq(
    wait("vim.iter(_G.notes):any(function(note) return note[2] == vim.log.levels.ERROR end)"),
    true
  )
  eq(
    vim.tbl_filter(function(note)
      return note[2] == ERROR
    end, child.lua_get("_G.notes")),
    { { "A note needs text.", ERROR } }
  )
  eq(read(repo .. "/specs/INBOX.md"), inbox)
end

return T
