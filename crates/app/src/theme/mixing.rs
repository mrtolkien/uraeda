//! What the design language mixes from a theme's roles, and the pairs its contrast floors are
//! measured on. This is the one home of each rule: the tokens read [`mixed`] through
//! `uraeda/native`, and the test of the shipped themes reads [`floors`].

use std::collections::BTreeMap;

use nsh_core::prelude::JsObject;

use super::colour::{self, fade, mix, over, solid};

/// The floor of text, and of lines and marks, as the UI look decision sets them.
pub const TEXT_FLOOR: f64 = 4.5;
pub const LINE_FLOOR: f64 = 3.0;

/// A theme's roles, each `#rrggbb` or `#rrggbbaa`, by the names its file gives them.
pub type Roles = BTreeMap<String, String>;

/// Whether `mode`, a theme's, is the dark one: glow needs darkness, and a light theme draws ink.
pub fn is_dark(mode: &str) -> bool {
    mode != "light"
}

/// The colour of `role`.
fn role<'a>(roles: &'a Roles, name: &str) -> Result<&'a str, String> {
    let colour = roles.get(name).map(String::as_str);
    colour.ok_or_else(|| format!("The theme has no role {name}."))
}

/// A mix that cannot be made says which colour it could not read.
fn mixed_of<T>(colour: Option<T>, of: &str) -> Result<T, String> {
    colour.ok_or_else(|| format!("{of} is not a colour."))
}

/// How glass tints what is behind it: the tint's share over a page far from it, and what it gains
/// over one near it, bright in a dark theme and dark in a light one.
struct Tint {
    strength: f64,
    thicken: f64,
    saturate: f64,
    brightness: f64,
}

const fn tint(dark: bool) -> Tint {
    if dark {
        Tint {
            strength: 0.62,
            thicken: 0.3,
            saturate: 1.8,
            brightness: 0.92,
        }
    } else {
        Tint {
            strength: 0.72,
            thicken: 0.2,
            saturate: 1.5,
            brightness: 1.0,
        }
    }
}

/// The most of the key's colour its block takes: at rest, under the pointer, and pressed. The
/// block is the key's colour over the backdrop in a dark theme, and over white in a light one.
const fn key_shares(dark: bool) -> [f64; 3] {
    if dark {
        [0.2, 0.32, 0.08]
    } else {
        [0.1, 0.18, 0.04]
    }
}

/// How much a well darkens what it is cut in, when that is a well or glass.
const fn deeper(dark: bool) -> f64 {
    if dark { 0.24 } else { 0.05 }
}

/// A key's block: `share` of the key's colour over `under`, less by a hundredth at a time until
/// the letter, in the key's colour, reaches the floor of text on it.
fn key_block(key: &str, under: &str, share: f64) -> Result<String, String> {
    let mut share = share;
    loop {
        let block = mixed_of(mix(key, under, share), "action")?;
        let reads = colour::contrast(key, &block).is_some_and(|ratio| ratio >= TEXT_FLOOR);
        if reads || share <= 0.0 {
            return Ok(block);
        }
        share = (share - 0.01).max(0.0);
    }
}

/// What the tokens take ready mixed: every colour and share the contrast floors are measured on.
#[derive(Clone, Debug, PartialEq, JsObject)]
pub struct Mixed {
    /// The colour shade is made of: black in a dark theme, the theme's dark ink in a light one.
    pub black: String,
    /// A well cut in a well or in glass: `black`, at the share that darkens it.
    pub deeper: String,
    /// What glass is tinted with.
    pub glass_tint: String,
    /// The tint's share over a page far from it.
    pub glass_strength: f64,
    /// What the tint gains over a page near it.
    pub glass_thicken: f64,
    /// How much colour what is behind glass keeps: 1 is all of it.
    pub glass_saturate: f64,
    /// How bright what is behind glass stays: 1 is all of it.
    pub glass_brightness: f64,
    /// A key's block at rest.
    pub key_fill: String,
    /// A key's block under the pointer.
    pub key_hot: String,
    /// A key's block pressed.
    pub key_pressed: String,
}

