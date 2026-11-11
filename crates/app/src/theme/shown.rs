//! A theme's roles as Native Shell's own tokens, shadcn's: what its classes, its text views, its
//! editors, and the system's menus are drawn with. The library's components read the tokens of
//! `app/ui/tokens/` instead.

use super::mixing::Roles;

/// Each of Native Shell's colour tokens, and the role it takes.
const TOKENS: &[(&str, &str)] = &[
    ("background", "page"),
    ("foreground", "ink"),
    ("card", "raised"),
    ("card-foreground", "ink"),
    ("popover", "raised"),
    ("popover-foreground", "ink"),
    ("primary", "action"),
    ("primary-foreground", "on-action"),
    ("secondary", "raised"),
    ("secondary-foreground", "ink"),
    ("muted", "well"),
    ("muted-foreground", "ink-quiet"),
    ("accent", "cursor-row"),
    ("accent-foreground", "ink"),
    ("destructive", "removed"),
    ("border", "rule"),
    ("input", "rule"),
    ("ring", "light-focus"),
    ("chart-1", "action"),
    ("chart-2", "context"),
    ("chart-3", "added"),
    ("chart-4", "caution"),
    ("chart-5", "removed"),
    ("sidebar", "page"),
    ("sidebar-foreground", "ink"),
    ("sidebar-primary", "action"),
    ("sidebar-primary-foreground", "on-action"),
    ("sidebar-accent", "cursor-row"),
    ("sidebar-accent-foreground", "ink"),
    ("sidebar-border", "rule"),
    ("sidebar-ring", "light-focus"),
];

/// The theme file Native Shell reads, shadcn's `cssVars`, of `roles`: the same colours in both
/// appearances, since a theme has one mode, square corners, and the two fonts.
pub fn theme_file(roles: &Roles, sans: &str, mono: &str) -> Result<String, String> {
    let mut vars = serde_json::Map::new();
    for (token, role) in TOKENS {
        let colour = roles.get(*role);
        let colour = colour.ok_or_else(|| format!("The theme has no role {role}."))?;
        vars.insert((*token).to_owned(), colour.as_str().into());
    }
    vars.insert("radius".to_owned(), "0px".into());
    vars.insert("font-sans".to_owned(), sans.into());
    vars.insert("font-mono".to_owned(), mono.into());
    Ok(serde_json::json!({ "cssVars": { "theme": vars } }).to_string())
}
