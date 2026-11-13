//! The line that ends a turn: its result, and the agent session's running total of tokens.

use std::fmt;

use serde::Deserialize;
use serde::de::{Deserializer, IgnoredAny, MapAccess, Visitor};
use serde_json::Value;

use super::json::{self, is_true, nested, number, objects, string, text, words};
use crate::runner::{Denial, Event, TokenCounts};

/// The events of a `result` line: the tokens counted so far, then the result. `line` is the
/// line as printed, which names the models in their order.
pub(super) fn events(message: &Value, line: &str) -> Vec<Event> {
    let tokens = tokens(nested(message, "modelUsage"));
    tokens.into_iter().chain([result(message, line)]).collect()
}

/// The fields of each model's counts in `modelUsage`.
const COUNTS: [&str; 4] = [
    "cacheReadInputTokens",
    "cacheCreationInputTokens",
    "inputTokens",
    "outputTokens",
];

/// The agent session's running total, summed over its models: `modelUsage` counts the
/// sub-agents, as `usage` does not. None without a count in `modelUsage`: an all-zero total
/// would read as a new agent session.
fn tokens(usage: &Value) -> Option<Event> {
    let models = usage
        .as_object()?
        .values()
        .filter(|model| model.is_object());
    let mut totals = [0.0; 4];
    let mut counted = false;
    for model in models {
        for (total, field) in totals.iter_mut().zip(COUNTS) {
            if let Some(count) = number(model, field) {
                *total += count;
                counted = true;
            }
        }
    }
    #[expect(
        clippy::cast_possible_truncation,
        clippy::cast_sign_loss,
        reason = "a count of tokens: whole, and none below zero"
    )]
    let [cache_read, cache_write, input, output] = totals.map(|total| total as u64);
    let total = TokenCounts {
        cache_read,
        cache_write,
        input,
        output,
    };
    counted.then_some(Event::Tokens { total })
}

fn result(message: &Value, line: &str) -> Event {
    let ok = string(message, "subtype") == Some("success") && !is_true(message, "is_error");
    let listed = json::field(message, "errors").and_then(Value::as_array);
    let errors = listed.into_iter().flatten().filter_map(Value::as_str);
    let mut errors: Vec<String> = errors.map(str::to_owned).collect();
    // A success that is an error, like an API error, says why in its result.
    if let (false, true, Some(why)) = (ok, errors.is_empty(), words(message, "result")) {
        errors.push(why.to_owned());
    }
    let denials = objects(message, "permission_denials").into_iter();
    let denials = denials.map(|denial| Denial {
        input: json::object(denial, "tool_input")
            .cloned()
            .unwrap_or_default(),
        tool: text(denial, "tool_name").to_owned(),
    });
    Event::Result {
        cost_usd: number(message, "total_cost_usd"),
        denials: denials.collect(),
        errors,
        // An interrupt ends the turn this way, with only diagnostics in its errors.
        interrupted: string(message, "terminal_reason") == Some("aborted_streaming"),
        models: json::object(message, "modelUsage").and_then(|_| models(line)),
        ok,
    }
}

/// The models that answered, in the order the line names them: the keys of `modelUsage`.
fn models(line: &str) -> Option<Vec<String>> {
    let named = serde_json::from_str::<Named>(line);
    let named = named.or_else(|_| serde_json::from_str(&json::without_halves(line)));
    named
        .ok()?
        .usage
        .map(|keys| keys.0)
        .filter(|keys| !keys.is_empty())
}

/// A `result` line, read for the names of its models alone.
#[derive(Deserialize)]
struct Named {
    #[serde(rename = "modelUsage", default)]
    usage: Option<Keys>,
}

/// The keys of an object, in the order they are written: an object read as a `Value` keeps it
/// only when serde_json is built to. A value that is no object has none.
struct Keys(Vec<String>);

impl<'de> Deserialize<'de> for Keys {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Keys, D::Error> {
        deserializer.deserialize_any(KeysVisitor)
    }
}

struct KeysVisitor;

impl<'de> Visitor<'de> for KeysVisitor {
    type Value = Keys;

    fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("anything")
    }

    fn visit_map<A: MapAccess<'de>>(self, mut map: A) -> Result<Keys, A::Error> {
        let mut keys = Vec::new();
        while let Some((key, IgnoredAny)) = map.next_entry::<String, IgnoredAny>()? {
            // Written twice, a key is named once, where it was first.
            if !keys.contains(&key) {
                keys.push(key);
            }
        }
        Ok(Keys(keys))
    }

    fn visit_seq<A: serde::de::SeqAccess<'de>>(self, mut seq: A) -> Result<Keys, A::Error> {
        while seq.next_element::<IgnoredAny>()?.is_some() {}
        Ok(Keys(Vec::new()))
    }

    fn visit_bool<E>(self, _: bool) -> Result<Keys, E> {
        Ok(Keys(Vec::new()))
    }

    fn visit_i64<E>(self, _: i64) -> Result<Keys, E> {
        Ok(Keys(Vec::new()))
    }

    fn visit_u64<E>(self, _: u64) -> Result<Keys, E> {
        Ok(Keys(Vec::new()))
    }

    fn visit_f64<E>(self, _: f64) -> Result<Keys, E> {
        Ok(Keys(Vec::new()))
    }

    fn visit_str<E>(self, _: &str) -> Result<Keys, E> {
        Ok(Keys(Vec::new()))
    }

    fn visit_unit<E>(self) -> Result<Keys, E> {
        Ok(Keys(Vec::new()))
    }
}
