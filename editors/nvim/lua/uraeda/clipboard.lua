-- The clipboard's image, read with the system's tools, as Neovim has no binary clipboard: wl-paste
-- on Wayland, xclip on X11, pngpaste on macOS, PowerShell on Windows, or the command of
-- `vim.g.uraeda.clipboard`. The bytes go to a temporary file, for `ura lsp` to check and encode.
local M = {}

M.no_image = "uraeda: the clipboard holds no image"
M.no_tool = "uraeda: no clipboard tool found: install wl-clipboard, xclip, or pngpaste"

--- The message for a configured command that is not on the `PATH`.
--- @param command string[]
function M.not_found(command)
  return "uraeda: clipboard command not found: " .. command[1]
end

--- The image types taken from the clipboard, in order of preference.
local types = { "image/png", "image/jpeg", "image/gif", "image/webp" }

--- Runs `command`, and returns its output, binary, or nil when it fails, cannot start, or runs
--- longer than `timeout` ms (default 10 s, for an image).
--- @param command string[]
--- @param timeout integer?
--- @return string?
local function run(command, timeout)
  local ok, process = pcall(vim.system, command)
  if not ok then
    return nil
  end
  local result = process:wait(timeout or 10000)
  if result.code ~= 0 then
    return nil
  end
  return result.stdout
end

--- The first type of `types` among the lines of `listed`, or nil.
--- @param listed string?
--- @return string?
local function first_type(listed)
  local offered = {}
  for _, line in ipairs(vim.split(listed or "", "\n")) do
    offered[vim.trim(line)] = true
  end
  return vim.iter(types):find(function(type)
    return offered[type]
  end)
end

--- Whether `bytes` start as a PNG, a JPEG, a GIF, or a WebP file does: a command of the
--- configuration, or a tool that lists no types, may give anything. The core checks them again.
--- @param bytes string?
local function is_image(bytes)
  if bytes == nil then
    return false
  end
  return vim.startswith(bytes, "\137PNG\r\n\26\n")
    or vim.startswith(bytes, "\255\216\255")
    or vim.startswith(bytes, "GIF87a")
    or vim.startswith(bytes, "GIF89a")
    or (vim.startswith(bytes, "RIFF") and bytes:sub(9, 12) == "WEBP")
end

--- The image bytes `get(type)` gives for the first image type `list` offers. Listing types is
--- quick: it gives up after 3 s, where fetching the image may take 10.
local function listed(list, get)
  local type = first_type(run(list, 3000))
  return type and run(get(type))
end

--- A tool reading the clipboard's image: its name, and either `bytes()`, giving the image, or
--- `save(path)`, writing it to `path`; each returns nil or false when it fails.
--- @class uraeda.ClipboardTool
--- @field name string
--- @field bytes (fun(): string?)?
--- @field save (fun(path: string): boolean)?

--- PowerShell saving the clipboard's image as PNG to `path`, a Windows path.
local function powershell_script(path)
  return table.concat({
    "Add-Type -AssemblyName System.Windows.Forms;",
    "$image = [System.Windows.Forms.Clipboard]::GetImage();",
    "if ($image -eq $null) { exit 1 };",
    ("$image.Save('%s', [System.Drawing.Imaging.ImageFormat]::Png)"):format((path:gsub("'", "''"))),
  }, " ")
end

--- The tools of this system, in order, each with `available()`. On WSL, Windows' PowerShell comes
--- first: WSLg sets `WAYLAND_DISPLAY`, but its `wl-paste` may not see a Windows screenshot.
--- @type (uraeda.ClipboardTool | { available: fun(): boolean })[]
local tools = {
  {
    name = "powershell.exe",
    available = function()
      return vim.fn.has("wsl") == 1
        and vim.fn.executable("powershell.exe") == 1
        and vim.fn.executable("wslpath") == 1
    end,
    save = function(path)
      local windows = vim.trim(run({ "wslpath", "-w", path }) or "")
      return windows ~= ""
        and run({ "powershell.exe", "-NoProfile", "-Command", powershell_script(windows) }) ~= nil
    end,
  },
  {
    name = "wl-paste",
    available = function()
      return (vim.env.WAYLAND_DISPLAY or "") ~= "" and vim.fn.executable("wl-paste") == 1
    end,
    bytes = function()
      return listed({ "wl-paste", "--list-types" }, function(type)
        return { "wl-paste", "--type", type }
      end)
    end,
  },
  {
    name = "xclip",
    available = function()
      return (vim.env.DISPLAY or "") ~= "" and vim.fn.executable("xclip") == 1
    end,
    bytes = function()
      return listed({ "xclip", "-selection", "clipboard", "-t", "TARGETS", "-o" }, function(type)
        return { "xclip", "-selection", "clipboard", "-t", type, "-o" }
      end)
    end,
  },
  {
    name = "pngpaste",
    available = function()
      return vim.fn.has("mac") == 1 and vim.fn.executable("pngpaste") == 1
    end,
    bytes = function()
      return run({ "pngpaste", "-" })
    end,
  },
  {
    name = "powershell",
    available = function()
      return vim.fn.has("win32") == 1 and vim.fn.executable("powershell") == 1
    end,
    save = function(path)
      return run({ "powershell", "-NoProfile", "-Command", powershell_script(path) }) ~= nil
    end,
  },
}

--- The tool reading the clipboard's image: the command of `vim.g.uraeda.clipboard`, writing the
--- image to its output, else the first tool of this system found, else nil.
--- @return uraeda.ClipboardTool?
function M.tool()
  local command = require("uraeda").config().clipboard
  if command then
    return {
      name = table.concat(command, " "),
      bytes = function()
        return run(command)
      end,
    }
  end
  return vim.iter(tools):find(function(tool)
    return tool.available()
  end)
end

--- Writes the image `tool` reads to the file at `path`, and returns whether it was an image.
--- @param tool uraeda.ClipboardTool
--- @param path string
local function save(tool, path)
  if tool.bytes then
    local bytes = tool.bytes()
    if not is_image(bytes) then
      return false
    end
    local file = assert(io.open(path, "wb"))
    file:write(bytes)
    file:close()
    return true
  end
  local file = tool.save(path) and io.open(path, "rb")
  if not file then
    return false
  end
  local head = file:read(16)
  file:close()
  return is_image(head)
end

--- Writes the clipboard's image to a temporary file, and returns its path; else nil and the
--- message saying why: no tool, a configured command not found, or no image.
--- @return string? path
--- @return string? message
function M.read()
  local tool = M.tool()
  if tool == nil then
    return nil, M.no_tool
  end
  local command = require("uraeda").config().clipboard
  if command and vim.fn.executable(command[1]) ~= 1 then
    return nil, M.not_found(command)
  end
  local path = vim.fn.tempname()
  if not save(tool, path) then
    os.remove(path)
    return nil, M.no_image
  end
  return path
end

return M
