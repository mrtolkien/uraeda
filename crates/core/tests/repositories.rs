//! Uraeda's data folder follows the platform.

use std::path::{Path, PathBuf};

use uraeda_core::repositories;

type DataDirCase = (
    &'static [(&'static str, &'static str)],
    &'static str,
    &'static str,
);

#[test]
fn the_data_folder_follows_the_platform() {
    let cases: [DataDirCase; 7] = [
        (&[("URAEDA_DATA_DIR", "/data")], "linux", "/data"),
        (&[("XDG_DATA_HOME", "/xdg")], "linux", "/xdg/uraeda"),
        (&[], "linux", "/home/me/.local/share/uraeda"),
        (
            &[("XDG_DATA_HOME", "")],
            "linux",
            "/home/me/.local/share/uraeda",
        ),
        (&[], "macos", "/home/me/Library/Application Support/uraeda"),
        (
            &[("APPDATA", "C:\\Users\\me\\AppData\\Roaming")],
            "windows",
            "C:\\Users\\me\\AppData\\Roaming\\uraeda",
        ),
        (
            &[("URAEDA_DATA_DIR", "/data"), ("XDG_DATA_HOME", "/xdg")],
            "macos",
            "/data",
        ),
    ];
    for (vars, os, expected) in cases {
        let var = |name: &str| {
            vars.iter()
                .find(|(key, _)| *key == name)
                .map(|(_, value)| value.to_string())
        };

        let folder = repositories::data_dir(var, os, Path::new("/home/me"));

        assert_eq!(folder, PathBuf::from(expected), "{vars:?} on {os}");
    }
}
