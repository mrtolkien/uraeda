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
    /// The version of the text drawn, which every write sends back.
    pub version: &'a str,
    pub draw: &'a dyn Fn(&str) -> String,
}

/// What the views' page shows.
pub struct Views<'a> {
    pub text: &'a str,
    /// The feature's name, as the human reads it.
    pub name: &'a str,
    pub waiting: bool,
    pub draw: &'a dyn Fn(&str) -> String,
}

/// The `<main>` of the views' page: the file drawn, its story links live, and nothing to write.
/// The human comments in the project's own preview or in the session, so the page holds no comment
/// box and no verdict.
pub fn views(page: &Views<'_>) -> String {
    let drawn = (page.draw)(page.text);
    let mut out = String::with_capacity(page.text.len() * 3);
    let _ = write!(
        out,
        "<main class=\"views\" data-waiting=\"{waiting}\">\
         <nav class=\"crumbs\"><a href=\"../../../\">‹ What waits on you</a></nav>\
         <p class=\"badge{quiet}\">Views {state}</p><h1>{name}</h1>",
        quiet = if page.waiting { "" } else { " quiet" },
        state = if page.waiting { "to look at" } else { "agreed" },
        waiting = page.waiting,
        name = escape(page.name),
    );
    if page.waiting {
        out.push_str(
            "<p class=\"hint small\">Look at each view, then tell your agent your comments in \
             its session, all in one pass.</p>",
        );
    }
    let _ = write!(out, "<article class=\"doc\">{drawn}</article></main>");
    outline(&mut out, &drawn, None);
    out
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
         <p class=\"badge{quiet}\">{title} {state}</p><h1>{name}</h1>",
        quiet = if page.waiting { "" } else { " quiet" },
        state = if page.waiting {
            "to review"
        } else {
            "reviewed"
        },
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
    let drawn = (page.draw)(page.text);
    let _ = write!(out, "<article class=\"doc\">{drawn}</article>");
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
    let data = json!({
        "comments": comments_json(page.comments),
        "changed": changed,
        "version": page.version,
    });
    let _ = write!(
        out,
        "<script type=\"application/json\" id=\"review-data\">{}</script></main>",
        data.to_string().replace("</", "<\\/")
    );
    outline(&mut out, &drawn, Some(page.waiting));
    if page.waiting {
        out.push_str(
            "<div class=\"bar\" role=\"region\" aria-label=\"Review\"><span class=\"progress\">\
             <b class=\"count\">0</b> comments</span><a class=\"button primary finish\" \
             href=\"#verdict\">Finish the review</a></div>",
        );
    }
    out
}

/// The outline beside the page at a desk: the file's `##` and `###` headings, then, for a review,
/// the comments and the verdict. `review` is whether the review still waits, `None` for a page that
/// takes no comments.
fn outline(out: &mut String, drawn: &str, review: Option<bool>) {
    out.push_str("<aside class=\"outline\" aria-label=\"Contents\"><p class=\"outline-title\">Contents</p><ul>");
    for (level, id, text) in headings(drawn) {
        let _ = write!(
            out,
            "<li class=\"level-{level}\"><a href=\"#{id}\">{text}</a></li>"
        );
    }
    out.push_str("</ul>");
    if let Some(waiting) = review {
        out.push_str("<ul><li><a href=\"#comments\">Your comments</a></li>");
        if waiting {
            out.push_str("<li><a href=\"#verdict\">Your verdict</a></li>");
        }
        out.push_str("</ul>");
    }
    out.push_str("</aside>");
}

/// The `<h2>` and `<h3>` of drawn HTML: their level, their `id`, and their text without its tags,
/// still escaped.
fn headings(drawn: &str) -> Vec<(u8, &str, String)> {
    let mut found = Vec::new();
    let mut rest = drawn;
    while let Some(at) = rest.find("<h") {
        rest = &rest[at + 2..];
        let level = match rest.as_bytes().first() {
            Some(b'2') => 2,
            Some(b'3') => 3,
            _ => continue,
        };
        let Some(close) = rest.find('>') else { break };
        let tag = &rest[..close];
        let Some(end) = rest.find("</h") else { break };
        let id = tag
            .split_once("id=\"")
            .and_then(|(_, after)| after.split_once('"'))
            .map(|(id, _)| id);
        if let Some(id) = id
            && close < end
        {
            found.push((level, id, without_tags(&rest[close + 1..end])));
        }
        rest = &rest[end..];
    }
    found
}

/// HTML without its tags.
fn without_tags(html: &str) -> String {
    let mut out = String::with_capacity(html.len());
    let mut inside = false;
    for c in html.chars() {
        match c {
            '<' => inside = true,
            '>' => inside = false,
            c if !inside => out.push(c),
            _ => {}
        }
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
