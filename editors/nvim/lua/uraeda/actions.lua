-- The human's actions, one function each, shared by `:Uraeda`, the `<Plug>` mappings, and the keys.
-- Every fact about a file comes from the server: the actions only send the buffer and the cursor.
local M = {}

local function client()
  return require("uraeda.client")
end

--- Drafts the `PRIORITIES.md` entry under the cursor, after saving the buffer, and opens the draft
--- (US2). The server finds the entry holding the line, or refuses.
function M.draft()
  local line = vim.api.nvim_win_get_cursor(0)[1]
  client().command(0, "uraeda.draft", { line = line }, { save = true })
end

--- Starts the current draft or backlog file as a feature, after saving it, opens its proposal in the
--- current window, and wipes the draft's buffer, whose file has moved (US3).
function M.start()
  local bufnr = vim.api.nvim_get_current_buf()
  client().command(bufnr, "uraeda.start", nil, { save = true }, function(result)
    if
      result.opened
      and vim.api.nvim_buf_is_valid(bufnr)
      and bufnr ~= vim.api.nvim_get_current_buf()
    then
      -- Not forced: an edit made while the start ran stays in its buffer.
      pcall(vim.api.nvim_buf_delete, bufnr, {})
    end
  end)
end

--- Commits the current draft, backlog file, proposal, or `PRIORITIES.md`, after saving it (US7).
function M.commit()
  client().command(0, "uraeda.commit", nil, { save = true })
end

local images = vim.api.nvim_create_namespace("uraeda.image")

