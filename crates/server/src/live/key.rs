//! What names one record among those of its name.

use serde::Serialize;
use serde_json::Value;

/// A record's key: its arguments, as one text. Two subscribers whose arguments are equal share
/// one read and one value, and a domain names the record it changed by the same arguments.
#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub(super) struct Key(String);

impl Key {
    /// The key of a record's arguments, with the arguments as JSON.
    ///
    /// # Errors
    ///
    /// When the arguments are not JSON, as a map whose keys are not texts.
    pub(super) fn of<Args: Serialize>(args: &Args) -> Result<(Key, Value), serde_json::Error> {
        let args = sorted(serde_json::to_value(args)?);
        Ok((Key(args.to_string()), args))
    }
}

/// A value with each record's fields in the order of their names, so its text does not depend on
/// the order they were written in.
fn sorted(value: Value) -> Value {
    match value {
        Value::Object(fields) => {
            let mut fields: Vec<(String, Value)> = fields.into_iter().collect();
            fields.sort_by(|(one, _), (other, _)| one.cmp(other));
            let fields = fields
                .into_iter()
                .map(|(name, value)| (name, sorted(value)));
            Value::Object(fields.collect())
        }
        Value::Array(items) => Value::Array(items.into_iter().map(sorted).collect()),
        other => other,
    }
}
