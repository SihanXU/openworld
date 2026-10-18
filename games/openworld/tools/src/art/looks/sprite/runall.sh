# every outfit whose three drafts are there, on its body: runall.sh outfit:body …   (in the work folder)
PY=${PY:-python}
T=$(dirname "$0")
for ob in "$@"; do
  o=${ob%%:*}; b=${ob##*:}
  if [ -f drafts/outfit-$o-$b-down.png ] && [ -f drafts/outfit-$o-$b-left.png ] && [ -f drafts/outfit-$o-$b-up.png ]; then
    for f in down left up; do $PY -I $T/outfit.py $o $b $f > /dev/null || echo "FAIL $o $b $f"; done
    echo "done $o $b"
  else
    echo "waiting $o $b"
  fi
done
