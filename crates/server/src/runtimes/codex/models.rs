//! The models Codex lists for the account: `model/list`, page after page, and `config/read`,
//! asked together, and the list a picker offers made of them.

use serde_json::{Value, json};
use uraeda_protocol::{AgentModel, ModelDefaults, ModelEffort, ModelList};

use super::json::{filled, object, objects};
use super::rpc::Answer;
use super::target::effort_name;

/// `model/list` pages read at most, should Codex never stop giving a cursor.
const MAX_PAGES: usize = 50;

/// The rows of `model/list` pages offered in a picker, each with its model: all but the hidden
/// ones.
fn shown_rows(rows: &[Value]) -> Vec<(&Value, &str)> {
    let rows = rows.iter().filter(|row| row.is_object());
    let shown = rows.filter_map(|row| {
        let model = filled(row, "model").or_else(|| filled(row, "id"))?;
        (row.get("hidden") != Some(&Value::Bool(true))).then_some((row, model))
    });
    shown.collect()
}

/// The models of Codex's `model/list` rows, every page's, and its configuration, the `config`
/// of a `config/read` answer: each row but the hidden ones, by its model as the id, its display
/// name, and its efforts. The defaults are the configured model and effort, else the row marked
/// default and its default effort.
pub(super) fn models(rows: &[Value], config: &Value) -> ModelList {
    let shown = shown_rows(rows);
    let listed = shown.iter().map(|(row, model)| {
        let efforts = objects(row, "supportedReasoningEfforts").into_iter();
        let efforts = efforts.filter_map(|option| {
            let id = filled(option, "reasoningEffort")?;
            Some(ModelEffort {
                id: id.to_owned(),
                name: effort_name(id).to_owned(),
            })
        });
        AgentModel {
            id: (*model).to_owned(),
            name: filled(row, "displayName").unwrap_or(model).to_owned(),
            description: filled(row, "description").map(str::to_owned),
            efforts: efforts.collect(),
        }
    });
    let marked = shown
        .iter()
        .find(|(row, _)| row.get("isDefault") == Some(&Value::Bool(true)));
    let model = filled(config, "model").or(marked.map(|(_, model)| *model));
    let of_model = shown.iter().find(|(_, each)| Some(*each) == model);
    let effort = filled(config, "model_reasoning_effort")
        .or_else(|| filled(of_model?.0, "defaultReasoningEffort"));
    ModelList {
        defaults: ModelDefaults {
            model: model.map(str::to_owned),
            effort: effort.map(str::to_owned),
        },
        models: listed.collect(),
    }
}

/// The `config` of a `config/read` answer: nothing for an answer without one.
pub(super) fn config_of(answer: &Value) -> Value {
    object(answer, "config").cloned().unwrap_or(json!({}))
}

/// What a listing asks next.
pub(super) enum Next {
    /// Nothing: an answer is still awaited.
    Wait,
    /// The next page of `model/list`, with these parameters.
    Page(Value),
    /// Every page and the configuration were read.
    Done(Listed),
    /// Codex refused one of the two, in these words.
    Failed(String),
}

/// The rows of `model/list`, every page's, and the answer of `config/read`.
pub(super) struct Listed {
    pub rows: Vec<Value>,
    pub config: Value,
}

/// The two asks of a listing, `model/list` page after page and `config/read`, answered in any
/// order: the first refusal fails it.
#[derive(Default)]
pub(super) struct Listing {
    rows: Vec<Value>,
    pages: usize,
    listed: bool,
    config: Option<Value>,
    over: bool,
}

impl Listing {
    /// The parameters of the first `model/list`, and of `config/read`.
    pub(super) fn asks() -> (Value, Value) {
        (json!({}), json!({ "includeLayers": false }))
    }

    /// A page of `model/list` was answered.
    pub(super) fn page(&mut self, answer: Answer) -> Next {
        if self.over {
            return Next::Wait;
        }
        let answer = match answer {
            Ok(answer) => answer,
            Err(why) => return self.fail(why),
        };
        if let Some(rows) = answer.get("data").and_then(Value::as_array) {
            self.rows.extend(rows.iter().cloned());
        }
        self.pages += 1;
        match filled(&answer, "nextCursor") {
            Some(cursor) if self.pages < MAX_PAGES => Next::Page(json!({ "cursor": cursor })),
            _ => {
                self.listed = true;
                self.done()
            }
        }
    }

    /// `config/read` was answered.
    pub(super) fn config(&mut self, answer: Answer) -> Next {
        if self.over {
            return Next::Wait;
        }
        match answer {
            Ok(answer) => {
                self.config = Some(answer);
                self.done()
            }
            Err(why) => self.fail(why),
        }
    }

    fn fail(&mut self, why: String) -> Next {
        self.over = true;
        Next::Failed(why)
    }

    fn done(&mut self) -> Next {
        if !self.listed {
            return Next::Wait;
        }
        let Some(config) = self.config.take() else {
            return Next::Wait;
        };
        self.over = true;
        Next::Done(Listed {
            rows: std::mem::take(&mut self.rows),
            config,
        })
    }
}
