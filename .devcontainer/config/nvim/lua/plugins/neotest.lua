return {
  "nvim-neotest/neotest",
  dependencies = {
    "nvim-lua/plenary.nvim",
    "nvim-treesitter/nvim-treesitter",
    "antoinemadec/FixCursorHold.nvim",
    "nvim-neotest/neotest-python",
    "nvim-neotest/nvim-nio",
  },
  config = function()
    -- Setup Neotest Python adapter
    require("neotest").setup({
      adapters = {
        require("neotest-python")({
          dap = { justMyCode = false },
          runner = "pytest",
          args = { "lambdas/tests/unit" }, -- your test folder
          cwd = vim.fn.getcwd(), -- project root
        }),
      },
    })
  end,
}
