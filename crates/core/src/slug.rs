//! Slugs for folder and file names, from a line of text.

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
