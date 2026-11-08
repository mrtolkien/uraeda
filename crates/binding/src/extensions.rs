//! Extensions: the built-in ones and the owner's, in `extensions/` in the config folder, with the
//! repositories each is on in and its settings. Reading never rejects; a refused write rejects
//! with `refused: `, and a settings file that cannot be read with `unreadable: `.

use std::path::Path;

use napi::Either;
use napi::bindgen_prelude::AsyncTask;
use napi_derive::napi;
use uraeda_core::extensions::{self, Extensions, On};

use super::{Job, job};

/// The extensions folder in the config folder `configDir`. It reads nothing, so it returns at once.
#[napi]
pub fn extensions_folder(config_dir: String) -> String {
    extensions::extensions_dir(Path::new(&config_dir))
        .to_string_lossy()
        .into_owned()
}

/// The extension API this Uraeda runs. It reads nothing, so it returns at once.
#[napi]
pub fn extension_api() -> u32 {
    extensions::EXTENSION_API
}

/// The built-in extensions and the config folder's, each with its problems.
#[napi(ts_return_type = "Promise<Extensions>")]
pub fn read_extensions(config_dir: String) -> AsyncTask<Job<Extensions>> {
    job(move || Ok(extensions::read(Path::new(&config_dir))))
}

/// The settings of the extension `name` for `repository`, or for every repository, as a JSON
/// object: `{}` for an extension that does not exist.
#[napi(ts_return_type = "Promise<string>")]
pub fn extension_settings(
    config_dir: String,
    name: String,
    repository: Option<String>,
) -> AsyncTask<Job<String>> {
    job(move || {
        let json = extensions::settings_json(Path::new(&config_dir), &name, repository.as_deref());
        Ok(json)
    })
}

/// The values of the extension `name` set for one repository, as a JSON object by repository:
/// `{}` for an extension that does not exist.
#[napi(ts_return_type = "Promise<string>")]
pub fn extension_repository_settings(config_dir: String, name: String) -> AsyncTask<Job<String>> {
    job(move || {
        let json = extensions::repository_settings_json(Path::new(&config_dir), &name);
        Ok(json)
    })
}

/// Writes the repositories the extension `name` is on in: `"all"`, or their names, none turning it
/// off.
#[napi(
    ts_args_type = "configDir: string, dataDir: string, name: string, on: \"all\" | string[]",
    ts_return_type = "Promise<void>"
)]
pub fn set_extension_on(
    config_dir: String,
    data_dir: String,
    name: String,
    on: Either<String, Vec<String>>,
) -> napi::Result<AsyncTask<Job<()>>> {
    let on = match on {
        Either::A(all) if all == "all" => On::All,
        Either::A(other) => {
            return Err(napi::Error::from_reason(format!(
                "refused: {other} is not \"all\" or a list of repository names."
            )));
        }
        Either::B(names) => On::Some(names),
    };
    Ok(job(move || {
        extensions::set_on(Path::new(&config_dir), Path::new(&data_dir), &name, on)
    }))
}

/// Writes the setting `key` of the extension `name` to `valueJson`, a JSON value, for
/// `repository`, or for every repository when it is `null`.
#[napi(
    ts_args_type = "configDir: string, dataDir: string, name: string, repository: string | null, key: string, valueJson: string",
    ts_return_type = "Promise<void>"
)]
pub fn set_extension_setting(
    config_dir: String,
    data_dir: String,
    name: String,
    repository: Option<String>,
    key: String,
    value_json: String,
) -> AsyncTask<Job<()>> {
    job(move || {
        extensions::set_setting(
            Path::new(&config_dir),
            Path::new(&data_dir),
            &name,
            repository.as_deref(),
            &key,
            &value_json,
        )
    })
}
