# every hairstyle from its drafts, with the touch-ups each needed
set -e
PY=${PY:-python}
T=$(dirname "$0")
for s in short messy swept cropped thin tied bob bun ponytail; do $PY -I $T/hairmake.py $s | tail -1; done
$PY -I $T/hairmake.py long --back down:99,left:13@12,up:99 | tail -1
$PY -I $T/hairmake.py wavy --back down:99,left:13@12,up:99 | tail -1
$PY -I $T/hairmake.py braid --back down:99,left:99,up:99 | tail -1
$PY -I $T/nape.py short messy swept cropped
$PY -I $T/nape.py wavy --to 12 --full --woman
$PY -I $T/fixcropped.py
$PY -I $T/fixbraid.py
# the children's (drafted on the adults' heads: the child's head is the woman's)
$PY -I $T/hairmake.py pigtails --back down:99,left:99,up:99 | tail -1
$PY -I $T/hairmake.py tuft | tail -1
$PY -I $T/hairmake.py childbob | tail -1
$PY -I $T/nape.py pigtails --to 12 --woman
$PY -I $T/nape.py tuft
$PY -I $T/fixchildbob.py