/// Everything mixed from `roles` in `mode`.
pub fn mixed(roles: &Roles, mode: &str) -> Result<Mixed, String> {
    let dark = is_dark(mode);
    let black = mixed_of(solid(role(roles, "shade")?), "shade")?;
    let glass = tint(dark);
    let under = if dark {
        role(roles, "backdrop")?
    } else {
        "#ffffff"
    };
    let action = role(roles, "action")?;
    let key = |share: f64| key_block(action, under, share);
    let [rest, hot, pressed] = key_shares(dark);
    Ok(Mixed {
        deeper: mixed_of(fade(&black, deeper(dark)), "shade")?,
        black,
        glass_tint: mixed_of(solid(role(roles, "glass-tint")?), "glass-tint")?,
        glass_strength: glass.strength,
        glass_thicken: glass.thicken,
        glass_saturate: glass.saturate,
        glass_brightness: glass.brightness,
        key_fill: key(rest)?,
        key_hot: key(hot)?,
        key_pressed: key(pressed)?,
    })
}

/// `x` between `low` and `high`, eased, as the shader's `smoothstep`.
fn smoothstep(low: f64, high: f64, x: f64) -> f64 {
    let t = ((x - low) / (high - low)).clamp(0.0, 1.0);
    t * t * 2.0f64.mul_add(-t, 3.0)
}

/// Glass over a flat `behind`, as the shader tints it: what is behind keeps its colour and loses
/// some brightness, and the tint thickens where that is far from it. The light inside the glass,
/// its sheen and its grain, is not counted: it is drawn where no text sits.
pub fn glass_over(roles: &Roles, mode: &str, behind: &str) -> Result<String, String> {
    const LUMA: [f64; 3] = [0.2126, 0.7152, 0.0722];
    let dark = is_dark(mode);
    let glass = tint(dark);
    let [r, g, b, _] = mixed_of(colour::parse(behind), behind)?;
    let luma_of = |rgb: [f64; 3]| {
        LUMA.iter()
            .zip(rgb)
            .map(|(share, c)| share * c)
            .sum::<f64>()
    };
    let grey = luma_of([r, g, b]);
    let kept = [r, g, b].map(|channel| {
        let vivid = (channel - grey).mul_add(glass.saturate, grey);
        (vivid * glass.brightness).clamp(0.0, 255.0)
    });
    let luma = luma_of(kept) / 255.0;
    let far = if dark { luma } else { 1.0 - luma };
    let strength = glass
        .thicken
        .mul_add(smoothstep(0.04, 0.5, far), glass.strength)
        .clamp(0.0, 1.0);
    let tint = role(roles, "glass-tint")?;
    mixed_of(
        mix(
            tint,
            &colour::hex([kept[0], kept[1], kept[2], 1.0]),
            strength,
        ),
        "glass-tint",
    )
}

/// The roles a bar, an overlay, or a field cut in one holds as text: what is read at a glance, and
/// what can be pressed. Long prose never sits on glass, and a pane is never glass, so the roles of
/// prose and of panes are not measured there.
pub const HELD: &[&str] = &[
    "ink",
    "ink-quiet",
    "ink-faint",
    "action",
    "needs-you",
    "added",
    "removed",
    "caution",
    "context",
    "link",
];

/// The busiest page glass sits over, as its frost returns it: half the theme's ink, over its page.
/// No page of text is that dense, and the tint thickens against anything brighter.
fn busiest(roles: &Roles) -> Result<String, String> {
    mixed_of(mix(role(roles, "ink")?, role(roles, "page")?, 0.5), "ink")
}

/// A fill text sits on: the height it is the ground of, what it is, and its colour, opaque.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Ground {
    /// `recessed`, `standard`, `raised`, or `overlay`.
    pub height: &'static str,
    /// What it is, as a failure names it: `a well in glass`.
    pub name: &'static str,
    /// `#rrggbb`.
    pub colour: String,
    /// Whether it is one of a theme's own fills, which any text and any line may sit on. The
    /// others are mixed, glass and what is cut in it, and hold only [`HELD`].
    pub fill: bool,
}

