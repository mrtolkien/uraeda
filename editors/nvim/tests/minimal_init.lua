-- The init of the test runner and of each child Neovim: the plugin and mini.test on the
-- runtimepath, nothing else. Tests run from `editors/nvim`, with `MINI_TEST` set by the dev shell.
local plugin = vim.fn.fnamemodify(debug.getinfo(1, "S").source:sub(2), ":p:h:h")

vim.opt.runtimepath:prepend(plugin)
vim.opt.swapfile = false

-- The host's git stays out, however the tests are started (R2): no global or system configuration,
-- such as signing or a template's hooks, and no repository exported by a hook. The runner's git,
-- each child, its `ura lsp`, and their git inherit it.
vim.env.GIT_CONFIG_GLOBAL = "/dev/null"
vim.env.GIT_CONFIG_NOSYSTEM = "1"
for _, name in ipairs({ "GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_COMMON_DIR" }) do
  vim.env[name] = nil
end

local mini_test = os.getenv("MINI_TEST")
if mini_test == nil or mini_test == "" then
  error("MINI_TEST is not set: run the tests in the dev shell, with `nix develop`")
end
vim.opt.runtimepath:append(mini_test)

-- The runner, not a child: mini.test's global, for `lua MiniTest.run()`.
if os.getenv("URAEDA_TEST") == nil then
  require("mini.test").setup()
end
