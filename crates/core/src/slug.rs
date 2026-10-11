//! Slugs for folder and file names, from a line of text.

const LIMIT: usize = 50;

/// A slug: lowercase, every run of characters other than letters and digits turned into one
/// hyphen, at most 50 characters, cut on a hyphen.
pub fn from_text(text: &str) -> String {
    let mut slug = String::new();
    for c in text.to_lowercase().chars() {
        if c.is_alphanumeric() {
            slug.push(c);
        } else if !slug.ends_with('-') {
            slug.push('-');
        }
    }
    let slug = slug.trim_matches('-');
    if slug.chars().count() <= LIMIT {
        return slug.to_string();
    }
    let cut: String = slug.chars().take(LIMIT + 1).collect();
    let cut = cut.rsplit_once('-').map_or(cut.as_str(), |(head, _)| head);
    cut.trim_end_matches('-').to_string()
}
