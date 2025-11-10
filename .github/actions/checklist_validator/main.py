import os
from scripts.github.checklist_validator.main import validate_checklist


def run():
    pr_body = os.getenv(
        "INPUT_BODY", ""
    )  # GitHub passes inputs as env vars prefixed with INPUT_
    if validate_checklist(pr_body):
        print("All checklist items are checked ✅")
        exit(0)
    else:
        print("Some checklist items are not checked ❌")
        exit(1)


if __name__ == "__main__":
    run()
