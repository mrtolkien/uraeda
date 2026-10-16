//! How a write changes the settings file: only the value it sets, every other byte kept.

use std::fs;
use std::io::Read as _;
use std::os::unix::fs::{MetadataExt as _, PermissionsExt as _};
use std::path::{Path, PathBuf};

use tempfile::TempDir;
use uraeda_core::api::ApiError;
use uraeda_core::settings;

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

fn names(dir: &Path) -> Vec<String> {
    let mut names: Vec<_> = fs::read_dir(dir)
        .unwrap()
        .map(|entry| entry.unwrap().file_name().to_string_lossy().into_owned())
        .collect();
    names.sort();
    names
}

/// The `[server]` table holding `hosts`, the inside of the `allowed_hosts` array.
fn listing(hosts: &str) -> String {
    format!("# mine\n[server]\nallowed_hosts = [{hosts}]\nport = 4310\n")
}

const TWO: &str = "\n  # home\n  \"a.ts.net\", # laptop\n  # work\n  \"b.ts.net\", # phone\n";

#[test]
fn adding_a_name_keeps_each_names_comments() {
    let rows = [
        ("\n  \"a.ts.net\"\n", "\n  \"a.ts.net\",\n  \"c.ts.net\"\n"),
        (
            TWO,
            "\n  # home\n  \"a.ts.net\", # laptop\n  # work\n  \"b.ts.net\", # phone\n  \"c.ts.net\",\n",
        ),
        (
            "\n  # home\n  \"a.ts.net\", # laptop\n  # work\n  \"b.ts.net\" # phone\n",
            "\n  # home\n  \"a.ts.net\", # laptop\n  # work\n  \"b.ts.net\", # phone\n  \"c.ts.net\"\n",
        ),
        (
            "\n    \"a.ts.net\",\n    # more to come\n",
            "\n    \"a.ts.net\",\n    \"c.ts.net\",\n    # more to come\n",
        ),
        (
            "\"a.ts.net\", \"b.ts.net\"",
            "\"a.ts.net\", \"b.ts.net\", \"c.ts.net\"",
        ),
        ("", "\"c.ts.net\""),
    ];
    for (before, after) in rows {
        let dir = tempdir();
        write(dir.path(), &listing(before));

        settings::add_allowed_host(dir.path(), "c.ts.net").unwrap();

        assert_eq!(text(dir.path()), listing(after), "for {before:?}");
    }
}

#[test]
fn removing_a_name_takes_its_comments_with_it() {
    let three = format!("{TWO}  # tablet\n  \"c.ts.net\", # kitchen\n");
    let rows = [
        (
            TWO,
            "a.ts.net",
            "\n  # work\n  \"b.ts.net\", # phone\n".to_owned(),
        ),
        (
            TWO,
            "b.ts.net",
            "\n  # home\n  \"a.ts.net\", # laptop\n".to_owned(),
        ),
        (
            &three,
            "b.ts.net",
            "\n  # home\n  \"a.ts.net\", # laptop\n  # tablet\n  \"c.ts.net\", # kitchen\n"
                .to_owned(),
        ),
        (
            "\n  \"a.ts.net\", # laptop\n  \"b.ts.net\" # phone\n",
            "b.ts.net",
            "\n  \"a.ts.net\" # laptop\n".to_owned(),
        ),
        (
            "\"a.ts.net\", \"b.ts.net\", \"c.ts.net\"",
            "b.ts.net",
            "\"a.ts.net\", \"c.ts.net\"".to_owned(),
        ),
        (
            "\n  # home\n  \"a.ts.net\", # laptop\n",
            "a.ts.net",
            String::new(),
        ),
    ];
    for (before, name, after) in rows {
        let dir = tempdir();
        write(dir.path(), &listing(before));

        settings::remove_allowed_host(dir.path(), name).unwrap();

        assert_eq!(text(dir.path()), listing(&after), "for {before:?} - {name}");
    }
}

#[test]
fn acts_on_every_copy_of_a_name() {
    let dir = tempdir();
    let before = listing("\"a.ts.net\", \"b.ts.net\", \"A.ts.net\"");
    write(dir.path(), &before);

    let removed = settings::remove_allowed_host(dir.path(), "a.ts.net").unwrap();

    assert_eq!(removed.server.allowed_hosts, Some(vec!["b.ts.net".into()]));
    assert_eq!(text(dir.path()), listing("\"b.ts.net\""));

    write(dir.path(), &before);
    let edited = settings::edit_allowed_host(dir.path(), "A.ts.net", "x.ts.net").unwrap();

    assert_eq!(
        edited.server.allowed_hosts,
        Some(vec!["x.ts.net".into(), "b.ts.net".into()])
    );
    assert_eq!(text(dir.path()), listing("\"x.ts.net\", \"b.ts.net\""));
}

