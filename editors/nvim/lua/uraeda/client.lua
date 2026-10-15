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

--- Whether a `uraeda` server exited with an error before its initialization: an `ura` without
--- `ura lsp`, older than the plugin. Set once per session.
local too_old = false

--- Says why a buffer has no client: `older` once a server failed to start, else `not_workflow`.
local function no_client()
  notify_error(too_old and older or not_workflow)
end

--- The `on_exit` of every `uraeda` client: a server exiting with an error before its
--- initialization is an older `ura`, which fails with `unrecognized subcommand 'lsp'`; it is said
--- once per session, and actions say it instead of `not_workflow`.
--- @param code integer
--- @param client_id integer
function M.exited(code, client_id)
  local client = vim.lsp.get_client_by_id(client_id)
  if code == 0 or too_old or (client and client.initialized) then
    return
  end
  too_old = true
  vim.schedule(function()
    notify_error(older)
  end)
end

--- Shows a server's error: the core's message with a hook's output, after `prefix` when given, or
--- `older` for a method or a command the server does not know.
--- @param prefix string?
local function failed(err, prefix)
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
  notify_error((prefix or "") .. message)
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
    return no_client()
  end
  params = params or { uri = vim.uri_from_bufnr(bufnr) }
  client:request(method, params, function(err, result)
    if err then
      return failed(err)
    end
    cb(result)
  end, bufnr)
end

--- The checkout of the current buffer's file, else of the current folder, holding
--- `specs/PRIORITIES.md`, found as the server's root is.
local function current_checkout()
  local uraeda = require("uraeda")
  local name = vim.api.nvim_buf_get_name(0)
  if name ~= "" and vim.bo.buftype == "" then
    local root = uraeda.checkout(vim.fs.normalize(vim.fn.fnamemodify(name, ":p")))
    if root then
      return root
    end
  end
  local cwd = vim.fs.normalize(vim.fn.getcwd())
  return uraeda.checkout(vim.fs.joinpath(cwd, "specs", "PRIORITIES.md"))
end

--- Calls `cb(client)` with the `uraeda` client of the current checkout, started attached to no
--- buffer when none runs, once it is initialized. Notifies `not_workflow` outside a checkout, and
--- `older` when the server fails to start.
local function checkout_client(cb)
  local root = current_checkout()
  if root == nil then
    return notify_error(not_workflow)
  end
  local running = vim.iter(vim.lsp.get_clients({ name = "uraeda" })):find(function(client)
    return client.root_dir and vim.fs.normalize(client.root_dir) == root
  end)
  if running then
    return cb(running)
  end
  local config = vim.tbl_extend("force", vim.lsp.config.uraeda or {}, {
    name = "uraeda",
    cmd = require("uraeda").config().cmd,
    root_dir = root,
  })
  local id = vim.lsp.start(config, { attach = false })
  if id == nil then
    return
  end
  -- Started, or reused while it starts: a request waits for the server's initialization.
  local timer = assert(vim.uv.new_timer())
  local waited, done = 0, false
  timer:start(
    0,
    20,
    vim.schedule_wrap(function()
      if done then
        return
      end
      local client = vim.lsp.get_client_by_id(id)
      waited = waited + 20
      if client and client.initialized then
        done = true
        timer:close()
        cb(client)
      elseif client == nil or client:is_stopped() or waited > 10000 then
        done = true
        timer:close()
        notify_error(too_old and older or "ura lsp did not start.")
      end
    end)
  )
end

--- Sends `method` with `params` to the `uraeda` client of the current checkout, the current
--- buffer's or the current folder's, starting one when none runs, and calls `cb(result)` on
--- success; errors are notified, and `cb` is not called. For the requests about every checkout of
--- a repository, such as `uraeda/waiting`.
--- @param method string
--- @param params table
--- @param cb fun(result: any)
function M.request_checkout(method, params, cb)
  checkout_client(function(client)
    client:request(method, params, function(err, result)
      if err then
        return failed(err)
      end
      cb(result)
    end)
  end)
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

--- Sends the command `name` with `args` to `client`, about `bufnr` when given: shows the server's
--- progress, reloads the buffers of `written`, redraws the inline comments next to them, edits
--- `opened` in the current window, then calls `cb(result)`. Errors are notified, after
--- `opts.prefix` when given, after reloading the files they list in `data.written`, and `cb` is not
--- called. `opts.finally()` runs last on every outcome.
--- @param client vim.lsp.Client
--- @param bufnr integer?
--- @param name string
--- @param args table
--- @param opts { prefix?: string, finally?: fun() }
--- @param cb fun(result: { opened?: string, written: string[], link?: string, line?: integer })?
local function execute(client, bufnr, name, args, opts, cb)
  local finally = opts.finally or function() end
  tokens = tokens + 1
  local token = ("uraeda/nvim/%d"):format(tokens)
  local stop = show_progress(client, token)
  local params = { command = name, arguments = { args }, workDoneToken = token }
  --- The answer: reloads, notifies, opens, and calls `cb`.
  local function handle(err, result)
    -- The progress notifications come before the answer; any left are dropped once handled.
    vim.schedule(stop)
    -- A command a hook refused leaves the files it wrote, listed in the error's `written`.
    local written = (err and type(err.data) == "table" and err.data.written)
      or (result or {}).written
      or {}
    reload(written)
    -- A comment or a verdict changes the review: the files next to it redraw their comments.
    if #written > 0 then
      require("uraeda.marks").refresh(written)
    end
    if err then
      return failed(err, opts.prefix)
    end
    result = result or {}
    if result.opened then
      local ok, message = pcall(vim.cmd.edit, vim.fn.fnameescape(result.opened))
      if not ok then
        notify_error(message)
      end
    end
    if cb then
      cb(result)
    end
  end
  local sent = client:request("workspace/executeCommand", params, function(err, result)
    local ok, message = pcall(handle, err, result)
    finally()
    if not ok then
      error(message, 0)
    end
  end, bufnr)
  if not sent then
    stop()
    no_client()
    finally()
  end
end

--- Runs the server's command `name` with `args` (`uri` defaults to the buffer's), as `execute`
--- does, saving the buffer first when `opts.save`. `opts.finally()` runs last on every outcome:
--- success, error, no client, or a request that could not be sent.
--- @param bufnr integer?
--- @param name string
--- @param args table?
--- @param opts { save?: boolean, prefix?: string, finally?: fun() }?
--- @param cb fun(result: { opened?: string, written: string[], link?: string })?
function M.command(bufnr, name, args, opts, cb)
  bufnr = resolve(bufnr)
  opts = opts or {}
  local finally = opts.finally or function() end
  local client = M.get(bufnr)
  if client == nil then
    no_client()
    return finally()
  end
  if opts.save then
    local saved, message = pcall(vim.api.nvim_buf_call, bufnr, function()
      vim.cmd("silent update")
    end)
    if not saved then
      notify_error(message)
      return finally()
    end
  end
  args = vim.tbl_extend("keep", args or {}, { uri = vim.uri_from_bufnr(bufnr) })
  execute(client, bufnr, name, args, opts, cb)
end

--- Runs the server's command `name` with `args`, about no buffer, on the `uraeda` client of the
--- current checkout, as `request_checkout` finds it, as `execute` does: for the commands that work
--- from any buffer, such as `uraeda.note`.
--- @param name string
--- @param args table
--- @param cb fun(result: { opened?: string, written: string[], line?: integer })?
function M.command_checkout(name, args, cb)
  checkout_client(function(client)
    execute(client, nil, name, args, {}, cb)
  end)
end

return M
