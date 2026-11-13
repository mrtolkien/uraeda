//! Reading Codex's JSON, whose fields are present, absent, or of another type than expected:
//! each helper gives what a field holds when it is of the type asked, and nothing otherwise.

use serde_json::{Map, Value};

/// A JSON object.
pub(super) type Object = Map<String, Value>;

/// The text of a field: empty when it is absent, or no text.
pub(super) fn text<'a>(value: &'a Value, key: &str) -> &'a str {
    value.get(key).and_then(Value::as_str).unwrap_or_default()
}

/// The text of a field, when it has one that is not empty.
pub(super) fn filled<'a>(value: &'a Value, key: &str) -> Option<&'a str> {
    Some(text(value, key)).filter(|text| !text.is_empty())
}

/// The object of a field, when it is one.
pub(super) fn object<'a>(value: &'a Value, key: &str) -> Option<&'a Value> {
    value.get(key).filter(|value| value.is_object())
}

/// The objects of a field that is a list: none for any other field.
pub(super) fn objects<'a>(value: &'a Value, key: &str) -> Vec<&'a Value> {
    let items = value.get(key).and_then(Value::as_array);
    let items = items.map(|items| items.iter().filter(|item| item.is_object()));
    items.map(Iterator::collect).unwrap_or_default()
}

/// The texts of a field that is a list: none for any other field.
pub(super) fn texts<'a>(value: &'a Value, key: &str) -> Vec<&'a str> {
    let items = value.get(key).and_then(Value::as_array);
    let items = items.map(|items| items.iter().filter_map(Value::as_str));
    items.map(Iterator::collect).unwrap_or_default()
}

/// The number of a field, when it is one.
pub(super) fn number(value: &Value, key: &str) -> Option<f64> {
    value.get(key).filter(|value| value.is_number())?.as_f64()
}

/// Whether a field holds something JavaScript takes as true: anything but an absent field,
/// `null`, `false`, zero, and an empty text.
pub(super) fn truthy(value: &Value, key: &str) -> bool {
    match value.get(key) {
        None | Some(Value::Null) => false,
        Some(Value::Bool(set)) => *set,
        Some(Value::Number(number)) => number.as_f64().is_some_and(|number| number != 0.0),
        Some(Value::String(text)) => !text.is_empty(),
        Some(Value::Array(_) | Value::Object(_)) => true,
    }
}

/// A number as JavaScript writes it in a text: a whole one without its fraction.
pub(super) fn written(number: f64) -> String {
    #[allow(
        clippy::cast_possible_truncation,
        reason = "a whole number below 2^53, checked first"
    )]
    if number.fract() == 0.0 && number.abs() < 9.0e15 {
        format!("{}", number as i64)
    } else {
        format!("{number}")
    }
}
