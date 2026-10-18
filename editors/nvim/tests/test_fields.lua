local helpers = dofile("tests/helpers.lua")
local eq = MiniTest.expect.equality

local child = helpers.new_child()
local T = MiniTest.new_set({
  hooks = {
    pre_case = function()
      child.setup()
      -- `vim.ui.select` picks the item shown as `_G.picks[n]`, and records what it showed;
      -- `vim.ui.input` types `_G.typed[n]`, and records its opts. The verdict window is task 10's.
      child.lua([[
        _G.notes, _G.selects, _G.picks, _G.inputs, _G.typed = {}, {}, {}, {}, {}
        vim.notify = function(message, level)
          table.insert(_G.notes, { message, level })
        end
        vim.ui.select = function(items, opts, on_choice)
          local shown = vim.tbl_map(opts.format_item or tostring, items)
          table.insert(_G.selects, { kind = opts.kind, prompt = opts.prompt, items = shown })
          local pick = table.remove(_G.picks, 1)
          for i, text in ipairs(shown) do
            if text == pick then
              return on_choice(items[i], i)
            end
          end
          on_choice(nil, nil)
        end
        vim.ui.input = function(opts, on_confirm)
          table.insert(_G.inputs, opts)
          on_confirm(table.remove(_G.typed, 1))
        end
        package.loaded["uraeda.verdict"] = {
          open = function(bufnr, action)
            _G.verdict = { bufnr = bufnr, action = action }
          end,
        }
      ]])
    end,
    post_once = child.stop,
  },
})

local feature = "specs/2026-10-06-recurring-tasks/"

--- A repository holding the example project, with `edits` (path → { from, to }) applied to its
--- files; returns the repository.
local function example(edits)
  local files = helpers.example()
  for path, edit in pairs(edits or {}) do
    files[path] = files[path]:gsub(vim.pesc(edit[1]), edit[2], 1)
  end
  return helpers.repo(files)
end

--- Edits `path`, waits for its client, picks `picks`, types `typed`, and runs the field action.
local function pick(path, picks, typed)
  helpers.edit(child, path)
  eq(helpers.wait_client(child), true)
  child.lua("_G.picks, _G.typed = ...", { picks, typed or {} })
  child.lua([[require("uraeda.actions").get("field").fn()]])
end

--- Waits up to 5 s for line `line` of the child's buffer to read `text`, and returns the line.
local function wait_line(line, text)
  return child.lua(
    [[local line, text = ...
      vim.wait(5000, function() return vim.fn.getline(line) == text end, 20)
      return vim.fn.getline(line)]],
    { line, text }
  )
end

--- Waits up to 5 s for `count` pickers to have opened, and returns them.
local function selects(count)
  child.lua("local count = ... vim.wait(5000, function() return #_G.selects >= count end, 20)", {
    count,
  })
  return child.lua_get("_G.selects")
end

local function read(path)
  local file = assert(io.open(path, "rb"))
  local text = file:read("*a")
  file:close()
  return text
end

T["a value replaces its line and keeps the comment"] = function() -- US5.1
  local line = "discovery: high # low, medium, or high"
  local repo = example({ [feature .. "proposal.md"] = { "discovery: high", line } })
  local proposal = repo .. "/" .. feature .. "proposal.md"

  pick(proposal, { "discovery  high", "low" })

  eq(wait_line(2, "discovery: low # low, medium, or high"), "discovery: low # low, medium, or high")
  eq(selects(2), {
    { kind = "uraeda_field", prompt = "Field · proposal.md", items = { "discovery  high" } },
    {
      kind = "uraeda_value",
      prompt = "discovery · proposal.md",
      items = { "low", "medium", "high  (current)" },
    },
  })
  eq(child.bo.modified, true)
  eq(read(proposal):find(line, 1, true) ~= nil, true, "the disk is untouched")
  child.type_keys("u")
  eq(child.fn.getline(2), line)
end

T["a number is typed"] = function() -- US5.2
  local repo = example()

  pick(repo .. "/" .. feature .. "spec.md", { "revision        2" }, { "3" })

  eq(wait_line(3, "revision: 3"), "revision: 3")
  eq(selects(1)[1].items, {
    "status          approved",
    "revision        2",
    "clarifications  1",
    "risk-tier       high",
    "plan-review     true",
  })
  eq(#child.lua_get("_G.selects"), 1, "no value picker for a number")
  eq(child.lua_get("_G.inputs[1].default"), "2")
  eq(child.lua_get("_G.inputs[1].prompt"), "revision: ")
end

T["a status that commits opens the verdict"] = function() -- US5.3
  local repo =
    example({ [feature .. "spec.md"] = { "status: approved", "status: awaiting-human" } })

  pick(
    repo .. "/" .. feature .. "spec.md",
    { "status          awaiting-human", "approved…  commits" }
  )

  child.lua("vim.wait(5000, function() return _G.verdict ~= nil end, 20)")
  eq(selects(2)[2], {
    kind = "uraeda_value",
    prompt = "status · spec.md",
    items = { "awaiting-human  (current)", "approved…  commits", "changes-requested…  commits" },
  })
  eq(child.lua_get("_G.verdict"), { bufnr = child.api.nvim_get_current_buf(), action = "approve" })
  eq(child.fn.getline(2), "status: awaiting-human")
  eq(child.bo.modified, false)
end

T["a cancelled picker changes nothing"] = function()
  local repo = example()

  pick(repo .. "/" .. feature .. "spec.md", { "risk-tier       high" })

  eq(#selects(2), 2)
  eq(child.bo.modified, false)
  eq(child.lua_get("_G.notes"), {})
end

return T
