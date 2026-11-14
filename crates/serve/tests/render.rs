//! Workflow files as HTML: their lines, callouts, links, and diagrams.

use std::path::Path;
use std::time::Instant;

use uraeda_serve::render::{Links, render};

fn links() -> Links {
    Links {
        folder: "specs/2026-10-06-recurring-tasks".into(),
        base: "/t/".into(),
        key: "k".into(),
    }
}

fn html(text: &str) -> String {
    render(text, &links())
}

#[test]
fn a_paragraph_names_its_lines() {
    let out = html("One line.\n");
    assert_eq!(
        out,
        "<p data-lines=\"1-1\"><span data-line=\"1\">One line.</span></p>"
    );
}

#[test]
fn each_line_of_a_paragraph_is_a_span_of_its_own() {
    let out = html("intro\n\nfirst line\nsecond **bold\nstill bold** end\n");
    assert!(out.contains("<p data-lines=\"3-5\">"), "{out}");
    assert!(
        out.contains("<span data-line=\"3\">first line</span>\n"),
        "{out}"
    );
    // Bold runs over a line break: closed at the end of line 4, opened again on line 5.
    assert!(
        out.contains(
            "<span data-line=\"4\">second <strong>bold</strong></span>\n\
             <span data-line=\"5\"><strong>still bold</strong> end</span>"
        ),
        "{out}"
    );
}

#[test]
fn list_items_have_their_own_lines_and_hold_their_inner_items() {
    let out = html("- one\n- two\n  - inner a\n  - inner b\n- three\n");
    assert!(out.contains("<ul data-lines=\"1-5\">"), "{out}");
    assert!(out.contains("<li data-lines=\"1-1\">"), "{out}");
    assert!(out.contains("<li data-lines=\"2-4\">"), "{out}");
    assert!(
        out.contains("<li data-lines=\"3-3\"><span data-line=\"3\">inner a"),
        "{out}"
    );
    assert!(out.contains("<li data-lines=\"4-4\">"), "{out}");
    assert!(out.contains("<li data-lines=\"5-5\">"), "{out}");
    let outer = out.find("<li data-lines=\"2-4\">").unwrap();
    let inner = out.find("<li data-lines=\"3-3\">").unwrap();
    let outer_end = out[outer..].find("</ul></li>").unwrap() + outer;
    assert!(outer < inner && inner < outer_end, "{out}");
}

#[test]
fn table_rows_have_their_own_lines() {
    let out = html("Text\n\n| A | B |\n|---|--:|\n| 1 | 2 |\n| 3 | 4 |\n");
    assert!(out.contains("<table data-lines=\"3-6\">"), "{out}");
    assert!(out.contains("<thead><tr data-lines=\"3-3\"><th>"), "{out}");
    assert!(out.contains("<tr data-lines=\"5-5\">"), "{out}");
    assert!(out.contains("<tr data-lines=\"6-6\">"), "{out}");
    assert!(
        out.contains("<td style=\"text-align:right\"><span data-line=\"6\">4</span></td>"),
        "{out}"
    );
}

#[test]
fn lines_count_the_frontmatter_which_is_not_drawn() {
    let out = html("---\nstatus: draft\nid: x\n---\n\n# Title\n\nText.\n");
    assert!(!out.contains("status"), "{out}");
    assert!(
        out.starts_with(
            "<h1 id=\"title\" data-lines=\"6-6\"><span data-line=\"6\">Title</span></h1>"
        ),
        "{out}"
    );
    assert!(out.contains("<p data-lines=\"8-8\">"), "{out}");
}

#[test]
fn headings_have_ids_numbered_when_repeated() {
    let out = html("## The *same* `one`\n\n## The same one\n\n## Q&A: why?\n");
    assert!(out.contains("<h2 id=\"the-same-one\""), "{out}");
    assert!(out.contains("<h2 id=\"the-same-one-1\""), "{out}");
    assert!(out.contains("<h2 id=\"qa-why\""), "{out}");
}

