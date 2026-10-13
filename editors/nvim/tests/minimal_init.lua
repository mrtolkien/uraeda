-- The init of the test runner and of each child Neovim: the plugin and mini.test on the
-- runtimepath, nothing else. Tests run from `editors/nvim`, with `MINI_TEST` set by the dev shell.
local plugin = vim.fn.fnamemodify(debug.getinfo(1, "S").source:sub(2), ":p:h:h")

vim.opt.runtimepath:prepend(plugin)
vim.opt.swapfile = false

local mini_test = os.getenv("MINI_TEST")
if mini_test == nil or mini_test == "" then
  error("MINI_TEST is not set: run the tests in the dev shell, with `nix develop`")
end
vim.opt.runtimepath:append(mini_test)

-- The runner, not a child: mini.test's global, for `lua MiniTest.run()`.
if os.getenv("URAEDA_TEST") == nil then
  require("mini.test").setup()
end
