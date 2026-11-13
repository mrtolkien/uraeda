//! The agent's offers to move a session up, as its messages hold them: the grammar of the
//! block. The server reads it to start the change a job's run offers, and the app's offer card
//! reads it to draw the card, so a block means the same to both.
//!
//! An offer is a fenced block, ` ```uraeda-offer change ` or ` ```uraeda-offer feature `, read
//! as markdown reads fences (CommonMark): its body is the change's proposal, `# Title` first, or
//! the reason to make the change a feature.

/// What an offer moves: a session to a change, or a change to a feature.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum OfferKind {
    Change,
    Feature,
}

/// An offer block: its kind, and its body, trimmed, its lines ending in LF.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Offer {
    pub kind: OfferKind,
    pub body: String,
}

/// An offer, with where its closing fence ends in the text and how far its opening fence is
/// indented.
struct Found {
    offer: Offer,
    end: usize,
    indent: usize,
}

/// A fence still open: its run of backticks or tildes, its indent, the kind of an offer's, and
/// its lines so far.
struct Open<'a> {
    fence: &'a str,
    indent: usize,
    kind: Option<OfferKind>,
    body: Vec<&'a str>,
}

/// An opening fence: up to three spaces, a run of three or more backticks or tildes, then its
/// info string. A backtick fence's info string holds no backtick.
fn opening(line: &str) -> Option<(usize, &str, &str)> {
    let indent = line.len() - line.trim_start_matches(' ').len();
    if indent > 3 {
        return None;
    }
    let rest = &line[indent..];
    let mark = rest
        .chars()
        .next()
        .filter(|mark| matches!(mark, '`' | '~'))?;
    let length = rest.len() - rest.trim_start_matches(mark).len();
    if length < 3 {
        return None;
    }
    let (fence, info) = rest.split_at(length);
    let info = info.trim();
    (mark != '`' || !info.contains('`')).then_some((indent, fence, info))
}

/// The kind of an offer's info string, `uraeda-offer` then its kind, apart by blanks.
fn kind_of(info: &str) -> Option<OfferKind> {
    let kind = info.strip_prefix("uraeda-offer")?;
    if !kind.starts_with([' ', '\t']) {
        return None;
    }
    match kind.trim_matches([' ', '\t']) {
        "change" => Some(OfferKind::Change),
        "feature" => Some(OfferKind::Feature),
        _ => None,
    }
}

/// Whether a line closes a fence: up to three spaces, a run of the fence's character as long
/// as it or longer, then nothing but blanks.
fn closes(line: &str, fence: &str) -> bool {
    let indent = line.len() - line.trim_start_matches(' ').len();
    let rest = &line[indent..];
    let Some(mark) = fence.chars().next() else {
        return false;
    };
    let run = rest.len() - rest.trim_start_matches(mark).len();
    indent <= 3 && run >= fence.len() && rest[run..].trim_matches([' ', '\t']).is_empty()
}

/// A block's body as the card reads it: trimmed, its lines ending in LF.
fn body_of(lines: &[&str]) -> String {
    lines.join("\n").replace("\r\n", "\n").trim().to_owned()
}

/// The closed offer blocks of a text, in order. A fence of N backticks or tildes closes on a
/// line of the same character, N or more of them, with nothing after it, so a block quoted
/// inside an outer fence is text. A fence left open, as the one of a message still streaming,
/// runs to the end of the text and is no offer.
fn offers_of(text: &str) -> Vec<Found> {
    let mut found = Vec::new();
    let mut open: Option<Open<'_>> = None;
    let mut at = 0;
    for raw in text.split('\n') {
        let end = at + raw.len();
        at = end + 1;
        let line = raw.strip_suffix('\r').unwrap_or(raw);
        let Some(block) = open.as_mut() else {
            open = opening(line).map(|(indent, fence, info)| Open {
                fence,
                indent,
                kind: kind_of(info),
                body: Vec::new(),
            });
            continue;
        };
        if closes(line, block.fence) {
            let body = body_of(&block.body);
            if let Some(kind) = block.kind.filter(|_| !body.is_empty()) {
                let indent = block.indent;
                found.push(Found {
                    offer: Offer { kind, body },
                    end,
                    indent,
                });
            }
            open = None;
        } else {
            // A line of the content loses the indent of its fence, as far as it has it.
            let spaces = line.len() - line.trim_start_matches(' ').len();
            block.body.push(&line[spaces.min(block.indent)..]);
        }
    }
    found
}

/// The last closed offer block of a message's text, as the card draws it: a block still open
/// is text.
pub fn last_offer(text: &str) -> Option<Offer> {
    offers_of(text).pop().map(|found| found.offer)
}

/// The offer the text ends on: its last closed block, with nothing but whitespace after its
/// closing fence. Prose, a code block, or a block left open after an offer make it no longer
/// the last word, and so does an indented fence, which may sit in a list item or a quote: the
/// card may draw it, but only a fence at column 0 starts a change by itself.
pub fn ending_offer(text: &str) -> Option<Offer> {
    let last = offers_of(text).pop()?;
    let after = text.get(last.end..).unwrap_or_default();
    (last.indent == 0 && after.trim().is_empty()).then_some(last.offer)
}

