//! The shipped themes, measured on what the design language mixes from their roles: the contrast
//! floors of the UI look decision, at each height, glass included. The core reads the themes, and
//! the app's `theme.rs` mixes them, as the tokens do.

use std::fs;

use tempfile::TempDir;
use uraeda_app::theme::colour;
use uraeda_app::theme::mixing::{self, Roles};
use uraeda_core::themes::{self, DEFAULT_DARK, DEFAULT_LIGHT, Theme, contrast};

/// The themes of a config folder holding `files` in its themes folder.
fn read(files: &[(&str, &str)]) -> themes::Themes {
    let dir = TempDir::new().expect("a temporary folder");
    let folder = themes::themes_dir(dir.path());
    fs::create_dir_all(&folder).unwrap();
    for (name, text) in files {
        fs::write(folder.join(name), text).unwrap();
    }
    themes::read(dir.path())
}

/// Each pair of `theme` under its floor, as a line: `nord: ink-faint is 4.31:1 on glass, at
/// overlay (#9aa1b0 on #3a4150), under 4.5`.
fn under_floor(theme: &Theme) -> Vec<String> {
    let roles: &Roles = &theme.roles;
    let floors = mixing::floors(roles, &theme.mode, contrast::TEXT, contrast::MARKS)
        .unwrap_or_else(|error| panic!("{}: {error}", theme.id));
    floors
        .into_iter()
        .filter_map(|pair| {
            let ratio = colour::contrast(&pair.front_colour, &pair.back_colour)?;
            (ratio < pair.floor).then(|| {
                format!(
                    "{}: {} is {ratio:.2}:1 on {} ({} on {}), under {}",
                    theme.id,
                    pair.front,
                    pair.back,
                    pair.front_colour,
                    pair.back_colour,
                    pair.floor
                )
            })
        })
        .collect()
}

#[test]
fn every_shipped_theme_meets_the_contrast_floors() {
    let read = read(&[]);
    assert!(read.themes.len() > 20, "the shipped themes are read");
    let under: Vec<String> = read.themes.iter().flat_map(under_floor).collect();
    assert!(
        under.is_empty(),
        "{} pairs under their floor:\n{}",
        under.len(),
        under.join("\n")
    );
}

/// A theme written before the design language set none of its roles: it takes each from the
/// default of its mode, and what is mixed from them is the default's.
#[test]
fn a_theme_without_the_new_roles_inherits_them() {
    let dusk = "mode = \"light\"\n[roles]\nlink = \"#000000\"\n";
    let ember = "mode = \"dark\"\n[roles]\nlink = \"#ffffff\"\n";
    let read = read(&[("dusk.toml", dusk), ("ember.toml", ember)]);
    let theme = |id: &str| read.themes.iter().find(|theme| theme.id == id).unwrap();
    for (id, default) in [("ember", DEFAULT_DARK), ("dusk", DEFAULT_LIGHT)] {
        let (own, default) = (theme(id), theme(default));
        let mixed = mixing::mixed(&own.roles, &own.mode).unwrap();
        assert_eq!(mixed, mixing::mixed(&default.roles, &default.mode).unwrap());
        assert_eq!(Some(&mixed.glass_tint), default.roles.get("glass-tint"));
        let grounds = mixing::grounds(&own.roles, &own.mode).unwrap();
        assert_eq!(
            grounds,
            mixing::grounds(&default.roles, &default.mode).unwrap()
        );
    }
}

