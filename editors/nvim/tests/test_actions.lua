local helpers = dofile("tests/helpers.lua")
local eq = MiniTest.expect.equality

-- The day a start writes, read by the server from its environment, inherited from the child.
vim.env.URA_TODAY = "2026-10-14"

local child = helpers.new_child()
local T = MiniTest.new_set({
  hooks = {
    pre_case = function()
      child.setup()
      -- Every notification, as { message, level }.
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

local later = "# Priorities\n\n## Now\n\n## Next\n\n## Later\n\n- Codex runtime\n\n## Blocked\n"
local linked = later:gsub("%- Codex runtime", "- [Codex runtime](drafts/codex-runtime.md)")
local draft_text = "# Codex runtime\n\n## What\n\nA runtime.\n"
local ERROR = vim.log.levels.ERROR

--- Waits up to 5 s for the child's current buffer to be the file at `path`.
local function wait_buffer(path)
  return child.lua(
    "local path = ... return vim.wait(5000, function() return vim.api.nvim_buf_get_name(0) == path end, 20)",
    { path }
  )
end

--- Waits up to 5 s for an error notification in the child, and returns the error notifications.
local function errors()
  child.lua([[vim.wait(5000, function()
    return vim.iter(_G.notes):any(function(note) return note[2] == vim.log.levels.ERROR end)
  end, 20)]])
  return vim.tbl_filter(function(note)
    return note[2] == ERROR
  end, child.lua_get("_G.notes"))
end

--- Waits up to 5 s for the last commit of the repository at `repo` to be `subject`.
local function wait_commit(repo, subject)
  child.lua(
    [[local repo, subject = ...
      vim.wait(5000, function()
        local log = vim.system({ "git", "-C", repo, "log", "-1", "--format=%s" }):wait()
        return vim.trim(log.stdout or "") == subject
      end, 50)]],
    { repo, subject }
  )
end

local function read(path)
  local file = assert(io.open(path, "rb"))
  local text = file:read("*a")
  file:close()
  return text
end

local function subjects(repo, ref)
  return vim.split(vim.trim(helpers.git(repo, { "log", "--format=%s", ref or "HEAD" })), "\n")
end

--- Edits `path`, waits for its client, and puts the cursor on `line`.
local function open(path, line)
  helpers.edit(child, path)
  eq(helpers.wait_client(child), true)
  if line then
    child.api.nvim_win_set_cursor(0, { line, 0 })
  end
end

T["a line becomes a draft"] = function()
  local repo = helpers.repo({ ["specs/PRIORITIES.md"] = later })
  local priorities = repo .. "/specs/PRIORITIES.md"
  open(priorities, 9)

  child.type_keys("\\an")

  local draft = repo .. "/specs/drafts/codex-runtime.md"
  eq(wait_buffer(draft), true)
  eq(vim.tbl_contains(vim.split(read(draft), "\n"), "# Codex runtime"), true)
  local buf = child.lua_get("vim.fn.bufnr(...)", { priorities })
  eq(
    child.lua_get("vim.api.nvim_buf_get_lines(..., 8, 9, false)", { buf }),
    { "- [Codex runtime](drafts/codex-runtime.md)" }
  )
  eq(subjects(repo), { "chore: start" })
  eq(helpers.hook_runs(repo), 0)
end

T["a linked line opens its draft"] = function()
  local repo = helpers.repo({
    ["specs/PRIORITIES.md"] = linked,
    ["specs/drafts/codex-runtime.md"] = draft_text,
  })
  open(repo .. "/specs/PRIORITIES.md", 9)

  child.cmd("Uraeda draft")

  eq(wait_buffer(repo .. "/specs/drafts/codex-runtime.md"), true)
  eq(helpers.git(repo, { "status", "--porcelain" }), "")
end

T["an unsaved priorities file is saved first"] = function()
  local repo = helpers.repo({ ["specs/PRIORITIES.md"] = later })
  local priorities = repo .. "/specs/PRIORITIES.md"
  open(priorities)
  child.lua("vim.api.nvim_buf_set_lines(0, 8, 8, false, { '- Benchmarks' })")
  child.api.nvim_win_set_cursor(0, { 10, 0 })

  child.type_keys("\\an")

  eq(wait_buffer(repo .. "/specs/drafts/codex-runtime.md"), true)
  eq(
    vim.list_slice(vim.split(read(priorities), "\n"), 9, 10),
    { "- Benchmarks", "- [Codex runtime](drafts/codex-runtime.md)" }
  )
end

T["a draft starts a feature"] = function()
  local repo = helpers.repo({
    ["specs/PRIORITIES.md"] = linked,
    ["specs/drafts/codex-runtime.md"] = draft_text,
  })
  local draft = repo .. "/specs/drafts/codex-runtime.md"
  open(draft)

  child.type_keys("\\ap")

  local folder = "2026-10-14-codex-runtime"
  local proposal = ("%s/.worktrees/%s/specs/%s/proposal.md"):format(repo, folder, folder)
  eq(wait_buffer(proposal), true)
  eq(child.lua_get("vim.fn.bufexists(...)", { draft }), 0)
  eq(subjects(repo, "main")[1], "chore(codex-runtime): start Codex runtime")
  eq(subjects(repo, folder)[1], "chore(codex-runtime): proposal")
  eq(helpers.hook_runs(repo), 2)
  child.lua([[vim.wait(1000, function()
    return vim.iter(_G.notes):any(function(note) return note[1]:find("^Started") end)
  end, 20)]])
  eq(child.lua_get("_G.notes"), {
    { "Starting Codex runtime…", vim.log.levels.INFO },
    { "Started " .. folder, vim.log.levels.INFO },
  })
end

T["a spec cannot be started"] = function()
  local repo = helpers.repo(helpers.example())
  local spec = repo .. "/specs/2026-10-06-recurring-tasks/spec.md"
  open(spec)

  child.cmd("Uraeda start")

  eq(errors(), { { "Only a draft or a backlog file can be started.", ERROR } })
  eq(helpers.git(repo, { "status", "--porcelain" }), "")
  eq(child.lua_get("vim.api.nvim_buf_get_name(0)"), spec)
end

T["a draft is committed"] = function()
  local repo = helpers.repo(helpers.example())
  local priorities = repo .. "/specs/PRIORITIES.md"
  helpers.write(priorities, read(priorities) .. "\n- [Codex runtime](drafts/codex-runtime.md)\n")
  helpers.write(repo .. "/specs/drafts/codex-runtime.md", draft_text)
  open(repo .. "/specs/drafts/codex-runtime.md")

  child.type_keys("\\ag")

  wait_commit(repo, "chore: draft Codex runtime")
  eq(subjects(repo)[1], "chore: draft Codex runtime")
  eq(helpers.git(repo, { "status", "--porcelain" }), "")

  open(repo .. "/specs/2026-10-06-recurring-tasks/spec.md")
  child.type_keys("\\ag")
  eq(errors(), {
    {
      "Only drafts, backlog files, proposals, and PRIORITIES.md are committed from the editor.",
      ERROR,
    },
  })
end

T["a buffer closed while a command runs"] = function()
  local repo = helpers.repo({ ["specs/PRIORITIES.md"] = later })
  helpers.write(repo .. "/specs/PRIORITIES.md", linked)
  helpers.write(repo .. "/specs/drafts/codex-runtime.md", draft_text)
  helpers.set_hook(repo, 'sleep 1\necho run >> "$(git rev-parse --git-common-dir)/hook-runs"')
  local draft = repo .. "/specs/drafts/codex-runtime.md"
  open(draft)

  child.cmd("Uraeda commit")
  child.cmd("bwipeout! " .. vim.fn.fnameescape(draft))

  wait_commit(repo, "chore: draft Codex runtime")
  eq(subjects(repo)[1], "chore: draft Codex runtime")

  open(draft)
  child.cmd("Uraeda start")
  child.cmd("bwipeout! " .. vim.fn.fnameescape(draft))

  local folder = "2026-10-14-codex-runtime"
  local proposal = ("%s/.worktrees/%s/specs/%s/proposal.md"):format(repo, folder, folder)
  eq(wait_buffer(proposal), true)
  eq(subjects(repo, "main")[1], "chore(codex-runtime): start Codex runtime")
  eq(subjects(repo, folder)[1], "chore(codex-runtime): proposal")
  child.lua("vim.wait(200)")
  eq(
    vim.tbl_filter(function(note)
      return note[2] == ERROR
    end, child.lua_get("_G.notes")),
    {}
  )
  eq(child.lua_get("vim.v.errmsg"), "")
end

return T
