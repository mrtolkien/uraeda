//! What a turn's items of the Node server's store become in a log: the events that leave the
//! same transcript.
//!
//! The Node server kept a turn as items it changed in place: a message's state, a text as it
//! grew, a tool call once it ended, a blocked action once allowed. A log is never changed, so an
//! item becomes the events that led to its last state:
//!
//! | Item                                  | Events                                             |
//! | ------------------------------------- | -------------------------------------------------- |
//! | `message`, pending                    | `message`                                          |
//! | `message`, read or taken back         | `message`, then `accepted` or `cancelled`          |
//! | `text`, whole or still streaming      | `text`, or `textDelta` alone                       |
//! | `tool`, completed or failed           | `toolStart`, then `toolEnd` after its duration     |
//! | `tool`, in any other state            | `toolStart` alone                                  |
//! | `thought` that lasted                 | `activity` of `thinking` at its start, `thought`   |
//! | `thought` that did not, a sub-agent's | `thought`                                          |
//! | `system`                              | `notice`                                           |
//! | `denial`, allowed or not              | `denial`, and `allowed` at the end of the log      |

use serde::Deserialize;

use crate::runner::event::{Activity, ChatImage, Event, Origin, Subagent, ToolKind};

/// A row of the old store's `items`, with its times in milliseconds.
pub(super) struct Row {
    /// When the item was added to its turn.
    pub(super) at: i64,
    /// A message's own time, when it kept one: when it was sent.
    pub(super) sent: Option<i64>,
    pub(super) kind: String,
    /// The JSON of its other fields.
    pub(super) data: String,
}

/// An event of an imported log, and its time in milliseconds.
pub(super) struct Line {
    pub(super) at: i64,
    pub(super) event: Event,
}

/// An item of a turn, as [`events.ts`](/packages/server/src/runner/events.ts) has it. A field
/// the import does not need, or that only newer items have, may be missing.
#[derive(Deserialize)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
enum Item {
    Message {
        id: String,
        origin: Origin,
        text: String,
        opening: Option<String>,
        #[serde(default)]
        images: Vec<ChatImage>,
        #[serde(default)]
        state: String,
    },
    Text {
        #[serde(default)]
        streaming: bool,
        text: String,
    },
    Tool {
        id: String,
        name: String,
        tool_kind: ToolKind,
        #[serde(default)]
        status: String,
        target: Option<String>,
        parent: Option<String>,
        subagent: Option<Subagent>,
        output: Option<String>,
        #[serde(default)]
        duration_ms: f64,
    },
    Thought {
        #[serde(default)]
        duration_ms: f64,
        parent: Option<String>,
        text: Option<String>,
    },
    System {
        text: String,
    },
    Denial {
        tool: String,
        target: Option<String>,
        rule: Option<String>,
        #[serde(default)]
        allowed: bool,
    },
}

/// The log of a turn's items, in their order, and how many of them could not be read: a kind
/// this import does not know, or fields that are not its kind's. Those are left out.
pub(super) fn of(items: impl IntoIterator<Item = Row>) -> (Vec<Line>, u64) {
    let (mut log, mut unread) = (Log::default(), 0);
    for row in items {
        match item(&row) {
            Some(item) => log.add(&row, item),
            None => unread += 1,
        }
    }
    (log.ended(), unread)
}

/// The item of a row, none when it cannot be read.
fn item(row: &Row) -> Option<Item> {
    let mut fields: serde_json::Map<String, serde_json::Value> =
        serde_json::from_str(&row.data).ok()?;
    fields.insert("kind".to_owned(), row.kind.clone().into());
    serde_json::from_value(fields.into()).ok()
}

/// A log being written from items.
#[derive(Default)]
struct Log {
    lines: Vec<Line>,
    /// The ends of the tool calls still running at the last item.
    ends: Vec<Line>,
    /// The blocked actions allowed since: each one's place in the log, and its time.
    allowed: Vec<(u64, i64)>,
}

impl Log {
    /// Adds the events of an item, after the ends of the tool calls that ended before it.
    fn add(&mut self, row: &Row, item: Item) {
        self.end_until(row.at);
        let at = row.at;
        match item {
            Item::Message {
                id,
                origin,
                text,
                opening,
                images,
                state,
            } => {
                let at = row.sent.unwrap_or(at);
                let message = Event::Message {
                    id: id.clone(),
                    origin,
                    text,
                    opening,
                    images,
                };
                self.push(at, message);
                match state.as_str() {
                    "read" => self.push(at, Event::Accepted { id }),
                    "taken-back" => self.push(at, Event::Cancelled { id }),
                    _ => {}
                }
            }
            Item::Text { streaming, text } if streaming => {
                self.push(at, Event::TextDelta { text });
            }
            Item::Text { text, .. } => self.push(at, Event::Text { text }),
            Item::Tool {
                id,
                name,
                tool_kind,
                status,
                target,
                parent,
                subagent,
                output,
                duration_ms,
            } => {
                let failed = status == "failed";
                if failed || status == "completed" {
                    let end = Event::ToolEnd {
                        id: id.clone(),
                        is_error: failed,
                        output: output.unwrap_or_default(),
                    };
                    let at = at + millis(duration_ms);
                    self.ends.push(Line { at, event: end });
                }
                let start = Event::ToolStart {
                    id,
                    // The Node server kept no input.
                    input: serde_json::Map::new(),
                    kind: tool_kind,
                    name,
                    parent,
                    subagent,
                    target,
                };
                self.push(at, start);
            }
            Item::Thought {
                duration_ms,
                parent,
                text,
            } => {
                let lasted = millis(duration_ms);
                if lasted > 0 && parent.is_none() {
                    let activity = Activity::Thinking;
                    self.push(at - lasted, Event::Activity { activity });
                }
                self.push(at, Event::Thought { parent, text });
            }
            Item::System { text } => self.push(at, Event::Notice { text }),
            Item::Denial {
                tool,
                target,
                rule,
                allowed,
            } => {
                if allowed {
                    self.allowed.push((self.lines.len() as u64, at));
                }
                self.push(at, Event::Denial { tool, target, rule });
            }
        }
    }

    fn push(&mut self, at: i64, event: Event) {
        self.lines.push(Line { at, event });
    }

    /// Ends the tool calls that ended by `at`, the first to end first.
    fn end_until(&mut self, at: i64) {
        self.ends.sort_by_key(|end| end.at);
        let ended = self.ends.partition_point(|end| end.at <= at);
        self.lines.extend(self.ends.drain(..ended));
    }

    /// The whole log: the tool calls that ended after the last item, then what was allowed.
    fn ended(mut self) -> Vec<Line> {
        self.end_until(i64::MAX);
        for (denial, at) in std::mem::take(&mut self.allowed) {
            self.push(at, Event::Allowed { denial });
        }
        self.lines
    }
}

/// A duration the Node server kept, in whole milliseconds.
fn millis(duration: f64) -> i64 {
    // Far below what an i64 holds, and never negative.
    (duration.round() as i64).max(0)
}
