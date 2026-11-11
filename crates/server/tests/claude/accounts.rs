//! Claude Code's accounts, the folders of `[extensions.claude] accounts`: each reaches the
//! process only as `CLAUDE_CONFIG_DIR`, never for the default folder, and each is asked its
//! state and usage in short processes of the stand-in, never of a real `claude`.

use std::fs;

use crate::stage::{options, rest, staged};
use uraeda_server::runtimes::{Account, AccountState, Options};

/// A stand-in that writes the folder it was given, answers `auth status` signed out for a
/// folder holding a file `signed-out`, and answers `get_usage` with 42% of the five hours.
const ACCOUNTS: &str = r#"
printf '%s' "${CLAUDE_CONFIG_DIR-unset}" > config_dir
if [ "$1" = "auth" ]; then
  if [ -f "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/signed-out" ]; then echo '{"loggedIn":false}'; exit 1; fi
  echo '{"loggedIn":true}'; exit 0
fi
while IFS= read -r line; do
  id=$(printf '%s' "$line" | sed -n 's/.*"request_id":"\([^"]*\)".*/\1/p')
  case "$line" in
    *'"subtype":"get_usage"'*)
      if [ -f "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/signed-out" ]; then usage='{}'
      else usage='{"rate_limits":{"five_hour":{"utilization":42,"resets_at":"2026-11-10T12:00:00Z"},"seven_day":{"utilization":10,"resets_at":"2026-11-14T00:00:00Z"}}}'
      fi
      printf '{"type":"control_response","response":{"request_id":"%s","subtype":"success","response":%s}}\n' "$id" "$usage" ;;
  esac
done
"#;

/// Each account as its name, its state, and its five hours used, when known.
fn read(accounts: &[Account]) -> Vec<(String, AccountState, Option<f64>)> {
    let read = |account: &Account| {
        let used = account.windows.first().map(|window| window.used);
        (
            account.name.clone(),
            account.state,
            used.filter(|_| account.known),
        )
    };
    accounts.iter().map(read).collect()
}

#[tokio::test]
async fn an_account_reaches_the_agent_only_as_its_configuration_folder() {
    let config = "[extensions.claude]\naccounts = [\"~/.claude\", \"~/.claude-b\", \
                  \"~/.claude-c\", \"~/.claude-d\", \"docs\"]\n";
    let stage = staged(ACCOUNTS, |setup| setup.config("config.toml", config)).await;
    for folder in [".claude", ".claude-b", ".claude-d"] {
        fs::create_dir_all(stage.home.join(folder)).unwrap();
    }
    fs::write(stage.home.join(".claude-d/signed-out"), "").unwrap();

    // A session on account b gets its folder; one on the default folder gets no variable,
    // as one on the server's own login.
    let folder_b = stage.home.join(".claude-b").to_string_lossy().into_owned();
    let folder_default = stage.home.join(".claude").to_string_lossy().into_owned();
    for (account, given) in [
        (Some(folder_b.clone()), folder_b.as_str()),
        (Some(folder_default), "unset"),
        (None, "unset"),
    ] {
        let dir = stage.session_dir();
        let opened = Options {
            account,
            ..options(&dir)
        };
        let mut process = stage.open(opened).await;
        let mut events = process.events();
        process.close();
        rest(&mut events).await;
        let written = fs::read_to_string(dir.join("config_dir")).unwrap();
        assert_eq!(written, given);
    }

    // Their usage, asked in short processes: c has no folder, d is signed out, and a line
    // that is no absolute path is a problem.
    let (listed, problems) = stage
        .ask(|runtime| {
            let accounts = runtime.accounts().expect("Claude Code lists its accounts");
            accounts.refresh(std::time::Duration::from_secs(60));
            (accounts.list(), accounts.problems())
        })
        .await;
    assert_eq!(
        read(&listed),
        [
            ("default".to_owned(), AccountState::Ready, Some(0.42)),
            ("b".to_owned(), AccountState::Ready, Some(0.42)),
            ("c".to_owned(), AccountState::Missing, None),
            ("d".to_owned(), AccountState::SignedOut, None),
        ]
    );
    assert_eq!(
        problems,
        [
            "account folder docs is not an absolute path",
            "account d is signed out, in ~/.claude-d",
            "account c has no folder at ~/.claude-c",
        ]
    );
    // A session's transcript is looked for in its account's folder.
    let projects = stage.home.join(".claude-b/projects/p");
    fs::create_dir_all(&projects).unwrap();
    fs::write(projects.join("s1.jsonl"), "").unwrap();
    let found = stage
        .ask(move |runtime| {
            let in_b = runtime.has_session("s1", Some(&folder_b));
            (in_b, runtime.has_session("s1", None))
        })
        .await;
    assert_eq!(found, (true, false));
    stage.server.stop().await;
}
