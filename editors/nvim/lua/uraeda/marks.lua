-- The marks of a file's items: jumps between the questions of a round, or the comments of a
-- pending review. The items and their lines come from the server's `uraeda/items`.
local M = {}

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
