//! What Claude Code's answers to `list_models` and `get_settings` say: the models offered, and
//! what a process runs on.

use serde_json::Value;
use uraeda_protocol::{AgentModel, ModelDefaults, ModelEffort, ModelList};

use super::super::built_in::effort_name;
use super::json::{field, is_true, listed, nested, string, words};
use crate::runner::Event;

/// The rows of a `list_models` answer, but its `default` row, which stands for one of the
/// others.
fn rows(list: &Value) -> Vec<&Value> {
    let rows = field(list, "models").map(listed).unwrap_or_default();
    let named = |row: &&Value| string(row, "value").is_some_and(|value| value != "default");
    rows.into_iter().filter(named).collect()
}

/// The row of a model, an id Claude Code runs on: the row resolving to it, else the row it
/// names.
fn row_of<'a>(rows: &[&'a Value], model: &str) -> Option<&'a Value> {
    let by = |key: &str| rows.iter().find(|row| string(row, key) == Some(model));
    by("resolvedModel").or_else(|| by("value")).copied()
}

/// The models of Claude Code's `list_models` and `get_settings` answers: each row but the
/// `default` one and those that drop `auto` mode, which an unattended run cannot do without,
/// its `value` as the id. The defaults are the listed row of the configured model, else of the
/// one it runs on, none when neither is listed, and the effort it runs on.
pub(super) fn models(list: &Value, settings: &Value) -> ModelList {
    let rows = rows(list);
    let listed: Vec<&Value> = rows
        .into_iter()
        .filter(|row| is_true(row, "supportsAutoMode"))
        .collect();
    let applied = nested(settings, "applied");
    let running = words(applied, "model");
    let configured = words(nested(settings, "effective"), "model");
    // The configured model may be an id the list resolves, as the one it runs on is.
    let by = |key: &str, model: &str| listed.iter().find(|row| string(row, key) == Some(model));
    let configured = configured.and_then(|model| {
        by("value", model)
            .or_else(|| by("resolvedModel", model))
            .copied()
    });
    let model = configured.or_else(|| running.and_then(|model| row_of(&listed, model)));
    ModelList {
        defaults: ModelDefaults {
            model: model
                .and_then(|row| string(row, "value"))
                .map(str::to_owned),
            effort: words(applied, "effort").map(str::to_owned),
        },
        models: listed.iter().map(|row| model_of(row)).collect(),
    }
}

/// A row, as a model a session is started on.
fn model_of(row: &Value) -> AgentModel {
    let levels = field(row, "supportedEffortLevels").and_then(Value::as_array);
    let levels = levels.into_iter().flatten().filter_map(Value::as_str);
    let id = string(row, "value").unwrap_or_default();
    AgentModel {
        id: id.to_owned(),
        name: words(row, "displayName").unwrap_or(id).to_owned(),
        description: words(row, "description").map(str::to_owned),
        efforts: levels
            .map(|level| ModelEffort {
                id: level.to_owned(),
                name: effort_name(level).to_owned(),
            })
            .collect(),
    }
}

/// What a process runs on, from its `get_settings` answer, by names: the model's from the
/// `list_models` answer, else its id, and the effort's. None when the answer names no model.
pub(super) fn runs_on(list: &Value, settings: &Value) -> Option<Event> {
    let applied = nested(settings, "applied");
    let model = words(applied, "model")?;
    let row = row_of(&rows(list), model);
    let name = row.and_then(|row| words(row, "displayName"));
    Some(Event::RunsOn {
        model: name.unwrap_or(model).to_owned(),
        effort: words(applied, "effort").map(|effort| effort_name(effort).to_owned()),
    })
}