#[test]
fn refuses_to_edit_a_name_into_another_listed() {
    let dir = tempdir();
    let before = listing("\"a.ts.net\", \"b.ts.net\"");
    write(dir.path(), &before);

    let edited = settings::edit_allowed_host(dir.path(), "a.ts.net", "B.ts.net");

    assert_eq!(
        edited,
        Err(ApiError {
            code: "refused",
            message: "b.ts.net is already allowed.".into(),
            output: None,
        })
    );
    assert_eq!(text(dir.path()), before);
}

#[test]
fn keeps_windows_line_ends() {
    let before = "# mine\r\n[server]\r\nport = 4310 # usual\r\n\r\n[agents]\r\nmodel = \"x\"\r\n";
    let dir = tempdir();
    write(dir.path(), before);

    settings::set_port(dir.path(), "4400").unwrap();
    assert_eq!(text(dir.path()), before.replace("4310", "4400"));

    settings::add_allowed_host(dir.path(), "a.ts.net").unwrap();
    assert_eq!(
        text(dir.path()),
        before.replace(
            "4310 # usual\r\n",
            "4400 # usual\r\nallowed_hosts = [\"a.ts.net\"]\r\n"
        )
    );
}

#[test]
fn keeps_a_byte_order_mark() {
    let before = "\u{feff}# mine\n[server]\nport = 4310\n";
    let dir = tempdir();
    write(dir.path(), before);

    let saved = settings::set_port(dir.path(), "4400").unwrap();

    assert_eq!(saved.server.port, Some(4400));
    assert_eq!(text(dir.path()), before.replace("4310", "4400"));
    assert_eq!(settings::read(dir.path()), Ok(saved));
}

#[test]
fn writes_through_a_symlink() {
    let root = tempdir();
    let dotfiles = root.path().join("dotfiles");
    let config = root.path().join("config");
    fs::create_dir_all(&dotfiles).unwrap();
    fs::create_dir_all(&config).unwrap();
    write(&dotfiles, "# mine\n[server]\nport = 4310\n");
    std::os::unix::fs::symlink("../dotfiles/config.toml", file(&config)).unwrap();

    settings::set_port(&config, "4400").unwrap();

    assert!(fs::symlink_metadata(file(&config)).unwrap().is_symlink());
    assert_eq!(text(&dotfiles), "# mine\n[server]\nport = 4400\n");
    assert_eq!(names(&dotfiles), ["config.toml"]);
    assert_eq!(names(&config), ["config.toml"]);
}

#[test]
fn keeps_the_files_permissions() {
    let dir = tempdir();
    write(dir.path(), "[server]\nport = 4310\n");
    fs::set_permissions(file(dir.path()), fs::Permissions::from_mode(0o600)).unwrap();

    settings::set_port(dir.path(), "4400").unwrap();

    let mode = fs::metadata(file(dir.path())).unwrap().permissions().mode();
    assert_eq!(mode & 0o777, 0o600);
}

#[test]
fn replaces_the_file_through_a_rename() {
    let dir = tempdir();
    write(dir.path(), "[server]\nport = 4310\n");
    let mut before = fs::File::open(file(dir.path())).unwrap();
    let inode = before.metadata().unwrap().ino();

    settings::set_port(dir.path(), "4400").unwrap();
    settings::set_open_browser(dir.path(), false).unwrap();

    let mut old = String::new();
    before.read_to_string(&mut old).unwrap();
    assert_eq!(old, "[server]\nport = 4310\n");
    assert_ne!(fs::metadata(file(dir.path())).unwrap().ino(), inode);
    assert_eq!(names(dir.path()), ["config.toml"]);
}

#[test]
fn writes_the_home_folder_as_a_tilde() {
    let home = Path::new("/home/me");
    let rows = [
        (
            "/home/me/.config/uraeda/config.toml",
            "~/.config/uraeda/config.toml",
        ),
        ("/etc/uraeda/config.toml", "/etc/uraeda/config.toml"),
        ("/home/meow/config.toml", "/home/meow/config.toml"),
    ];
    for (path, shown) in rows {
        assert_eq!(settings::shown(Path::new(path), home), shown, "for {path}");
    }
    let path = Path::new("/home/me/config.toml");
    assert_eq!(settings::shown(path, Path::new("")), "/home/me/config.toml");
}
