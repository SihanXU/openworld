import os
import tempfile

# the stages' data in a directory of the tests' own, before any module reads where it lives
os.environ["LSW_FRESH_DATA"] = tempfile.mkdtemp(prefix="lsw-fresh-test-")
os.environ.pop("LSW_FRESH_REGISTRY", None)
