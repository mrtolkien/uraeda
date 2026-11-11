//! A page's lines, as its events make them: each event's place, and what it adds to a line or
//! changes of one.

use super::*;

/// Where an event is: its place in the log, its time, the text a piece grows, and whether it
/// is in the page, and starts a line of it.
pub(super) struct Place {
    pub(super) seq: u64,
    pub(super) at: i64,
    pub(super) text_start: Option<u64>,
    pub(super) starts: bool,
    pub(super) inside: bool,
}

impl Place {
    /// The id of the line an event at this place starts.
    pub(super) fn id(&self) -> String {
        self.seq.to_string()
    }
}

/// A page's lines, as its events make them.
pub(super) struct Lines<'a> {
    /// The place of the page's first line: what came before only says since when the agent
    /// thinks.
    first: u64,
    agent: &'a str,
    items: Vec<Item>,
    /// Where each line of the page is, by the place of the event that started it.
    at: HashMap<u64, usize>,
    /// The page's messages, by their own ids, and whether each was taken back.
    messages: HashMap<String, (usize, bool)>,
    /// The page's tool calls still running, by their ids: each one's line, and its start.
    tools: HashMap<String, (usize, i64)>,
    /// The page's text being written: its line.
    pub(super) writing: Option<usize>,
    /// Whether a text is being written, in the page or before it.
    pieces: bool,
    /// The page's line of skipped output, and how many it counts.
    skipped: Option<(usize, u32)>,
    /// Since when the main agent thinks.
    thinking: Option<i64>,
    pending: usize,
    blocked: usize,
}

