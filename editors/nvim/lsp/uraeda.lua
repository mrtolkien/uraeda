-- The `uraeda` language server, `ura lsp`: one client per checkout, attached to the markdown files
-- under a `specs/` folder holding `PRIORITIES.md`.

--- The checkout of the file at `path`: the folder above the nearest `specs/` folder holding
--- `PRIORITIES.md` among the file's parents, or nil.
local function checkout(path)
  for dir in vim.fs.parents(path) do
    if
      vim.fs.basename(dir) == "specs"
      and vim.uv.fs_stat(vim.fs.joinpath(dir, "PRIORITIES.md")) ~= nil
    then
      return vim.fs.dirname(dir)
    end
  end
end

--- @type vim.lsp.Config
return {
  cmd = { "ura", "lsp" },
  filetypes = { "markdown" },
  root_dir = function(bufnr, on_dir)
    local name = vim.api.nvim_buf_get_name(bufnr)
    if name == "" or vim.bo[bufnr].buftype ~= "" then
      return
    end
    local root = checkout(vim.fs.normalize(vim.fn.fnamemodify(name, ":p")))
    if root ~= nil then
      on_dir(root)
    end
  end,
}
