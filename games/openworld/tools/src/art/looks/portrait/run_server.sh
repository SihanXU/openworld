#!/bin/sh
# The portrait library on lmmslab-03 (docs/looks.md §4): one ComfyUI on the given GPU, batch.py over the job list,
# and the ComfyUI stopped when the run ends or is stopped, so the card is never left held.
#   sh run_server.sh <gpu> [jobs.json]   (copied to the server as lsw_run.sh; see setup.md)
GPU=$1; JOBS=${2:-jobs.json}
echo $$ > /mnt/data2/lmmslab-03/lsw-portraits/run.pid   # stop: kill $(cat run.pid) (the trap stops the ComfyUI)
PORT=$((18290 + GPU))
ROOT=/mnt/data2/lmmslab-03/lsw-portraits
COMFY=/mnt/data2/lmmslab-03/sihan-video/ComfyUI
(cd $COMFY && CUDA_VISIBLE_DEVICES=$GPU exec .venv/bin/python main.py --listen 127.0.0.1 --port $PORT --disable-auto-launch) > $ROOT/comfy.log 2>&1 &
PID=$!
trap 'kill $PID 2>/dev/null; wait $PID 2>/dev/null' EXIT INT TERM HUP
until curl -s -o /dev/null http://127.0.0.1:$PORT/system_stats; do
  kill -0 $PID 2>/dev/null || { echo COMFY_DIED; exit 1; }
  sleep 3
done
# the batch in the background and waited on, so a stop reaches it too (the trap stops both)
cd $ROOT/work && LSW_COMFY=http://127.0.0.1:$PORT $COMFY/.venv/bin/python -I $ROOT/pipeline/batch.py $JOBS &
BATCH=$!
trap 'kill $BATCH $PID 2>/dev/null; wait $PID 2>/dev/null' EXIT INT TERM HUP
wait $BATCH
echo LSW_RUN_DONE
