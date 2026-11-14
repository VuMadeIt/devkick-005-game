#!/usr/bin/env bash
# Mixes an otter voice line over a victory music sting: the music starts first, the voice comes in
# after a short beat, and the music ducks under the voice (sidechain) so every word stays clear.
#   scripts/mix-celebration.sh <music.mp3> <voice.mp3> <out.mp3> [voice_delay_ms]
set -euo pipefail

if [ "$#" -lt 3 ]; then
  echo "usage: $0 <music.mp3> <voice.mp3> <out.mp3> [voice_delay_ms]" >&2
  exit 1
fi
command -v ffmpeg >/dev/null || { echo "ffmpeg is required (brew install ffmpeg)" >&2; exit 1; }

music="$1" voice="$2" out="$3" delay="${4:-400}"

ffmpeg -hide_banner -loglevel error -y -i "$music" -i "$voice" -filter_complex "\
[0:a]aresample=44100,aformat=channel_layouts=stereo,volume=0.8[m];\
[1:a]aresample=44100,aformat=channel_layouts=stereo,adelay=${delay}|${delay},volume=1.4,asplit=2[vk][vmix];\
[vk]apad[vkey];\
[m][vkey]sidechaincompress=threshold=0.03:ratio=8:attack=15:release=350[duck];\
[duck][vmix]amix=inputs=2:duration=longest:normalize=0,alimiter=limit=0.95[mix]" \
  -map "[mix]" -ar 44100 -b:a 160k "$out"

echo "wrote $out"
