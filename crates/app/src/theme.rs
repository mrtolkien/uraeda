//! The theme, in Rust: how colours are mixed, what the design language mixes from a theme's
//! roles, and the theme's roles as Native Shell's tokens. The tokens of `app/ui/tokens/` read all
//! of it through `uraeda/native`, and `tests/theme.rs` measures the shipped themes on it.

pub mod colour;
pub mod mixing;
mod shown;

use nsh_core::prelude::*;

use mixing::{Mixed, Roles};

/// The colours of the theme, mixed and shown.
#[module]
pub(crate) struct Theme;

/// A theme's roles, from the JSON object the record `Themes` gives.
fn roles_of(json: &str) -> Result<Roles, String> {
    serde_json::from_str(json).map_err(|error| format!("The theme's roles are not read: {error}."))
}

#[module(flat)]
impl Theme {
    /// `share` of the colour `a`, from 0 to 1, and the rest of `b`, as `#rrggbb`: mixed in sRGB,
    /// as CSS's `color-mix` does. Each is `#rrggbb`, `#rrggbbaa`, or `rgba(r, g, b, a)`.
    pub(crate) fn mix_colours(a: String, b: String, share: f64) -> Result<String, String> {
        colour::mix(&a, &b, share).ok_or_else(|| format!("{a} or {b} is not a colour."))
    }

    /// `colour` at `opacity`, from 0 to 1, of its own, as `rgba(r, g, b, a)`.
    pub(crate) fn fade_colour(colour: String, opacity: f64) -> Result<String, String> {
        colour::fade(&colour, opacity).ok_or_else(|| format!("{colour} is not a colour."))
    }

    /// What the design language mixes from a theme's `roles`, a JSON object of each role's
    /// colour, in its `mode`, `dark` or `light`: glass's tint and its shares, a key's block, and
    /// the shade of a well.
    pub(crate) fn mix_theme(roles: String, mode: String) -> Result<Mixed, String> {
        mixing::mixed(&roles_of(&roles)?, &mode)
    }

    /// Draws what Native Shell draws itself in the theme's `roles`, a JSON object of each role's
    /// colour: its classes' colours, its own text views and editors, and the system's menus.
    /// `sans` is the font of every text that names none, and `mono` the one of code.
    pub(crate) async fn show_theme(
        roles: String,
        sans: String,
        mono: String,
    ) -> Result<(), String> {
        let theme = shown::theme_file(&roles_of(&roles)?, &sans, &mono)?;
        set_tokens(nsh_base::tokens_of(Some(&theme))?);
        Ok(())
    }
}
