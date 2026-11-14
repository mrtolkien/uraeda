//! The agents and models a pick chooses among: T3 Code's providers, read from the snapshots it
//! keeps of each, `caches/<instance>.json` in its data folder (`T3CODE_HOME`, else `~/.t3`). Its
//! CLI takes a provider and a model (`t3 thread start --provider --model`) but lists neither: the
//! snapshots are what it shows in its own pickers. Only the instances enabled and installed count.
//!
//! A pick names a provider by its instance id, `claudeAgent_claude2`, and a model by its slug,
//! `claude-fable-5-2`. A value written before, an agent `claude` or a model `fable`, is read as
//! the instance of that driver and the model of that alias.

use std::path::{Path, PathBuf};

use serde::Serialize;
use serde_json::Value;

/// A provider instance, as a pick offers it.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct Provider {
    /// `claudeAgent_claude2`.
    pub id: String,
    /// `Claude2`.
    pub name: String,
    /// `claudeAgent`.
    pub driver: String,
    pub models: Vec<Model>,
}

/// A model of a provider.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct Model {
    /// `claude-fable-5-2`.
    pub slug: String,
    /// `Claude Fable 5.2`.
    pub name: String,
    /// `fable`, `fable-5.2`.
    pub aliases: Vec<String>,
    pub default: bool,
    pub efforts: Vec<Effort>,
}

/// An effort a model takes.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct Effort {
    /// `xhigh`.
    pub id: String,
    /// `Extra High`.
    pub label: String,
    pub default: bool,
}

/// T3 Code's data folder: `T3CODE_HOME`, else `~/.t3`.
pub fn t3_home() -> PathBuf {
    match std::env::var_os("T3CODE_HOME").filter(|v| !v.is_empty()) {
        Some(home) => PathBuf::from(home),
        None => std::env::home_dir().unwrap_or_default().join(".t3"),
    }
}

/// The providers enabled and installed in T3 Code's data folder `home`, by name; none when it has
/// no snapshot.
pub fn read(home: &Path) -> Vec<Provider> {
    let Ok(entries) = std::fs::read_dir(home.join("caches")) else {
        return Vec::new();
    };
    let mut providers: Vec<Provider> = entries
        .flatten()
        .filter(|e| e.path().extension().is_some_and(|x| x == "json"))
        .filter_map(|e| std::fs::read_to_string(e.path()).ok())
        .filter_map(|text| serde_json::from_str::<Value>(&text).ok())
        .filter_map(|value| provider(&value))
        .collect();
    providers.sort_by(|a, b| a.name.cmp(&b.name));
    providers
}

/// A provider from its snapshot, when it is enabled, installed, and has models.
fn provider(value: &Value) -> Option<Provider> {
    let on = |key: &str| value.get(key).and_then(Value::as_bool) == Some(true);
    if !on("enabled") || !on("installed") {
        return None;
    }
    let text = |v: &Value, key: &str| v.get(key).and_then(Value::as_str).map(str::to_string);
    let models: Vec<Model> = value
        .get("models")?
        .as_array()?
        .iter()
        .filter_map(|m| {
            Some(Model {
                slug: text(m, "slug")?,
                name: text(m, "name").or_else(|| text(m, "slug"))?,
                aliases: m
                    .get("aliases")
                    .and_then(Value::as_array)
                    .map(|a| {
                        a.iter()
                            .filter_map(Value::as_str)
                            .map(String::from)
                            .collect()
                    })
                    .unwrap_or_default(),
                default: m.get("isDefault").and_then(Value::as_bool) == Some(true),
                efforts: efforts(m),
            })
        })
        .collect();
    if models.is_empty() {
        return None;
    }
    let id = text(value, "instanceId")?;
    Some(Provider {
        name: text(value, "displayName").unwrap_or_else(|| id.clone()),
        driver: text(value, "driver").unwrap_or_else(|| id.clone()),
        id,
        models,
    })
}