#[test]
fn callouts_are_framed_and_quotes_stay_quotes() {
    let out = html("> [!IMPORTANT]\n> Answer these.\n\n> [!CAUTION]\n> Careful.\n\n> A quote.\n");
    assert!(
        out.contains(
            "<aside class=\"callout callout-important\" data-lines=\"1-2\">\
             <p class=\"callout-title\">Important</p><p data-lines=\"2-2\">"
        ),
        "{out}"
    );
    assert!(
        out.contains("<aside class=\"callout callout-caution\" data-lines=\"4-5\">"),
        "{out}"
    );
    assert!(out.contains("<blockquote data-lines=\"7-7\">"), "{out}");
    for kind in ["NOTE", "TIP", "WARNING"] {
        let out = html(&format!("> [!{kind}]\n> x\n"));
        let class = format!("callout-{}", kind.to_lowercase());
        assert!(out.contains(&class), "{out}");
    }
}

#[test]
fn raw_html_is_text_and_comments_are_left_out() {
    let out = html(
        "<script>alert(1)</script>\n\nA <b onclick=\"x\">tag</b>.\n\n<!-- a note\nfor agents -->\n\nEnd.\n",
    );
    assert!(!out.contains("<script"), "{out}");
    assert!(!out.contains("<b "), "{out}");
    assert!(
        out.contains("&lt;script&gt;alert(1)&lt;/script&gt;"),
        "{out}"
    );
    assert!(out.contains("&lt;b onclick=&quot;x&quot;&gt;"), "{out}");
    assert!(!out.contains("for agents"), "{out}");
    assert!(out.contains("End."), "{out}");
}

#[test]
fn each_kind_of_link_is_rewritten() {
    let out = html(concat!(
        "[spec](spec.md#scope) [other](../2026-11-01-x/plan.md) ",
        "[root](/specs/decisions/stack.md) [mock](mockups/list.html) ",
        "[site](https://example.com/a?b=1) [up](../../../../etc/passwd) ",
        "[js](javascript:alert(1)) [here](#tasks)\n\n",
        "![shot](images/a%20b.webp \"A shot\") ![far *away*](../../../../x.png)\n",
    ));
    let expected = [
        "<a href=\"/t/file/specs/2026-10-06-recurring-tasks/spec.md#scope\">spec</a>",
        "<a href=\"/t/file/specs/2026-11-01-x/plan.md\">other</a>",
        "<a href=\"/t/file/specs/decisions/stack.md\">root</a>",
        "<a href=\"/t/raw/k/specs/2026-10-06-recurring-tasks/mockups/list.html\">mock</a>",
        "<a href=\"https://example.com/a?b=1\" rel=\"noreferrer noopener\" target=\"_blank\">site</a>",
        "<a href=\"#tasks\">here</a>",
        "<img src=\"/t/raw/k/specs/2026-10-06-recurring-tasks/images/a%20b.webp\" loading=\"lazy\" data-lines=\"3-3\" title=\"A shot\" alt=\"shot\">",
    ];
    for link in expected {
        assert!(out.contains(link), "{link}\n{out}");
    }
    assert!(out.contains(" up "), "{out}");
    assert!(out.contains(" far away</span>"), "{out}");
    assert!(!out.contains("x.png"), "{out}");
    assert!(!out.contains("passwd"), "{out}");
    assert!(!out.contains("javascript"), "{out}");
}

#[test]
fn task_lists_code_strikethrough_and_footnotes() {
    let out = html(
        "- [ ] open\n- [x] done\n\n```rust\nfn x() -> &'a <T> {}\n```\n\n~~gone~~ note[^a]\n\n[^a]: The note.\n",
    );
    assert!(
        out.contains("<li class=\"task\" data-lines=\"1-1\"><span data-line=\"1\"><input type=\"checkbox\" disabled> open"),
        "{out}"
    );
    assert!(
        out.contains("<input type=\"checkbox\" disabled checked>"),
        "{out}"
    );
    assert!(
        out.contains("<pre data-lines=\"4-6\"><code class=\"language-rust\">fn x() -&gt; &amp;&#39;a &lt;T&gt; {}\n</code></pre>"),
        "{out}"
    );
    assert!(out.contains("<del>gone</del>"), "{out}");
    assert!(
        out.contains("<a href=\"#fn-a\" id=\"fnref-a\">1</a>"),
        "{out}"
    );
    assert!(
        out.contains("<div class=\"footnote\" id=\"fn-a\" data-lines=\"10-10\">"),
        "{out}"
    );
}

