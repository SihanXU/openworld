"""A stand-in for the docker CLI in the miner's tests: `build` fails for a Dockerfile that names FAILFROM and
succeeds otherwise; every call is logged to $FAKE_DOCKER_LOG. (Run as LSW_DOCKER="python fake_docker.py".)"""

import json
import os
import sys

args = sys.argv[1:]
with open(os.environ["FAKE_DOCKER_LOG"], "a", encoding="utf-8") as f:
    f.write(json.dumps(args) + "\n")
if args[0] == "build":
    with open(os.path.join(args[-1], "Dockerfile"), encoding="utf-8") as f:
        sys.exit(1 if "FAILFROM" in f.read() else 0)
sys.exit(0)
