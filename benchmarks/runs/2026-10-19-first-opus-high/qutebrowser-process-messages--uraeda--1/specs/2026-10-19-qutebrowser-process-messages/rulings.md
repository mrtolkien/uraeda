# Rulings: Process messages

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: No signal name on Windows

- **Decision**: on Windows, a crash's outcome never names a signal:
  `Command crashed with status <code>.`
- **Rationale**: Windows crash codes are not signals, as the spec's [edge cases](spec.md#edge-cases)
  say. Python's `signal.Signals` on Windows also holds `CTRL_C_EVENT = 0` and
  `CTRL_BREAK_EVENT = 1`, so a crash with code 0 would have read `(CTRL_C_EVENT)`. The final review
  found it; `test_crash_without_signal_name_windows` covers it.
- **Alternatives considered**: keeping only names starting with `SIG`. It would still name a Windows
  crash code that happens to equal a signal number, which is wrong too.
- **If wrong**: a Windows crash that really is a signal loses its name; remove the
  `utils.is_windows` branch in `ProcessOutcome.__str__`.
- **Where**: task 1's code, fixed after the final review, `qutebrowser/misc/guiprocess.py`.

## R2: Validation run here, and what was not

- **Decision**: the unit tests ran with
  `python -m pytest -o required_plugins= -o addopts=--strict-markers`, since pytest-instafail is not
  installed. The limits were checked with flake8 7.4 and pylint 4.1 on the changed files; this
  pylint cannot load the project's own plugins, and reports other checks this old code base fails,
  so only `line-too-long` and `too-many-arguments` were enabled. mypy and the end-to-end tests did
  not run: they are not installed here.
- **Rationale**: the project's tox environments need packages this machine lacks.
- **Alternatives considered**: installing the full tox setup: it needs network access to many pinned
  packages and a browser.
- **If wrong**: CI runs `tox -e pylint`, `mypy`, and the end-to-end features; a failure there is
  fixed on the pull request.
- **Where**: every task's validation steps.
