use std::fs;
use std::path::Path;

use tempfile::TempDir;
use uraeda_core::themes::{self, DEFAULT_DARK, DEFAULT_LIGHT, ROLES, Theme, ThemeFile, Themes};

fn tempdir() -> TempDir {
    TempDir::new().expect("a temporary folder")
}

/// Writes each `(file, bytes)` in the config folder's `themes/`.
fn write(dir: &Path, files: &[(&str, &[u8])]) {
    let folder = themes::themes_dir(dir);
    fs::create_dir_all(&folder).unwrap();
    for (name, bytes) in files {
        fs::write(folder.join(name), bytes).unwrap();
    }
}

fn theme<'a>(read: &'a Themes, id: &str) -> Option<&'a Theme> {
    read.themes.iter().find(|theme| theme.id == id)
}

fn file<'a>(read: &'a Themes, name: &str) -> &'a ThemeFile {
    read.files
        .iter()
        .find(|file| file.file == name)
        .unwrap_or_else(|| panic!("{name} among {:?}", read.files))
}

fn assert_shipped_listed(read: &Themes) {
    assert!(theme(read, DEFAULT_DARK).is_some(), "Mocha listed");
    assert!(theme(read, DEFAULT_LIGHT).is_some(), "Latte listed");
}

#[test]
fn no_folder_the_shipped_themes_only() {
    let dir = tempdir();
    let read = themes::read(dir.path());
    assert_shipped_listed(&read);
    assert!(read.themes.iter().all(|theme| theme.is_shipped));
    assert!(read.files.is_empty());
    assert!(read.folder.ends_with("themes/"), "{}", read.folder);
    // Dark first, each mode's default first (R3).
    assert_eq!(read.themes[0].id, DEFAULT_DARK);
    let first_light = read.themes.iter().find(|theme| theme.mode == "light");
    assert_eq!(
        first_light.map(|theme| theme.id.as_str()),
        Some(DEFAULT_LIGHT)
    );
}

#[test]
fn every_shipped_file_reads_without_a_problem() {
    for file in themes::shipped_files() {
        assert!(file.is_listed, "{} listed", file.file);
        assert!(
            file.problems.is_empty(),
            "{}: {:?}",
            file.file,
            file.problems
        );
    }
}

#[test]
fn every_shipped_theme_sets_every_role_or_extends_one_that_does() {
    let read = themes::read(tempdir().path());
    for theme in read.themes.iter().filter(|theme| theme.is_shipped) {
        for role in ROLES {
            let colour = theme.roles.get(*role);
            assert!(
                colour.is_some_and(|colour| colour.starts_with('#')),
                "{}: {role} is {colour:?}",
                theme.id
            );
        }
        assert_eq!(theme.roles.len(), ROLES.len(), "{}", theme.id);
    }
}

const EMBER: &str = r##"#:schema https://raw.githubusercontent.com/mrtolkien/uraeda/main/schemas/theme.json
name = "Ember"
mode = "dark"
extends = "catppuccin-mocha"

[palette]
coal = "#1a1210"
ash = "#c9b8a8"
ember = "#FF7A45"
quote = "#5a4a40"

[roles]
page = "coal"
ink = "ash"
needs-you = "ember"
pane-title = "#e0a070"
"##;

#[test]
fn a_theme_extending_mocha_changes_only_the_roles_it_sets() {
    let dir = tempdir();
    write(dir.path(), &[("ember.toml", EMBER.as_bytes())]);
    let read = themes::read(dir.path());
    let ember = theme(&read, "ember").expect("ember listed");
    let mocha = theme(&read, DEFAULT_DARK).unwrap();
    assert_eq!(ember.name, "Ember");
    assert_eq!(ember.mode, "dark");
    assert!(!ember.is_shipped);
    assert_eq!(ember.roles["needs-you"], "#ff7a45");
    assert_eq!(ember.sources["needs-you"], "ember");
    assert_eq!(ember.roles["page"], "#1a1210");
    assert_eq!(ember.roles["ink"], "#c9b8a8");
    assert_eq!(ember.roles["pane-title"], "#e0a070");
    // A palette entry named like a role is only a name: `quote` stays Mocha's.
    assert_eq!(ember.palette["quote"], "#5a4a40");
    for role in ROLES {
        if !["page", "ink", "needs-you", "pane-title"].contains(role) {
            assert_eq!(ember.roles[*role], mocha.roles[*role], "{role}");
        }
    }
    assert!(file(&read, "ember.toml").is_listed);
    // The user's themes follow the shipped ones of their mode.
    let dark: Vec<_> = read
        .themes
        .iter()
        .filter(|theme| theme.mode == "dark")
        .collect();
    assert_eq!(dark.last().map(|theme| theme.id.as_str()), Some("ember"));
}

