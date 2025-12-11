-- -- Keymaps are automatically loaded on the VeryLazy event
-- Default keymaps that are always set: https://github.com/LazyVim/LazyVim/blob/main/lua/lazyvim/config/keymaps.lua
-- Add any additional keymaps here
-- vim.keymap.set("n", "<leader>lg", function()
--   vim.cmd("FloatermNew --autoclose=2 lazygit")
-- end, { desc = "Open LazyGit" })

-- Ensure this is inside your keymap configuration
local map = vim.keymap.set

-- Remap Tab to go to the next buffer
-- map("n", "<Tab>", "]b", { desc = "Next buffer", noremap = true, silent = true })

-- Optional: Shift-Tab to go to the previous buffer
-- map("n", "<S-Tab>", "[b", { desc = "Previous buffer", noremap = true, silent = true })

-- Map <leader>x to close the current buffer
map("n", "<leader>x", ":bd<CR>", { desc = "Close current buffer", noremap = true, silent = true })

-- Map <leader>fz Telescope live Grep
map("n", "<leader>fz", "<cmd>Telescope live_grep<CR>", { desc = "Telescope Grep", noremap = true, silent = true })

-- Swap `j` and `k` globally
-- map({ "n", "x", "o" }, "j", "k", { desc = "Move up" }) -- Map `j` to `k`
-- map({ "n", "x", "o" }, "k", "j", { desc = "Move down" }) -- Map `k` to `j`

-- For Ctrl-based motions (if you use them)
-- map({ 'n', 'x', 'o' }, '<C-j>', '<C-k>', { desc = "Move up (Ctrl)" })
-- map({ 'n', 'x', 'o' }, '<C-k>', '<C-j>', { desc = "Move down (Ctrl)" })

map("n", "<leader>j", "<C-w>k", { desc = "Move to above split" })
map("n", "<leader>k", "<C-w>j", { desc = "Move to below split" })
