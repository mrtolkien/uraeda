//! The contrast of a theme, at the level of roles: each text role and each mark against the
//! backgrounds it is read on, as WCAG 2.x measures it. A colour with alpha is laid over its
//! background first. What is mixed from roles, glass first, is measured where it is mixed, in the
//! app's `theme.rs`.

use std::collections::BTreeMap;

/// The roles read as text, at 4.5:1 on each of [`GROUNDS`].
pub const TEXT: &[&str] = &[
    "ink",
    "ink-quiet",
    "ink-faint",
    "pane-title",
    "action",
    "needs-you",
    "changed",
    "added",
    "removed",
    "caution",
    "context",
    "yours",
    "link",
    "working",
    "live",
    "example",
    "heading-1",
    "heading-2",
    "heading-3",
    "code-inline",
    "quote",
];

/// The lines and marks, at 3:1 on each of [`GROUNDS`].
pub const MARKS: &[&str] = &["rule", "sub-agent", "marked"];

/// The fills text and lines sit on: the standard height's, the raised one's, and the recessed one's.
pub const GROUNDS: &[&str] = &["page", "raised", "well"];

/// The floor of text, and of lines and marks.
pub const TEXT_FLOOR: f64 = 4.5;
pub const MARK_FLOOR: f64 = 3.0;

/// Each pair of `roles` under its floor: the foreground role, and its warning,
/// `ink-faint is 3.1:1 on page, under 4.5.`
pub fn warnings(roles: &BTreeMap<String, String>) -> Vec<(String, String)> {
    let mut pairs: Vec<(&str, &str, f64)> = Vec::new();
    for background in GROUNDS.iter().copied() {
        pairs.extend(TEXT.iter().map(|role| (*role, background, TEXT_FLOOR)));
        pairs.extend(MARKS.iter().map(|role| (*role, background, MARK_FLOOR)));
    }
    let syntax = roles.keys().filter(|role| role.starts_with("syntax-"));
    let mut syntax: Vec<&str> = syntax.map(String::as_str).collect();
    syntax.sort_unstable();
    pairs.extend(
        syntax
            .into_iter()
            .map(|role| (role, "code-ground", TEXT_FLOOR)),
    );
    let page = roles.get("page");
    pairs
        .into_iter()
        .filter_map(|(role, background, floor)| {
            let page = page.map(String::as_str);
            let ratio = ratio(roles.get(role)?, roles.get(background)?, page)?;
            // Truncated, so a ratio just under the floor never prints as the floor.
            let shown = (ratio * 10.0).floor() / 10.0;
            (ratio < floor).then(|| {
                let warning = format!("{role} is {shown:.1}:1 on {background}, under {floor}.");
                (role.to_owned(), warning)
            })
        })
        .collect()
}

/// The contrast ratio of `front` on `back`, each `#rrggbb` or `#rrggbbaa`, from 1 to 21: `back` is
/// laid over `page` first when it has alpha, and `front` over `back`. None when one is no colour.
fn ratio(front: &str, back: &str, page: Option<&str>) -> Option<f64> {
    let under = opaque(rgba(back)?, page.and_then(rgba));
    Some(contrast(opaque(rgba(front)?, Some(under)), under))
}

/// A colour's red, green, blue, and alpha, from 0 to 1.
fn rgba(hex: &str) -> Option<[f64; 4]> {
    let hex = hex.strip_prefix('#')?;
    let channel = |at: usize| {
        let byte = u8::from_str_radix(hex.get(at..at + 2)?, 16).ok()?;
        Some(f64::from(byte) / 255.0)
    };
    let alpha = if hex.len() == 8 { channel(6)? } else { 1.0 };
    Some([channel(0)?, channel(2)?, channel(4)?, alpha])
}

/// `colour` laid over `under`, itself opaque: as it is when it has no alpha, or no `under`.
fn opaque(colour: [f64; 4], under: Option<[f64; 4]>) -> [f64; 4] {
    let [r, g, b, alpha] = colour;
    let Some([ur, ug, ub, _]) = under else {
        return [r, g, b, 1.0];
    };
    let over = |top: f64, bottom: f64| top.mul_add(alpha, bottom * (1.0 - alpha));
    [over(r, ur), over(g, ug), over(b, ub), 1.0]
}

/// A channel without its gamma.
fn linear(channel: f64) -> f64 {
    if channel <= 0.040_45 {
        channel / 12.92
    } else {
        ((channel + 0.055) / 1.055).powf(2.4)
    }
}

/// A colour's relative luminance, as WCAG counts it.
fn luminance([r, g, b, _]: [f64; 4]) -> f64 {
    0.2126f64.mul_add(linear(r), 0.7152f64.mul_add(linear(g), 0.0722 * linear(b)))
}

/// The contrast ratio of two opaque colours, from 1 to 21.
fn contrast(a: [f64; 4], b: [f64; 4]) -> f64 {
    let (a, b) = (luminance(a), luminance(b));
    (a.max(b) + 0.05) / (a.min(b) + 0.05)
}

#[cfg(test)]
mod tests {
    use super::{MARKS, TEXT};
    use crate::themes::ROLES;

    #[test]
    fn every_measured_role_is_a_role() {
        for role in TEXT.iter().chain(MARKS) {
            assert!(ROLES.contains(role), "{role} is not in ROLES");
        }
    }
}
