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

local priorities = "# Priorities\n\n## Now\n"

local function clients()
  return child.lua_get("#vim.lsp.get_clients({ bufnr = 0, name = 'uraeda' })")
end

T["attaches to workflow files only"] = function()
  local repo = helpers.repo({ ["specs/PRIORITIES.md"] = priorities, ["README.md"] = "# R\n" })
  helpers.edit(child, repo .. "/README.md")
  eq(clients(), 0)
  helpers.edit(child, repo .. "/specs/PRIORITIES.md")
  eq(helpers.wait_client(child), true)
end

T["does not attach under a specs folder without PRIORITIES.md"] = function()
  local repo = helpers.repo({
    ["specs/PRIORITIES.md"] = priorities,
    ["docs/specs/notes.md"] = "# Notes\n",
  })
  helpers.edit(child, repo .. "/docs/specs/notes.md")
  eq(helpers.wait_client(child, 300), false)
end

T["one client per checkout"] = function()
  local repo = helpers.repo(
    { ["specs/PRIORITIES.md"] = priorities },
    { ["2026-10-13-x"] = { ["specs/2026-10-13-x/proposal.md"] = "# Proposal\n" } }
  )
  local worktree = repo .. "/.worktrees/2026-10-13-x"
  helpers.edit(child, repo .. "/specs/PRIORITIES.md")
  eq(helpers.wait_client(child), true)
  child.cmd("vsplit")
  helpers.edit(child, worktree .. "/specs/2026-10-13-x/proposal.md")
  eq(helpers.wait_client(child), true)
  local roots = child.lua_get([[vim.iter(vim.lsp.get_clients({ name = 'uraeda' }))
    :map(function(client) return client.root_dir end)
    :totable()]])
  table.sort(roots)
  eq(roots, { repo, worktree })
end

T["an unsaved change shows its diagnostic"] = function()
  local repo = helpers.repo(helpers.example())
  helpers.edit(child, repo .. "/specs/2026-10-06-recurring-tasks/spec.md")
  eq(helpers.wait_client(child), true)
  eq(child.lua_get("vim.api.nvim_buf_get_lines(0, 4, 5, false)"), { "risk-tier: high" })
  child.lua("vim.api.nvim_buf_set_lines(0, 4, 5, false, { 'risk-tier: extreme' })")
  child.lua([[vim.wait(2000, function() return #vim.diagnostic.get(0) > 0 end, 20)]])
  local diagnostics = child.lua_get([[vim.tbl_map(function(d)
    return { lnum = d.lnum, message = d.message, source = d.source, severity = d.severity }
  end, vim.diagnostic.get(0))]])
  eq(diagnostics, {
    {
      lnum = 4,
      message = 'risk-tier "extreme" is not one of low, medium, high',
      source = "uraeda",
      severity = vim.diagnostic.severity.ERROR,
    },
  })
  eq(child.lua_get("vim.bo.modified"), true)
end

T["the server is not enabled when lsp is false"] = function()
  child.setup({ lsp = false })
  local repo = helpers.repo({ ["specs/PRIORITIES.md"] = priorities })
  helpers.edit(child, repo .. "/specs/PRIORITIES.md")
  eq(helpers.wait_client(child, 500), false)
end

return T
