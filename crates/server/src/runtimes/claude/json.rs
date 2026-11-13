//! Claude Code's JSON, read as loosely as its own code reads it: a field of the wrong type is a
//! field that is missing, and a line is read even when it holds half a character.

use serde_json::{Map, Value};

/// A JSON object.
pub(super) type Object = Map<String, Value>;

/// A field of an object: none when the value is no object, or has no such field.
pub(super) fn field<'a>(value: &'a Value, key: &str) -> Option<&'a Value> {
    value.as_object()?.get(key)
}

/// A field that is a text, else the empty one.
pub(super) fn text<'a>(value: &'a Value, key: &str) -> &'a str {
    string(value, key).unwrap_or_default()
}

/// A field that is a text.
pub(super) fn string<'a>(value: &'a Value, key: &str) -> Option<&'a str> {
    field(value, key)?.as_str()
}

/// A field that is a text and not the empty one.
pub(super) fn words<'a>(value: &'a Value, key: &str) -> Option<&'a str> {
    string(value, key).filter(|text| !text.is_empty())
}

/// A field that is a number, and not too large to be one.
pub(super) fn number(value: &Value, key: &str) -> Option<f64> {
    let number = field(value, key)?.as_number()?.as_f64()?;
    number.is_finite().then_some(number)
}

/// A field that is an object.
pub(super) fn object<'a>(value: &'a Value, key: &str) -> Option<&'a Object> {
    field(value, key)?.as_object()
}

/// A field that is an object, as the value it is.
pub(super) fn nested<'a>(value: &'a Value, key: &str) -> &'a Value {
    let nested = field(value, key).filter(|nested| nested.is_object());
    nested.unwrap_or(&Value::Null)
}

/// The objects of a field that is a list: what else the list holds is left out.
pub(super) fn objects<'a>(value: &'a Value, key: &str) -> Vec<&'a Value> {
    field(value, key).map(listed).unwrap_or_default()
}

/// The objects of a list: none for a value that is no list.
pub(super) fn listed(value: &Value) -> Vec<&Value> {
    let items = value.as_array().map(Vec::as_slice).unwrap_or_default();
    items.iter().filter(|item| item.is_object()).collect()
}

/// Whether a field is the boolean `true`.
pub(super) fn is_true(value: &Value, key: &str) -> bool {
    field(value, key) == Some(&Value::Bool(true))
}

/// Reads a JSON text. Claude Code cuts a long text between the two halves of a character, and
/// writes the half as an escape, which is no text here: each half alone is read as U+FFFD, the
/// replacement character.
pub(super) fn read(text: &str) -> Option<Value> {
    serde_json::from_str(text)
        .or_else(|_| serde_json::from_str(&without_halves(text)))
        .ok()
}

/// The JSON text with each escape of half a character, a surrogate without its pair, written as
/// the escape of U+FFFD.
pub(super) fn without_halves(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut rest = text;
    while let Some(at) = rest.find('\\') {
        let (before, escape) = rest.split_at(at);
        out.push_str(before);
        let (first, second) = (surrogate(escape), surrogate(escape.get(6..).unwrap_or("")));
        let taken = match (first, second) {
            // A whole character: both halves, in their order.
            (Some(Half::High), Some(Half::Low)) => 12,
            (Some(_), _) => {
                out.push_str("\\ufffd");
                rest = &escape[6..];
                continue;
            }
            // Any other escape: the backslash and what it escapes, another backslash included.
            (None, _) => escape.chars().take(2).map(char::len_utf8).sum(),
        };
        out.push_str(&escape[..taken]);
        rest = &escape[taken..];
    }
    out.push_str(rest);
    out
}

/// The half of a character a `\uXXXX` escape names.
enum Half {
    High,
    Low,
}

/// The half that the escape at the start of a text names, if it names one.
fn surrogate(text: &str) -> Option<Half> {
    let digits = text.strip_prefix("\\u")?.get(..4)?;
    match u16::from_str_radix(digits, 16).ok()? {
        0xD800..=0xDBFF => Some(Half::High),
        0xDC00..=0xDFFF => Some(Half::Low),
        _ => None,
    }
}
