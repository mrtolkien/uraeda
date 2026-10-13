-- The marks of a file's items: jumps between the questions of a round, or the comments of a
-- pending review, and the comments drawn under their lines. The items, the comments, and their
-- lines come from the server's `uraeda/items` and `uraeda/comments`.
local M = {}

local ns = vim.api.nvim_create_namespace("uraeda")

--- Whether `bufnr` shows its inline comments: as toggled, else as `inline_comments` says.
local function shown(bufnr)
  local toggled = vim.b[bufnr].uraeda_inline
  if toggled ~= nil then
    return toggled
  end
  return require("uraeda").config().inline_comments
end

--- The virtual lines of a comment: `▎ C1  <first line>`, then `▎     <next lines>`.
local function virt_lines(comment)
  local label = ("C%d  "):format(comment.number)
  local lines = {}
  for index, text in ipairs(vim.split(comment.text, "\n")) do
    local lead = index == 1 and label or (" "):rep(#label)
    table.insert(lines, { { "▎ " .. lead .. text, "UraedaComment" } })
  end
  return lines
end

--- Draws the comments of the pending review of `bufnr` (default the current buffer) as virtual
--- lines below each comment's last line, replacing those drawn before (US9). General comments,
--- without lines, are not drawn; nothing is drawn while the buffer's inline comments are hidden,
--- or without a `uraeda` client.
--- @param bufnr integer?
function M.show(bufnr)
  if bufnr == nil or bufnr == 0 then
    bufnr = vim.api.nvim_get_current_buf()
  end
  vim.api.nvim_set_hl(0, "UraedaComment", { link = "DiagnosticInfo", default = true })
  local client = require("uraeda.client").get(bufnr)
  if not shown(bufnr) or client == nil then
    vim.api.nvim_buf_clear_namespace(bufnr, ns, 0, -1)
    return
  end
  -- The latest request wins: an older answer arriving late draws nothing.
  local drawn = (vim.b[bufnr].uraeda_drawn or 0) + 1
  vim.b[bufnr].uraeda_drawn = drawn
  -- Sent without a buffer, so the changes of every buffer reach the server first, such as a
  -- review reloaded after a command. A redraw's error is not the human's action: none shows.
  client:request("uraeda/comments", { uri = vim.uri_from_bufnr(bufnr) }, function(err, comments)
    if
      not vim.api.nvim_buf_is_valid(bufnr)
      or vim.b[bufnr].uraeda_drawn ~= drawn
      or err
      or not shown(bufnr)
    then
      return
    end
    vim.api.nvim_buf_clear_namespace(bufnr, ns, 0, -1)
    local count = vim.api.nvim_buf_line_count(bufnr)
    for _, comment in ipairs(comments or {}) do
      local last = comment.endLine or comment.line
      if last and last <= count then
        vim.api.nvim_buf_set_extmark(bufnr, ns, last - 1, 0, { virt_lines = virt_lines(comment) })
      end
    end
  end)
end

--- Hides the inline comments of `bufnr` (default the current buffer) when they show, else shows
--- them (US9.2).
--- @param bufnr integer?
function M.toggle(bufnr)
  if bufnr == nil or bufnr == 0 then
    bufnr = vim.api.nvim_get_current_buf()
  end
  vim.b[bufnr].uraeda_inline = not shown(bufnr)
  M.show(bufnr)
end

--- Redraws the inline comments of every loaded buffer with a `uraeda` client, or only of those in
--- the folders of `paths` when given: the files next to a review that changed.
--- @param paths string[]?
function M.refresh(paths)
  local folders
  if paths then
    folders = {}
    for _, path in ipairs(paths) do
      folders[vim.fs.dirname(vim.fs.normalize(path))] = true
    end
  end
  for _, buf in ipairs(vim.api.nvim_list_bufs()) do
    local name = vim.api.nvim_buf_get_name(buf)
    if
      vim.api.nvim_buf_is_loaded(buf)
      and name ~= ""
      and (folders == nil or folders[vim.fs.dirname(vim.fs.normalize(name))])
      and require("uraeda.client").get(buf) ~= nil
    then
      M.show(buf)
    end
  end
end

--- Moves the cursor of `bufnr` (default the current buffer) to the line of the next item after the
--- cursor's line when `direction` is 1, or of the previous one before it when -1; past the last or
--- the first item, the cursor stays (US8).
--- @param bufnr integer?
--- @param direction 1|-1
function M.jump(bufnr, direction)
  if bufnr == nil or bufnr == 0 then
    bufnr = vim.api.nvim_get_current_buf()
  end
  local win = vim.api.nvim_get_current_win()
  local from = vim.api.nvim_win_get_cursor(win)[1]
  require("uraeda.client").request(bufnr, "uraeda/items", nil, function(items)
    local target
    for _, item in ipairs(items or {}) do
      if direction > 0 and item.line > from and (target == nil or item.line < target) then
        target = item.line
      elseif direction < 0 and item.line < from and (target == nil or item.line > target) then
        target = item.line
      end
    end
    if
      target
      and vim.api.nvim_win_is_valid(win)
      and vim.api.nvim_win_get_buf(win) == bufnr
      and target <= vim.api.nvim_buf_line_count(bufnr)
    then
      vim.api.nvim_win_call(win, function()
        vim.cmd("normal! m'")
      end)
      vim.api.nvim_win_set_cursor(win, { target, 0 })
    end
  end)
end

return M
