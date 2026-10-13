-- Helpers of the plugin's tests: a child Neovim running the real `ura lsp` built by cargo, and
-- temporary git repositories for it to work on.
local helpers = {}

local tests = vim.fn.fnamemodify(debug.getinfo(1, "S").source:sub(2), ":p:h")

--- The repository's root, three folders above this file.
helpers.root = vim.fn.fnamemodify(tests, ":h:h:h")

--- The `ura` built by `cargo build -p uraeda-cli`.
helpers.ura = vim.fs.joinpath(helpers.root, "target", "debug", "ura")

--- A child Neovim. `child.setup(config?)` (re)starts it with the plugin loaded, `URAEDA_TEST` set,
--- and `vim.g.uraeda` set to `config` over a `cmd` pointed at `helpers.ura`.
function helpers.new_child()
  local child = MiniTest.new_child_neovim()
  vim.env.URAEDA_TEST = "1"

  function child.setup(config)
    config = vim.tbl_extend("force", { cmd = { helpers.ura, "lsp" } }, config or {})
    local options = vim.inspect(config, { newline = " ", indent = "" })
    child.restart({
      "--cmd",
      "lua vim.g.uraeda = " .. options,
      "-u",
      vim.fs.joinpath(tests, "minimal_init.lua"),
    })
  end

  return child
end

--- Runs git in `path` with `args`, and returns its output. Errors when git fails.
function helpers.git(path, args)
  local command = { "git" }
  vim.list_extend(command, args)
  local result = vim.system(command, { cwd = path, text = true }):wait()
  if result.code ~= 0 then
    error(("git %s: %s"):format(table.concat(args, " "), result.stderr))
  end
  return result.stdout
end

--- Writes `text` to the file at `path`, creating its folders.
function helpers.write(path, text)
  vim.fn.mkdir(vim.fs.dirname(path), "p")
  local file = assert(io.open(path, "wb"))
  file:write(text)
  file:close()
end
local write = helpers.write

local function commit_all(path, message)
  helpers.git(path, { "add", "--all" })
  helpers.git(path, { "commit", "--quiet", "--no-verify", "--message", message })
end

--- A temporary git repository on `main`, its files committed, with a pre-commit hook counting its
--- runs (`helpers.hook_runs`). `files` maps paths to texts. `branches` maps a branch name to the
--- files committed on it, from `main`, each branch checked out in `.worktrees/<branch>`. Returns
--- the repository's path, with symbolic links resolved.
function helpers.repo(files, branches)
  local dir = vim.fn.tempname()
  vim.fn.mkdir(dir, "p")
  local path = vim.uv.fs_realpath(dir)
  helpers.git(path, { "init", "--quiet", "--initial-branch", "main" })
  for key, value in pairs({
    ["user.name"] = "Test",
    ["user.email"] = "test@example.com",
    ["commit.gpgSign"] = "false",
    ["core.hooksPath"] = ".git/hooks",
  }) do
    helpers.git(path, { "config", key, value })
  end
  helpers.set_hook(path, 'echo run >> "$(git rev-parse --git-common-dir)/hook-runs"')
  write(vim.fs.joinpath(path, ".gitignore"), ".worktrees/\n")
  for name, text in pairs(files) do
    write(vim.fs.joinpath(path, name), text)
  end
  commit_all(path, "chore: start")
  for branch, branch_files in pairs(branches or {}) do
    local worktree = vim.fs.joinpath(path, ".worktrees", branch)
    helpers.git(path, { "worktree", "add", "--quiet", "-b", branch, worktree })
    for name, text in pairs(branch_files) do
      write(vim.fs.joinpath(worktree, name), text)
    end
    commit_all(worktree, "chore: " .. branch)
  end
  return path
end

--- Replaces the pre-commit hook of the repository at `path` with `script`.
function helpers.set_hook(path, script)
  local hook = vim.fs.joinpath(path, ".git", "hooks", "pre-commit")
  write(hook, "#!/bin/sh\n" .. script .. "\n")
  vim.uv.fs_chmod(hook, tonumber("755", 8))
end

--- How many times the pre-commit hook of the repository at `path` ran.
function helpers.hook_runs(path)
  local file = io.open(vim.fs.joinpath(path, ".git", "hook-runs"), "r")
  if file == nil then
    return 0
  end
  local runs = select(2, file:read("*a"):gsub("\n", ""))
  file:close()
  return runs
end

--- The example project's `specs/` files, as `helpers.repo` takes them.
function helpers.example()
  local specs = vim.fs.joinpath(helpers.root, "skills", "uraeda", "assets", "example", "specs")
  local files = {}
  for name, kind in vim.fs.dir(specs, { depth = math.huge }) do
    if kind == "file" then
      local file = assert(io.open(vim.fs.joinpath(specs, name), "rb"))
      files["specs/" .. name] = file:read("*a")
      file:close()
    end
  end
  return files
end

--- Edits `path` in the child's current window.
function helpers.edit(child, path)
  child.cmd("edit " .. vim.fn.fnameescape(path))
end

--- Waits up to `timeout` ms (default 5000) for a `uraeda` client on the child's current buffer, and
--- returns whether one attached.
function helpers.wait_client(child, timeout)
  return child.lua_get(
    "vim.wait(...,"
      .. " function() return #vim.lsp.get_clients({ bufnr = 0, name = 'uraeda' }) > 0 end, 20)",
    { timeout or 5000 }
  )
end

return helpers
