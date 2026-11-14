use std::fs;
use std::path::{Path, PathBuf};

use tempfile::TempDir;
use uraeda_core::api::ApiError;
use uraeda_core::settings::{
    self, KeyboardSettings, RunOptions, RunSettings, ServerSettings, Settings,
};

const HOST_PROBLEM: &str =
    "is not a host name: use letters, digits, hyphens, and dots, like mac.tail1234.ts.net.";
const PORT_PROBLEM: &str = "The port is a number from 1 to 65535.";
const CONTINUES_PROBLEM: &str = "Automatic continues in a row is a whole number from 1 to 10.";

fn tempdir() -> TempDir {
    TempDir::new().expect("a temporary folder")
}

fn file(dir: &Path) -> PathBuf {
    dir.join("config.toml")
}

fn write(dir: &Path, text: &str) {
    fs::write(file(dir), text).unwrap();
}

/// The file's path as messages show it.
fn shown(dir: &Path) -> String {
    settings::shown(&file(dir), &std::env::home_dir().unwrap_or_default())
}

fn unreadable(dir: &Path, problem: &str) -> ApiError {
    ApiError {
        code: "unreadable",
        message: format!("Cannot read {}: {problem}", shown(dir)),
        output: None,
    }
}

#[test]
fn reads_each_file() {
    let dir = tempdir();
    let full = Settings {
        server: ServerSettings {
            allowed_hosts: Some(vec!["mac.tail1234.ts.net".into()]),
            port: Some(4400),
            open_browser: Some(false),
        },
        runs: RunSettings {
            continue_after_restart: Some(false),
            continue_after_limit: Some(true),
            automatic_continues: Some(4),
            catch_up_pull_requests: Some(true),
            scheduled_jobs: Some(false),
            default_agent: Some("codex".into()),
            options: RunOptions::default(),
        },
        ..Settings::default()
    };
    let list = "The allowed host names are a list, like [\"mac.tail1234.ts.net\"].";
    let rows: [(Option<&str>, Result<Settings, String>); 15] = [
        (None, Ok(Settings::default())),
        (Some(""), Ok(Settings::default())),
        (
            Some(
                "[server]\nallowed_hosts = [\"mac.tail1234.ts.net\"]\nport = 4400\nopen_browser = false\n\n[runs]\ncontinue_after_restart = false\ncontinue_after_limit = true\nautomatic_continues = 4\ncatch_up_pull_requests = true\nscheduled_jobs = false\ndefault_agent = \" codex \"\n",
            ),
            Ok(full),
        ),
        (Some("[agents]\nmodel = \"x\"\n"), Ok(Settings::default())),
        (
            Some("[server]\nport = 0\n"),
            Err(format!("line 2, port: {PORT_PROBLEM}")),
        ),
        (
            Some("[server]\nport = 70000\n"),
            Err(format!("line 2, port: {PORT_PROBLEM}")),
        ),
        (
            Some("[server]\nport = \"x\"\n"),
            Err(format!("line 2, port: {PORT_PROBLEM}")),
        ),
        (
            Some("[server]\nallowed_hosts = [\"https://x\"]\n"),
            Err(format!("line 2, allowed_hosts: https://x {HOST_PROBLEM}")),
        ),
        (
            Some("# mine\n\n[server]\nport = 0\n"),
            Err(format!("line 4, port: {PORT_PROBLEM}")),
        ),
        (
            Some("server = 1\n"),
            Err("line 1, server: [server] is a table of settings.".into()),
        ),
        (
            Some("[server]\nallowed_hosts = \"mac.tail1234.ts.net\"\n"),
            Err(format!("line 2, allowed_hosts: {list}")),
        ),
        (
            Some("[server]\nallowed_hosts = [\n  \"a.ts.net\",\n  4310,\n]\n"),
            Err(format!("line 4, allowed_hosts: {list}")),
        ),
        (
            Some("[server]\nopen_browser = \"yes\"\n"),
            Err("line 2, open_browser: Opening a browser at start is true or false.".into()),
        ),
        (
            Some("[runs]\nbuild_in_fresh_session = 1\n"),
            Err(
                "line 2, build_in_fresh_session: Building in a fresh session is true or false."
                    .into(),
            ),
        ),
        (
            Some("runs = true\n"),
            Err("line 1, runs: [runs] is a table of settings.".into()),
        ),
    ];
    reads(dir.path(), rows);
}

