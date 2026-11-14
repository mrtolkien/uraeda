//! How the writer closes what it opened: a block, a heading with its id, a code block or a
//! diagram, and a footnote's number.

use std::fmt::Write as _;

use pulldown_cmark::TagEnd;

use super::*;

impl Writer<'_> {
    pub(super) fn end(&mut self, tag: TagEnd) {
        match tag {
            TagEnd::Paragraph => self.block("</p>"),
            TagEnd::Heading(_) => self.end_heading(),
            TagEnd::BlockQuote(Some(_)) => self.block("</aside>"),
            TagEnd::BlockQuote(None) => self.block("</blockquote>"),
            TagEnd::CodeBlock => self.end_code(),
            TagEnd::HtmlBlock => {
                if std::mem::replace(&mut self.html, HtmlBlock::None) == HtmlBlock::Shown {
                    self.block("</pre>");
                }
            }
            TagEnd::List(true) => self.block("</ol>"),
            TagEnd::List(false) => self.block("</ul>"),
            TagEnd::Item => self.block("</li>"),
            TagEnd::FootnoteDefinition => self.block("</div>"),
            TagEnd::Table => self.block("</tbody></table>"),
            TagEnd::TableHead => {
                self.table_head = false;
                self.block("</tr></thead><tbody>");
            }
            TagEnd::TableRow => self.block("</tr>"),
            TagEnd::TableCell => {
                let name = if self.table_head { "th" } else { "td" };
                self.cell += 1;
                self.block(&format!("</{name}>"));
            }
            TagEnd::Emphasis
            | TagEnd::Strong
            | TagEnd::Strikethrough
            | TagEnd::Superscript
            | TagEnd::Subscript
            | TagEnd::Link => self.close_inline(),
            TagEnd::Image | TagEnd::MetadataBlock(_) => {}
            TagEnd::DefinitionList
            | TagEnd::DefinitionListTitle
            | TagEnd::DefinitionListDefinition => self.close_span(),
        }
    }

    fn end_heading(&mut self) {
        self.close_span();
        let Some(heading) = self.heading.take() else {
            return;
        };
        let inner = std::mem::replace(&mut self.out, self.saved.pop().unwrap_or_default());
        let base = slug(&unescape(&heading.text));
        let mut id = base.clone();
        let mut number = 0;
        while self.anchors.contains(&id) {
            number += 1;
            id = format!("{base}-{number}");
        }
        self.anchors.insert(id.clone());
        let level = heading.level as usize;
        let _ = write!(
            self.out,
            "<h{level} id=\"{}\" {}>{inner}</h{level}>",
            escape(&id),
            heading.lines
        );
    }

    pub(super) fn end_code(&mut self) {
        let Some(code) = self.code.take() else {
            return;
        };
        let lines = code.lines;
        if code.language.eq_ignore_ascii_case("mermaid") {
            match diagram::draw(&code.source) {
                Ok(svg) => {
                    let _ = write!(self.out, "<figure class=\"diagram\" {lines}>{svg}</figure>");
                }
                Err(_) => {
                    let _ = write!(
                        self.out,
                        "<figure class=\"diagram diagram-failed\" {lines}>\
                         <p class=\"diagram-error\">Diagram could not be drawn</p>\
                         <pre><code>{}</code></pre></figure>",
                        escape(&code.source)
                    );
                }
            }
            return;
        }
        let class = if code.language.is_empty() {
            String::new()
        } else {
            format!(" class=\"language-{}\"", escape(&code.language))
        };
        let _ = write!(
            self.out,
            "<pre {lines}><code{class}>{}</code></pre>",
            escape(&code.source)
        );
    }

    pub(super) fn footnote(&mut self, name: &str) -> usize {
        match self.footnotes.iter().position(|known| known == name) {
            Some(index) => index + 1,
            None => {
                self.footnotes.push(name.to_owned());
                self.footnotes.len()
            }
        }
    }
}
