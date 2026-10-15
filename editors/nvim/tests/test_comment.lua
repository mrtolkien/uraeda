local helpers = dofile("tests/helpers.lua")
local eq = MiniTest.expect.equality

local child = helpers.new_child()
local T = MiniTest.new_set({
  hooks = {
    pre_case = function()
      child.setup()
      -- Every notification, as { message, level }, and every `User UraedaComment`.
      child.lua([[
        _G.notes, _G.saved = {}, 0
        vim.notify = function(message, level)
          table.insert(_G.notes, { message, level })
        end
        vim.api.nvim_create_autocmd("User", {
          pattern = "UraedaComment",
          callback = function() _G.saved = _G.saved + 1 end,
        })
      ]])
    end,
    post_once = child.stop,
  },
})

local example = "specs/2026-10-06-recurring-tasks/"
local branch = "2026-10-13-nvim-plugin"
local feature = "specs/" .. branch .. "/"
local ERROR = vim.log.levels.ERROR

--- A repository holding the example project, with a feature's branch checked out in its worktree:
--- the example's proposal, and its spec with `status`; returns the worktree and the spec's path in
--- it.
local function feature_spec(status)
  local files = helpers.example()
  local spec = files[example .. "spec.md"]:gsub("status: approved", "status: " .. status, 1)
  local repo = helpers.repo(files, {
    [branch] = {
      [feature .. "proposal.md"] = files[example .. "proposal.md"],
      [feature .. "spec.md"] = spec,
    },
  })
  local worktree = repo .. "/.worktrees/" .. branch
  return worktree, worktree .. "/" .. feature .. "spec.md"
end

--- The same, the spec waiting for the human.
local function waiting_spec()
  return feature_spec("awaiting-human")
end

local function read(path)
  local file = io.open(path, "rb")
  if file == nil then
    return nil
  end
  local text = file:read("*a")
  file:close()
  return text
end

--- Edits `path`, and waits for its client.
local function open(path)
  helpers.edit(child, path)
  eq(helpers.wait_client(child), true)
end

--- Comments on lines 50 to 52 of the open spec with `Rename this field`, through the server's
--- command, as US4.1 does.
local function comment_c1()
  child.lua([[
    local done = false
    require("uraeda.client").command(0, "uraeda.comment",
      { line = 50, endLine = 52, text = "Rename this field" }, nil, function() done = true end)
    vim.wait(5000, function() return done end, 20)
  ]])
end

--- Waits up to 5 s for the comment window to open, and returns whether it did.
local function wait_window()
  return child.lua_get(
    "vim.wait(5000, function() return vim.bo.filetype == 'markdown' and vim.bo.buftype == 'acwrite' end, 20)"
  )
end

--- Waits up to 5 s for `User UraedaComment` to fire `count` times.
local function wait_saved(count)
  return child.lua(
    "local count = ... return vim.wait(5000, function() return _G.saved >= count end, 20)",
    { count }
  )
end

--- The comment window's config: its title, footer, and buffer's lines.
local function window()
  return child.lua([[
    local config = vim.api.nvim_win_get_config(0)
    local function text(chunks)
      return table.concat(vim.tbl_map(function(chunk) return chunk[1] end, chunks or {}))
    end
    return {
      relative = config.relative,
      title = text(config.title),
      footer = text(config.footer),
      lines = vim.api.nvim_buf_get_lines(0, 0, -1, false),
    }
  ]])
end

local function errors()
  child.lua([[vim.wait(5000, function()
    return vim.iter(_G.notes):any(function(note) return note[2] == vim.log.levels.ERROR end)
  end, 20)]])
  return vim.tbl_filter(function(note)
    return note[2] == ERROR
  end, child.lua_get("_G.notes"))
end

T["a selection gets a comment"] = function() -- US4.1
  local repo, spec = waiting_spec()
  open(spec)
  child.api.nvim_win_set_cursor(0, { 52, 0 })

  child.type_keys("V2j", "\\am")

  eq(wait_window(), true)
  eq(window(), {
    relative = "win",
    title = " Comment · lines 52–54 ",
    footer = " :w save · q cancel ",
    lines = { "" },
  })
  child.type_keys("Rename this field", "<Esc>", ":w<CR>")
  eq(wait_saved(1), true)

  local review = read(repo .. "/" .. feature .. "spec-review.md")
  eq(review:find("verdict: pending", 1, true) ~= nil, true)
  eq(
    review:find('## C1: Lines 52–54, under "US2: Complete a repeating task (P1)"', 1, true) ~= nil,
    true
  )
  eq(review:find("> Completing a repeating task moves it", 1, true) ~= nil, true)
  eq(review:find("\nRename this field\n", 1, true) ~= nil, true)
  eq(child.lua_get("vim.api.nvim_buf_get_name(0)"), spec)
  eq(child.lua_get("#vim.api.nvim_list_wins()"), 1)
  eq(vim.trim(helpers.git(repo, { "log", "-1", "--format=%s" })), "chore: " .. branch)
  eq(
    vim.tbl_filter(function(note)
      return note[2] == ERROR
    end, child.lua_get("_G.notes")),
    {}
  )
