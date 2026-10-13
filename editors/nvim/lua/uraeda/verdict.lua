-- The verdict window of US6: a float with a border in `UraedaVerdictBorder`, set apart from every
-- edit since it commits. It shows the commit the server will make, the comments kept with the
-- verdict, a spec's risk tier and plan review, and a summary to type; `<C-s>` runs the command. The
-- server gives every fact shown: the plugin only holds the values the human picks.
local M = {}

local function client()
  return require("uraeda.client")
end

local titles = {
  approve = "Approve",
  requestChanges = "Request changes",
  submit = "Submit answers",
}

local verbs = {
  approve = "approve",
  requestChanges = "request changes",
  submit = "submit",
}

local commands = {
  approve = "uraeda.approve",
  requestChanges = "uraeda.requestChanges",
  submit = "uraeda.submit",
}

local namespace = vim.api.nvim_create_namespace("uraeda.verdict")
local windows = 0

--- Defines the highlight groups, kept by a colour scheme that sets them.
local function highlights()
  vim.api.nvim_set_hl(0, "UraedaVerdictBorder", { link = "DiagnosticWarn", default = true })
end

--- `Q3 and Q5`: the names joined with `, ` and a final `and`.
local function joined(names)
  if #names == 1 then
    return names[1]
  end
  return table.concat(names, ", ", 1, #names - 1) .. " and " .. names[#names]
end

--- `< medium >`, `< false >`.
local function choice(value)
  return ("< %s >"):format(tostring(value))
end

--- The path of `bufnr`'s file from its checkout's root, else its name.
local function path_of(bufnr, verdict)
  local name = vim.api.nvim_buf_get_name(bufnr)
  local root = (client().get(bufnr) or {}).root_dir
  return root and vim.fs.relpath(root, name) or verdict.file
end

--- Closes the window and wipes its buffer.
local function close(win, buf)
  if vim.api.nvim_win_is_valid(win) then
    vim.api.nvim_win_close(win, true)
  end
  if vim.api.nvim_buf_is_valid(buf) then
    vim.api.nvim_buf_delete(buf, { force = true })
  end
end

--- The index in `tiers` of the tier `value`, 0 when it is none of them.
local function tier_index(tiers, value)
  return vim.iter(ipairs(tiers)):find(function(_, choice)
    return choice.value == value
  end) or 0
end

--- Opens the window of `action` on `bufnr`, from its `uraeda/verdict`.
local function show(bufnr, verdict, action)
  highlights()
  local tier = action == "approve" and verdict.riskTier or nil
  -- The tiers the server offers, each with the plan review it gives by default.
  local tiers = verdict.tiers or {}
  -- The values sent with the verdict, shown on their lines.
  local state = { tier = tier, plan = verdict.planReview }
  if tier and state.plan == nil then
    local current = tiers[tier_index(tiers, tier)]
    state.plan = current ~= nil and current.planReview
  end
  local blocked = action == "submit" and #verdict.blank > 0

  local lines =
    { "Commits  " .. (action == "requestChanges" and verdict.requestChanges or verdict.approve) }
  if action ~= "submit" then
    table.insert(
      lines,
      verdict.comments > 0 and ("Comments %d, kept with the verdict"):format(verdict.comments)
        or "Comments none"
    )
  end
  local rows = {}
  if tier then
    rows.tier = #lines
    table.insert(lines, "Risk tier    " .. choice(state.tier))
    rows.plan = #lines
    table.insert(lines, "Plan review  " .. choice(state.plan))
  end
  if blocked then
    rows.blank = #lines
    local verb = #verdict.blank == 1 and "has" or "have"
    table.insert(lines, ("%s %s no answer."):format(joined(verdict.blank), verb))
  end

  local width = math.max(40, math.min(72, vim.o.columns - 4))
  if action ~= "submit" then
    rows.separator = #lines
    table.insert(lines, string.rep("─", width))
    table.insert(lines, "")
  end

  windows = windows + 1
  local buf = vim.api.nvim_create_buf(false, true)
  vim.api.nvim_buf_set_name(buf, ("uraeda://verdict/%d"):format(windows))
  vim.bo[buf].bufhidden = "wipe"
  vim.bo[buf].filetype = "uraeda_verdict"
  vim.api.nvim_buf_set_lines(buf, 0, -1, false, lines)

  -- Marks follow their lines if the human edits above them; the risk tier's and the plan
  -- review's carry the hint.
  local hint = { { "Tab to change", "Comment" } }
  local marks = {}
  local function mark(name, at)
    local opts = { id = marks[name] }
    if name == "tier" or name == "plan" then
      opts.virt_text, opts.virt_text_win_col = hint, 28
    end
    marks[name] = vim.api.nvim_buf_set_extmark(buf, namespace, at, 0, opts)
  end
  for name, at in pairs(rows) do
    mark(name, at)
  end
  if rows.blank then
    vim.api.nvim_buf_set_extmark(buf, namespace, rows.blank, 0, {
      end_row = rows.blank,
      end_col = #lines[rows.blank + 1],
      hl_group = "DiagnosticError",
    })
  end
  if rows.separator then
    vim.api.nvim_buf_set_extmark(buf, namespace, rows.separator, 0, {
      end_row = rows.separator,
      end_col = #lines[rows.separator + 1],
      hl_group = "FloatBorder",
      virt_lines = { { { "Summary ", "Normal" }, { "(optional)", "Comment" } } },
    })
  end

  local footer = blocked and " q close " or (" Ctrl-s %s · q cancel "):format(verbs[action])
  local height = #lines + (rows.separator and 3 or 0)
  local win = vim.api.nvim_open_win(buf, true, {
    relative = "editor",
    row = math.max(0, math.floor((vim.o.lines - height) / 2) - 1),
    col = math.floor((vim.o.columns - width) / 2),
    width = width,
    height = height,
    style = "minimal",
    border = "rounded",
    title = (" %s · %s "):format(
      titles[action],
      action == "submit" and verdict.file or path_of(bufnr, verdict)
    ),
    title_pos = "left",
    footer = footer,
    footer_pos = "right",
  })
  vim.wo[win].winhighlight =
    "FloatBorder:UraedaVerdictBorder,FloatTitle:UraedaVerdictBorder,FloatFooter:UraedaVerdictBorder"
  vim.wo[win].wrap = true
  vim.api.nvim_win_set_cursor(win, { rows.separator and #lines or 1, 0 })

  --- The 0-based row of the mark `name`.
  local function row(name)
    return vim.api.nvim_buf_get_extmark_by_id(buf, namespace, marks[name], {})[1]
  end
  local function set_line(name, text)
    local at = row(name)
    vim.api.nvim_buf_set_lines(buf, at, at + 1, false, { text })
    -- Replacing the line may drop its mark: put it back.
    mark(name, at)
  end

  local function send()
    if blocked then
      return
    end
    local args = {}
    if action ~= "submit" then
      local summary = vim.api.nvim_buf_get_lines(buf, row("separator") + 1, -1, false)
      args.summary = vim.trim(table.concat(summary, "\n"))
    end
    if tier then
      args.riskTier, args.planReview = state.tier, state.plan
    end
    vim.cmd.stopinsert()
    -- On a refusal, the window and the summary stay: the callback runs on success only.
    client().command(bufnr, commands[action], args, { save = true }, function()
      close(win, buf)
    end)
  end

  local function map(modes, lhs, rhs, desc)
    vim.keymap.set(modes, lhs, rhs, { buffer = buf, desc = "Uraeda: " .. desc, nowait = true })
  end
  map({ "n", "i" }, "<C-s>", send, ("%s and commit"):format(verbs[action]))
  map("n", "q", function()
    close(win, buf)
  end, "close the verdict")
  if tier then
    map("n", "<Tab>", function()
      local at = vim.api.nvim_win_get_cursor(win)[1] - 1
      if at == row("tier") and #tiers > 0 then
        local next = tiers[tier_index(tiers, state.tier) % #tiers + 1]
        state.tier, state.plan = next.value, next.planReview
        set_line("tier", "Risk tier    " .. choice(state.tier))
        set_line("plan", "Plan review  " .. choice(state.plan))
      elseif at == row("plan") then
        state.plan = not state.plan
        set_line("plan", "Plan review  " .. choice(state.plan))
      end
    end, "change the value")
  end
end

--- Asks for the verdict on a review, unless `action` names it, and opens its window. A file not
--- waiting for the human is refused with the server's text.
local function pick(bufnr, verdict, action)
  if not verdict.waiting then
    local waits_for = verdict.kind == "round" and "answers" or "a review"
    return vim.notify(
      ("%s is not waiting for %s."):format(verdict.file, waits_for),
      vim.log.levels.ERROR,
      { title = "Uraeda" }
    )
  end
  if verdict.kind == "round" then
    return show(bufnr, verdict, "submit")
  end
  local function chosen(name)
    if name == "requestChanges" and verdict.comments == 0 then
      return vim.notify(
        "Requesting changes needs at least one comment.",
        vim.log.levels.ERROR,
        { title = "Uraeda" }
      )
    end
    show(bufnr, verdict, name)
  end
  if action == "approve" or action == "requestChanges" then
    return chosen(action)
  end
  local items = {
    { name = "approve", label = "Approve" },
    { name = "requestChanges", label = "Request changes" },
  }
  vim.ui.select(items, {
    prompt = ("Verdict on %s"):format(verdict.file),
    kind = "uraeda_verdict",
    format_item = function(item)
      return item.label
    end,
  }, function(item)
    if item then
      chosen(item.name)
    end
  end)
end

--- Opens the verdict window of `bufnr`: for a spec, a plan, or an assessment, the window of
--- `action`, else of the verdict the human picks; for a round of questions, the submission's. A
--- file not waiting gets no window, and the server refuses other files.
--- @param bufnr integer?
--- @param action? "approve" | "requestChanges" | "submit"
function M.open(bufnr, action)
  if bufnr == nil or bufnr == 0 then
    bufnr = vim.api.nvim_get_current_buf()
  end
  client().request(bufnr, "uraeda/verdict", nil, function(verdict)
    if not vim.api.nvim_buf_is_valid(bufnr) then
      return
    end
    pick(bufnr, verdict, action)
  end)
end

return M
