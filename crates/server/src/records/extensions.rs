//! The records of the extensions: `Extensions`, every extension with its state and its
//! settings, and `ExtensionRecord`, a record an extension's server part registered; and their
//! actions, `extensions.act`, which runs an extension's action, and the settings page's.
//!
//! An extension names its records and actions as it loads, so they are no entries of the
//! catalog: each is `ExtensionRecord` or `extensions.act`, by the extension's name and its own.

use serde_json::{Value, json};
use uraeda_core::extensions::{self as core, EXTENSION_API, On};
use uraeda_core::watch::Changes;
use uraeda_protocol::{
    ExtensionAction, ExtensionProblem, ExtensionRecord, ExtensionRow, ExtensionSetting,
    ExtensionSource, Extensions as ExtensionsRecord, ExtensionsAct, ExtensionsReportPageProblem,
    ExtensionsSetOn, ExtensionsSetSetting,
};

use super::repositories;
use crate::Failure;
use crate::extensions::{self, Extensions, Shown};
use crate::live::{Call, Registry};
use crate::shared::Shared;

/// Registers the extensions' records and actions.
pub(super) fn register(_: &Shared, registry: &Registry) -> Result<(), Failure> {
    registry.record::<ExtensionsRecord>(|shared, args| Ok(read(shared, args.repo.as_deref())));
    registry.record::<ExtensionRecord>(|shared, args| {
        repositories::find(shared, &args.repo)?;
        Ok(shared.get::<Extensions>().read_record(&args))
    });
    registry.action::<ExtensionsAct>(|call, input| {
        repositories::find(call.shared(), &input.repo)?;
        let extensions = call.shared().get::<Extensions>();
        let output = extensions.act(&input.repo, &input.extension, &input.name, &input.input)?;
        Ok(ExtensionAction { output })
    });
    registry.action::<ExtensionsSetOn>(|call, input| {
        let on = match input.on_all {
            true => On::All,
            false => On::Some(input.on),
        };
        let shared = call.shared();
        core::set_on(shared.config_dir(), shared.data_dir(), &input.name, on)?;
        written(call);
        Ok(())
    });
    registry.action::<ExtensionsSetSetting>(|call, input| {
        let (shared, value) = (call.shared(), input.value.to_string());
        let repository = input.repository.as_deref();
        let (config, data) = (shared.config_dir(), shared.data_dir());
        core::set_setting(config, data, &input.name, repository, &input.key, &value)?;
        written(call);
        Ok(())
    });
    registry.action::<ExtensionsReportPageProblem>(|call, input| {
        let extensions = call.shared().get::<Extensions>();
        if extensions.report_page_problem(&input.name, input.version, &input.message) {
            call.bus().changed_all::<ExtensionsRecord>();
        }
        Ok(())
    });
    Ok(())
}

/// The settings file was written: the extensions are read again before the action answers,
/// so a read after its answer shows what it changed, and the extension it changed loads again.
fn written(call: &Call) {
    call.shared().get::<Extensions>().refresh();
}

/// A repository's files changed: what its extensions listen to is sent.
pub(super) fn files_changed(shared: &Shared, repository: &str, changes: &Changes) {
    extensions::files_changed(shared, repository, changes);
}

/// The settings file changed: where each extension is on, and its settings, are read again.
pub(super) fn config_changed(shared: &Shared) {
    if let Some(extensions) = shared.find::<Extensions>() {
        extensions.wake(None);
    }
}

/// A repository left the list: what its events are compared with is forgotten.
pub(super) fn repository_left(shared: &Shared, repository: &str) {
    extensions::repository_left(shared, repository);
}

/// The `Extensions` record, for a repository or for the settings page.
fn read(shared: &Shared, repo: Option<&str>) -> ExtensionsRecord {
    let (folder, shown) = shared.get::<Extensions>().shown(shared);
    let rows = shown.into_iter().map(|shown| row(shared, shown, repo));
    ExtensionsRecord {
        api: EXTENSION_API,
        folder,
        extensions: rows.collect(),
    }
}

/// An extension's row, with its settings as the reader's repository has them.
fn row(shared: &Shared, shown: Shown, repo: Option<&str>) -> ExtensionRow {
    let Shown {
        extension,
        state,
        waiting_for,
        page_version,
        problems,
    } = shown;
    let json = |text: String| serde_json::from_str(&text).unwrap_or_else(|_| json!({}));
    let has_settings = !extension.settings.is_empty();
    let config = shared.config_dir();
    // One without settings has none to read, in any repository.
    let values = match has_settings {
        true => json(core::settings_json(config, &extension.name, None)),
        false => json!({}),
    };
    let values_here = match repo {
        None => values.clone(),
        Some(repo) if has_settings && core::is_on(&extension, Some(repo)) => {
            json(core::settings_json(config, &extension.name, Some(repo)))
        }
        Some(_) => json!({}),
    };
    let repository_values = match repo {
        None if has_settings => json(core::repository_settings_json(config, &extension.name)),
        _ => json!({}),
    };
    let settings = extension
        .settings
        .into_iter()
        .map(|setting| ExtensionSetting {
            key: setting.key,
            kind: setting.kind,
            default: serde_json::from_str(&setting.default_json).unwrap_or(Value::Null),
            label: setting.label,
            help: setting.help,
        });
    let problems = problems.into_iter().map(|problem| ExtensionProblem {
        file: problem.file,
        line: problem.line,
        message: problem.message,
    });
    ExtensionRow {
        id: extension.name.clone(),
        name: extension.name,
        title: extension.title,
        description: extension.description,
        version: extension.version,
        api: extension.api,
        icon: extension.icon,
        is_built_in: extension.is_built_in,
        is_linked: extension.is_linked,
        source: extension.source.map(|source| ExtensionSource {
            url: source.url,
            commit: source.commit,
            git_ref: source.git_ref,
        }),
        on_all: extension.on_all,
        on: extension.on,
        state,
        waiting_for,
        page_version,
        problems: problems.collect(),
        settings: settings.collect(),
        values,
        values_here,
        repository_values,
    }
}
