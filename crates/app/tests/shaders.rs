//! Every shader of the app compiles. Native Shell compiles a `<Shader>`'s source as the page draws
//! it, and one that fails is only a warning in the log: the view draws nothing, and nothing else
//! says so. The caret's trail was such a shader (ruling T96.3).

use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

use nsh_core::shader::Shader;

/// The `.wgsl.ts` modules under `dir`, at any depth.
fn modules(dir: &Path, found: &mut Vec<PathBuf>) {
    for entry in fs::read_dir(dir).unwrap() {
        let path = entry.unwrap().path();
        if path.is_dir() {
            modules(&path, found);
        } else if path.to_string_lossy().ends_with(".wgsl.ts") {
            found.push(path);
        }
    }
}

/// Each `export const NAME = /* wgsl */ \`...\`` of a module, by name.
fn sources(text: &str, into: &mut BTreeMap<String, String>) {
    for part in text.split("export const ").skip(1) {
        let Some((name, rest)) = part.split_once(" = /* wgsl */ `") else {
            continue;
        };
        // Its end: a backtick may stand in a comment of the shader, never before `;`.
        let body = rest.split_once("`;").expect("a closed template").0;
        into.insert(name.trim().to_owned(), body.to_owned());
    }
}

#[test]
fn every_shader_of_the_app_compiles() {
    let app = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../app");
    let mut found = Vec::new();
    modules(&app, &mut found);
    let mut all = BTreeMap::new();
    for path in &found {
        sources(&fs::read_to_string(path).unwrap(), &mut all);
    }
    // A shader that shares another's functions takes them in as `${NAME}`.
    let whole = |body: &str| {
        all.iter().fold(body.to_owned(), |text, (name, shared)| {
            text.replace(&format!("${{{name}}}"), shared)
        })
    };
    let shaders: Vec<_> = all
        .iter()
        .filter(|(_, body)| body.contains("fn shade("))
        .collect();
    assert!(
        shaders.len() >= 4,
        "the app's shaders were not found: {:?}",
        all.keys()
    );
    let failed: Vec<String> = shaders
        .iter()
        .filter_map(|(name, body)| {
            Shader::compile(&whole(body))
                .err()
                .map(|error| format!("{name}: {error}"))
        })
        .collect();
    assert!(failed.is_empty(), "{}", failed.join("\n"));
}