#[test]
fn an_inherited_role_resolves_against_the_childs_palette() {
    let dir = tempdir();
    let read = themes::read(dir.path());
    let mocha = theme(&read, DEFAULT_DARK).unwrap();
    let name = mocha.sources["ink"].clone();
    let text = format!("mode = \"dark\"\n[palette]\n{name} = \"#abcdef\"\n");
    write(dir.path(), &[("night.toml", text.as_bytes())]);
    let read = themes::read(dir.path());
    let night = theme(&read, "night").expect("night listed");
    assert_eq!(night.roles["ink"], "#abcdef");
    assert_eq!(night.name, "night", "the id when no name");
}

#[test]
fn a_role_under_the_floor_is_applied_and_named() {
    let dir = tempdir();
    // #929292 on white is 3.11:1.
    let dusk = "mode = \"light\"\n[roles]\npage = \"#ffffff\"\nink-faint = \"#929292\"\n";
    write(dir.path(), &[("dusk.toml", dusk.as_bytes())]);
    let read = themes::read(dir.path());
    let theme = theme(&read, "dusk").expect("dusk listed");
    assert_eq!(theme.roles["ink-faint"], "#929292");
    let row = file(&read, "dusk.toml");
    let warning = row
        .problems
        .iter()
        .find(|problem| problem.message == "ink-faint is 3.1:1 on page, under 4.5.")
        .unwrap_or_else(|| panic!("{:?}", row.problems));
    assert!(warning.is_warning);
}

/// A row of the problems table: its files, the file whose row is checked, whether it is listed,
/// and the message and line of one of its problems.
struct Row {
    files: &'static [(&'static str, &'static [u8])],
    file: &'static str,
    listed: bool,
    message: Message,
    line: Option<u32>,
}

