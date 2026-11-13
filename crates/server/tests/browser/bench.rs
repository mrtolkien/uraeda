//! The benchmarks of the web build on a slow phone: a browser at a phone's size, 390 by 844 with
//! its touch screen, its processor slowed four times (`Browser::slow`), over a sandbox with its
//! chat of 20,000 messages. `just bench-navigation web` and `just frames <scene> web` run them,
//! after `just web-build`; `just web-test` skips them, as every run without `URAEDA_BENCH` does.
//! They time; they assert nothing but that each step did what it says: a benchmark, never a
//! check.
//!
//! The app times itself (`app/ui/timing.ts`): the page holds `uraedaBench` before the app starts,
//! and the release build then times each navigation, to its first frame drawn with its records,
//! as the development build does on GTK. What `/live` sent meanwhile is read from the browser's
//! own record of the socket's frames (`protocol.rs`).

use std::time::Duration;

use serde_json::{Value, json};
use tempfile::TempDir;
use uraeda_server::Server;
use uraeda_server::sandbox::Prepare;

use super::cdp::{Browser, PHONE};
use super::protocol::{self, Frame, Names};
use super::signed_sandbox;

/// How many times a slow phone's processor is slower than this machine's.
const SLOWER: u32 = 4;

/// What the page holds before the app starts: the app's timing writes there (`ui/timing.ts`),
/// its interactions in `timed`, and the store's inflate and parse of each binary frame in
/// `parts`.
const HOOK: &str = "if (window === window.top) \
    window.uraedaBench = { timed: [], parts: [], now: () => performance.now() };";

/// One interaction the app timed, in the page's clock: its name, its milliseconds to the frame
/// drawn with its records, to its first frame, and to the first frame with every record.
#[derive(Clone, Debug)]
pub struct Timed {
    pub what: String,
    pub ms: f64,
    pub first: f64,
    pub settled: f64,
}

/// Which benchmark this run asked for, from `URAEDA_BENCH`: none in any other run.
pub fn asked() -> Option<String> {
    std::env::var("URAEDA_BENCH")
        .ok()
        .filter(|asked| !asked.is_empty())
}

/// A sandbox with the long chat, served with the web build, and a slow phone signed in to it.
pub struct Phone {
    pub browser: Browser,
    pub server: Server,
    /// The `timed` the benchmark has read so far.
    read: usize,
    /// The long chat's id, once a list the phone read named it.
    pub long_chat: Option<String>,
    /// The records' names by their subscriptions' ids, as the page asked for them.
    pub names: Names,
    _folder: TempDir,
}

impl Phone {
    /// Serves a fresh sandbox, signs a phone in at the home page, then slows it.
    pub async fn start() -> Phone {
        let prepare = Prepare {
            long_chat: true,
            ..Prepare::default()
        };
        let (folder, server, key) = signed_sandbox(prepare, |_| ()).await;
        let mut browser = Browser::start().await;
        browser.show(PHONE, "dark").await;
        browser
            .command(
                "Page.addScriptToEvaluateOnNewDocument",
                json!({ "source": HOOK }),
            )
            .await;
        browser
            .open(&format!("{}/r/sample/", server.address()))
            .await;
        browser.shows("Sign in to Uraeda").await;
        let field = browser.field().await;
        browser.click_at(field).await;
        browser.types(&key).await;
        browser.enter().await;
        browser.shows("Due dates").await;
        browser.slow(SLOWER).await;
        let mut phone = Phone {
            browser,
            server,
            read: 0,
            long_chat: None,
            names: Names::default(),
            _folder: folder,
        };
        // The load timed before the sign-in is not a reload's.
        phone.read = phone.all_timed().await.len();
        phone
    }

    /// Everything the app timed since the page loaded.
    async fn all_timed(&mut self) -> Vec<Timed> {
        let timed = self
            .browser
            .evaluate("window.uraedaBench?.timed ?? []")
            .await;
        let read = |value: &Value| Timed {
            what: value["what"].as_str().unwrap_or_default().to_owned(),
            ms: value["ms"].as_f64().unwrap_or_default(),
            first: value["first"].as_f64().unwrap_or_default(),
            settled: value["settled"].as_f64().unwrap_or_default(),
        };
        timed
            .as_array()
            .map_or_else(Vec::new, |all| all.iter().map(read).collect())
    }

