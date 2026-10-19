# Inbox

## Deferred fixes

- [agent] [qutebrowser-process-messages] The hint for long output,
  `[N lines hidden, see :process for the full output]`, names no PID, so it can open the wrong
  process
- [agent] [qutebrowser-process-messages] `test_exit_unsuccessful_other_process_started` kills its
  second process only at the end of the test body: a failed assert leaves a 60-second child running
- [agent] [qutebrowser-process-messages] `ProcessOutcome.__str__` takes its word (`crashed`,
  `terminated`) from `state_str()`, so renaming a completion state would change the messages too
- [agent] [qutebrowser-process-messages] `GUIProcess._on_finished` tests `was_successful()` twice:
  once for logging and cleanup, once for the message
- [agent] [qutebrowser-process-messages] `test_exit_sigterm_verbose` does not check that the cleanup
  timer stays stopped
