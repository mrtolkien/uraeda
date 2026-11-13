//! One data folder, one server: a second start on the folder of a server that runs, but has not
//! said so yet in its status file, is refused, and touches none of the first's files.

use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

use uraeda_server::{Server, status};

use crate::support;

/// Every file under `folder`, with its bytes, but the extensions' built modules: the first server
/// still writes those in the background as the second starts.
fn files(folder: &Path) -> BTreeMap<PathBuf, Vec<u8>> {
    let mut found = BTreeMap::new();
    let mut folders = vec![folder.to_owned()];
    while let Some(folder) = folders.pop() {
        for entry in fs::read_dir(&folder).unwrap().flatten() {
            let path = entry.path();
            if path.is_dir() {
                if path.file_name().is_some_and(|name| name == "extensions") {
                    continue;
                }
                folders.push(path);
            } else {
                found.insert(path.clone(), fs::read(&path).unwrap());
            }
        }
    }
    found
}

#[tokio::test]
async fn a_second_server_on_one_data_folder_is_refused() {
    let first = support::server().await;
    let data = first.data_dir().to_owned();
    let running = status::read(&data).expect("the first's status");

    // Before the first says where it listens, a second start, on any port, finds no status.
    status::remove(&data);
    let before = files(&data);
    let Err(refused) = Server::start(first.options()).await else {
        panic!("a second server started on the first's data folder");
    };
    assert_eq!(
        refused.to_string(),
        format!(
            "another Uraeda server is starting on the data folder {}: wait for it, or stop it",
            data.display()
        )
    );
    assert_eq!(
        files(&data),
        before,
        "the second start changed the first's files"
    );

    // Once it has, the second names it, when it does not answer.
    let mut gone = running.clone();
    gone.token = "a token it refuses".to_owned();
    fs::write(status::path(&data), serde_json::to_vec(&gone).unwrap()).unwrap();
    let Err(refused) = Server::start(first.options()).await else {
        panic!("a second server started on the first's data folder");
    };
    assert_eq!(
        refused.to_string(),
        format!(
            "the data folder {} is held by the Uraeda server at http://127.0.0.1:{} (process {}), \
             which did not answer: stop it, or pass another --data-dir",
            data.display(),
            running.port,
            running.pid
        )
    );
    first.stop().await;
}
