# Run the server on a release build of the core

From Q1 of the [performance pass](/specs/2026-10-29-performance-pass/clarifications-01.md), answered
on 2026-10-30: "Ok, issue a PR for that before the spec, I guess it's mostly trivial."

The option picked: ship the release build for `vp run start` now, as its own change, and keep the
debug build for `vp run dev` and tests. The debug build makes every read about 4 times slower.
