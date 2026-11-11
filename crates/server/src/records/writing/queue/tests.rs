//! The queues' stop, which no client can reach: its connections end as the stop begins, and the
//! writes left are those of calls still running and of the server's own tasks.

use std::sync::Arc;
use std::time::SystemTime;

use tempfile::TempDir;

use super::{Queues, Write};
use crate::live::{self, Bus};
use crate::{Clock, Options, Shared};

// The break it catches: a write that arrives once the stop began opens a new queue, which defers
// its commit again to a landing thread nothing joins, so the process may exit mid-commit.
#[tokio::test]
async fn no_write_opens_a_queue_once_the_stop_began() {
    let folder = TempDir::new().unwrap();
    let options = Options {
        port: 0,
        config_dir: folder.path().join("config"),
        data_dir: folder.path().join("data"),
        folder: None,
        environment: Vec::new(),
        allow_origins: Vec::new(),
        clock: Clock::fixed(SystemTime::UNIX_EPOCH),
        no_scheduled_jobs: true,
        sandbox: None,
    };
    let shared = Shared::new(options, 0, String::new());
    shared.provide::<Bus>(live::test_bus(&shared));
    let queues = Arc::new(Queues::default());
    let repository = folder.path();

    let opened = queues
        .open(&shared, repository)
        .expect("a queue, before the stop");
    tokio::task::spawn_blocking({
        let queues = queues.clone();
        move || queues.close()
    })
    .await
    .unwrap();

    let refused = queues.open(&shared, repository).map(|_| ());
    assert_eq!(
        refused.unwrap_err().message(),
        super::repository::stopped().message()
    );
    // A write that found the queue before the stop is refused its turn too, and lands nothing.
    let turn = opened.turn("repository", Write::saving()).map(|_| ());
    assert!(turn.is_err(), "a turn after the stop");
    let land = opened.add("repository", Write::saving(), Box::new(|_| unreachable!()));
    assert!(land.is_err(), "a landing queued after the stop");
}
