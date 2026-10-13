-- The comment window of US4: a float under the commented lines, holding a scratch markdown buffer
-- that `:w` or `<C-s>` sends to the server as a new comment, or as an edit of the comment already on
-- those lines. The server says whether the file takes comments, and holds the comments.
local M = {}

local function client()
  return require("uraeda.client")
end

local windows = 0

--- `Comment · lines 50–52`, or `Comment · line 50`.
local function title(first, last)
  if first == last then
    return (" Comment · line %d "):format(first)
  end
  return (" Comment · lines %d–%d "):format(first, last)
end

--- The first comment on a line between `first` and `last`, from `uraeda/comments`.
local function on_lines(comments, first, last)
  return vim.iter(comments or {}):find(function(comment)
    return comment.line ~= nil
      and comment.line <= last
      and (comment.endLine or comment.line) >= first
  end)
end

--- The window's text, without its trailing blank lines.
local function text_of(buf)
  local text = table.concat(vim.api.nvim_buf_get_lines(buf, 0, -1, false), "\n")
  return (text:gsub("%s+$", ""))
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

--- Sends the window's text: a new comment on `first`–`last`, or the edit of `existing`, removed
--- when the text is empty. Closes the window and fires `User UraedaComment` once the server took
--- it; on a refusal, the window and its text stay, and the error shows.
local function save(bufnr, win, buf, first, last, existing)
  local text = text_of(buf)
  local function saved()
    -- The window may have been closed while the server worked.
    close(win, buf)
    vim.api.nvim_exec_autocmds("User", { pattern = "UraedaComment", modeline = false })
  end
  if existing then
    client().command(
      bufnr,
      "uraeda.editComment",
      { number = existing.number, text = text },
      nil,
      saved
    )
  elseif text == "" then
    -- Nothing to add.
    close(win, buf)
  else
    client().command(
      bufnr,
      "uraeda.comment",
      { line = first, endLine = last, text = text },
      nil,
      saved
    )
  end
end

--- Opens the window over `first`–`last` of the current window, which shows `bufnr`.
local function show(bufnr, first, last, existing)
  if existing then
    first, last = existing.line, existing.endLine or existing.line
  end
  local source = vim.api.nvim_get_current_win()
  local info = vim.fn.getwininfo(source)[1]

  windows = windows + 1
  local buf = vim.api.nvim_create_buf(false, false)
  vim.api.nvim_buf_set_name(buf, ("uraeda://comment/%d"):format(windows))
  vim.bo[buf].buftype = "acwrite"
  vim.bo[buf].bufhidden = "wipe"
  vim.bo[buf].swapfile = false
  vim.bo[buf].filetype = "markdown"
  local lines = existing and vim.split(existing.text, "\n") or { "" }
  vim.api.nvim_buf_set_lines(buf, 0, -1, false, lines)
  vim.bo[buf].modified = false

  local win = vim.api.nvim_open_win(buf, true, {
    relative = "win",
    win = source,
    bufpos = { last - 1, 0 },
    width = math.max(20, math.min(80, info.width - info.textoff - 4)),
    height = math.max(2, math.min(12, #lines + 1)),
    style = "minimal",
    border = "rounded",
    title = title(first, last),
    title_pos = "left",
    footer = " :w save · q cancel ",
    footer_pos = "right",
  })
  vim.wo[win].wrap = true
  vim.api.nvim_win_set_cursor(win, { #lines, #lines[#lines] })

  vim.api.nvim_create_autocmd("BufWriteCmd", {
    buffer = buf,
    desc = "Uraeda: send the comment",
    callback = function()
      save(bufnr, win, buf, first, last, existing)
    end,
  })
  local function map(modes, lhs, rhs, desc)
    vim.keymap.set(modes, lhs, rhs, { buffer = buf, desc = "Uraeda: " .. desc, nowait = true })
  end
  map({ "n", "i" }, "<C-s>", "<Cmd>write<CR>", "save the comment")
  map("n", "q", function()
    close(win, buf)
  end, "cancel the comment")
  map("n", "<Esc>", function()
    close(win, buf)
  end, "cancel the comment")

  if not existing then
    vim.cmd.startinsert()
  end
end

--- Opens the comment window over lines `first` to `last` (1-based) of `bufnr`, shown in the
--- current window, prefilled with the comment already on those lines. Opens nothing when the
--- server refuses comments on the file: one waiting for a review, as committed.
--- @param bufnr integer?
--- @param first integer
--- @param last integer
function M.open(bufnr, first, last)
  if bufnr == nil or bufnr == 0 then
    bufnr = vim.api.nvim_get_current_buf()
  end
  first, last = math.min(first, last), math.max(first, last)
  client().request(bufnr, "uraeda/canComment", nil, function()
    client().request(bufnr, "uraeda/comments", nil, function(comments)
      if vim.api.nvim_get_current_buf() ~= bufnr then
        return
      end
      show(bufnr, first, last, on_lines(comments, first, last))
    end)
  end)
end

return M
