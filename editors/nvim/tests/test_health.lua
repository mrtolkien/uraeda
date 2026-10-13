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

return T
