# The sandbox an unattended agent's commands run in (packages/agent/src/env.ts, DockerEnv):
# node to run the engine's code and tests, git for the diff, ripgrep for search. Nothing else —
# the task's workspace and the engine's code are mounted when it starts, and it has no network.
FROM node:24-bookworm-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends git ripgrep ca-certificates \
 && rm -rf /var/lib/apt/lists/*
