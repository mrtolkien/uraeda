-- The pickers, through `vim.ui.select`: the frontmatter fields of a file, then a field's values,
-- and the files waiting on the human, in snacks' picker when it is installed. The fields, their
-- values, the files, and every edit come from the server; the plugin never edits frontmatter text
-- itself.
local M = {}

local function client()
  return require("uraeda.client")
end

--- `value`, or nil for a JSON null.
local function given(value)
  if value == vim.NIL then
    return nil
  end
  return value
end

--- Applies the server's edit setting the field `name` of `bufnr` to `value`: an unsaved change of
--- the buffer, undone with `u`.
local function set(bufnr, name, value)
  local params = { uri = vim.uri_from_bufnr(bufnr), name = name, value = value }
  client().request(bufnr, "uraeda/setField", params, function(edit)
    local lsp = client().get(bufnr)
    if edit and lsp and vim.api.nvim_buf_is_valid(bufnr) then
      vim.lsp.util.apply_workspace_edit(edit, lsp.offset_encoding)
    end
  end)
end

--- The value picker of `field`, or a prompt for a field without a list of values.
local function values(bufnr, field, file)
  if #field.values == 0 then
    local opts = { prompt = field.name .. ": ", default = given(field.value) or "" }
    return vim.ui.input(opts, function(value)
      if value ~= nil then
        set(bufnr, field.name, value)
      end
    end)
  end
  vim.ui.select(field.values, {
    prompt = ("%s · %s"):format(field.name, file),
    kind = "uraeda_value",
    format_item = function(choice)
      if given(choice.action) then
        return choice.value .. "…  commits"
      end
      if choice.value == field.value then
        return choice.value .. "  (current)"
      end
      return choice.value
    end,
  }, function(choice)
    if choice == nil or choice.value == field.value then
      return
    end
    if given(choice.action) then
      return require("uraeda.verdict").open(bufnr, choice.action)
    end
    set(bufnr, field.name, choice.value)
  end)
end

--- Picks a frontmatter field of `bufnr` (default the current buffer), then its value: a listed
--- value is set in the buffer, a number or a text is typed, and a value set by a verdict opens the
--- verdict window (US5).
--- @param bufnr integer?
function M.field(bufnr)
  if bufnr == nil or bufnr == 0 then
    bufnr = vim.api.nvim_get_current_buf()
  end
  client().request(bufnr, "uraeda/fields", nil, function(fields)
    local present = vim.tbl_filter(function(field)
      return given(field.line) ~= nil
    end, fields or {})
    local file = vim.fs.basename(vim.api.nvim_buf_get_name(bufnr))
    if #present == 0 then
      return vim.notify(file .. " has no frontmatter field.", vim.log.levels.WARN, {
        title = "Uraeda",
      })
    end
    local width = 0
    for _, field in ipairs(present) do
      width = math.max(width, #field.name)
    end
    vim.ui.select(present, {
      prompt = "Field · " .. file,
      kind = "uraeda_field",
      format_item = function(field)
        local value = given(field.value) or ""
        return field.name .. (" "):rep(width - #field.name + 2) .. value
      end,
    }, function(field)
      if field then
        values(bufnr, field, file)
      end
    end)
  end)
end

local waiting_title = "Uraeda · waiting on you"

--- Edits `path` in the current window, the cursor on `line`.
local function open_at(path, line)
  local ok, message = pcall(vim.cmd.edit, vim.fn.fnameescape(path))
  if not ok then
    return vim.notify(message, vim.log.levels.ERROR, { title = "Uraeda" })
  end
  pcall(vim.api.nvim_win_set_cursor, 0, { line, 0 })
end

--- Lists the workflow files waiting for the human in every checkout, from any buffer, as
--- `<feature> · <file> · <text>`; the one picked opens at its block's line (US8). In snacks' picker
--- with a preview of the file when snacks is installed, else through `vim.ui.select`.
function M.waiting()
  client().request_any("uraeda/waiting", vim.empty_dict(), function(files)
    files = files or {}
    if #files == 0 then
      return vim.notify("Nothing waits on you.", vim.log.levels.INFO, { title = "Uraeda" })
    end
    local items = vim.tbl_map(function(file)
      return {
        text = ("%s · %s · %s"):format(file.feature, file.file, file.text),
        file = file.path,
        pos = { file.line, 0 },
      }
    end, files)
    local snacks = rawget(_G, "Snacks")
    if snacks and snacks.picker and snacks.picker.pick then
      return snacks.picker.pick({
        title = waiting_title,
        items = items,
        format = "text",
        preview = "file",
        confirm = "jump",
      })
    end
    vim.ui.select(items, {
      prompt = waiting_title,
      kind = "uraeda_waiting",
      format_item = function(item)
        return item.text
      end,
    }, function(item)
      if item then
        open_at(item.file, item.pos[1])
      end
    end)
  end)
end

return M
