#!/usr/bin/env bash
set -euo pipefail
# Minimal one-shot assembly template. Adapt input paths and generated filter.
# Usage: assemble_oneshot.sh <concat-list.txt> <narration.wav> <edit-map.json> <output.mp4>
LIST=${1:?concat list}; NARR=${2:?narration}; MAP=${3:?edit map}; OUT=${4:?output}
DIR=$(cd "$(dirname "$0")" && pwd)
VF=$(python3 "$DIR/zack_edit.py" "$MAP" --print-vf)
ffmpeg -y -f concat -safe 0 -i "$LIST" -i "$NARR" \
  -filter_complex "[0:v]$VF,scale=1080:1920[v];[0:a]volume=0.25[a0];[1:a]loudnorm=I=-16:TP=-1.5[a1];[a0][a1]amix=inputs=2:duration=longest[a]" \
  -map "[v]" -map "[a]" -c:v libx264 -preset veryfast -crf 17 -c:a aac -movflags +faststart "$OUT"
