-- The one way to the `uraeda` language server: requests, commands, saving and reloading buffers,
-- progress, and errors.
local M = {}

local title = "Uraeda"
local not_workflow = "This file is not a Uraeda workflow file."
local older = "ura is older than the plugin: run ura upgrade."

local codes = vim.lsp.protocol.ErrorCodes

local function resolve(bufnr)
  if bufnr == nil or bufnr == 0 then
    return vim.api.nvim_get_current_buf()
  end
  return bufnr
end

local function notify_error(message)
  vim.notify(message, vim.log.levels.ERROR, { title = title })
end

--- Shows a server's error: the core's message with a hook's output, or `older` for a method or a
--- command the server does not know.
local function failed(err)
  local message = err.message or tostring(err)
  if
    err.code == codes.MethodNotFound
    or (err.code == codes.InvalidParams and message:find("^unknown command ") ~= nil)
  then
    return notify_error(older)
  end
  local output = type(err.data) == "table" and err.data.output or nil
  if type(output) == "string" and vim.trim(output) ~= "" then
    message = message .. "\n\n" .. vim.trim(output)
  end
  notify_error(message)
end

--- The buffer's `uraeda` client, if one is attached.
--- @param bufnr integer?
--- @return vim.lsp.Client?
function M.get(bufnr)
  return vim.lsp.get_clients({ bufnr = resolve(bufnr), name = "uraeda" })[1]
end

--- Sends `method` with `params` (default `{ uri }` of the buffer) to the buffer's client, and calls
--- `cb(result)` on success; errors are notified, and `cb` is not called.
--- @param bufnr integer?
--- @param method string
--- @param params table?
--- @param cb fun(result: any)
function M.request(bufnr, method, params, cb)
  bufnr = resolve(bufnr)
  local client = M.get(bufnr)
  if client == nil then
    return notify_error(not_workflow)
  end
  params = params or { uri = vim.uri_from_bufnr(bufnr) }
  client:request(method, params, function(err, result)
    if err then
      return failed(err)
    end
    cb(result)
  end, bufnr)
end

--- Reloads the loaded buffers of `paths` from disk.
local function reload(paths)
  local written = {}
  for _, path in ipairs(paths) do
    written[vim.fs.normalize(path)] = true
  end
  for _, buf in ipairs(vim.api.nvim_list_bufs()) do
    local name = vim.api.nvim_buf_get_name(buf)
    if vim.api.nvim_buf_is_loaded(buf) and name ~= "" and written[vim.fs.normalize(name)] then
      vim.cmd.checktime(buf)
    end
  end
end

local tokens = 0

--- Shows the progress the server reports on `token`, in one notification replaced in place.
--- Returns a function that stops listening.
local function show_progress(client, token)
  local group = vim.api.nvim_create_augroup("uraeda.progress." .. token, { clear = true })
  local function stop()
    pcall(vim.api.nvim_del_augroup_by_id, group)
  end
  vim.api.nvim_create_autocmd("LspProgress", {
    group = group,
    callback = function(event)
      local data = event.data
      if data.client_id ~= client.id or data.params.token ~= token then
        return
      end
      local value = data.params.value
      local text = value.message or (value.kind ~= "end" and value.title or nil)
      if text then
        vim.notify(text, vim.log.levels.INFO, { id = "uraeda", title = title })
      end
      if value.kind == "end" then
        stop()
      end
    end,
  })
  return stop
end

--- Runs the server's command `name` with `args` (`uri` defaults to the buffer's): saves the buffer
--- first when `opts.save`, shows the server's progress, reloads the buffers of `written`, edits
--- `opened` in the current window, then calls `cb(result)`. Errors are notified, and `cb` is not
--- called.
--- @param bufnr integer?
--- @param name string
--- @param args table?
--- @param opts { save?: boolean }?
--- @param cb fun(result: { opened?: string, written: string[] })?
function M.command(bufnr, name, args, opts, cb)
  bufnr = resolve(bufnr)
  opts = opts or {}
  local client = M.get(bufnr)
  if client == nil then
    return notify_error(not_workflow)
  end
  if opts.save then
    vim.api.nvim_buf_call(bufnr, function()
      vim.cmd("silent update")
    end)
  end
  args = vim.tbl_extend("keep", args or {}, { uri = vim.uri_from_bufnr(bufnr) })
  tokens = tokens + 1
  local token = ("uraeda/nvim/%d"):format(tokens)
  local stop = show_progress(client, token)
  local params = { command = name, arguments = { args }, workDoneToken = token }
  local sent = client:request("workspace/executeCommand", params, function(err, result)
    -- The progress notifications come before the answer; any left are dropped once handled.
    vim.schedule(stop)
    if err then
      return failed(err)
    end
    result = result or {}
    reload(result.written or {})
    if result.opened then
      local ok, message = pcall(vim.cmd.edit, vim.fn.fnameescape(result.opened))
      if not ok then
        notify_error(message)
      end
    end
    if cb then
      cb(result)
    end
  end, bufnr)
  if not sent then
    stop()
    notify_error(not_workflow)
  end
end

return M
