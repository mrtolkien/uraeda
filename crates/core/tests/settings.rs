use std::fs;
use std::os::unix::fs::PermissionsExt as _;
use std::path::{Path, PathBuf};

use tempfile::TempDir;
use uraeda_core::api::ApiError;
use uraeda_core::settings::{self, RunSettings, ServerSettings, Settings};

const HOST_PROBLEM: &str =
    "is not a host name: use letters, digits, hyphens, and dots, like mac.tail1234.ts.net.";
const PORT_PROBLEM: &str = "The port is a number from 1 to 65535.";

fn tempdir() -> TempDir {
    TempDir::new().expect("a temporary folder")
}

fn file(dir: &Path) -> PathBuf {
    dir.join("config.toml")
}

fn write(dir: &Path, text: &str) {
    fs::write(file(dir), text).unwrap();
}

fn text(dir: &Path) -> String {
    fs::read_to_string(file(dir)).unwrap()
}

fn refused(message: &str) -> ApiError {
    ApiError {
        code: "refused",
        message: message.into(),
        output: None,
    }
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

fn hosts(names: &[&str]) -> Settings {
    Settings {
        server: ServerSettings {
            allowed_hosts: Some(names.iter().map(|name| (*name).to_owned()).collect()),
            ..ServerSettings::default()
        },
        ..Settings::default()
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
            build_in_fresh_session: Some(false),
        },
    };
    let list = "The allowed host names are a list, like [\"mac.tail1234.ts.net\"].";
    let rows: [(Option<&str>, Result<Settings, String>); 15] = [
        (None, Ok(Settings::default())),
        (Some(""), Ok(Settings::default())),
        (
            Some(
                "[server]\nallowed_hosts = [\"mac.tail1234.ts.net\"]\nport = 4400\nopen_browser = false\n\n[runs]\nbuild_in_fresh_session = false\n",
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
    for (contents, expected) in rows {
        let _ = fs::remove_file(file(dir.path()));
        if let Some(contents) = contents {
            write(dir.path(), contents);
        }

        let read = settings::read(dir.path());

        let expected = expected.map_err(|problem| unreadable(dir.path(), &problem));
        assert_eq!(read, expected, "for {contents:?}");
    }
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
fn checks_each_host_name() {
    let longest = [
        "a".repeat(63),
        "b".repeat(63),
        "c".repeat(63),
        "d".repeat(61),
    ]
    .join(".");
    assert_eq!(longest.len(), 253);
    let long = format!("{}.ts.net", "a".repeat(247));
    assert_eq!(long.len(), 254);
    let rows: [(&str, Option<&str>); 11] = [
        ("mac.tail1234.ts.net", Some("mac.tail1234.ts.net")),
        ("MAC.Tail1234.ts.net", Some("mac.tail1234.ts.net")),
        ("  mac.tail1234.ts.net ", Some("mac.tail1234.ts.net")),
        ("localhost", Some("localhost")),
        ("https://mac.tail1234.ts.net", None),
        ("mac.tail1234.ts.net.", None),
        ("-mac.ts.net", None),
        ("mac-.ts.net", None),
        ("mac_1.ts.net", None),
        ("mac.ts.net:4310", None),
        ("", None),
    ];
    let lengths = [
        (longest.as_str(), Some(longest.as_str())),
        (long.as_str(), None),
    ];
    for (typed, saved) in rows.iter().copied().chain(lengths) {
        let dir = tempdir();
        write(dir.path(), "# mine\n");

        let added = settings::add_allowed_host(dir.path(), typed);

        match saved {
            Some(saved) => {
                assert_eq!(added, Ok(hosts(&[saved])), "for {typed:?}");
                assert!(
                    text(dir.path()).contains(&format!("allowed_hosts = [\"{saved}\"]")),
                    "for {typed:?}: {}",
                    text(dir.path())
                );
            }
            None => {
                let message = format!("{} {HOST_PROBLEM}", typed.trim());
                assert_eq!(added, Err(refused(&message)), "for {typed:?}");
                assert_eq!(text(dir.path()), "# mine\n", "for {typed:?}");
            }
        }
    }
}

#[test]
fn refuses_a_name_already_allowed() {
    let dir = tempdir();
    let before = "[server]\nallowed_hosts = [\"mac.tail1234.ts.net\"]\n";
    write(dir.path(), before);

    let added = settings::add_allowed_host(dir.path(), "MAC.tail1234.ts.net");

    assert_eq!(
        added,
        Err(refused("mac.tail1234.ts.net is already allowed."))
    );
    assert_eq!(text(dir.path()), before);
}

#[test]
fn keeps_comments_and_unknown_keys() {
    let dir = tempdir();
    let before = "# mine\n\n[server]\n# my tailnet\nallowed_hosts = [\"mac.tail1234.ts.net\"]\nport = 4310 # the usual\n\n[agents]\nmodel = \"x\"\n";
    write(dir.path(), before);

    let added = settings::add_allowed_host(dir.path(), "phone.tail1234.ts.net").unwrap();

    assert_eq!(
        text(dir.path()),
        before.replace(
            "allowed_hosts = [\"mac.tail1234.ts.net\"]",
            "allowed_hosts = [\"mac.tail1234.ts.net\", \"phone.tail1234.ts.net\"]"
        )
    );
    assert_eq!(
        added.server.allowed_hosts,
        Some(vec![
            "mac.tail1234.ts.net".into(),
            "phone.tail1234.ts.net".into()
        ])
    );
}

#[test]
fn edits_and_removes_a_name() {
    let dir = tempdir();
    write(
        dir.path(),
        "[server]\nallowed_hosts = [\"mac.tail1234.ts.net\"]\n",
    );

    let edited =
        settings::edit_allowed_host(dir.path(), "mac.tail1234.ts.net", "Laptop.tail1234.ts.net");
    assert_eq!(edited, Ok(hosts(&["laptop.tail1234.ts.net"])));
    assert_eq!(
        text(dir.path()),
        "[server]\nallowed_hosts = [\"laptop.tail1234.ts.net\"]\n"
    );

    let unknown = "phone.tail1234.ts.net is not an allowed host name.";
    assert_eq!(
        settings::edit_allowed_host(dir.path(), "phone.tail1234.ts.net", "x.ts.net"),
        Err(refused(unknown))
    );
    assert_eq!(
        settings::remove_allowed_host(dir.path(), "phone.tail1234.ts.net"),
        Err(refused(unknown))
    );
    assert_eq!(
        settings::edit_allowed_host(dir.path(), "laptop.tail1234.ts.net", "x_y"),
        Err(refused(&format!("x_y {HOST_PROBLEM}")))
    );

    let removed = settings::remove_allowed_host(dir.path(), "laptop.tail1234.ts.net");
    assert_eq!(removed, Ok(hosts(&[])));
    assert_eq!(text(dir.path()), "[server]\nallowed_hosts = []\n");
}

#[test]
fn removes_the_first_of_two_names() {
    let dir = tempdir();
    write(
        dir.path(),
        "[server]\nallowed_hosts = [\"mac.tail1234.ts.net\", \"phone.tail1234.ts.net\"]\n",
    );

    let removed = settings::remove_allowed_host(dir.path(), "mac.tail1234.ts.net");

    assert_eq!(removed, Ok(hosts(&["phone.tail1234.ts.net"])));
    assert_eq!(
        text(dir.path()),
        "[server]\nallowed_hosts = [\"phone.tail1234.ts.net\"]\n"
    );
}

#[test]
fn sets_building_in_a_fresh_session_in_its_own_table() {
    let dir = tempdir();
    write(dir.path(), "# mine\n[server]\nport = 4400\n");

    let saved = settings::set_build_in_fresh_session(dir.path(), false).unwrap();

    assert_eq!(saved.runs.build_in_fresh_session, Some(false));
    assert_eq!(saved.server.port, Some(4400));
    assert_eq!(
        text(dir.path()),
        "# mine\n[server]\nport = 4400\n\n[runs]\nbuild_in_fresh_session = false\n"
    );
    settings::set_build_in_fresh_session(dir.path(), true).unwrap();
    assert_eq!(
        text(dir.path()),
        "# mine\n[server]\nport = 4400\n\n[runs]\nbuild_in_fresh_session = true\n"
    );
}

#[test]
fn creates_the_folder_and_file() {
    let parent = tempdir();
    let dir = parent.path().join("config/uraeda");

    let saved = settings::set_open_browser(&dir, false).unwrap();

    assert_eq!(saved.server.open_browser, Some(false));
    assert_eq!(
        text(&dir),
        "# Uraeda's settings. The settings page writes this file too, and keeps your comments.\n\n[server]\nopen_browser = false\n"
    );
}

#[test]
fn adds_the_server_table_to_a_file_without_it() {
    let dir = tempdir();
    write(dir.path(), "# mine\n\n[agents]\nmodel = \"x\"\n");

    settings::add_allowed_host(dir.path(), "mac.tail1234.ts.net").unwrap();

    assert_eq!(
        text(dir.path()),
        "# mine\n\n[agents]\nmodel = \"x\"\n\n[server]\nallowed_hosts = [\"mac.tail1234.ts.net\"]\n"
    );
}

#[test]
fn sets_the_port() {
    let dir = tempdir();
    write(dir.path(), "[server]\nport = 4310\n");

    let saved = settings::set_port(dir.path(), "4400").unwrap();

    assert_eq!(saved.server.port, Some(4400));
    assert_eq!(text(dir.path()), "[server]\nport = 4400\n");
    for typed in ["70000", "0", "x", "", "-1", "4400.5"] {
        assert_eq!(
            settings::set_port(dir.path(), typed),
            Err(refused(PORT_PROBLEM)),
            "for {typed:?}"
        );
        assert_eq!(text(dir.path()), "[server]\nport = 4400\n");
    }
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
fn refuses_writes_to_a_broken_file() {
    for before in ["[server\n", "[server]\nport = 0\n"] {
        let dir = tempdir();
        write(dir.path(), before);
        let expected = settings::read(dir.path()).unwrap_err();
        assert_eq!(expected.code, "unreadable");

        let changes = [
            settings::add_allowed_host(dir.path(), "mac.tail1234.ts.net"),
            settings::edit_allowed_host(dir.path(), "a.ts.net", "b.ts.net"),
            settings::remove_allowed_host(dir.path(), "a.ts.net"),
            settings::set_port(dir.path(), "4400"),
            settings::set_open_browser(dir.path(), false),
        ];

        for change in changes {
            assert_eq!(change, Err(expected.clone()), "for {before:?}");
        }
        assert_eq!(text(dir.path()), before);
    }
}

#[test]
fn applies_to_the_file_as_it_is_now() {
    let dir = tempdir();
    let threads: Vec<_> = ["mac", "phone"]
        .into_iter()
        .map(|device| {
            let dir = dir.path().to_owned();
            std::thread::spawn(move || {
                for count in 0..20 {
                    settings::add_allowed_host(&dir, &format!("{device}-{count}.ts.net")).unwrap();
                }
            })
        })
        .collect();
    for thread in threads {
        thread.join().unwrap();
    }

    let listed = settings::read(dir.path()).unwrap().server.allowed_hosts;

    assert_eq!(listed.map(|names| names.len()), Some(40));
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

#[test]
fn reports_a_failed_write() {
    let dir = tempdir();
    write(dir.path(), "[server]\nport = 4310\n");
    fs::set_permissions(dir.path(), fs::Permissions::from_mode(0o500)).unwrap();

    let saved = settings::set_port(dir.path(), "4400");

    fs::set_permissions(dir.path(), fs::Permissions::from_mode(0o700)).unwrap();
    let message = format!("Could not save {}: permission denied.", shown(dir.path()));
    assert_eq!(saved, Err(refused(&message)));
    assert_eq!(text(dir.path()), "[server]\nport = 4310\n");
}
