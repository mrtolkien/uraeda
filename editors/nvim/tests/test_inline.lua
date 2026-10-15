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

--- A repository holding the example project, with a feature's branch checked out in its worktree:
--- the example's proposal, and its spec waiting for the human; returns the worktree and the spec's
--- path in it.
local function waiting_spec()
  local files = helpers.example()
  local spec = files[example .. "spec.md"]:gsub("status: approved", "status: awaiting-human", 1)
  local repo = helpers.repo(files, {
    [branch] = {
      [feature .. "proposal.md"] = files[example .. "proposal.md"],
      [feature .. "spec.md"] = spec,
    },
  })
  local worktree = repo .. "/.worktrees/" .. branch
  return worktree, worktree .. "/" .. feature .. "spec.md"
end

--- Edits `path`, and waits for its client.
local function open(path)
  helpers.edit(child, path)
  eq(helpers.wait_client(child), true)
end

--- Comments on the open spec through the server's command: `args` are the command's, without
--- `uri`.
local function comment(args)
  child.lua(
    [[
    local done = false
    require("uraeda.client").command(0, "uraeda.comment", ..., nil, function() done = true end)
    vim.wait(5000, function() return done end, 20)
  ]],
    { args }
  )
end

--- The virtual lines of the current buffer in the `uraeda` namespace, as `{ row, lines }` with
--- 1-based rows and each line's text and highlight, once `count` of them show (or after 2 s).
local function inline(count)
  return child.lua(
    [[
    local count = ...
    local ns = vim.api.nvim_create_namespace("uraeda")
    local function marks()
      return vim.api.nvim_buf_get_extmarks(0, ns, 0, -1, { details = true })
    end
    vim.wait(2000, function() return #marks() == count end, 20)
    return vim.tbl_map(function(mark)
      local lines = vim.tbl_map(function(line)
        return { line[1][1], line[1][2] }
      end, mark[4].virt_lines or {})
      return { mark[2] + 1, lines }
    end, marks())
  ]],
    { count }
  )
end

local c1 = { 52, { { "▎ C1  Rename this field", "UraedaComment" } } }

T["comments show under their lines"] = function() -- US9.1
  local _, spec = waiting_spec()
  open(spec)
  comment({ line = 50, endLine = 52, text = "Rename this field" })
  comment({ line = 60, text = "Say which day\nand which week" })
  comment({ text = "A general comment" })

  -- Reopened, as when the spec opens with a pending review.
  child.cmd("bwipeout")
  open(spec)

  eq(inline(2), {
    c1,
    {
      60,
      {
        { "▎ C2  Say which day", "UraedaComment" },
        { "▎     and which week", "UraedaComment" },
      },
    },
  })
  eq(child.lua_get("vim.api.nvim_get_hl(0, { name = 'UraedaComment' }).link"), "DiagnosticInfo")
  eq(
    vim.tbl_filter(function(note)
      return note[2] == vim.log.levels.ERROR
    end, child.lua_get("_G.notes")),
    {}
  )
end

T["the toggle hides and shows them"] = function() -- US9.2
  local _, spec = waiting_spec()
  open(spec)
  comment({ line = 50, endLine = 52, text = "Rename this field" })
  eq(inline(1), { c1 })

  child.type_keys("\\at")
  eq(inline(0), {})
  child.type_keys("\\at")
  eq(inline(1), { c1 })
  child.cmd("Uraeda comments")
  eq(inline(0), {})
end

T["they are hidden when inline comments are off"] = function()
  child.setup({ inline_comments = false })
  local _, spec = waiting_spec()
  open(spec)
  comment({ line = 50, endLine = 52, text = "Rename this field" })
  child.cmd("bwipeout")
  open(spec)

  eq(inline(1), {})
  child.type_keys("\\at")
  eq(inline(1), { c1 })
end

T["a new comment shows at once"] = function() -- US9.3
  local _, spec = waiting_spec()
  open(spec)
  eq(inline(0), {})
  child.api.nvim_win_set_cursor(0, { 50, 0 })

  child.type_keys("V2j", "\\am")
  child.lua(
    "vim.wait(5000, function() return vim.bo.filetype == 'markdown' and vim.bo.buftype == 'acwrite' end, 20)"
  )
  child.type_keys("Rename this field", "<Esc>", ":w<CR>")

  eq(inline(1), { c1 })
end

T["a saved review redraws its spec"] = function()
  local repo, spec = waiting_spec()
  open(spec)
  comment({ line = 50, endLine = 52, text = "Rename this field" })
  eq(inline(1), { c1 })

  child.cmd("split " .. vim.fn.fnameescape(repo .. "/" .. feature .. "spec-review.md"))
  child.lua([[
    local at = vim.fn.search("^Rename this field$")
    vim.api.nvim_buf_set_lines(0, at - 1, at, false, { "Rename it to tier" })
  ]])
  child.cmd("write")
  child.cmd("wincmd p")

  child.lua([[
    local ns = vim.api.nvim_create_namespace("uraeda")
    vim.wait(2000, function()
      local mark = vim.api.nvim_buf_get_extmarks(0, ns, 0, -1, { details = true })[1]
      return mark ~= nil and mark[4].virt_lines[1][1][1] == "▎ C1  Rename it to tier"
    end, 20)
  ]])
  eq(inline(1), { { 52, { { "▎ C1  Rename it to tier", "UraedaComment" } } } })
end

T["a verdict clears them"] = function()
  local _, spec = waiting_spec()
  open(spec)
  comment({ line = 50, endLine = 52, text = "Rename this field" })
  eq(inline(1), { c1 })

  child.lua([[
    local done = false
    require("uraeda.client").command(0, "uraeda.requestChanges", { summary = "" }, nil,
      function() done = true end)
    vim.wait(5000, function() return done end, 20)
  ]])

  eq(inline(0), {})
end

T["priorities show their hints"] = function() -- C1
  -- The change on its own branch, as a feature in progress is.
  local files, change = helpers.example(), "specs/changes/2026-10-14-tasks-reappear/"
  local on_branch = {}
  for name, text in pairs(files) do
    if vim.startswith(name, change) then
      on_branch[name], files[name] = text, nil
    end
  end
  local repo = helpers.repo(files, { ["change/2026-10-14-tasks-reappear"] = on_branch })
  open(repo .. "/specs/PRIORITIES.md")

  local hints = child.lua([[
    vim.wait(5000, function() return #vim.lsp.inlay_hint.get({ bufnr = 0 }) >= 3 end, 20)
    return vim.tbl_map(function(item)
      local hint = item.inlay_hint
      return { hint.position.line + 1, hint.label }
    end, vim.lsp.inlay_hint.get({ bufnr = 0 }))
  ]])
  table.sort(hints, function(a, b)
    return a[1] < b[1]
  end)
  eq(hints, {
    { 5, "assess · waits on agent" },
    { 9, "draft" },
    { 10, "draft" },
  })
  eq(child.lua_get("vim.lsp.inlay_hint.is_enabled({ bufnr = 0 })"), true)
end

T["the inline comments look right"] = function()
  local _, spec = waiting_spec()
  child.o.lines, child.o.columns = 12, 80
  child.o.laststatus = 0
  child.o.ruler = false
  child.o.showmode = false
  child.o.number = true
  open(spec)
  comment({ line = 50, endLine = 52, text = "Rename this field" })
  eq(inline(1), { c1 })
  child.api.nvim_win_set_cursor(0, { 50, 0 })
  child.cmd("normal! zt")
  child.cmd("echo ''")

  MiniTest.expect.reference_screenshot(child.get_screenshot())
end

return T
