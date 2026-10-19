//! The settings decision's rules: one TOML file in the config folder that a write never takes
//! from the human, whatever it holds.

use std::fs;
use std::path::{Path, PathBuf};

use tempfile::TempDir;
use uraeda_core::settings;

const HUMANS_FILE: &str = "# mine\n\n[server]\n# my tailnet\nallowed_hosts = [\"mac.tail1234.ts.net\"] # kept\nport = 4310 # the usual\n\n[agents]\nmodel = \"x\"\n";

fn config(text: &str) -> (TempDir, PathBuf) {
    let dir = TempDir::new().unwrap();
    let file = dir.path().join("config.toml");
    fs::write(&file, text).unwrap();
    (dir, file)
}

/// Whether every line of `before` is still in `after`, in the same order.
fn keeps_lines_in_order(before: &str, after: &str) -> bool {
    let mut rest = after.lines();
    before
        .lines()
        .filter(|line| !line.contains("allowed_hosts") && !line.contains("port"))
        .all(|line| rest.any(|kept| kept == line))
}

#[test]
fn a_write_keeps_the_humans_comments_unknown_keys_and_order() {
    let (dir, file) = config(HUMANS_FILE);

    settings::add_allowed_host(dir.path(), "phone.tail1234.ts.net").unwrap();
    settings::set_port(dir.path(), "4400").unwrap();
    settings::set_open_browser(dir.path(), false).unwrap();
    settings::set_build_in_fresh_session(dir.path(), false).unwrap();

    let after = fs::read_to_string(&file).unwrap();
    assert!(keeps_lines_in_order(HUMANS_FILE, &after), "{after}");
    assert!(
        after.contains("# kept") && after.contains("# the usual"),
        "{after}"
    );
    let read = settings::read(dir.path()).unwrap();
    assert_eq!(read.server.port, Some(4400));
    assert_eq!(
        read.server.allowed_hosts,
        Some(vec![
            "mac.tail1234.ts.net".into(),
            "phone.tail1234.ts.net".into()
        ])
    );
    assert_eq!(read.server.open_browser, Some(false));
    assert_eq!(read.runs.build_in_fresh_session, Some(false));
}

#[test]
fn a_file_that_cannot_be_read_is_never_overwritten() {
    for broken in [
        "[server\n",
        "[server]\nport = 0\n",
        "[server]\nallowed_hosts = \"x\"\n",
    ] {
        let (dir, file) = config(broken);
        assert!(settings::read(dir.path()).is_err());

        let writes = [
            settings::add_allowed_host(dir.path(), "mac.tail1234.ts.net"),
            settings::edit_allowed_host(dir.path(), "a.ts.net", "b.ts.net"),
            settings::remove_allowed_host(dir.path(), "a.ts.net"),
            settings::set_port(dir.path(), "4400"),
            settings::set_open_browser(dir.path(), false),
            settings::set_build_in_fresh_session(dir.path(), false),
        ];

        assert!(writes.iter().all(Result::is_err), "{broken:?}");
        assert_eq!(fs::read_to_string(&file).unwrap(), broken);
    }
}

#[test]
fn a_refused_value_leaves_the_file_as_it_was() {
    let (dir, file) = config(HUMANS_FILE);
    let hosts = [
        "https://x.ts.net",
        "mac_1.ts.net",
        "-a.ts.net",
        "a.ts.net:1",
        "",
        "MAC.tail1234.ts.net",
    ];
    let ports = ["70000", "0", "x", "", "-1", "4400.5"];

    for host in hosts {
        assert!(
            settings::add_allowed_host(dir.path(), host).is_err(),
            "{host:?}"
        );
    }
    for port in ports {
        assert!(settings::set_port(dir.path(), port).is_err(), "{port:?}");
    }
    assert!(settings::remove_allowed_host(dir.path(), "unknown.ts.net").is_err());

    assert_eq!(fs::read_to_string(&file).unwrap(), HUMANS_FILE);
}