    /// Waits for the next interaction the app times whose name starts with `named`.
    pub async fn timed(&mut self, named: &str) -> Timed {
        let started = std::time::Instant::now();
        loop {
            let all = self.all_timed().await;
            let new = all.get(self.read..).unwrap_or_default();
            if let Some(found) = new.iter().rposition(|timed| timed.what.starts_with(named)) {
                self.read += found + 1;
                return new[found].clone();
            }
            assert!(
                started.elapsed() < Duration::from_secs(90),
                "the app never timed {named:?}: it timed {new:?}"
            );
            tokio::time::sleep(Duration::from_millis(100)).await;
        }
    }

    /// Opens an address of the app, as a link does, and waits for its page drawn with its
    /// records: what the app timed, and the socket's frames meanwhile.
    pub async fn go(&mut self, address: &str) -> (Timed, Vec<Frame>) {
        self.browser.heard().await;
        self.browser
            .evaluate(&format!("window.uraedaBench.go({})", json!(address)))
            .await;
        let timed = self.timed("open ").await;
        let frames = protocol::frames(self.browser.heard().await);
        self.names.learn(&frames);
        self.long_chat = self
            .long_chat
            .take()
            .or_else(|| protocol::long_chat(&frames));
        (timed, frames)
    }

    /// Opens an address and leaves it to come to rest: a step's start.
    pub async fn rest_at(&mut self, address: &str) {
        self.go(address).await;
        tokio::time::sleep(Duration::from_millis(600)).await;
    }

    /// Reloads the page, and waits for its first page drawn with its records.
    pub async fn reload(&mut self) -> (Timed, Vec<Frame>) {
        self.browser.heard().await;
        self.browser.reload().await;
        self.read = 0;
        let timed = self.timed("reload").await;
        let frames = protocol::frames(self.browser.heard().await);
        self.names = Names::default();
        self.names.learn(&frames);
        (timed, frames)
    }

    /// The store's inflate and parse of the largest binary frame the page read since it loaded,
    /// and of all of them, on the slow phone.
    async fn parts(&mut self) -> String {
        let parts = self
            .browser
            .evaluate("window.uraedaBench?.parts ?? []")
            .await;
        let parts = parts.as_array().cloned().unwrap_or_default();
        let of = |what: &str| -> Vec<(f64, f64)> {
            parts
                .iter()
                .filter(|part| part["what"] == what)
                .map(|part| {
                    let bytes = part["bytes"].as_f64().unwrap_or_default();
                    (bytes, part["ms"].as_f64().unwrap_or_default())
                })
                .collect()
        };
        let line = |what: &str| {
            let all = of(what);
            let largest = all
                .iter()
                .copied()
                .fold((0.0, 0.0), |a, b| if b.0 > a.0 { b } else { a });
            let total: f64 = all.iter().map(|(_, ms)| ms).sum();
            format!(
                "{what}: {} frames, {total:.1} ms in all; the largest, {:.1} KB, {:.1} ms",
                all.len(),
                largest.0 / 1000.0,
                largest.1
            )
        };
        format!(
            "the store's work on binary frames, slowed {SLOWER} times, since the reload:\n{}\n{}",
            line("inflate"),
            line("parse")
        )
    }

    pub async fn stop(self) {
        drop(self.browser);
        self.server.stop().await;
    }
}

/// A screen the benchmark opens: its name, and where from.
struct Screen {
    name: &'static str,
    from: &'static str,
    to: To,
}