impl<'a> Lines<'a> {
    pub(super) fn new(first: u64, agent: &'a str) -> Lines<'a> {
        Lines {
            first,
            agent,
            items: Vec::new(),
            at: HashMap::new(),
            messages: HashMap::new(),
            tools: HashMap::new(),
            writing: None,
            pieces: false,
            skipped: None,
            thinking: None,
            pending: 0,
            blocked: 0,
        }
    }

    /// Whether an event after the page may change a message, a blocked action, or the skipped
    /// output's line of it.
    pub(super) fn follows_rare(&self) -> bool {
        self.pending > 0 || self.blocked > 0 || self.skipped.is_some()
    }

    /// How many tool calls of the page still run.
    pub(super) fn running(&self) -> usize {
        self.tools.len()
    }

    pub(super) fn push(&mut self, seq: u64, item: Item) -> usize {
        self.at.insert(seq, self.items.len());
        self.items.push(item);
        self.items.len() - 1
    }

    /// Takes an event: one before the page only moves what the agent does, one of the page
    /// may start a line, and any may change a line of the page.
    pub(super) fn add(&mut self, row: Row) {
        let at = Place {
            seq: row.seq,
            at: row.at,
            text_start: row.text_start,
            starts: row.starts && row.seq >= self.first,
            inside: row.seq >= self.first,
        };
        match row.event {
            Event::Activity { activity } => {
                self.thinking = matches!(activity, Activity::Thinking).then_some(at.at);
            }
            Event::Message {
                id,
                origin,
                text,
                opening,
                images,
            } if at.inside => {
                let item = Item::Message {
                    id: at.id(),
                    message: id.clone(),
                    at: millis_of(at.at),
                    origin: match origin {
                        Origin::Human => MessageOrigin::Human,
                        Origin::Workflow => MessageOrigin::Workflow,
                    },
                    read: false,
                    text,
                    opening,
                    images,
                };
                let line = self.push(at.seq, item);
                self.messages.insert(id, (line, false));
                self.pending += 1;
            }
            Event::Accepted { id } => self.settle(&id, false),
            Event::Cancelled { id } => self.settle(&id, true),
            Event::TextDelta { text } => self.piece(&at, text),
            Event::Text { text } => self.whole(&at, text),
            Event::ToolEnd {
                id,
                is_error,
                output,
            } => self.tool_end(&at, &id, is_error, &output),
            Event::Skipped => self.skipped(&at),
            Event::Allowed { denial } => self.allowed(denial),
            started => self.start(&at, started),
        }
    }

    /// Marks a message of the page read, or taken back.
    pub(super) fn settle(&mut self, message: &str, taken: bool) {
        let Some((line, was_taken)) = self.messages.get_mut(message) else {
            return;
        };
        let Item::Message { read, .. } = &mut self.items[*line] else {
            return;
        };
        if !*read && !*was_taken {
            self.pending -= 1;
        }
        match taken {
            true => *was_taken = true,
            false => *read = true,
        }
    }

    /// A piece of a text: the first starts its line, and the next ones grow it.
    pub(super) fn piece(&mut self, at: &Place, text: String) {
        self.thinking = None;
        self.pieces = true;
        if at.starts {
            let item = Item::Text {
                id: at.id(),
                streaming: true,
                text,
            };
            self.writing = Some(self.push(at.seq, item));
            return;
        }
        let line = at.text_start.and_then(|start| self.at.get(&start));
        if let Some(Item::Text { text: whole, .. }) = line.map(|line| &mut self.items[*line]) {
            whole.push_str(&text);
        }
    }

    /// A whole text: it ends the pieces before it, which it repeats, or is a line of its own.
    pub(super) fn whole(&mut self, at: &Place, text: String) {
        self.thinking = None;
        let was_writing = std::mem::take(&mut self.pieces);
        match (self.writing.take(), at.starts) {
            (Some(line), _) => {
                self.items[line] = Item::Text {
                    id: item_id(&self.items[line]),
                    streaming: false,
                    text,
                };
            }
            (None, true) if !was_writing => {
                let item = Item::Text {
                    id: at.id(),
                    streaming: false,
                    text,
                };
                self.push(at.seq, item);
            }
            _ => {}
        }
    }

    /// A tool call's end: its line reads completed or failed, with its result and its time.
    pub(super) fn tool_end(&mut self, at: &Place, call: &str, is_error: bool, output: &str) {
        let Some((line, started)) = self.tools.remove(call) else {
            return;
        };
        let Item::Tool {
            status,
            output: shown,
            duration_ms,
            ..
        } = &mut self.items[line]
        else {
            return;
        };
        *status = match is_error {
            true => ToolStatus::Failed,
            false => ToolStatus::Completed,
        };
        *shown = Some(cut(output));
        *duration_ms = Some(millis_of(at.at - started));
    }

    /// Output the agent printed that Uraeda does not read: the first of a turn is a line,
    /// which the next ones count on.
    pub(super) fn skipped(&mut self, at: &Place) {
        match (&mut self.skipped, at.starts) {
            (Some((line, count)), _) => {
                *count += 1;
                let (line, text) = (*line, skipped_text(*count, self.agent));
                self.items[line] = Item::System {
                    id: item_id(&self.items[line]),
                    text,
                };
            }
            (None, true) => {
                let text = skipped_text(1, self.agent);
                let line = self.push(at.seq, Item::System { id: at.id(), text });
                self.skipped = Some((line, 1));
            }
            (None, false) => {}
        }
    }

    /// A blocked action of the page was allowed.
    pub(super) fn allowed(&mut self, denial: u64) {
        let Some(line) = self.at.get(&denial) else {
            return;
        };
        if let Item::Denial { allowed, .. } = &mut self.items[*line]
            && !*allowed
        {
            *allowed = true;
            self.blocked -= 1;
        }
    }

    /// What starts a line by itself: a tool call, a thought, a line of Uraeda's or of the
    /// agent's, a blocked action.
    pub(super) fn start(&mut self, at: &Place, event: Event) {
        let id = at.id();
        let item = match event {
            Event::ToolStart {
                id: call,
                kind,
                name,
                parent,
                subagent,
                target,
                ..
            } => {
                if parent.is_none() {
                    self.thinking = None;
                }
                if !at.inside {
                    return;
                }
                let item = Item::Tool {
                    id,
                    call: call.clone(),
                    name,
                    tool_kind: tool_kind(kind),
                    target,
                    parent,
                    subagent: subagent.map(|subagent| subagent.description),
                    status: ToolStatus::InProgress,
                    output: None,
                    duration_ms: None,
                };
                let line = self.push(at.seq, item);
                self.tools.insert(call, (line, at.at));
                return;
            }
            Event::Thought { parent, text } => {
                let started = match parent {
                    None => self.thinking.take(),
                    Some(_) => None,
                };
                Item::Thought {
                    id,
                    parent,
                    text: text.as_deref().map(cut),
                    duration_ms: started.map_or(0, |started| millis_of(at.at - started)),
                }
            }
            Event::Notice { text } => Item::System { id, text },
            Event::Retry {
                delay_ms, error, ..
            } => Item::System {
                id,
                text: retry_text(delay_ms, &error),
            },
            Event::Denial { tool, target, rule } => {
                self.blocked += usize::from(at.inside);
                Item::Denial {
                    id,
                    tool,
                    target,
                    rule,
                    allowed: false,
                }
            }
            _ => return,
        };
        if at.inside {
            self.push(at.seq, item);
        }
    }

    /// The page's lines, without the messages taken back.
    pub(super) fn ended(self) -> Vec<Item> {
        let taken: Vec<usize> = self
            .messages
            .values()
            .filter(|(_, taken)| *taken)
            .map(|(line, _)| *line)
            .collect();
        let kept = self.items.into_iter().enumerate();
        kept.filter(|(line, _)| !taken.contains(line))
            .map(|(_, item)| item)
            .collect()
    }
}
