# Large Symbolic World

A web-playable 2D JRPG-style world at large scale (dozens of maps, thousands of NPCs,
tens of thousands of items) whose rules are code. An LLM acts as a live modder: when
an interaction is undefined, it writes a type-level rule patch that the engine
validates, applies, and keeps. When interactions are defined, the game runs on its own.

Successor to BardOS. Design: [docs/design.md](docs/design.md).

Status: design agreed; implementation not started.