/// Reads each row's file, `None` for none, and checks its settings or its problem.
fn reads(
    dir: &Path,
    rows: impl IntoIterator<Item = (Option<&'static str>, Result<Settings, String>)>,
) {
    for (contents, expected) in rows {
        let _ = fs::remove_file(file(dir));
        if let Some(contents) = contents {
            write(dir, contents);
        }

        let read = settings::read(dir);

        let expected = expected.map_err(|problem| unreadable(dir, &problem));
        assert_eq!(read, expected, "for {contents:?}");
    }
}

#[test]
fn refuses_each_continue_setting_out_of_its_rule() {
    let dir = tempdir();
    let rows: [(Option<&str>, Result<Settings, String>); 7] = [
        (
            Some("[runs]\nscheduled_jobs = \"yes\"\n"),
            Err("line 2, scheduled_jobs: Running scheduled jobs is true or false.".into()),
        ),
        (
            Some("[runs]\ncatch_up_pull_requests = \"yes\"\n"),
            Err(
                "line 2, catch_up_pull_requests: Catching up open pull requests is true or false."
                    .into(),
            ),
        ),
        (
            Some("[runs]\ncontinue_after_restart = \"no\"\n"),
            Err(
                "line 2, continue_after_restart: Continue after a restart is true or false.".into(),
            ),
        ),
        (
            Some("[runs]\ncontinue_after_limit = 0\n"),
            Err(
                "line 2, continue_after_limit: Continue after a usage limit is true or false."
                    .into(),
            ),
        ),
        (
            Some("[runs]\nautomatic_continues = 0\n"),
            Err(format!("line 2, automatic_continues: {CONTINUES_PROBLEM}")),
        ),
        (
            Some("[runs]\nautomatic_continues = 11\n"),
            Err(format!("line 2, automatic_continues: {CONTINUES_PROBLEM}")),
        ),
        (
            Some("[runs]\nautomatic_continues = \"3\"\n"),
            Err(format!("line 2, automatic_continues: {CONTINUES_PROBLEM}")),
        ),
    ];
    reads(dir.path(), rows);
}

#[test]
fn reports_where_a_file_does_not_parse() {
    let dir = tempdir();
    write(dir.path(), "[server\n");

    let error = settings::read(dir.path()).unwrap_err();

    assert_eq!(error.code, "unreadable");
    let start = format!("Cannot read {}: line 1", shown(dir.path()));
    assert!(error.message.starts_with(&start), "{}", error.message);
}

#[test]
fn checks_a_port_given_by_a_flag_or_a_variable() {
    assert_eq!(settings::port(" 4400 "), Ok(4400));
    for typed in ["70000", "0", "abc", "", "-1", "4400.5", "0x10"] {
        assert_eq!(
            settings::port(typed),
            Err(PORT_PROBLEM.into()),
            "for {typed:?}"
        );
    }
}

#[test]
fn shows_the_settings_file_with_the_home_folder_as_tilde() {
    let home = std::env::home_dir().unwrap_or_default();

    assert_eq!(
        settings::shown_file(&home.join(".config/uraeda")),
        "~/.config/uraeda/config.toml"
    );
    assert_eq!(
        settings::shown(Path::new("/srv/uraeda/config.toml"), Path::new("/home/me/")),
        "/srv/uraeda/config.toml"
    );
    assert_eq!(
        settings::shown(
            Path::new("/home/me/.config/uraeda/config.toml"),
            Path::new("/home/me/")
        ),
        "~/.config/uraeda/config.toml"
    );
}

#[test]
fn finds_the_config_folder() {
    let home = Path::new("/home/me");
    let rows: [(&[(&str, &str)], &str); 5] = [
        (&[("URAEDA_CONFIG_DIR", "/c")], "/c"),
        (
            &[("URAEDA_CONFIG_DIR", "/c"), ("XDG_CONFIG_HOME", "/x")],
            "/c",
        ),
        (
            &[("URAEDA_CONFIG_DIR", ""), ("XDG_CONFIG_HOME", "/x")],
            "/x/uraeda",
        ),
        (&[("XDG_CONFIG_HOME", "")], "/home/me/.config/uraeda"),
        (&[], "/home/me/.config/uraeda"),
    ];
    for (variables, expected) in rows {
        let var = |name: &str| {
            variables
                .iter()
                .find(|(key, _)| *key == name)
                .map(|(_, value)| (*value).to_owned())
        };

        let dir = settings::config_dir(var, home);

        assert_eq!(dir, PathBuf::from(expected), "for {variables:?}");
    }
}

/// A file's text, or none, and what its keyboard table reads as, or the problem.
type KeyboardRow<'a> = (Option<&'a str>, Result<KeyboardSettings, String>);

