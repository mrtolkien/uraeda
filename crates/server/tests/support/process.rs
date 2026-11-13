//! The processes a test's server started, as the machine lists them: a preview's command, or an
//! agent's.

use std::process::Command;
use std::time::Duration;

/// How long a group gets to end.
const PATIENCE: Duration = Duration::from_secs(10);

/// The processes of a process group that still run, zombies left out, as `ps` lists them.
pub fn group_members(group: u32) -> Vec<u32> {
    let listed = Command::new("ps")
        .args(["-eo", "pid=,pgid=,stat="])
        .output()
        .unwrap();
    let listed = String::from_utf8(listed.stdout).unwrap();
    let rows = listed.lines().filter_map(|line| {
        let mut cells = line.split_whitespace();
        let (pid, pgid, stat) = (cells.next()?, cells.next()?, cells.next()?);
        let runs = pgid.parse() == Ok(group) && !stat.starts_with('Z');
        runs.then(|| pid.parse().unwrap())
    });
    rows.collect()
}

/// Waits until no process of the group runs: the processes left once the wait is over.
pub async fn gone(group: u32) -> Vec<u32> {
    let deadline = tokio::time::Instant::now() + PATIENCE;
    loop {
        let left = group_members(group);
        if left.is_empty() || tokio::time::Instant::now() > deadline {
            return left;
        }
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
}