end

T["a commented line opens its comment"] = function() -- US4.2
  local repo, spec = waiting_spec()
  open(spec)
  comment_c1()
  child.api.nvim_win_set_cursor(0, { 51, 0 })

  child.cmd("Uraeda comment")

  eq(wait_window(), true)
  eq(window().title, " Comment · lines 50–52 ")
  eq(window().lines, { "Rename this field" })
  child.lua("vim.api.nvim_buf_set_lines(0, 0, -1, false, { 'Rename it to tier' })")
  child.type_keys("<C-s>")
  eq(wait_saved(1), true)

  local review = read(repo .. "/" .. feature .. "spec-review.md")
  eq(review:find("\nRename it to tier\n", 1, true) ~= nil, true)
  eq(review:find("Rename this field", 1, true), nil)
end

T["an emptied comment is removed"] = function() -- US4.3
  local repo, spec = waiting_spec()
  open(spec)
  comment_c1()

  child.cmd("51Uraeda comment")

  eq(wait_window(), true)
  child.type_keys("dd", ":w<CR>")
  eq(wait_saved(1), true)
  eq(read(repo .. "/" .. feature .. "spec-review.md"), nil)
end

T["an uncommitted spec refuses"] = function() -- US4.4
  local repo, spec = waiting_spec()
  open(spec)
  child.lua("vim.api.nvim_buf_set_lines(0, -1, -1, false, { 'An unsaved line.' })")
  child.api.nvim_win_set_cursor(0, { 50, 0 })

  child.type_keys("\\am")

  eq(errors(), {
    {
      "spec.md differs from its last commit: comments point at the committed version. Commit or undo the change first.",
      ERROR,
    },
  })
  eq(child.lua_get("#vim.api.nvim_list_wins()"), 1)
  eq(child.lua_get("vim.api.nvim_buf_get_name(0)"), spec)
  eq(read(repo .. "/" .. feature .. "spec-review.md"), nil)
end

T["an approved spec refuses"] = function() -- US4.5
  local _, spec = feature_spec("approved")
  open(spec)

  child.cmd("Uraeda comment")

  eq(errors(), { { "spec.md is not waiting for a review.", ERROR } })
  eq(child.lua_get("#vim.api.nvim_list_wins()"), 1)
end

T["a refused text keeps the window"] = function() -- review focus 3
  local repo, spec = waiting_spec()
  open(spec)
  child.api.nvim_win_set_cursor(0, { 50, 0 })

  child.cmd("Uraeda comment")

  eq(wait_window(), true)
  child.type_keys("Rename this field", "<CR>", "# A heading", "<C-s>")
  eq(#errors(), 1)
  eq(wait_window(), true)
  eq(window().lines, { "Rename this field", "# A heading" })
  eq(child.lua_get("_G.saved"), 0)
  eq(read(repo .. "/" .. feature .. "spec-review.md"), nil)

  child.type_keys("<Esc>", "q")
  eq(child.lua_get("#vim.api.nvim_list_wins()"), 1)
  eq(child.lua_get("vim.api.nvim_buf_get_name(0)"), spec)
  eq(read(repo .. "/" .. feature .. "spec-review.md"), nil)
end

T["the window looks right"] = function()
  -- The window alone: the inline comments of task 12 have their own screenshot.
  child.setup({ inline_comments = false })
  local _, spec = waiting_spec()
  child.o.lines, child.o.columns = 16, 80
  child.o.laststatus = 0
  child.o.ruler = false
  child.o.showmode = false
  child.o.number = true
  open(spec)
  comment_c1()
  child.api.nvim_win_set_cursor(0, { 50, 0 })
  child.cmd("normal! zt")
  child.cmd("echo ''")

  child.type_keys("\\am")

  eq(wait_window(), true)
  MiniTest.expect.reference_screenshot(child.get_screenshot())
end

return T