/// The keyboard table holding only `single_key_shortcuts`.
fn shortcuts(on: Option<bool>) -> KeyboardSettings {
    KeyboardSettings {
        single_key_shortcuts: on,
        ..KeyboardSettings::default()
    }
}

const VIM_COMMANDS_PROBLEM: &str =
    "vim_commands: Vim commands are a list of lines, like [\"imap jj <Esc>\"].";

#[test]
fn reads_the_keyboard_table() {
    let dir = tempdir();
    let rows: [KeyboardRow; 9] = [
        // Vim stays off and without commands until the file says otherwise.
        (None, Ok(shortcuts(None))),
        (Some("[agents]\nmodel = \"x\"\n"), Ok(shortcuts(None))),
        (Some("[keyboard]\n"), Ok(shortcuts(None))),
        (
            Some("[keyboard]\nsingle_key_shortcuts = false\n"),
            Ok(shortcuts(Some(false))),
        ),
        (
            Some("[keyboard]\nsingle_key_shortcuts = 1\n"),
            Err("line 2, single_key_shortcuts: Single-key shortcuts is true or false.".into()),
        ),
        (
            Some(
                "[keyboard]\nvim_mode = true\nvim_commands = [\"imap jj <Esc>\", \"nmap Y y$\"]\n",
            ),
            Ok(KeyboardSettings {
                vim_mode: Some(true),
                vim_commands: Some(vec!["imap jj <Esc>".into(), "nmap Y y$".into()]),
                ..KeyboardSettings::default()
            }),
        ),
        (
            Some("[keyboard]\nvim_mode = \"yes\"\n"),
            Err("line 2, vim_mode: Vim mode is true or false.".into()),
        ),
        // One line given as a string, not a list, is refused rather than read as a list.
        (
            Some("[keyboard]\nvim_commands = \"imap jj <Esc>\"\n"),
            Err(format!("line 2, {VIM_COMMANDS_PROBLEM}")),
        ),
        (
            Some("[keyboard]\n\nvim_commands = [1]\n"),
            Err(format!("line 3, {VIM_COMMANDS_PROBLEM}")),
        ),
    ];
    for (contents, expected) in rows {
        let _ = fs::remove_file(file(dir.path()));
        if let Some(contents) = contents {
            write(dir.path(), contents);
        }

        let read = settings::read(dir.path());

        let expected = expected
            .map(|keyboard| Settings {
                keyboard,
                ..Settings::default()
            })
            .map_err(|problem| unreadable(dir.path(), &problem));
        assert_eq!(read, expected, "for {contents:?}");
    }
    write(dir.path(), "keyboard = true\n");
    assert_eq!(
        settings::read(dir.path()),
        Err(unreadable(
            dir.path(),
            "line 1, keyboard: [keyboard] is a table of settings."
        ))
    );
}
