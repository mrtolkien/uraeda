local helpers = dofile("tests/helpers.lua")
local eq = MiniTest.expect.equality

-- The day an approval or a submission writes, read by the server from its environment, inherited
-- from the child (R8): set for this file's cases only.
local today = "2026-10-14"
local saved_today

local child = helpers.new_child()
local T = MiniTest.new_set({
  hooks = {
    pre_case = function()
      saved_today, vim.env.URA_TODAY = vim.env.URA_TODAY, today
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
          table.insert(_G.selects, { kind = opts.kind, items = shown })
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
    post_case = function()
      vim.env.URA_TODAY = saved_today
    end,
    post_once = child.stop,
  },
})

local example = "specs/2026-10-06-recurring-tasks/"
local branch = "2026-10-13-nvim-plugin"
local feature = "specs/" .. branch .. "/"
local ERROR = vim.log.levels.ERROR

--- A repository holding the example project, with a feature's branch checked out in its worktree,
--- holding the example's proposal and `files` (name → text) in the feature's folder; returns the
--- repository and its worktree.
local function with_feature(files)
  local example_files = helpers.example()
  local branch_files = { [feature .. "proposal.md"] = example_files[example .. "proposal.md"] }
  for name, text in pairs(files) do
    branch_files[feature .. name] = text
  end
  local repo = helpers.repo(example_files, { [branch] = branch_files })
  return repo, repo .. "/.worktrees/" .. branch
end

--- The example's spec, waiting for the human, its block waiting too: `risk-tier: high`,
--- `plan-review: true`.
local function waiting_spec()
  local spec = helpers.example()[example .. "spec.md"]
  spec = spec:gsub("status: approved", "status: awaiting-human", 1)
  spec = spec:gsub(
    vim.pesc("> [!NOTE]\n>\n> Approved on 2026-10-09."),
    "> [!IMPORTANT]\n>\n> Spec to review, about 20 minutes.",
    1
  )
  return spec
end

--- A round of questions waiting for the human, one question per answer, as the server's tests
--- write it.
local function round(answers)
  local text = "---\nstatus: awaiting-human\n---\n\n# Clarifications, round 01: Feature\n\n"
    .. "> [!IMPORTANT]\n>\n> "
    .. #answers
    .. " questions.\n>\n> - A point.\n\n## Context\n\nContext.\n"
  for index, answer in ipairs(answers) do
    text = text
      .. ("\n## Q%d: Question %d?\n\nWhy.\n\n"):format(index, index)
      .. "- **A (recommended). One.**\n  - [pro] p\n- **B. Two.**\n  - [con] c\n\n"
      .. "**Answer:**"
      .. (answer == "" and "" or " " .. answer)
      .. "\n"
  end
  return text .. "\n## Settled without the human\n\n- **A point** settled.\n\n**Notes:**\n"
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

--- Comments on lines 50 to 52 of the open spec, through the server's command.
local function comment_c1()
  child.lua([[
    local done = false
    require("uraeda.client").command(0, "uraeda.comment",
      { line = 50, endLine = 52, text = "Rename this field" }, nil, function() done = true end)
    vim.wait(5000, function() return done end, 20)
  ]])
end

--- Waits up to 5 s for the verdict window to open, and returns whether it did.
local function wait_window()
  return child.lua_get(
    "vim.wait(5000, function() return vim.api.nvim_win_get_config(0).relative ~= '' end, 20)"
  )
end

--- Waits up to 5 s for the child to show only its first window again.
local function wait_closed()
  return child.lua_get("vim.wait(5000, function() return #vim.api.nvim_list_wins() == 1 end, 20)")
end