#[test]
fn a_mermaid_flowchart_is_drawn_as_svg() {
    let out = html("Text\n\n```mermaid\nflowchart LR\n  A[Proposal] --> B[Round]\n```\n");
    assert!(
        out.contains("<figure class=\"diagram\" data-lines=\"3-6\"><svg"),
        "{out}"
    );
    assert!(out.contains("Proposal"), "{out}");
    assert!(!out.to_lowercase().contains("<script"), "{out}");
    // Drawn once: the second page takes it from the cache.
    assert_eq!(
        out,
        html("Text\n\n```mermaid\nflowchart LR\n  A[Proposal] --> B[Round]\n```\n")
    );
}

#[test]
fn a_mermaid_source_that_cannot_be_drawn_is_shown_as_source() {
    let out = html("```mermaid\nflowchart LR\n  A[Proposal --> ((\n```\n");
    assert!(
        out.contains("<figure class=\"diagram diagram-failed\" data-lines=\"1-4\"><p class=\"diagram-error\">Diagram could not be drawn</p><pre><code>flowchart LR\n  A[Proposal --&gt; ((\n</code></pre></figure>"),
        "{out}"
    );
    let out = html("```mermaid\nnot a diagram at all\n```\n");
    assert!(out.contains("diagram-failed"), "{out}");
}

#[test]
fn a_diagram_never_carries_a_script_or_a_link() {
    let out = html(
        "```mermaid\nflowchart LR\n  A[\"<script>alert(1)</script>\"] --> B\n  click A call alert(1)\n  click B href \"javascript:alert(1)\"\n```\n",
    );
    let lower = out.to_lowercase();
    assert!(!lower.contains("<script"), "{out}");
    assert!(!lower.contains("javascript:alert"), "{out}");
    assert!(!lower.contains("onclick"), "{out}");
}

const EXAMPLE: &str = "../../skills/uraeda/assets/example/specs/2026-10-06-recurring-tasks";

fn example(name: &str) -> String {
    std::fs::read_to_string(Path::new(EXAMPLE).join(name)).expect("an example file")
}

#[test]
fn the_example_files_are_drawn() {
    for name in ["spec.md", "plan.md", "clarifications-01.md"] {
        let text = example(name);
        let out = html(&text);
        assert!(out.matches("data-lines=").count() > 10, "{name}: {out}");
        assert!(!out.to_lowercase().contains("<script"), "{name}");
        assert!(out.contains("<h1 id="), "{name}");
        // Every line a block names is a line of the file.
        let last = text.lines().count();
        for lines in out.split("data-lines=\"").skip(1) {
            let (start, rest) = lines.split_once('-').unwrap();
            let end = rest.split('"').next().unwrap();
            let (start, end): (usize, usize) = (start.parse().unwrap(), end.parse().unwrap());
            assert!(
                1 <= start && start <= end && end <= last,
                "{name}: {start}-{end}"
            );
        }
    }
    let out = html(&example("clarifications-01.md"));
    assert!(out.contains("<figure class=\"diagram\""), "{out}");
    assert!(out.contains("callout-note"), "{out}");
}

/// The time to draw the example spec and its clarifications, printed with `--nocapture`.
#[test]
fn drawing_the_example_is_fast() {
    for name in ["spec.md", "clarifications-01.md"] {
        let text = example(name);
        let cold = Instant::now();
        html(&text);
        let cold = cold.elapsed();
        let warm = Instant::now();
        for _ in 0..10 {
            html(&text);
        }
        let warm = warm.elapsed() / 10;
        println!("{name}: {} bytes, cold {cold:?}, warm {warm:?}", text.len());
    }
}
