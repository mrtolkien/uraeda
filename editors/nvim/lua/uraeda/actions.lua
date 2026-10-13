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

--- Picks a frontmatter field of the current file, then its value (US5).
function M.field()
  require("uraeda.pickers").field(0)
end

--- @class uraeda.Action
--- @field name string the `:Uraeda` subcommand, and the `<Plug>(uraeda-<name>)` mapping
--- @field desc string starts with `Uraeda`
--- @field fn fun(opts: table?) called with the `:Uraeda` command's opts, else with nothing
--- @field modes string[] the modes of its mapping and key
--- @field buffer_local boolean its key is set in workflow files only, else once globally
--- @field key string? its key under the prefix

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
    name = "field",
    desc = "Uraeda: set a frontmatter field",
    fn = M.field,
    modes = { "n" },
    buffer_local = true,
    key = "e",
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
