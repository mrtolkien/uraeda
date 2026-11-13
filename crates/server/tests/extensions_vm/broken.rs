//! Broken extensions, and the server's stop: one that throws, recurses, or takes memory
//! without end is broken alone; one that never returns is cut off; and nothing a VM started
//! is left when the server stops.

use std::fs;
use std::time::Duration;

use serde_json::json;
use uraeda_protocol::ErrorCode;

use super::support::{self, Held, Live, fixture_repo, gone, group_members};
use super::{REPO, act, in_state, loaded, no_vm_threads, row, started, with};

/// How long a test that waits on a VM's limits may take, before it fails in place of hanging.
const LONGEST: Duration = Duration::from_secs(90);

/// The limit on a call, in place of its 10 seconds, for the test that waits it out.
const CALL_LIMIT: Duration = Duration::from_secs(2);

// The extensions decision: a broken extension MUST NOT stop Uraeda or another extension. Each
// of these is broken its own way, as it loads or after, and names its problem in the record
// `Extensions`: the server and the extension beside them go on.
#[tokio::test]
async fn an_extension_that_throws_at_load_leaves_the_others_running() {
    let repo = fixture_repo(REPO);
    let names = ["deep", "echo", "greedy", "later", "throws"];
    let server = started(&repo, &names).await;

    let threw = in_state(&server, "throws", "broken").await;
    let problem = json!({ "file": "server.ts", "line": null, "message": "it broke as it loaded" });
    assert_eq!(threw["problems"], json!([problem]));
    // A call nested without end is refused by the engine: it never reaches the thread's stack.
    let deep = in_state(&server, "deep", "broken").await;
    assert_eq!(deep["problems"][0]["file"], "server.ts");
    // Memory without end is refused at the VM's limit, or cut off at its 2 seconds.
    let greedy = in_state(&server, "greedy", "broken").await;
    assert_eq!(greedy["problems"][0]["file"], "server.ts");

    // One that breaks after it loaded: a timer's callback that throws turns it off alone.
    loaded(&server, "later", "alive").await;
    assert_eq!(
        act(&server, "later", "break", json!(null)).await,
        Ok(json!(null))
    );
    let later = in_state(&server, "later", "broken").await;
    assert_eq!(later["problems"][0]["message"], "it broke later");
    let alive = support::read(&server, "ExtensionRecord", super::record("later", "alive")).await;
    assert_eq!(alive["error"], "later has no record alive");

    // The extension beside them answers, and so does the server.
    assert_eq!(in_state(&server, "echo", "on").await["problems"], json!([]));
    let added = act(&server, "echo", "add", json!({ "by": 1 })).await;
    assert_eq!(added.map(|output| output["count"].clone()), Ok(json!(1)));
    let listed = support::read(&server, "Repositories", json!(null)).await;
    assert_eq!(listed["rows"][0]["name"], REPO);

    // A save loads a broken one again.
    let file = server.config_dir().join("extensions/throws/server.ts");
    fs::write(&file, "export default function activate() {}\n").unwrap();
    assert_eq!(
        in_state(&server, "throws", "on").await["problems"],
        json!([])
    );
    server.stop().await;
}

// The extensions decision's limit on time: an activation that never returns is cut off at 2
// seconds, and a call at 10, here at 2 not to wait for it. The extension is broken, its VM's
// thread ends, and the server answers meanwhile.
#[tokio::test]
async fn an_extension_that_never_returns_is_cut_off() {
    let cut_off = async {
        let repo = fixture_repo(REPO);
        let setup = support::setup().folder(repo.path());
        let setup = setup.extension_call_limit(CALL_LIMIT);
        let server = with(setup, &["busy", "endless"]).start().await;

        let endless = in_state(&server, "endless", "broken").await;
        let slow =
            json!({ "file": "server.ts", "line": null, "message": "took more than 2 s to load" });
        assert_eq!(endless["problems"], json!([slow]));

        let child = loaded(&server, "busy", "child").await;
        let pid = child.value["value"]["pid"].as_u64().expect("a process") as u32;
        let mut live = Live::of(&server).await;
        let input = json!({ "repo": REPO, "extension": "busy", "name": "spin", "input": null });
        let spinning = live.send("extensions.act", input).await;
        // While it spins, the server answers: the VM holds none of its threads.
        let listed = support::read(&server, "Repositories", json!(null)).await;
        assert_eq!(listed["rows"][0]["name"], REPO);

        // Past its limit, the call is refused, and the extension is broken with why.
        let mut all = Held::open(&server, "Extensions", json!({ "repo": null })).await;
        let mut broken = false;
        for _ in 0..40 {
            broken = row(&all.value, "busy")["state"] == "broken";
            if broken {
                break;
            }
            tokio::time::sleep(Duration::from_millis(500)).await;
            all = Held::open(&server, "Extensions", json!({ "repo": null })).await;
        }
        assert!(
            broken,
            "the spinning extension is not broken: {}",
            row(&all.value, "busy")
        );
        let problems = &row(&all.value, "busy")["problems"];
        assert_eq!(problems[0]["message"], "took more than 2 s in a call");
        let (code, _) = live
            .answer(spinning)
            .await
            .expect_err("the call that never returns");
        assert_eq!(code, ErrorCode::Refused);

        // Both VMs are gone, with what they started.
        assert_eq!(no_vm_threads().await, Vec::<String>::new());
        assert_eq!(gone(pid).await, Vec::<u32>::new());
        server.stop().await;
    };
    let ended = tokio::time::timeout(LONGEST, cut_off).await;
    ended.expect("an extension that never returns hangs its VM: nothing cut it off");
}

// The plan's review focus 3: the server stops while an extension's VM is in a call. The VM is
// stopped, and no thread, timer, or process of it is left.
#[tokio::test]
async fn stopping_the_server_leaves_no_vm_work_behind() {
    let stopped = async {
        let repo = fixture_repo(REPO);
        let server = started(&repo, &["busy"]).await;
        let child = loaded(&server, "busy", "child").await;
        let pid = child.value["value"]["pid"].as_u64().expect("a process") as u32;
        assert!(
            !group_members(pid).is_empty(),
            "the extension's command runs"
        );

        // A timer that writes a file, every 20 ms.
        let folder = tempfile::tempdir().unwrap();
        let ticks = folder.path().join("ticks");
        let ticking = json!({ "file": ticks });
        assert_eq!(act(&server, "busy", "tick", ticking).await, Ok(json!(null)));
        let written = || fs::read_to_string(&ticks).map_or(0, |text| text.len());
        while written() == 0 {
            tokio::time::sleep(Duration::from_millis(10)).await;
        }

        // A call that never returns: the server stops in the middle of it.
        let mut live = Live::of(&server).await;
        let input = json!({ "repo": REPO, "extension": "busy", "name": "spin", "input": null });
        live.send("extensions.act", input).await;
        tokio::time::sleep(Duration::from_millis(300)).await;
        assert_eq!(super::vm_threads(), ["vm:busy"]);
        server.stop().await;

        assert_eq!(
            super::vm_threads(),
            Vec::<String>::new(),
            "a VM's thread is left"
        );
        assert_eq!(gone(pid).await, Vec::<u32>::new(), "a VM's process is left");
        let before = written();
        tokio::time::sleep(Duration::from_millis(200)).await;
        assert_eq!(written(), before, "a VM's timer is left");
    };
    let ended = tokio::time::timeout(LONGEST, stopped).await;
    ended.expect("the server did not stop while an extension's call never returned");
}
