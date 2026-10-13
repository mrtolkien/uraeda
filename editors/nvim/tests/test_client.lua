local helpers = dofile("tests/helpers.lua")
local eq = MiniTest.expect.equality

local child = helpers.new_child()
local T = MiniTest.new_set({
  hooks = {
    pre_case = function()
      child.setup()
      -- Every notification, as { message, level, id }.
      child.lua([[
        _G.notes = {}
        vim.notify = function(message, level, opts)
          table.insert(_G.notes, { message, level, opts and opts.id or vim.NIL })
        end
      ]])
    end,
    post_once = child.stop,
  },
})

local later = "# Priorities\n\n## Now\n\n## Next\n\n## Later\n\n- Codex runtime\n\n## Blocked\n"
local linked = later:gsub("%- Codex runtime", "- [Codex runtime](drafts/codex-runtime.md)")
local ERROR = vim.log.levels.ERROR

--- Runs `client.command` in the child on the current buffer, and waits for its result.
local function command(name, args, opts)
  child.lua("_G.done = nil")
  child.lua(
    [[local name, args, opts = ...
      require("uraeda.client").command(0, name, args, opts, function(result) _G.done = result end)]],
    { name, args or vim.empty_dict(), opts or vim.empty_dict() }
  )
  child.lua("vim.wait(5000, function() return _G.done ~= nil end, 20)")
  return child.lua_get("_G.done")
end

--- Waits for an error notification in the child, and returns the error notifications.
local function errors()
  child.lua([[vim.wait(5000, function()
    return vim.iter(_G.notes):any(function(note) return note[2] == vim.log.levels.ERROR end)
  end, 20)]])
  return vim.tbl_filter(function(note)
    return note[2] == ERROR
  end, child.lua_get("_G.notes"))
end

T["a command saves first, reloads what it wrote, and opens what it opened"] = function()
  local repo = helpers.repo({ ["specs/PRIORITIES.md"] = later })
  local priorities = repo .. "/specs/PRIORITIES.md"
  helpers.edit(child, priorities)
  eq(helpers.wait_client(child), true)
  child.lua("vim.api.nvim_buf_set_lines(0, -1, -1, false, { '- Benchmarks' })")

  local result = command("uraeda.draft", { line = 9 }, { save = true })

  local draft = repo .. "/specs/drafts/codex-runtime.md"
  eq(result, { opened = draft, written = { draft, priorities } })
  eq(child.lua_get("vim.api.nvim_buf_get_name(0)"), draft)
  local buf = child.lua_get("vim.fn.bufnr(...)", { priorities })
  eq(child.lua_get("vim.bo[...].modified", { buf }), false)
  eq(
    child.lua_get("vim.api.nvim_buf_get_lines(..., 8, -1, false)", { buf }),
    { "- [Codex runtime](drafts/codex-runtime.md)", "", "## Blocked", "- Benchmarks" }
  )
  local progress = vim.tbl_filter(function(note)
    return note[3] == "uraeda"
  end, child.lua_get("_G.notes"))
  eq(progress, { { "Drafting…", vim.log.levels.INFO, "uraeda" } })
end

T["a refusal shows the server's message"] = function()
  local repo = helpers.repo({ ["specs/PRIORITIES.md"] = later, ["specs/notes.md"] = "# Notes\n" })
  helpers.edit(child, repo .. "/specs/notes.md")
  eq(helpers.wait_client(child), true)
  command("uraeda.commit")
  eq(errors(), {
    {
      "Only drafts, backlog files, proposals, and PRIORITIES.md are committed from the editor.",
      ERROR,
      vim.NIL,
    },
  })
end

T["a failing hook shows its output"] = function()
  local repo = helpers.repo({ ["specs/PRIORITIES.md"] = later })
  helpers.write(repo .. "/specs/PRIORITIES.md", linked)
  helpers.write(repo .. "/specs/drafts/codex-runtime.md", "# Codex runtime\n\n## What\n\nA.\n")
  helpers.set_hook(repo, "echo 'lint: draft too short' >&2\nexit 1")
  helpers.edit(child, repo .. "/specs/drafts/codex-runtime.md")
  eq(helpers.wait_client(child), true)
  command("uraeda.commit")
  local found = errors()
  eq(#found, 1)
  eq(found[1][1]:find("lint: draft too short", 1, true) ~= nil, true)
  eq(vim.uv.fs_stat(repo .. "/specs/drafts/codex-runtime.md") ~= nil, true)
end

T["an unknown command asks to upgrade ura"] = function()
  local repo = helpers.repo({ ["specs/PRIORITIES.md"] = later })
  helpers.edit(child, repo .. "/specs/PRIORITIES.md")
  eq(helpers.wait_client(child), true)
  command("uraeda.later")
  eq(errors(), { { "ura is older than the plugin: run ura upgrade.", ERROR, vim.NIL } })
end

T["a file without a client is not a workflow file"] = function()
  local repo = helpers.repo({ ["specs/PRIORITIES.md"] = later, ["README.md"] = "# R\n" })
  helpers.edit(child, repo .. "/README.md")
  command("uraeda.commit")
  eq(errors(), { { "This file is not a Uraeda workflow file.", ERROR, vim.NIL } })
  child.lua([[require("uraeda.client").request(0, "uraeda/fields", nil, function() end)]])
  eq(#errors(), 2)
end

return T
