"""
CI guard / Anti-Fake Data & Style Linter for SoyBuy.
Enforces:
  1. Data integrity rules (DR-1, DR-2, DR-9)
  2. Design rules (D-1, D-2, D-3)
  3. No banned hardcoded constants outside fixtures
"""

import os
import re
import sys

ERRORS = []

# 1. Banned literals in web and api (outside tests/ and data/)
BANNED_LITERALS = [
    r"dec-init",
    r"Zero-Hallucination Protocol Compliant",
    r"Fact Verified",
    r"Audit Trace: Pass",
]

# 2. Banned CSS/styling in web (D-1, D-2, D-3)
BANNED_CSS_PATTERNS = [
    (r"bg-gradient", "CSS Gradient (D-1)"),
    (r"gradient-to-", "CSS Gradient (D-1)"),
    (r"backdrop-blur", "Backdrop blur (D-2)"),
    (r"glass-card", "Glassmorphism (D-2)"),
]

def scan_file(fpath):
    rel_path = os.path.relpath(fpath)
    if "tests" in rel_path or "node_modules" in rel_path or ".next" in rel_path or ".venv" in rel_path:
        return

    with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()

    # Check banned literals
    for pattern in BANNED_LITERALS:
        if re.search(pattern, content, re.IGNORECASE):
            ERRORS.append(f"[{rel_path}] Found banned literal matching: {pattern}")

    # Check banned styling in web files
    if rel_path.startswith("apps\\web") or rel_path.startswith("apps/web"):
        for pattern, rule in BANNED_CSS_PATTERNS:
            matches = list(re.finditer(pattern, content))
            if matches:
                ERRORS.append(f"[{rel_path}] Found {len(matches)} occurrences of banned {rule} pattern: '{pattern}'")

def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    target_dirs = [
        os.path.join(root, "apps", "api", "app"),
        os.path.join(root, "apps", "web", "src"),
    ]

    for d in target_dirs:
        for dirpath, _, filenames in os.walk(d):
            for fname in filenames:
                if fname.endswith((".py", ".ts", ".tsx", ".css", ".js")):
                    scan_file(os.path.join(dirpath, fname))

    if ERRORS:
        print(f"FAILED: {len(ERRORS)} violations detected:")
        for err in ERRORS:
            print(f"  ❌ {err}")
        sys.exit(1)
    else:
        print("PASSED: Zero fake data or banned styling violations found!")
        sys.exit(0)

if __name__ == "__main__":
    main()