/// Every ground text sits on, at each height, in `mode`.
pub fn grounds(roles: &Roles, mode: &str) -> Result<Vec<Ground>, String> {
    let page = mixed_of(solid(role(roles, "page")?), "page")?;
    let lay = |name: &str| mixed_of(over(role(roles, name)?, &page), name);
    let glass = glass_over(roles, mode, &busiest(roles)?)?;
    let deeper = mixed(roles, mode)?.deeper;
    let sunk = |under: &str| mixed_of(over(&deeper, under), "shade");
    let well = lay("well")?;
    let ground = |height, name, colour, fill| Ground {
        height,
        name,
        colour,
        fill,
    };
    Ok(vec![
        ground("recessed", "a well in a well", sunk(&well)?, false),
        ground("recessed", "a well in glass", sunk(&glass)?, false),
        ground("recessed", "a well", well, true),
        ground("standard", "a pane", page.clone(), true),
        ground("raised", "a card", lay("raised")?, true),
        ground("raised", "a bar of glass", glass.clone(), false),
        ground("overlay", "glass", glass, false),
    ])
}

/// A pair the floors are measured on: what is in front, what is behind, and the ratio it needs.
#[derive(Clone, Debug, PartialEq)]
pub struct Floor {
    /// What is in front, as a failure names it: `ink-faint`.
    pub front: String,
    /// `#rrggbb` or `#rrggbbaa`.
    pub front_colour: String,
    /// What is behind, as a failure names it: `glass, at overlay`.
    pub back: String,
    /// `#rrggbb`.
    pub back_colour: String,
    /// 4.5 for text, 3 for a line.
    pub floor: f64,
}

/// Every pair of `roles` the design language draws, in `mode`: each of `text`, the roles read as
/// text, at 4.5:1 on each fill, and those of [`HELD`] on each mixed ground; each of `lines`, the
/// roles drawn as lines and marks, at 3:1 on each fill; a key's letter on its block; and the text on a filled action.
pub fn floors(
    roles: &Roles,
    mode: &str,
    text: &[&str],
    lines: &[&str],
) -> Result<Vec<Floor>, String> {
    let mut floors = Vec::new();
    let mut pair = |front: &str, colour: &str, back: String, behind: &str, floor: f64| {
        floors.push(Floor {
            front: front.to_owned(),
            front_colour: colour.to_owned(),
            back,
            back_colour: behind.to_owned(),
            floor,
        });
    };
    for ground in grounds(roles, mode)? {
        let back = format!("{}, at {}", ground.name, ground.height);
        for name in text
            .iter()
            .filter(|name| ground.fill || HELD.contains(name))
        {
            pair(
                name,
                role(roles, name)?,
                back.clone(),
                &ground.colour,
                TEXT_FLOOR,
            );
        }
        for name in lines.iter().filter(|_| ground.fill) {
            pair(
                name,
                role(roles, name)?,
                back.clone(),
                &ground.colour,
                LINE_FLOOR,
            );
        }
    }
    let mixed = mixed(roles, mode)?;
    let action = role(roles, "action")?;
    pair(
        "a key's letter",
        action,
        "its block".to_owned(),
        &mixed.key_fill,
        TEXT_FLOOR,
    );
    let hot = "its block under the pointer".to_owned();
    pair("a key's letter", action, hot, &mixed.key_hot, TEXT_FLOOR);
    let on_action = role(roles, "on-action")?;
    for fill in [
        "action",
        "mode-normal",
        "mode-insert",
        "mode-visual",
        "mode-replace",
    ] {
        pair(
            "on-action",
            on_action,
            fill.to_owned(),
            role(roles, fill)?,
            TEXT_FLOOR,
        );
    }
    Ok(floors)
}
