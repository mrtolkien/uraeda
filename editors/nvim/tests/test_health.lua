local helpers = dofile("tests/helpers.lua")
local eq = MiniTest.expect.equality

local child = helpers.new_child()
local T = MiniTest.new_set({
  hooks = {
    pre_case = function()
      child.setup()
    end,
    post_once = child.stop,
  },
})

--- The lines of `:checkhealth uraeda`.
local function health()
  child.cmd("checkhealth uraeda")
  return child.lua_get("vim.api.nvim_buf_get_lines(0, 0, -1, false)")
end

local function errors(lines)
  return vim.tbl_filter(function(line)
    return line:find("ERROR") ~= nil
  end, lines)
end

--- A folder holding only an executable script `name`, with `script` as its body.
local function bin(name, script)
  local dir = vim.fn.tempname()
  vim.fn.mkdir(dir, "p")
  local path = vim.fs.joinpath(dir, name)
  local file = assert(io.open(path, "w"))
  file:write("#!/bin/sh\n" .. script .. "\n")
  file:close()
  vim.uv.fs_chmod(path, tonumber("755", 8))
  return dir, path
end

T["reports a working ura"] = function()
  local lines = health()
  eq(errors(lines), {})
  eq(
    vim.iter(lines):any(function(line)
      return line:find("ura 0%.%d+%.%d+") ~= nil
    end),
    true
  )
end

T["reports a missing ura"] = function()
  child.setup({ cmd = { "ura", "lsp" } })
  local git = vim.fn.exepath("git")
  local dir = bin("git", ('exec "%s" "$@"'):format(git))
  child.lua("vim.env.PATH = ...", { dir })
  local found = errors(health())
  eq(#found, 1)
  eq(found[1]:find("ura not found on PATH", 1, true) ~= nil, true)
end

T["reports an ura without lsp"] = function()
  local _, ura = bin("ura", "echo \"error: unrecognized subcommand 'lsp'\" >&2\nexit 2")
  child.setup({ cmd = { ura, "lsp" } })
  local found = errors(health())
  eq(#found, 1)
  eq(found[1]:find("ura is older than the plugin: run ura upgrade.", 1, true) ~= nil, true)
end

--- The lines of `:checkhealth uraeda` naming the clipboard tool.
local function clipboard(lines)
  return vim.tbl_filter(function(line)
    return line:find("clipboard") ~= nil
  end, lines)
end

T["names the clipboard tool found"] = function()
  local dir = bin("wl-paste", "exit 0")
  child.lua(
    "vim.env.PATH, vim.env.WAYLAND_DISPLAY = ..., 'wayland-1'",
    { dir .. ":" .. vim.env.PATH }
  )
  eq(clipboard(health()), { "- ✅ OK clipboard images: wl-paste" })
end

T["names the configured clipboard command"] = function()
  child.setup({ clipboard = { "cat", "/tmp/shot.png" } })
  eq(clipboard(health()), { "- ✅ OK clipboard images: cat /tmp/shot.png" })
end

T["warns when no clipboard tool is found"] = function()
  local git = vim.fn.exepath("git")
  local dir = bin("git", ('exec "%s" "$@"'):format(git))
  child.lua(
    "vim.env.PATH, vim.env.WAYLAND_DISPLAY, vim.env.DISPLAY = ..., 'wayland-1', nil",
    { dir }
  )
  eq(clipboard(health()), {
    "- ⚠️ WARNING no clipboard tool found: install wl-clipboard, xclip, or pngpaste",
  })
end

T["warns when the configured clipboard command is missing"] = function()
  child.setup({ clipboard = { "no-such-clipboard-tool" } })
  eq(clipboard(health()), {
    "- ⚠️ WARNING clipboard command not found: no-such-clipboard-tool",
  })
end

return T