/// A proposal's title: its first line, without the heading's `#`.
pub fn proposal_title(proposal: &str) -> String {
    let first = proposal.trim().lines().next().unwrap_or_default();
    first.trim_start_matches('#').trim().to_owned()
}

#[cfg(test)]
mod tests {
    use super::*;

    const OFFER: &str = "```uraeda-offer change\n# Example\n\nBody.\n```";

    fn change(body: &str) -> Option<Offer> {
        Some(Offer {
            kind: OfferKind::Change,
            body: body.to_owned(),
        })
    }

    /// The text with `by` before each of its lines.
    fn indented(text: &str, by: &str) -> String {
        format!("{by}{}", text.replace('\n', &format!("\n{by}")))
    }

    #[test]
    fn an_offer_is_read_as_markdown_reads_it() {
        let example = change("# Example\n\nBody.");
        let real = OFFER.replace("Example", "Real");
        let rows: Vec<(&str, String, Option<Offer>)> = vec![
            ("a plain block", OFFER.to_owned(), example.clone()),
            ("indented by three", indented(OFFER, "   "), example.clone()),
            ("indented by four is code", indented(OFFER, "    "), None),
            (
                "after prose",
                format!("Intro.\n\n{OFFER}\n\nMore."),
                example.clone(),
            ),
            (
                "a feature block",
                "```uraeda-offer feature\nBecause.\n```".to_owned(),
                Some(Offer {
                    kind: OfferKind::Feature,
                    body: "Because.".to_owned(),
                }),
            ),
            (
                "a tilde block",
                "~~~uraeda-offer change\n# Tilde\n~~~".to_owned(),
                change("# Tilde"),
            ),
            (
                "a longer closing fence",
                "```uraeda-offer change\n# A\n`````".to_owned(),
                change("# A"),
            ),
            ("in four backticks", format!("````md\n{OFFER}\n````"), None),
            ("in a tilde fence", format!("~~~md\n{OFFER}\n~~~"), None),
            (
                "closed by more tildes",
                format!("~~~md\n{OFFER}\n~~~~~"),
                None,
            ),
            ("in three backticks", format!("```md\n{OFFER}\n```"), None),
            (
                "a tilde fence around a block",
                format!("~~~\n{OFFER}\n~~~\n\n{real}"),
                change("# Real\n\nBody."),
            ),
            (
                "an outer fence a short one does not close",
                format!("````md\n```\n{OFFER}"),
                None,
            ),
            (
                "closed too short",
                "````uraeda-offer change\n# A\n```".to_owned(),
                None,
            ),
            (
                "a closing with text after it",
                "```uraeda-offer change\n# A\n``` more".to_owned(),
                None,
            ),
            (
                "left open",
                "```uraeda-offer change\n# A\n\nNever closed.".to_owned(),
                None,
            ),
            (
                "a closed block before an open one",
                format!("{OFFER}\n\n```uraeda-offer change\n# B\nOpen."),
                example.clone(),
            ),
            (
                "CRLF lines",
                "```uraeda-offer change\r\n# A\r\n\r\nB.\r\n```\r\n".to_owned(),
                change("# A\n\nB."),
            ),
            (
                "another language",
                "```uraeda-offers change\n# A\n```".to_owned(),
                None,
            ),
        ];
        for (name, text, expected) in rows {
            assert_eq!(last_offer(&text), expected, "{name}");
        }
    }

    #[test]
    fn an_offer_is_the_last_word_only_with_nothing_but_blanks_after_it() {
        let example = change("# Example\n\nBody.");
        assert_eq!(ending_offer(&format!("Intro.\n\n{OFFER}\n\n  \n")), example);
        assert_eq!(ending_offer(&format!("{OFFER}\r\n")), example);
        assert_eq!(ending_offer(&format!("{OFFER}\n\nDo not start it.")), None);
        assert_eq!(ending_offer(&format!("{OFFER}\n```sh\nls\n```\n")), None);
        let open = format!("{OFFER}\n```uraeda-offer change\n# B\nOpen.");
        assert_eq!(ending_offer(&open), None);
        assert_eq!(ending_offer("Nothing to do."), None);
    }

    // An offer in a list item, a quote, or indented, which the card may draw but nobody wrote
    // as the run's last word, must not start a change by itself.
    #[test]
    fn the_automatic_acceptance_takes_an_offer_at_column_0_only() {
        assert!(last_offer(&indented(OFFER, "  ")).is_some());
        assert_eq!(ending_offer(&indented(OFFER, "  ")), None);
        assert_eq!(ending_offer(&indented(OFFER, " ")), None);
        let listed = format!("- ````md\n{}", indented(OFFER, "  "));
        assert_eq!(ending_offer(&listed), None);
        let numbered = format!("1. Example:\n\n{}\n", indented(OFFER, "   "));
        assert_eq!(ending_offer(&numbered), None);
        assert_eq!(ending_offer(&indented(OFFER, "> ")), None);
        let after_list = format!("- one\n- two\n\n{OFFER}\n");
        assert_eq!(ending_offer(&after_list), change("# Example\n\nBody."));
    }

    #[test]
    fn a_proposals_title_is_its_first_line() {
        assert_eq!(
            proposal_title("# Login redirects twice\n\nBody."),
            "Login redirects twice"
        );
        assert_eq!(proposal_title("  Plain\nmore"), "Plain");
    }
}