--- The verdict window's title, footer, border highlight, and buffer's lines.
local function window()
  return child.lua([[
    local config = vim.api.nvim_win_get_config(0)
    local function text(chunks)
      return table.concat(vim.tbl_map(function(chunk) return chunk[1] end, chunks or {}))
    end
    return {
      title = text(config.title),
      footer = text(config.footer),
      border = vim.wo.winhighlight:match("FloatBorder:(%w+)"),
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

--- The subject of the last commit on the feature's branch.
local function last_subject(repo)
  return vim.trim(helpers.git(repo, { "log", "-1", "--format=%s", branch }))
end

T["approving a spec with a new tier"] = function() -- US6.1
  -- Proposed at medium, without a plan review: approving at high leaves it off.
  local proposed = waiting_spec()
    :gsub("risk%-tier: high", "risk-tier: medium", 1)
    :gsub("plan%-review: true", "plan-review: false", 1)
  local repo, worktree = with_feature({ ["spec.md"] = proposed })
  local spec = worktree .. "/" .. feature .. "spec.md"
  open(spec)
  comment_c1()
  child.lua("_G.picks = { 'Approve' }")

  child.type_keys("\\av")

  eq(wait_window(), true)
  eq(child.lua_get("_G.selects"), {
    { kind = "uraeda_verdict", items = { "Approve", "Request changes" } },
  })
  local shown = window()
  eq(shown.title, " Approve · " .. feature .. "spec.md ")
  eq(shown.footer, " Ctrl-s approve · q cancel ")
  eq(shown.border, "UraedaVerdictBorder")
  eq(vim.list_slice(shown.lines, 1, 4), {
    "Commits  spec(nvim-plugin): approve",
    "Comments 1, kept with the verdict",
    "Risk tier    < medium >",
    "Plan review  < false >",
  })
  eq(#shown.lines[5] > 0 and (shown.lines[5]:gsub("─", "")) == "", true)
  eq(
    child.lua_get("vim.api.nvim_get_hl(0, { name = 'UraedaVerdictBorder' }).link"),
    "DiagnosticWarn"
  )

  -- Tab on the risk tier's line: medium → high, plan review off by default for every tier.
  child.api.nvim_win_set_cursor(0, { 3, 0 })
  child.type_keys("<Tab>")
  eq(vim.list_slice(window().lines, 3, 4), { "Risk tier    < high >", "Plan review  < false >" })
  -- Tab on the plan review's line toggles it, twice back to false.
  child.api.nvim_win_set_cursor(0, { 4, 0 })
  child.type_keys("<Tab>")
  eq(window().lines[4], "Plan review  < true >")
  child.type_keys("<Tab>")
  eq(window().lines[4], "Plan review  < false >")

  child.api.nvim_win_set_cursor(0, { 6, 0 })
  child.type_keys("i", "Looks good.", "<C-s>")

  eq(wait_closed(), true)
  eq(last_subject(repo), "spec(nvim-plugin): approve")
  local approved = read(spec)
  eq(approved:find("status: approved\n", 1, true) ~= nil, true)
  eq(approved:find("risk-tier: high\n", 1, true) ~= nil, true)
  eq(approved:find("plan-review: false\n", 1, true) ~= nil, true)
  eq(approved:find("Approved on 2026-10-14.", 1, true) ~= nil, true)
  local review = read(worktree .. "/" .. feature .. "spec-review.md")
  eq(review:find("verdict: approved", 1, true) ~= nil, true)
  eq(review:find("Looks good.", 1, true) ~= nil, true)
  -- The buffer shows the committed file.
  eq(child.lua_get("vim.api.nvim_buf_get_name(0)"), spec)
  eq(child.lua_get("vim.bo.modified"), false)
  eq(
    child
      .lua_get("vim.iter(vim.api.nvim_buf_get_lines(0, 0, 6, false)):join('\\n')")
      :find("status: approved", 1, true) ~= nil,
    true
  )
  eq(
    vim.tbl_filter(function(note)
      return note[2] == ERROR
    end, child.lua_get("_G.notes")),
    {}
  )
end

T["a failing hook reloads what the verdict wrote"] = function()
  local repo, worktree = with_feature({ ["spec.md"] = waiting_spec() })
  helpers.set_hook(repo, "echo 'lint: spec too long' >&2\nexit 1")
  local spec = worktree .. "/" .. feature .. "spec.md"
  open(spec)

  child.lua([[require("uraeda.client").command(0, "uraeda.approve", { riskTier = "medium" },
    { save = true })]])

  local found = errors()
  eq(#found, 1)
  eq(found[1][1]:find("lint: spec too long", 1, true) ~= nil, true)
  eq(last_subject(repo), "chore: " .. branch)
  -- The spec stays written, uncommitted, and the buffer shows it.
  eq(read(spec):find("status: approved\n", 1, true) ~= nil, true)
  eq(child.lua_get("vim.bo.modified"), false)
  eq(
    child
      .lua_get("vim.iter(vim.api.nvim_buf_get_lines(0, 0, 6, false)):join('\\n')")
      :find("status: approved", 1, true) ~= nil,
    true
  )
end

T["changes without comments refuse"] = function() -- US6.2
  local repo, worktree = with_feature({ ["spec.md"] = waiting_spec() })
  open(worktree .. "/" .. feature .. "spec.md")
  child.lua("_G.picks = { 'Request changes' }")

  child.cmd("Uraeda verdict")

  eq(errors(), { { "Requesting changes needs at least one comment.", ERROR } })
  eq(child.lua_get("#vim.api.nvim_list_wins()"), 1)
  eq(last_subject(repo), "chore: " .. branch)

  -- The same from the field picker's `changes-requested…`.
  child.lua("_G.notes = {}")
  child.lua("require('uraeda.verdict').open(0, 'requestChanges')")
  eq(errors(), { { "Requesting changes needs at least one comment.", ERROR } })
  eq(child.lua_get("#vim.api.nvim_list_wins()"), 1)
end

T["a file not waiting gets no window"] = function()
  local spec = helpers.example()[example .. "spec.md"]
  local answered = round({ "A", "B" }):gsub("status: awaiting%-human", "status: answered", 1)
  local _, worktree = with_feature({ ["spec.md"] = spec, ["clarifications-01.md"] = answered })
  open(worktree .. "/" .. feature .. "spec.md")
  child.lua("_G.picks = { 'Approve' }")

  child.cmd("Uraeda verdict")

  eq(errors(), { { "spec.md is not waiting for a review.", ERROR } })
  eq(child.lua_get("_G.selects"), {})
  eq(child.lua_get("#vim.api.nvim_list_wins()"), 1)

  child.lua("_G.notes = {}")
  open(worktree .. "/" .. feature .. "clarifications-01.md")
  child.cmd("Uraeda verdict")
  eq(errors(), { { "clarifications-01.md is not waiting for answers.", ERROR } })
  eq(child.lua_get("#vim.api.nvim_list_wins()"), 1)
end

T["a round is submitted"] = function() -- US6.3
  local repo, worktree = with_feature({ ["clarifications-01.md"] = round({ "A", "B" }) })
  local path = worktree .. "/" .. feature .. "clarifications-01.md"
  open(path)

  child.type_keys("\\av")

  eq(wait_window(), true)
  eq(child.lua_get("_G.selects"), {})
  eq(window(), {
    title = " Submit answers · clarifications-01.md ",
    footer = " Ctrl-s submit · q cancel ",
    border = "UraedaVerdictBorder",
    lines = { "Commits  discovery(nvim-plugin): answer round 01" },
  })
  child.type_keys("<C-s>")

  eq(wait_closed(), true)
  eq(last_subject(repo), "discovery(nvim-plugin): answer round 01")
  local submitted = read(path)
  eq(submitted:find("status: answered\n", 1, true) ~= nil, true)
  eq(submitted:find("Answered on 2026-10-14.", 1, true) ~= nil, true)
  eq(child.lua_get("vim.api.nvim_buf_get_lines(0, 1, 2, false)"), { "status: answered" })
end

T["blank questions block the submit"] = function() -- US6.4
  local repo, worktree =
    with_feature({ ["clarifications-01.md"] = round({ "A", "B", "", "A", "" }) })
  open(worktree .. "/" .. feature .. "clarifications-01.md")

  child.cmd("Uraeda verdict")

  eq(wait_window(), true)
  eq(window(), {
    title = " Submit answers · clarifications-01.md ",
    footer = " q close ",
    border = "UraedaVerdictBorder",
    lines = { "Commits  discovery(nvim-plugin): answer round 01", "Q3 and Q5 have no answer." },
  })
  child.type_keys("<C-s>")
  child.lua("vim.wait(300)")
  eq(child.lua_get("#vim.api.nvim_list_wins()"), 2)
  eq(last_subject(repo), "chore: " .. branch)

  child.type_keys("q")
  eq(wait_closed(), true)
  eq(last_subject(repo), "chore: " .. branch)
end

--- Sets the child's screen to 20 lines of 80 columns, without a status line.
local function small_screen()
  child.o.lines, child.o.columns = 20, 80
  child.o.laststatus = 0
  child.o.ruler = false
  child.o.showmode = false
end

T["the window looks right"] = MiniTest.new_set()

T["the window looks right"]["approve"] = function()
  local _, worktree = with_feature({ ["spec.md"] = waiting_spec() })
  small_screen()
  open(worktree .. "/" .. feature .. "spec.md")
  comment_c1()
  child.cmd("echo ''")

  child.lua("require('uraeda.verdict').open(0, 'approve')")

  eq(wait_window(), true)
  child.api.nvim_win_set_cursor(0, { 3, 0 })
  child.type_keys("<Tab>", "<Tab>")
  MiniTest.expect.reference_screenshot(child.get_screenshot())
end

T["the window looks right"]["submit with blanks"] = function()
  local _, worktree = with_feature({ ["clarifications-01.md"] = round({ "A", "B", "", "A", "" }) })
  small_screen()
  open(worktree .. "/" .. feature .. "clarifications-01.md")
  child.cmd("echo ''")

  child.lua("require('uraeda.verdict').open(0)")

  eq(wait_window(), true)
  MiniTest.expect.reference_screenshot(child.get_screenshot())
end

return T