enum Message {
    Exactly(&'static str),
    StartsWith(&'static str),
}

const NOT_TOML: &[u8] = b"mode = \"dark\"\n\n[palette]\nroles = [\n";
const MISSING: &[u8] = b"name = \"Broken\"\nmode = \"dark\"\nextends = \"catppuccin-mocha\"\n\n[palette]\nember = \"#ff7a45\"\n\n[roles]\nneeds-you = \"embr\"\n";

/// The table: problems of reading a file, then of resolving it.
fn rows() -> Vec<(&'static str, Row)> {
    let mut rows = file_rows();
    rows.extend(resolve_rows());
    rows.extend(name_rows());
    rows
}

/// Problems of a file's text.
fn file_rows() -> Vec<(&'static str, Row)> {
    vec![
        (
            "not TOML",
            Row {
                files: &[("bad.toml", NOT_TOML)],
                file: "bad.toml",
                listed: false,
                message: Message::StartsWith("Could not read: line 4: "),
                line: Some(4),
            },
        ),
        (
            "missing palette entry",
            Row {
                files: &[("broken.toml", MISSING)],
                file: "broken.toml",
                listed: true,
                message: Message::Exactly(
                    "Line 9: needs-you names \"embr\", which is not in the palette.",
                ),
                line: Some(9),
            },
        ),
        (
            "bad colour",
            Row {
                files: &[("bad.toml", b"mode = \"dark\"\n[roles]\nink = \"#12345\"\n")],
                file: "bad.toml",
                listed: true,
                message: Message::Exactly(
                    "Line 3: ink is \"#12345\", which is not a colour: write #rrggbb or #rrggbbaa.",
                ),
                line: Some(3),
            },
        ),
    ]
}

/// Problems of a file among the others: `extends` and modes.
fn resolve_rows() -> Vec<(&'static str, Row)> {
    vec![
        (
            "unknown extends",
            Row {
                files: &[("x-child.toml", b"extends = \"x\"\nmode = \"dark\"\n")],
                file: "x-child.toml",
                listed: true,
                message: Message::Exactly("extends \"x\", which no theme is called."),
                line: Some(1),
            },
        ),
        (
            "loop",
            Row {
                files: &[
                    ("a.toml", b"mode = \"dark\"\nextends = \"b\"\n"),
                    ("b.toml", b"mode = \"dark\"\nextends = \"a\"\n"),
                ],
                file: "a.toml",
                listed: false,
                message: Message::Exactly("extends forms a loop: a \u{2192} b \u{2192} a."),
                line: Some(2),
            },
        ),
        (
            "other mode",
            Row {
                files: &[(
                    "day.toml",
                    b"mode = \"light\"\nextends = \"catppuccin-mocha\"\n",
                )],
                file: "day.toml",
                listed: false,
                message: Message::Exactly(
                    "extends \"catppuccin-mocha\", a dark theme, while this one is light.",
                ),
                line: Some(2),
            },
        ),
        (
            "no mode",
            Row {
                files: &[("plain.toml", b"[roles]\nink = \"#ffffff\"\n")],
                file: "plain.toml",
                listed: false,
                message: Message::Exactly("Give it mode = \"dark\" or \"light\"."),
                line: None,
            },
        ),
    ]
}

/// Problems of a file's name, its keys, and its contrast.
fn name_rows() -> Vec<(&'static str, Row)> {
    vec![
        (
            "shipped name",
            Row {
                files: &[("catppuccin-mocha.toml", b"mode = \"dark\"\n")],
                file: "catppuccin-mocha.toml",
                listed: false,
                message: Message::Exactly(
                    "A shipped theme is called catppuccin-mocha: rename the file.",
                ),
                line: None,
            },
        ),
        (
            "shipped name in another case",
            Row {
                files: &[("Catppuccin-Mocha.toml", b"mode = \"dark\"\n")],
                file: "Catppuccin-Mocha.toml",
                listed: false,
                message: Message::Exactly(
                    "A shipped theme is called catppuccin-mocha: rename the file.",
                ),
                line: None,
            },
        ),
        (
            "unknown role",
            Row {
                files: &[(
                    "typo.toml",
                    b"mode = \"dark\"\n[roles]\ninkk = \"#ffffff\"\n",
                )],
                file: "typo.toml",
                listed: true,
                message: Message::Exactly("Line 3: inkk is not a role, and is ignored."),
                line: Some(3),
            },
        ),
        (
            "bad mode",
            Row {
                files: &[("dim.toml", b"name = \"Dim\"\nmode = \"dim\"\n")],
                file: "dim.toml",
                listed: false,
                message: Message::Exactly("Line 2: mode is \"dim\": write \"dark\" or \"light\"."),
                line: Some(2),
            },
        ),
        (
            "not UTF-8",
            Row {
                files: &[("raw.toml", b"\xff\xfe")],
                file: "raw.toml",
                listed: false,
                message: Message::StartsWith("Could not read: "),
                line: None,
            },
        ),
        (
            "alpha measured over the page",
            Row {
                files: &[(
                    "veil.toml",
                    b"mode = \"light\"\n[roles]\npage = \"#ffffff\"\nink-faint = \"#00000040\"\n",
                )],
                file: "veil.toml",
                listed: true,
                // #000000 at 25% over white is #bfbfbf, 1.8:1; read as opaque it would pass.
                message: Message::Exactly("ink-faint is 1.8:1 on page, under 4.5."),
                line: Some(4),
            },
        ),
    ]
}

#[test]
fn every_problem_is_one_row() {
    for (name, row) in rows() {
        let dir = tempdir();
        write(dir.path(), row.files);
        let read = themes::read(dir.path());
        assert_shipped_listed(&read);
        let found = file(&read, row.file);
        assert_eq!(found.is_listed, row.listed, "{name}: {:?}", found.problems);
        let id = row.file.trim_end_matches(".toml");
        let yours = read
            .themes
            .iter()
            .any(|theme| theme.id == id && !theme.is_shipped);
        assert_eq!(yours, row.listed, "{name}: in the lists");
        let problem = found
            .problems
            .iter()
            .find(|problem| match row.message {
                Message::Exactly(text) => problem.message == text,
                Message::StartsWith(text) => problem.message.starts_with(text),
            })
            .unwrap_or_else(|| panic!("{name}: {:?}", found.problems));
        assert_eq!(problem.line, row.line, "{name}: {}", problem.message);
    }
}

#[test]
fn a_role_naming_a_missing_entry_keeps_the_extended_colour() {
    let dir = tempdir();
    write(dir.path(), &[("broken.toml", MISSING)]);
    let read = themes::read(dir.path());
    let broken = theme(&read, "broken").unwrap();
    let mocha = theme(&read, DEFAULT_DARK).unwrap();
    assert_eq!(broken.roles["needs-you"], mocha.roles["needs-you"]);
}

#[test]
fn both_themes_of_a_loop_leave_the_lists() {
    let dir = tempdir();
    write(
        dir.path(),
        &[
            ("a.toml", b"mode = \"dark\"\nextends = \"b\"\n"),
            ("b.toml", b"mode = \"dark\"\nextends = \"a\"\n"),
        ],
    );
    let read = themes::read(dir.path());
    let b = file(&read, "b.toml");
    assert!(!b.is_listed);
    assert!(
        b.problems
            .iter()
            .any(|problem| problem.message == "extends forms a loop: b \u{2192} a \u{2192} b.")
    );
}

#[test]
fn what_is_not_a_theme_file_has_no_row() {
    let dir = tempdir();
    write(
        dir.path(),
        &[
            (".ember.toml.swp", b"junk"),
            ("ember.toml~", b"junk"),
            ("notes.txt", b"junk"),
        ],
    );
    fs::create_dir(themes::themes_dir(dir.path()).join("x.toml")).unwrap();
    let read = themes::read(dir.path());
    assert!(read.files.is_empty(), "{:?}", read.files);
    assert_shipped_listed(&read);
}

#[test]
fn a_symlinked_theme_file_is_read() {
    let dir = tempdir();
    let elsewhere = dir.path().join("ember-source.toml");
    fs::write(&elsewhere, EMBER).unwrap();
    write(dir.path(), &[]);
    std::os::unix::fs::symlink(
        &elsewhere,
        themes::themes_dir(dir.path()).join("ember.toml"),
    )
    .unwrap();
    let read = themes::read(dir.path());
    assert!(theme(&read, "ember").is_some());
}

#[test]
fn files_sort_by_name_and_themes_by_mode_then_name() {
    let dir = tempdir();
    write(
        dir.path(),
        &[
            ("zeta.toml", b"name = \"Alpha\"\nmode = \"dark\"\n"),
            ("alpha.toml", b"name = \"Zeta\"\nmode = \"dark\"\n"),
            ("light.toml", b"name = \"Aaa\"\nmode = \"light\"\n"),
        ],
    );
    let read = themes::read(dir.path());
    let files: Vec<_> = read.files.iter().map(|file| file.file.as_str()).collect();
    assert_eq!(files, ["alpha.toml", "light.toml", "zeta.toml"]);
    let ids: Vec<_> = read.themes.iter().map(|theme| theme.id.as_str()).collect();
    assert_eq!(ids, [DEFAULT_DARK, "zeta", "alpha", DEFAULT_LIGHT, "light"]);
}

#[test]
fn extends_finds_a_theme_in_any_case_an_exact_match_first() {
    let dir = tempdir();
    write(
        dir.path(),
        &[
            ("upper.toml", b"extends = \"Catppuccin-Mocha\"\n"),
            ("Night.toml", b"mode = \"light\"\n"),
            ("night.toml", b"mode = \"dark\"\n"),
            ("exact.toml", b"extends = \"Night\"\n"),
        ],
    );
    let read = themes::read(dir.path());
    let upper = file(&read, "upper.toml");
    assert!(upper.problems.is_empty(), "{:?}", upper.problems);
    let mocha = theme(&read, DEFAULT_DARK).unwrap();
    assert_eq!(theme(&read, "upper").unwrap().roles, mocha.roles);
    // `Night` and `night` differ only in case: `exact` extends the one it names exactly.
    assert_eq!(
        theme(&read, "exact").map(|t| t.mode.as_str()),
        Some("light")
    );
}