/// A file that is no theme leaves the lists, and every other theme is mixed as before.
#[test]
fn a_broken_theme_never_blocks_the_others() {
    let ember = "mode = \"dark\"\n[roles]\nglass-tint = \"#201010\"\n";
    let broken = [
        ("ember.toml", ember),
        ("torn.toml", "mode = \"dark\"\n[roles\nglass-tint = "),
        (
            "hue.toml",
            "mode = \"dark\"\n[roles]\nglass-tint = \"warm\"\nlight-focus = 3\n",
        ),
        ("loop.toml", "extends = \"loop\"\n"),
    ];
    let (alone, read) = (read(&[("ember.toml", ember)]), read(&broken));
    let listed: Vec<&str> = read.themes.iter().map(|theme| theme.id.as_str()).collect();
    assert!(
        !listed.contains(&"torn") && !listed.contains(&"loop"),
        "{listed:?}"
    );
    for theme in &alone.themes {
        let same = read.themes.iter().find(|other| other.id == theme.id);
        assert_eq!(same, Some(theme), "{} reads as it does alone", theme.id);
    }
    // A role that is no colour keeps the colour of the theme the file extends, and is mixed.
    let hue = read.themes.iter().find(|theme| theme.id == "hue").unwrap();
    let mocha = read
        .themes
        .iter()
        .find(|theme| theme.id == DEFAULT_DARK)
        .unwrap();
    assert_eq!(hue.roles["glass-tint"], mocha.roles["glass-tint"]);
    assert_eq!(hue.roles["light-focus"], mocha.roles["light-focus"]);
    let ember = read
        .themes
        .iter()
        .find(|theme| theme.id == "ember")
        .unwrap();
    let mixed = mixing::mixed(&ember.roles, &ember.mode).unwrap();
    assert_eq!(mixed.glass_tint, "#201010");
}

/// The colours are mixed in sRGB, channel by channel, and an alpha multiplies.
#[test]
fn two_colours_mix_as_css_mixes_them() {
    use colour::{contrast, fade, mix, over};
    assert_eq!(mix("#181824", "#fab387", 0.95).as_deref(), Some("#232029"));
    assert_eq!(mix("#cba6f7", "#11111b", 0.2).as_deref(), Some("#362f47"));
    assert_eq!(
        fade("#70748b", 0.45).as_deref(),
        Some("rgba(112, 116, 139, 0.45)")
    );
    assert_eq!(
        fade("rgba(0, 0, 0, 0.5)", 0.5).as_deref(),
        Some("rgba(0, 0, 0, 0.25)")
    );
    assert_eq!(over("#00000080", "#ffffff").as_deref(), Some("#7f7f7f"));
    assert_eq!(mix("teal", "#ffffff", 0.5), None);
    // #777777 on white is 4.48:1, and a colour with alpha is laid over what is behind it.
    assert!((contrast("#777777", "#ffffff").unwrap() - 4.48).abs() < 0.005);
    assert_eq!(contrast("#00000000", "#ffffff"), Some(1.0));
}

/// The two default themes as the tokens hold them, `app/ui/tokens/defaults.json`: what the app
/// draws before the server answers, and what a role a theme lacks comes from.
fn default_themes() -> String {
    let read = read(&[]);
    let theme = |id: &str| {
        let theme = read.themes.iter().find(|theme| theme.id == id).unwrap();
        serde_json::json!({ "id": theme.id, "mode": theme.mode, "roles": theme.roles })
    };
    let themes = serde_json::json!({ "dark": theme(DEFAULT_DARK), "light": theme(DEFAULT_LIGHT) });
    format!("{}\n", serde_json::to_string_pretty(&themes).unwrap())
}

/// The tokens' copy of the default themes is the core's reading of them. After a change of a
/// default theme, `UPDATE_TOKENS=1 just test -p uraeda-app -E 'test(/^theme::/)'` writes it again.
#[test]
fn the_tokens_default_themes_are_the_ones_the_core_reads() {
    let path = concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../../app/ui/tokens/defaults.json"
    );
    let fresh = default_themes();
    if std::env::var_os("UPDATE_TOKENS").is_some() {
        fs::write(path, &fresh).unwrap();
    }
    let kept = fs::read_to_string(path).unwrap_or_default();
    assert!(
        kept == fresh,
        "app/ui/tokens/defaults.json is stale: run `UPDATE_TOKENS=1 just test -p uraeda-app -E \
         'test(/^theme::/)'`"
    );
}
