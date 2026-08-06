#!/usr/bin/env python3
"""Emit an ffmpeg video-filter expression from a Zack edit map.

Expected JSON:
{
  "punches": [{"time": 3.2, "duration": 0.4, "scale": 1.08}],
  "shakes": [{"time": 9.9, "duration": 0.3, "amount": 0.01}]
}
"""
from __future__ import annotations
import argparse, json
from pathlib import Path


def between(t: float, d: float) -> str:
    return f"between(t,{t:.3f},{t+d:.3f})"


def build(data: dict) -> str:
    # Use one zoompan-like scale/crop expression and cumulative tiny translations.
    punches = data.get("punches", [])
    shakes = data.get("shakes", [])
    scale_terms = ["1"]
    for p in punches:
        t = float(p.get("time", 0)); d = float(p.get("duration", 0.4)); s = float(p.get("scale", 1.08))
        scale_terms.append(f"({s-1:.5f})*{between(t,d)}*sin(PI*(t-{t:.3f})/{d:.3f})")
    scale = "+".join(scale_terms)
    x_terms = [f"(iw-iw/({scale}))/2"]
    y_terms = [f"(ih-ih/({scale}))/2"]
    for i, sh in enumerate(shakes):
        t = float(sh.get("time", 0)); d = float(sh.get("duration", 0.3)); a = float(sh.get("amount", 0.01))
        freq = 43 + i * 7
        x_terms.append(f"iw*{a:.5f}*{between(t,d)}*sin({freq}*t)")
        y_terms.append(f"ih*{a:.5f}*{between(t,d)}*cos({freq+11}*t)")
    x = "+".join(x_terms); y = "+".join(y_terms)
    return f"scale=iw*({scale}):ih*({scale}):eval=frame,crop=iw/({scale}):ih/({scale}):x='{x}':y='{y}'"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("edit_map")
    ap.add_argument("--print-vf", action="store_true")
    args = ap.parse_args()
    data = json.loads(Path(args.edit_map).read_text(encoding="utf-8"))
    print(build(data))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
