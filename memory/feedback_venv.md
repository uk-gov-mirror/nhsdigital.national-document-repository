---
name: Activate venv before running Python commands
description: Must source the lambdas virtualenv before running Python/pytest commands
type: feedback
---

Always activate the virtual environment before running Python commands in this repo.

**Why:** Python and pytest are not available globally; they live in the lambdas venv.

**How to apply:** Run `source /home/roga/repos/national-document-repository/lambdas/venv/bin/activate` before any `python` or `pytest` invocation in the lambdas directory.
