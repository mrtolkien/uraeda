//! A fake turn's script: the steps a fake process plays when a message is sent.
//!
//! As JSON, a script is an array, and a step is one of:
//!
//! - an event, as a runtime sends it: `{ "type": "textDelta", "text": "Reading " }`;
//! - `{ "wait": 400 }`, a wait of that many milliseconds, on tokio's clock;
//! - `{ "try": { "id": "t1", "tool": "Bash", "input": { "command": "curl example.com" } } }`,
//!   an action the agent's permissions block until its rule is allowed.
//!
//! The Node server's fake took the same events, and a function where this one takes a wait.

use std::fmt;
use std::path::Path;
use std::sync::Arc;
use std::time::Duration;

use serde::de::Error as _;
use serde::{Deserialize, Deserializer};
use serde_json::{Map, Value};

use crate::runner::{Denial, Event};

/// What a step of a test's own does, in the process's directory: its failure, in words.
pub type Work = Arc<dyn Fn(&Path) -> Result<(), String> + Send + Sync>;

/// One step of a fake turn.
#[derive(Clone)]
pub enum Step {
    /// An event, sent as it is. A `result` ends the turn, and an `exit` the process.
    Event(Event),
    /// A wait before the next step, on tokio's clock, which a test pauses: what ends the turn
    /// or the process cuts it short.
    Wait(Duration),
    /// An action the agent tries, as a tool call of this id. Its permissions block it, and the
    /// turn's `result` names it in its `denials`, unless the process was opened with the rule
    /// that allows it, `Runtime::allow_rule`: then it runs.
    Try { id: String, denial: Denial },
    /// Work of the test's own, run on a blocking thread in the process's directory, as an
    /// agent that commits a file, and waited for. One that fails ends the process, with exit
    /// code 1 and its words as stderr.
    Run(Work),
}

impl Step {
    /// A step that runs `work` in the process's directory.
    pub fn run(work: impl Fn(&Path) -> Result<(), String> + Send + Sync + 'static) -> Step {
        Step::Run(Arc::new(work))
    }

    /// Whether a close still plays it: what the process wrote already, never what it waits on.
    pub(super) fn is_written(&self) -> bool {
        matches!(self, Step::Event(_) | Step::Try { .. })
    }

    /// A step, from its JSON.
    fn read(value: Value) -> Result<Step, String> {
        const SHAPES: &str = "a step is an event, { \"wait\": milliseconds }, or \
                              { \"try\": { \"id\", \"tool\", \"input\" } }";
        let Some(object) = value.as_object() else {
            return Err(SHAPES.to_owned());
        };
        if let Some(wait) = object.get("wait") {
            let wait = wait.as_u64().ok_or("a wait is a number of milliseconds")?;
            return Ok(Step::Wait(Duration::from_millis(wait)));
        }
        if let Some(action) = object.get("try") {
            let action: Try = serde_json::from_value(action.clone())
                .map_err(|error| format!("a step's `try`: {error}"))?;
            let denial = Denial {
                input: action.input,
                tool: action.tool,
            };
            return Ok(Step::Try {
                id: action.id,
                denial,
            });
        }
        if object.contains_key("type") {
            let event = serde_json::from_value(value);
            return event.map(Step::Event).map_err(|error| error.to_string());
        }
        Err(SHAPES.to_owned())
    }
}

/// A `try` step's JSON.
#[derive(Deserialize)]
struct Try {
    id: String,
    tool: String,
    #[serde(default)]
    input: Map<String, Value>,
}

/// Through a JSON value, so a number with a fraction reads whatever serde_json is built with.
impl<'de> Deserialize<'de> for Step {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Step, D::Error> {
        let value = Value::deserialize(deserializer)?;
        Step::read(value).map_err(D::Error::custom)
    }
}

impl fmt::Debug for Step {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Step::Event(event) => write!(formatter, "Event({event:?})"),
            Step::Wait(wait) => write!(formatter, "Wait({wait:?})"),
            Step::Try { id, denial } => write!(formatter, "Try({id}, {denial:?})"),
            Step::Run(_) => formatter.write_str("Run(..)"),
        }
    }
}

/// A fake turn: its steps, in order. Played for a message, it starts with the message's
/// `accepted`, and ends with a successful `result` unless a step ends it: a `result` of its
/// own, as a failure's, or an `exit`.
#[derive(Clone, Debug, Default, Deserialize)]
#[serde(transparent)]
pub struct Script(pub Vec<Step>);

impl Script {
    /// A script, from the text of its JSON array.
    ///
    /// # Errors
    ///
    /// When the text is no JSON array, or one of its steps is no step.
    pub fn parse(json: &str) -> serde_json::Result<Script> {
        serde_json::from_str(json)
    }

    /// A reply streamed word by word over a time, then whole: each word a `textDelta` after
    /// its share of the time, then the `text`. A reply of 20,000 words is 20,000 pieces.
    pub fn reply(text: &str, over: Duration) -> Script {
        let words = words(text);
        let waits = shares(over, words.len());
        let pieces = words.into_iter().zip(waits).flat_map(|(word, wait)| {
            let text = word.to_owned();
            [Step::Wait(wait), Step::Event(Event::TextDelta { text })]
        });
        let whole = Step::Event(Event::Text {
            text: text.to_owned(),
        });
        Script(pieces.chain([whole]).collect())
    }

    /// Whether a step ends the turn itself, with a `result` or an `exit`.
    pub(super) fn ends_itself(&self) -> bool {
        let ends =
            |step: &Step| matches!(step, Step::Event(Event::Result { .. } | Event::Exit { .. }));
        self.0.iter().any(ends)
    }
}

impl From<Vec<Step>> for Script {
    fn from(steps: Vec<Step>) -> Script {
        Script(steps)
    }
}

impl From<Vec<Event>> for Script {
    fn from(events: Vec<Event>) -> Script {
        Script(events.into_iter().map(Step::Event).collect())
    }
}

/// A text's words, each with the blanks after it, the first with those before it: joined, they
/// are the text.
fn words(text: &str) -> Vec<&str> {
    let mut words = Vec::new();
    let (mut start, mut worded, mut spaced) = (0, false, false);
    for (at, letter) in text.char_indices() {
        if letter.is_whitespace() {
            spaced = worded;
        } else if spaced {
            words.push(&text[start..at]);
            (start, spaced) = (at, false);
        } else {
            worded = true;
        }
    }
    if start < text.len() {
        words.push(&text[start..]);
    }
    words
}

/// A time in `count` shares that add up to it exactly: the first takes what does not divide.
fn shares(total: Duration, count: usize) -> Vec<Duration> {
    let Ok(parts) = u32::try_from(count) else {
        return vec![Duration::ZERO; count];
    };
    if parts == 0 {
        return Vec::new();
    }
    let each = total / parts;
    let mut shares = vec![each; count];
    shares[0] += total - each * parts;
    shares
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_reply_is_cut_into_words_that_join_back_and_shares_that_add_up() {
        let text = "  One two,\n\nthree.  ";
        assert_eq!(words(text), ["  One ", "two,\n\n", "three.  "]);
        assert_eq!(words(text).concat(), text);
        assert_eq!(words(""), Vec::<&str>::new());
        assert_eq!(words("  "), ["  "]);

        let total = Duration::from_millis(1000);
        let split = shares(total, 3);
        assert_eq!(split.iter().sum::<Duration>(), total);
        assert_eq!(split[1], split[2]);
        assert_eq!(shares(total, 0), Vec::<Duration>::new());
    }
}