/// A model's efforts: its option `effort`, or `reasoningEffort`, without the values a prompt
/// carries, as Claude's `ultrathink`.
fn efforts(model: &Value) -> Vec<Effort> {
    let descriptors = model
        .pointer("/capabilities/optionDescriptors")
        .and_then(Value::as_array);
    let Some(effort) = descriptors.into_iter().flatten().find(|d| {
        matches!(
            d.get("id").and_then(Value::as_str),
            Some("effort" | "reasoningEffort")
        )
    }) else {
        return Vec::new();
    };
    let injected: Vec<&str> = effort
        .get("promptInjectedValues")
        .and_then(Value::as_array)
        .map(|a| a.iter().filter_map(Value::as_str).collect())
        .unwrap_or_default();
    effort
        .get("options")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|o| {
            let id = o.get("id").and_then(Value::as_str)?;
            (!injected.contains(&id)).then(|| Effort {
                id: id.to_string(),
                label: o
                    .get("label")
                    .and_then(Value::as_str)
                    .unwrap_or(id)
                    .to_string(),
                default: o.get("isDefault").and_then(Value::as_bool) == Some(true),
            })
        })
        .collect()
}

/// The provider an agent value names: its instance id, or a driver's short name, `claude` or
/// `codex`, read as that driver's own instance.
pub fn find<'a>(providers: &'a [Provider], agent: &str) -> Option<&'a Provider> {
    if agent.is_empty() {
        return None;
    }
    providers.iter().find(|p| p.id == agent).or_else(|| {
        let driver = match agent {
            "claude" => "claudeAgent",
            other => other,
        };
        providers
            .iter()
            .find(|p| p.driver == driver && p.id == p.driver)
    })
}

/// The model a model value names, by its slug or one of its aliases.
pub fn model<'a>(provider: &'a Provider, value: &str) -> Option<&'a Model> {
    provider
        .models
        .iter()
        .find(|m| m.slug == value || m.aliases.iter().any(|a| a == value))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn snapshot(id: &str, driver: &str, enabled: bool) -> Value {
        serde_json::json!({
            "instanceId": id, "driver": driver, "displayName": id, "enabled": enabled,
            "installed": true,
            "models": [{
                "slug": "claude-fable-5-2", "name": "Claude Fable 5.2", "aliases": ["fable"],
                "capabilities": { "optionDescriptors": [{
                    "id": "effort",
                    "options": [
                        { "id": "low", "label": "Low" },
                        { "id": "high", "label": "High", "isDefault": true },
                        { "id": "ultrathink", "label": "Ultrathink" }
                    ],
                    "promptInjectedValues": ["ultrathink"]
                }]}
            }]
        })
    }

    #[test]
    fn a_snapshot_gives_its_models_and_efforts_and_a_disabled_one_none() {
        let read = provider(&snapshot("claudeAgent", "claudeAgent", true)).unwrap();
        let efforts: Vec<_> = read.models[0]
            .efforts
            .iter()
            .map(|e| e.id.as_str())
            .collect();
        assert_eq!(efforts, ["low", "high"]);
        assert!(read.models[0].efforts[1].default);
        assert_eq!(provider(&snapshot("cursor", "cursor", false)), None);
    }

    #[test]
    fn values_written_before_find_their_provider_and_model() {
        let providers = vec![
            provider(&snapshot("claudeAgent", "claudeAgent", true)).unwrap(),
            provider(&snapshot("claudeAgent_claude2", "claudeAgent", true)).unwrap(),
        ];
        assert_eq!(find(&providers, "claude").unwrap().id, "claudeAgent");
        assert_eq!(
            find(&providers, "claudeAgent_claude2").unwrap().id,
            "claudeAgent_claude2"
        );
        assert_eq!(find(&providers, "codex"), None);
        assert_eq!(
            model(&providers[0], "fable").unwrap().slug,
            "claude-fable-5-2"
        );
    }
}
