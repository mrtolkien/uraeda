-- `:checkhealth uraeda`: Neovim's version, `ura` and `git` on the path, and an `ura` with `lsp`.
local M = {}

local older = "ura is older than the plugin: run ura upgrade."

--- Runs `command`, and returns its result, or nil when it cannot start.
local function run(command)
  local ok, process = pcall(vim.system, command, { text = true })
  if not ok then
    return nil
  end
  return process:wait(5000)
end

function M.check()
  vim.health.start("uraeda")

  if vim.fn.has("nvim-0.11") == 0 then
    vim.health.error("Neovim 0.11 or later is required")
    return
  end
  vim.health.ok("Neovim " .. tostring(vim.version()))

  local ok, config = pcall(require("uraeda").config)
  if not ok then
    vim.health.error(config)
    return
  end
  if not config.lsp then
    vim.health.info("The language server is disabled: vim.g.uraeda.lsp is false")
  end

  local ura = config.cmd[1]
  local path = vim.fn.exepath(ura)
  if path == "" then
    vim.health.error(ura .. " not found on PATH")
  else
    local version = run({ path, "--version" })
    local found = version and version.code == 0 and vim.trim(version.stdout) or ura
    vim.health.ok(("%s at %s"):format(found, path))
    local help = vim.list_extend(vim.list_extend({ path }, config.cmd, 2), { "--help" })
    local lsp = run(help)
    if lsp and lsp.code == 0 then
      vim.health.ok(table.concat(config.cmd, " ") .. " runs")
    else
      local output = vim.trim(lsp and lsp.stderr or "")
      vim.health.error(older, output ~= "" and { output } or nil)
    end
  end

  if vim.fn.executable("git") == 1 then
    vim.health.ok("git at " .. vim.fn.exepath("git"))
  else
    vim.health.error("git not found on PATH")
  end
end

return M
