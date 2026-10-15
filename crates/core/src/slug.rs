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

/// Words a short slug leaves out: they name nothing.
const FILLERS: &[&str] = &[
    "a", "an", "and", "as", "at", "be", "by", "for", "from", "in", "into", "is", "it", "its", "of",
    "on", "or", "should", "the", "to", "with",
];

/// A feature's or a change's slug, the default the human is offered: the first two words of a slug
/// that name something, or its first two words when none does.
pub fn short(slug: &str) -> String {
    let words: Vec<&str> = slug.split('-').filter(|word| !word.is_empty()).collect();
    let named: Vec<&str> = words
        .iter()
        .copied()
        .filter(|word| !FILLERS.contains(word))
        .collect();
    let kept = if named.is_empty() { &words } else { &named };
    kept.iter().take(2).copied().collect::<Vec<_>>().join("-")
}

/// The slug proposed for a change typed as a text, from its title: the short slug of its words, as
/// `ura start` proposes one from a draft's name.
pub fn propose(title: &str) -> String {
    short(&from_text(title))
}
