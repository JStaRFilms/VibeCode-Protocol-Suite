#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REQUIRED = [
    ROOT / "index.ts",
    ROOT / "provider.ts",
    ROOT / "commands.ts",
    ROOT / "oauth-flow.ts",
    ROOT / "oauth-store.ts",
    ROOT / "state.ts",
    ROOT / "policies.ts",
    ROOT / "config.ts",
    ROOT / "types.ts",
    ROOT / "README.md",
]
EXPECTED_MODELS = ["oauth-router", "gpt-5.4-mini", "gpt-5.4", "gpt-5.5", "gpt-5.6-luna", "gpt-5.6-sol", "gpt-5.6-terra"]
PI_CANDIDATES = [
    os.environ.get("PI_BIN"),
    shutil.which("pi"),
    shutil.which("pi.cmd"),
    str(Path.home() / "AppData" / "Roaming" / "npm" / "pi"),
    str(Path.home() / "AppData" / "Roaming" / "npm" / "pi.cmd"),
]


def resolve_pi() -> str | None:
    for candidate in PI_CANDIDATES:
        if not candidate:
            continue
        path = Path(candidate)
        if path.exists():
            return str(path)
    return None


def run(cmd: list[str], timeout: int = 90) -> tuple[int, str, str]:
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    return proc.returncode, proc.stdout, proc.stderr


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--quick", action="store_true")
    args = parser.parse_args()

    failed = False

    for path in REQUIRED:
        if not path.exists():
            print(f"[FAIL] missing: {path}")
            failed = True
        else:
            print(f"[ OK ] found: {path.relative_to(ROOT)}")

    if args.quick:
        return 1 if failed else 0

    pi_bin = resolve_pi()
    if not pi_bin:
        print("[FAIL] unable to locate `pi` binary")
        return 1

    try:
        code, stdout, stderr = run([pi_bin, "--list-models"])
        output = f"{stdout}\n{stderr}"
        if code != 0:
            print("[FAIL] `pi --list-models` failed")
            print(output.strip())
            failed = True
        else:
            print("[ OK ] `pi --list-models` executed")
            for token in EXPECTED_MODELS:
                if token not in output:
                    print(f"[FAIL] model token not found in list output: {token}")
                    failed = True
                else:
                    print(f"[ OK ] model token present: {token}")
    except Exception as exc:
        print(f"[FAIL] unable to execute `pi --list-models`: {exc}")
        failed = True

    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
