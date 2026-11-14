//! The review page's HTML: what changed since the last review, the file drawn with each passage
//! taking a comment, the human's comments, and the verdict.
//!
//! The script reads `#review-data`, a JSON script: `{ comments: [{ number, start, end, text }],
//! changed: [[start, end]] }`, and every drawn block's `data-lines`.

use std::fmt::Write as _;

use serde_json::{Value, json};
use uraeda_core::files::review::{Anchor, Comment};
use uraeda_core::view::SinceReview;

use crate::html::escape;

/// What the page shows.
pub struct Page<'a> {
    pub text: &'a str,
    /// The feature's name, as the human reads it.
    pub name: &'a str,
    /// `spec.md` or `plan.md`.
    pub file: &'a str,
    pub waiting: bool,
    pub since: Option<&'a SinceReview>,
    pub comments: &'a [Comment],
    pub draw: &'a dyn Fn(&str) -> String,
}

/// The comments as the script reads them.
pub fn comments_json(comments: &[Comment]) -> Value {
    Value::Array(
        comments
            .iter()
            .map(|c| {
                let (start, end) = match &c.anchor {
                    Anchor::Lines(start, end, _) => (*start, *end),
                    _ => (0, 0),
                };
                json!({ "number": c.number, "start": start, "end": end, "text": c.text })
            })
            .collect(),
    )
}

/// The `<main>` of a review's page, and its bar.
pub fn main(page: &Page<'_>) -> String {
    let what = if page.file == "spec.md" {
        "spec"
    } else {
        "plan"
    };
    let mut out = String::with_capacity(page.text.len() * 3);
    let _ = write!(
        out,
        "<main class=\"review\" data-waiting=\"{waiting}\" data-what=\"{what}\">\
         <nav class=\"crumbs\"><a href=\"../../../\">‹ What waits on you</a></nav>\
         <h1>{name}</h1><p class=\"muted subtitle\">{title} to review</p>",
        waiting = page.waiting,
        name = escape(page.name),
        title = if what == "spec" { "Spec" } else { "Plan" },
    );
    if page.waiting {
        out.push_str(
            "<p class=\"hint small\">Tap a passage to comment on it, or select words in it. \
             Your comments are saved as you write them.</p>",
        );
    }
    let mut changed: Vec<(u32, u32)> = Vec::new();
    if let Some(since) = page.since {
        since_list(&mut out, since, &mut changed);
    }
    let _ = write!(
        out,
        "<article class=\"doc\">{}</article>",
        (page.draw)(page.text)
    );
    let _ = write!(
        out,
        "<section class=\"comments\" id=\"comments\"><h2>Your comments</h2>\
         <ol class=\"comment-list\"></ol><p class=\"none muted\">No comment yet.</p>{general}\
         </section>",
        general = if page.waiting {
            format!(
                "<details class=\"general\"><summary>Comment on the whole {what}</summary>\
                 <textarea rows=\"3\" aria-label=\"Comment on the whole {what}\"></textarea>\
                 <button type=\"button\" class=\"save-general\">Save comment</button>\
                 <p class=\"saved small muted\" aria-live=\"polite\"></p></details>"
            )
        } else {
            String::new()
        },
    );
    if page.waiting {
        let _ = write!(
            out,
            "<section class=\"verdict\" id=\"verdict\"><h2>Your verdict</h2>\
             <label class=\"words\"><span class=\"small muted\">A word for the agent, optional\
             </span><textarea rows=\"2\" class=\"summary\"></textarea></label>\
             <div class=\"verdict-buttons\"><button type=\"button\" class=\"primary approve\">\
             Approve the {what}</button><button type=\"button\" class=\"request\">Request changes\
             </button></div><p class=\"saved small muted\" aria-live=\"polite\"></p></section>"
        );
    }
    let data = json!({ "comments": comments_json(page.comments), "changed": changed });
    let _ = write!(
        out,
        "<script type=\"application/json\" id=\"review-data\">{}</script></main>",
        data.to_string().replace("</", "<\\/")
    );
    if page.waiting {
        out.push_str(
            "<div class=\"bar\" role=\"region\" aria-label=\"Review\"><span class=\"progress\">\
             <b class=\"count\">0</b> comments</span><a class=\"button primary finish\" \
             href=\"#verdict\">Finish the review</a></div>",
        );
    }
    out
}

/// The list of what changed since the last review, each row a link to the part, its words with
/// the removed ones struck. Collects the changed parts' lines in `changed`.
fn since_list(out: &mut String, since: &SinceReview, changed: &mut Vec<(u32, u32)>) {
    let shown: Vec<_> = since.parts.iter().filter(|p| p.after.is_some()).collect();
    let removed = since.parts.len() - shown.len();
    if since.parts.is_empty() {
        out.push_str(
            "<p class=\"since-none small muted\">Nothing changed since your last review.</p>",
        );
        return;
    }
    let _ = write!(
        out,
        "<details class=\"since\" open><summary>Changed since your last review: {count}\
         </summary><ol>",
        count = match (shown.len(), removed) {
            (n, 0) => plural(n, "part"),
            (0, r) => format!("{} removed", plural(r, "part")),
            (n, r) => format!("{}, {} removed", plural(n, "part"), r),
        }
    );
    for part in &since.parts {
        let label = match part.kind.as_str() {
            "added" => "New",
            "removed" => "Removed",
            _ => "Changed",
        };
        let words: String = part
            .runs
            .iter()
            .map(|run| match run.kind.as_str() {
                "added" => format!("<ins>{}</ins>", escape(&run.text)),
                "removed" => format!("<del>{}</del>", escape(&run.text)),
                _ => escape(&run.text),
            })
            .collect::<Vec<_>>()
            .join(" ");
        match part.after {
            Some(lines) => {
                changed.push((lines.start, lines.end));
                let _ = write!(
                    out,
                    "<li class=\"{kind}\"><a href=\"#L{start}\" data-goto=\"{start}\">\
                     <span class=\"kind\">{label}</span> {heading}</a><p class=\"since-words\">{words}\
                     </p></li>",
                    kind = escape(&part.kind),
                    start = lines.start,
                    heading = escape(&part.heading),
                );
            }
            None => {
                let _ = write!(
                    out,
                    "<li class=\"removed\"><span class=\"kind\">{label}</span> {heading}\
                     <p class=\"since-words\">{words}</p></li>",
                    heading = escape(&part.heading),
                );
            }
        }
    }
    out.push_str("</ol></details>");
}

fn plural(n: usize, word: &str) -> String {
    if n == 1 {
        format!("1 {word}")
    } else {
        format!("{n} {word}s")
    }
}