/// Where a screen is: an address, or the long chat, whose address the sessions' list gives.
enum To {
    Address(&'static str),
    LongChat,
}

const SAMPLE: &str = "/r/sample/";
const REALISTIC: &str = "/r/realistic/";

/// The screens of the navigation benchmark of GTK (`app/tools/navigation.test.tsx`), each opened
/// as a phone opens it, by a tap that navigates.
const SCREENS: &[Screen] = &[
    Screen {
        name: "Priorities",
        from: SAMPLE,
        to: To::Address("/r/sample/priorities"),
    },
    Screen {
        name: "Inbox",
        from: SAMPLE,
        to: To::Address("/r/sample/inbox"),
    },
    Screen {
        name: "Sessions",
        from: SAMPLE,
        to: To::Address("/r/sample/sessions"),
    },
    Screen {
        name: "Decisions (realistic)",
        from: REALISTIC,
        to: To::Address("/r/realistic/decisions"),
    },
    Screen {
        name: "Git",
        from: SAMPLE,
        to: To::Address("/r/sample/git"),
    },
    Screen {
        name: "Jobs",
        from: SAMPLE,
        to: To::Address("/r/sample/jobs"),
    },
    Screen {
        name: "Settings",
        from: SAMPLE,
        to: To::Address("/r/sample/settings"),
    },
    Screen {
        name: "Home",
        from: "/r/sample/settings",
        to: To::Address(SAMPLE),
    },
    Screen {
        name: "Home (realistic)",
        from: "/r/realistic/settings",
        to: To::Address(REALISTIC),
    },
    Screen {
        name: "A feature",
        from: SAMPLE,
        to: To::Address("/r/sample/f/2026-10-17-redesign-clarifications"),
    },
    Screen {
        name: "A long plan (realistic)",
        from: REALISTIC,
        to: To::Address("/r/realistic/f/2026-10-18-due-reminders/plan.md"),
    },
    Screen {
        name: "A session",
        from: SAMPLE,
        to: To::Address("/r/sample/f/2026-10-19-dark-mode/session"),
    },
    Screen {
        name: "The chat of 20,000 messages",
        from: "/r/sample/sessions",
        to: To::LongChat,
    },
    Screen {
        name: "A decision",
        from: "/r/realistic/decisions",
        to: To::Address("/r/realistic/decisions/git"),
    },
];

/// How many times each screen opens: the first is cold, the others find its records kept.
const RUNS: usize = 3;

#[tokio::test]
#[ignore = "a benchmark: `just bench-navigation web` runs it"]
async fn the_navigation_on_a_slow_phone() {
    if asked().as_deref() != Some("navigation") {
        return;
    }
    let mut phone = Phone::start().await;
    let load = load_before();
    let mut times = vec![
        "| Screen | First | Median | Worst | Within 100 ms | Its first frame, median | Its records come, median |".to_owned(),
        "| ------ | ----- | ------ | ----- | ------------- | ----------------------- | ------------------------ |".to_owned(),
    ];
    let mut sent = protocol::table();
    let (reload, frames) = phone.reload().await;
    times.push(format!(
        "| reload: the app's start to its first page drawn with its records | {} | | | {} | {} | {} |",
        ms(reload.ms),
        if reload.ms <= 1000.0 { "yes" } else { "no" },
        ms(reload.first),
        ms(reload.settled),
    ));
    sent.push(protocol::row(
        "A reload (the shell's records too)",
        &reload,
        &frames,
        &phone.names,
    ));
    for screen in SCREENS {
        let mut runs = Vec::new();
        for run in 0..RUNS {
            phone.rest_at(screen.from).await;
            let address = match screen.to {
                To::Address(address) => address.to_owned(),
                To::LongChat => {
                    let id = phone
                        .long_chat
                        .as_ref()
                        .expect("the sessions' list names the chat");
                    format!("/r/sample/sessions/{id}")
                }
            };
            let address = address.as_str();
            let (timed, frames) = phone.go(address).await;
            if run == 0 {
                sent.push(protocol::row(screen.name, &timed, &frames, &phone.names));
            }
            runs.push(timed);
        }
        times.push(time_row(screen.name, &runs));
    }
    println!("{load}, load after: {}", load_now());
    println!(
        "navigation, on a phone slowed {SLOWER} times:\n{}",
        times.join("\n")
    );
    println!(
        "\nwhat /live sent, a screen's first visit:\n{}",
        sent.join("\n")
    );
    println!("\n{}", phone.parts().await);
    phone.stop().await;
}

/// A screen's row of the times: its first run, cold, then the median and the worst of all.
fn time_row(name: &str, runs: &[Timed]) -> String {
    let median = |of: fn(&Timed) -> f64| {
        let mut all: Vec<f64> = runs.iter().map(of).collect();
        all.sort_by(f64::total_cmp);
        all[all.len() / 2]
    };
    let worst = runs.iter().map(|run| run.ms).fold(0.0, f64::max);
    format!(
        "| {name} | {} | {} | {} | {} | {} | {} |",
        ms(runs[0].ms),
        ms(median(|run| run.ms)),
        ms(worst),
        if worst <= 100.0 { "yes" } else { "no" },
        ms(median(|run| run.first)),
        ms(median(|run| run.settled)),
    )
}

pub fn ms(value: f64) -> String {
    format!("{value:.0} ms")
}

/// The machine's load, as the run starts: a timing is a quiet machine's or it is nothing.
pub fn load_before() -> String {
    format!("load before: {}", load_now())
}

pub fn load_now() -> String {
    let load = std::fs::read_to_string("/proc/loadavg").unwrap_or_default();
    load.split_whitespace()
        .take(3)
        .collect::<Vec<_>>()
        .join(" ")
}