--- The byte column after the character at byte column `col` of `line`, as `p` puts text: the
--- start of an empty line, else past every byte of a multi-byte character.
--- @param line string
--- @param col integer 0-based
local function after_cursor(line, col)
  if line == "" then
    return 0
  end
  col = math.min(col, #line - 1)
  return col + 1 + vim.str_utf_end(line, col + 1)
end

--- Saves the clipboard's image, or the file named after `:Uraeda image`, next to the current file,
--- and inserts its link after the cursor's character, as `p` does, in one undo step, tracked by a
--- mark while the server works; the cursor ends on the link's last character. A single-file draft
--- becomes a folder: its buffer reopens at the new path, with the link at the same place, and the
--- edits made while the server worked (image-attachments US5). A draft opened from another
--- branch's checkout reopens as the default branch's file, where drafts are written.
--- @param opts table?
function M.image(opts)
  local bufnr = vim.api.nvim_get_current_buf()
  if client().get(bufnr) == nil then
    -- Says why, as every action does, before the clipboard is read.
    return client().command(bufnr, "uraeda.attachImage")
  end
  -- A file's name names the image; a pasted image is named by the time, from a temporary file.
  local args, pasted
  local file = opts and opts.fargs and table.concat(vim.list_slice(opts.fargs, 2), " ") or ""
  if file ~= "" then
    local path = vim.fn.fnamemodify(vim.fs.normalize(file), ":p")
    args = { path = path, name = vim.fs.basename(path) }
  else
    local message
    pasted, message = require("uraeda.clipboard").read()
    if pasted == nil then
      return vim.notify(message, vim.log.levels.ERROR, { title = "Uraeda" })
    end
    args = { path = pasted }
  end
  local row, col = unpack(vim.api.nvim_win_get_cursor(0))
  local line = vim.api.nvim_buf_get_lines(bufnr, row - 1, row, false)[1] or ""
  local place = { row - 1, after_cursor(line, col) }
  local mark = vim.api.nvim_buf_set_extmark(bufnr, images, place[1], place[2], {})
  --- Where the mark is now, the edits made meanwhile counted.
  local function marked()
    if vim.api.nvim_buf_is_valid(bufnr) then
      local found = vim.api.nvim_buf_get_extmark_by_id(bufnr, images, mark, {})
      if found[1] then
        place = found
      end
    end
    return place
  end
  -- Run on every outcome, a refusal or a request that could not be sent included.
  local function finally()
    if pasted then
      os.remove(pasted)
    end
    if vim.api.nvim_buf_is_valid(bufnr) then
      pcall(vim.api.nvim_buf_del_extmark, bufnr, images, mark)
    end
  end
  local command_opts = { save = true, prefix = "uraeda: ", finally = finally }
  client().command(bufnr, "uraeda.attachImage", args, command_opts, function(result)
    marked()
    -- A moved draft, or the default branch's copy of a draft, is now the current buffer, its old
    -- buffer left as `:Uraeda start` leaves it, with the edits made while the server worked
    -- carried over: the file moved, or was the default branch's, as it was saved.
    local target = result.opened and vim.api.nvim_get_current_buf() or bufnr
    if result.opened and target ~= bufnr and vim.api.nvim_buf_is_valid(bufnr) then
      if vim.bo[bufnr].modified then
        local lines = vim.api.nvim_buf_get_lines(bufnr, 0, -1, false)
        vim.api.nvim_buf_set_lines(target, 0, -1, false, lines)
      end
      -- Forced: its edits are in the new buffer, and a save would re-create the old file.
      pcall(vim.api.nvim_buf_delete, bufnr, { force = true })
    end
    if vim.api.nvim_buf_is_valid(target) and result.link then
      local last = vim.api.nvim_buf_line_count(target) - 1
      local line_row = math.min(place[1], last)
      local text = vim.api.nvim_buf_get_lines(target, line_row, line_row + 1, false)[1] or ""
      local line_col = math.min(place[2], #text)
      vim.api.nvim_buf_set_text(target, line_row, line_col, line_row, line_col, { result.link })
      if vim.api.nvim_get_current_buf() == target then
        vim.api.nvim_win_set_cursor(0, { line_row + 1, line_col + #result.link - 1 })
      end
    end
    local saved = "images/" .. vim.fs.basename(result.written[1] or "")
    local note = "uraeda: added " .. saved
    -- A draft that moved also wrote its new file and the priorities; one opened from another
    -- branch's checkout only opens the default branch's file.
    if #result.written > 1 then
      note = note .. "; the draft is now a folder"
    end
    vim.notify(note, vim.log.levels.INFO, { id = "uraeda", title = "Uraeda" })
  end)
end

--- Picks a frontmatter field of the current file, then its value (US5).
function M.field()
  require("uraeda.pickers").field(0)
end

--- Opens the comment window (US4) over the lines of `:Uraeda`'s range, else of the visual
--- selection when a key or a mapping runs it in visual mode, else of the cursor's line.
--- @param opts table?
function M.comment(opts)
  local first, last
  if opts and opts.range and opts.range > 0 then
    first, last = opts.line1, opts.line2
  elseif vim.fn.mode():find("^[vV\22]") then
    first, last = vim.fn.line("v"), vim.fn.line(".")
    vim.api.nvim_feedkeys(vim.keycode("<Esc>"), "nx", false)
  else
    first = vim.api.nvim_win_get_cursor(0)[1]
    last = first
  end
  require("uraeda.comment").open(0, first, last)
end

--- Opens the verdict window of the current spec, plan, or round of questions (US6).
function M.verdict()
  require("uraeda.verdict").open(0)
end

--- Lists the files waiting on the human in every checkout, from any buffer (US8).
function M.waiting()
  require("uraeda.pickers").waiting()
end

--- Jumps to the next question of a round, or comment of a review (US8).
function M.next()
  require("uraeda.marks").jump(0, 1)
end

--- Jumps to the previous question of a round, or comment of a review (US8).
function M.prev()
  require("uraeda.marks").jump(0, -1)
end

--- Hides or shows the comments drawn under their lines (US9).
function M.comments()
  require("uraeda.marks").toggle(0)
end

--- @class uraeda.Action
--- @field name string the `:Uraeda` subcommand, and the `<Plug>(uraeda-<name>)` mapping
--- @field desc string starts with `Uraeda`
--- @field fn fun(opts: table?) called with the `:Uraeda` command's opts, else with nothing
--- @field modes string[] the modes of its mapping and key
--- @field buffer_local boolean its key is set in workflow files only, else once globally
--- @field key string? its key under the prefix
--- @field lhs string? its key outside the prefix, like `]u`, when it has no `key`
--- @field file boolean? `:Uraeda <name>` takes a file after it; else it takes no argument

--- Every action, in the order of `:Uraeda`'s completion. Later actions are appended here.
--- @type uraeda.Action[]
M.list = {
  {
    name = "draft",
    desc = "Uraeda: draft the priorities line",
    fn = M.draft,
    modes = { "n" },
    buffer_local = true,
    key = "n",
  },
  {
    name = "start",
    desc = "Uraeda: start the draft",
    fn = M.start,
    modes = { "n" },
    buffer_local = true,
    key = "p",
  },
  {
    name = "commit",
    desc = "Uraeda: commit the file",
    fn = M.commit,
    modes = { "n" },
    buffer_local = true,
    key = "g",
  },
  {
    name = "image",
    desc = "Uraeda: add the clipboard's image",
    fn = M.image,
    modes = { "n" },
    buffer_local = true,
    key = "i",
    file = true,
  },
  {
    name = "comment",
    desc = "Uraeda: comment on the lines",
    fn = M.comment,
    modes = { "n", "x" },
    buffer_local = true,
    key = "m",
  },
  {
    name = "field",
    desc = "Uraeda: set a frontmatter field",
    fn = M.field,
    modes = { "n" },
    buffer_local = true,
    key = "e",
  },
  {
    name = "verdict",
    desc = "Uraeda: approve, request changes, or submit answers",
    fn = M.verdict,
    modes = { "n" },
    buffer_local = true,
    key = "v",
  },
  {
    name = "comments",
    desc = "Uraeda: inline comments",
    fn = M.comments,
    modes = { "n" },
    buffer_local = true,
    key = "t",
  },
  {
    name = "waiting",
    desc = "Uraeda: files waiting on you",
    fn = M.waiting,
    modes = { "n" },
    buffer_local = false,
    key = "w",
  },
  {
    name = "next",
    desc = "Uraeda: next question or comment",
    fn = M.next,
    modes = { "n" },
    buffer_local = true,
    lhs = "]u",
  },
  {
    name = "prev",
    desc = "Uraeda: previous question or comment",
    fn = M.prev,
    modes = { "n" },
    buffer_local = true,
    lhs = "[u",
  },
}

--- The action named `name`, if any.
--- @param name string
--- @return uraeda.Action?
function M.get(name)
  return vim.iter(M.list):find(function(action)
    return action.name == name
  end)
end

return M