#[test]
fn host_names_are_kept_lowercase_and_edited_or_removed_by_name() {
    let (dir, _) = config("");

    settings::add_allowed_host(dir.path(), "  Mac.Tail1234.ts.net ").unwrap();
    settings::add_allowed_host(dir.path(), "phone.tail1234.ts.net").unwrap();
    settings::edit_allowed_host(dir.path(), "mac.tail1234.ts.net", "Laptop.tail1234.ts.net")
        .unwrap();
    let removed = settings::remove_allowed_host(dir.path(), "phone.tail1234.ts.net").unwrap();

    assert_eq!(
        removed.server.allowed_hosts,
        Some(vec!["laptop.tail1234.ts.net".into()])
    );
}

#[test]
fn a_missing_file_and_folder_are_created_by_the_first_write() {
    let parent = TempDir::new().unwrap();
    let dir = parent.path().join("config/uraeda");
    assert_eq!(settings::read(&dir).unwrap(), settings::Settings::default());

    settings::set_open_browser(&dir, false).unwrap();

    assert!(dir.join("config.toml").is_file());
    assert_eq!(
        settings::read(&dir).unwrap().server.open_browser,
        Some(false)
    );
}

#[test]
fn a_write_keeps_the_files_line_endings_permissions_and_symlink() {
    use std::os::unix::fs::PermissionsExt as _;
    let dir = TempDir::new().unwrap();
    let real = dir.path().join("dotfiles/config.toml");
    fs::create_dir_all(real.parent().unwrap()).unwrap();
    fs::write(&real, "[server]\r\nport = 4310\r\n").unwrap();
    fs::set_permissions(&real, fs::Permissions::from_mode(0o600)).unwrap();
    let folder = dir.path().join("config");
    fs::create_dir_all(&folder).unwrap();
    std::os::unix::fs::symlink(&real, folder.join("config.toml")).unwrap();

    settings::set_port(&folder, "4400").unwrap();

    let text = fs::read_to_string(&real).unwrap();
    assert!(text.contains("4400"), "the link's target was written");
    assert!(
        folder.join("config.toml").is_symlink(),
        "the link is still a link"
    );
    assert!(
        !text.replace("\r\n", "").contains('\n'),
        "every line ending is still CRLF"
    );
    assert_eq!(
        fs::metadata(&real).unwrap().permissions().mode() & 0o777,
        0o600
    );
}

#[test]
fn settings_live_in_the_config_folder_never_in_a_repository() {
    let home = Path::new("/home/me");
    let rows: [(&[(&str, &str)], &str); 4] = [
        (
            &[("URAEDA_CONFIG_DIR", "/c"), ("XDG_CONFIG_HOME", "/x")],
            "/c",
        ),
        (&[("XDG_CONFIG_HOME", "/x")], "/x/uraeda"),
        (&[("XDG_CONFIG_HOME", "")], "/home/me/.config/uraeda"),
        (&[], "/home/me/.config/uraeda"),
    ];
    for (variables, expected) in rows {
        let var = |name: &str| {
            variables
                .iter()
                .find(|(key, value)| *key == name && !value.is_empty())
                .map(|(_, value)| (*value).to_owned())
        };

        assert_eq!(
            settings::config_dir(var, home),
            PathBuf::from(expected),
            "{variables:?}"
        );
    }
}

#[test]
fn writes_at_the_same_moment_all_stay() {
    let (dir, _) = config("");

    let path = dir.path();
    std::thread::scope(|scope| {
        for device in ["mac", "phone"] {
            scope.spawn(move || {
                for count in 0..15 {
                    settings::add_allowed_host(path, &format!("{device}-{count}.ts.net")).unwrap();
                }
            });
        }
    });

    let listed = settings::read(dir.path()).unwrap().server.allowed_hosts;
    assert_eq!(listed.map(|names| names.len()), Some(30));
}
