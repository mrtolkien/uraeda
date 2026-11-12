//! The frames of the web build on a slow phone, `just frames <scene> web`: the chat of 20,000
//! messages, `streaming` a reply 40 times a usual one (the sandbox's `at length`) for a minute,
//! or `scrolling` up its history by 9 pixels a frame for 5 seconds; or `reading`, a spec opened
//! as its frames are counted, then scrolled down the same way, where task 57 saw a stall. Frames are the browser's own,
//! the time between two `requestAnimationFrame`s of the page. `just frames <scene> web-profile`
//! also traces the page's main thread meanwhile, and says where its time went: the app's script,
//! Native Shell's engine in WebAssembly, the browser's style and layout, and its paint.

use std::collections::HashMap;
use std::time::Duration;

use serde_json::{Value, json};
use uraeda_server::sandbox::AT_LENGTH;

use super::bench::{Phone, asked, load_before, load_now};

/// The page's frames, from now until `stop` is set: each one's time since the one before.
const COUNT_FRAMES: &str = "(() => {
    const deltas = [];
    window.uraedaFrames = { deltas, stop: false };
    let last = performance.now();
    const frame = (now) => {
        deltas.push(now - last);
        last = now;
        if (!window.uraedaFrames.stop) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
})()";

/// Scrolls the page's longest scroller by 9 pixels a frame, up or down, until `stop` is set.
fn scroll(by: i32) -> String {
    format!(
        "(() => {{
    const scrollers = [...document.querySelectorAll('.nsh-scroll')];
    const longest = scrollers.reduce((a, b) => (b.scrollHeight > a.scrollHeight ? b : a));
    const step = () => {{
        longest.scrollTop += {by};
        if (!window.uraedaFrames.stop) requestAnimationFrame(step);
    }};
    requestAnimationFrame(step);
    return longest.scrollHeight;
}})()"
    )
}

/// The middle of the composer's Send button, by the name it gives a screen reader.
const SEND: &str = "(() => {
    const box = document.querySelector('[aria-label=\"Send\"]')?.getBoundingClientRect();
    return box ? [box.x + box.width / 2, box.y + box.height / 2] : null;
})()";

/// The spec the `reading` scene opens: long, with a diagram and code.
const SPEC: &str = "/r/sample/f/2026-10-17-due-dates/spec.md";

#[tokio::test]
#[ignore = "a benchmark: `just frames <scene> web` runs it"]
async fn the_frames_on_a_slow_phone() {
    let Some(scene) = asked().and_then(|asked| asked.strip_prefix("frames ").map(str::to_owned))
    else {
        return;
    };
    let profile = std::env::var_os("URAEDA_BENCH_PROFILE").is_some();
    let mut phone = Phone::start().await;
    // The reader is opened as its frames are counted: what it fetches and reads on its first
    // visit is the stall to find.
    if scene != "reading" {
        phone.go("/r/sample/sessions").await;
        let id = phone
            .long_chat
            .clone()
            .expect("the sessions' list names the long chat");
        phone.go(&format!("/r/sample/sessions/{id}")).await;
    }
    tokio::time::sleep(Duration::from_secs(2)).await;
    let load = load_before();
    let second = Duration::from_secs(1);
    let windows = match scene.as_str() {
        "streaming" => {
            let field = phone.browser.field().await;
            phone.browser.tap_at(field).await;
            phone.browser.types(&format!("Tell me {AT_LENGTH}")).await;
            // A finger's Enter adds a line: the Send button sends.
            let send = phone.browser.evaluate(SEND).await;
            let at = send.as_array().expect("the composer's Send button");
            let at = (at[0].as_f64().unwrap(), at[1].as_f64().unwrap());
            phone.browser.tap_at(at).await;
            phone.browser.shows("Stop the agent").await;
            // The reply is followed as it grows. Where the transcript stopped following, a person
            // presses the button that follows it again, and the run says so (ruling T60.4).
            tokio::time::sleep(second).await;
            let left = "document.body.innerText.includes('Jump to the latest')";
            if phone.browser.evaluate(left).await == true {
                println!(
                    "the transcript stopped following the reply: \"Jump to the latest\" pressed"
                );
                let latest = phone.browser.middle_of("Jump to the latest").await;
                phone.browser.tap_at(latest).await;
            }
            measure(&mut phone, None, 10 * second, 5, profile).await
        }
        "scrolling" => measure(&mut phone, Some(scroll(-9)), 5 * second, 1, profile).await,
        "reading" => {
            let opening = format!("window.uraedaBench.go({})", json!(SPEC));
            let drive = format!("{opening}; setTimeout(() => {}, 2000)", scroll(9));
            measure(&mut phone, Some(drive), second, 6, profile).await
        }
        other => panic!("no scene {other:?} in a browser: `streaming`, `scrolling`, `reading`"),
    };
    // What the scene shows as it ends, for the eye: the reply following, the history scrolled.
    let picture = super::shots().join(format!("frames-{scene}-390.png"));
    phone.browser.picture(&picture).await;
    println!("{load}, load after: {}", load_now());
    println!("frames of `{scene}` on a phone slowed 4 times, in Chromium:");
    println!("| Window | Frames a second | Median | 95th percentile | Worst | Over 100 ms |");
    println!("| ------ | --------------- | ------ | --------------- | ----- | ----------- |");
    for line in windows {
        println!("{line}");
    }
    phone.stop().await;
}

/// Counts the page's frames over `windows` windows of `each`, driven by `drive` when given: a
/// row of the table for each window, and one for them all.
async fn measure(
    phone: &mut Phone,
    drive: Option<String>,
    each: Duration,
    windows: usize,
    profile: bool,
) -> Vec<String> {
    let browser = &mut phone.browser;
    if profile {
        start_trace(browser).await;
    }
    browser.evaluate(COUNT_FRAMES).await;
    if let Some(drive) = drive {
        browser.evaluate(&drive).await;
    }
    let mut rows = Vec::new();
    let mut all = Vec::new();
    let mut read = 0;
    for window in 1..=windows {
        tokio::time::sleep(each).await;
        let deltas = browser.evaluate("window.uraedaFrames.deltas").await;
        let deltas: Vec<f64> = deltas
            .as_array()
            .expect("the frames")
            .iter()
            .filter_map(Value::as_f64)
            .collect();
        let new = deltas[read..].to_vec();
        read = deltas.len();
        rows.push(row(&format!("{window}"), &new));
        all.extend(new);
    }
    browser.evaluate("window.uraedaFrames.stop = true").await;
    rows.push(row("all", &all));
    if profile {
        rows.push(String::new());
        rows.extend(end_trace(browser).await);
    }
    rows
}

/// A table's row of frames: how many a second, the median, the 95th percentile, the worst, and
/// how many took over 100 ms.
fn row(name: &str, deltas: &[f64]) -> String {
    let mut sorted = deltas.to_vec();
    sorted.sort_by(f64::total_cmp);
    let at = |share: f64| {
        sorted
            .get(((sorted.len() as f64 - 1.0) * share) as usize)
            .copied()
            .unwrap_or_default()
    };
    let seconds: f64 = deltas.iter().sum::<f64>() / 1000.0;
    format!(
        "| {name} | {:.1} | {:.1} ms | {:.1} ms | {:.0} ms | {} |",
        deltas.len() as f64 / seconds.max(0.001),
        at(0.5),
        at(0.95),
        sorted.last().copied().unwrap_or_default(),
        deltas.iter().filter(|delta| **delta > 100.0).count(),
    )
}

/// The trace's categories: the main thread's tasks, and the samples of its script's profiler.
const CATEGORIES: &str = "devtools.timeline,disabled-by-default-devtools.timeline,v8.execute";

async fn start_trace(browser: &mut super::cdp::Browser) {
    browser
        .command(
            "Tracing.start",
            json!({ "categories": CATEGORIES, "transferMode": "ReportEvents" }),
        )
        .await;
    browser.command("Profiler.enable", json!({})).await;
    browser
        .command("Profiler.setSamplingInterval", json!({ "interval": 500 }))
        .await;
    browser.command("Profiler.start", json!({})).await;
}

/// Ends the trace and the profile: the main thread's time by kind, and the script's by where
/// its code came from.
async fn end_trace(browser: &mut super::cdp::Browser) -> Vec<String> {
    let profile = browser.command("Profiler.stop", json!({})).await["profile"].clone();
    browser.heard().await;
    browser.command("Tracing.end", json!({})).await;
    let mut events = Vec::new();
    for _ in 0..200 {
        let heard = browser.heard().await;
        let complete = heard
            .iter()
            .any(|(method, _)| method == "Tracing.tracingComplete");
        for (method, params) in heard {
            if method == "Tracing.dataCollected" {
                events.extend(params["value"].as_array().cloned().unwrap_or_default());
            }
        }
        if complete {
            break;
        }
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
    let mut lines = Vec::new();
    let mut table = |title: &str, totals: HashMap<String, f64>, most: usize| {
        let mut rows: Vec<(String, f64)> = totals.into_iter().collect();
        rows.sort_by(|a, b| b.1.total_cmp(&a.1));
        lines.push(format!("{title} (its own time):"));
        lines.extend(
            rows.iter()
                .take(most)
                .map(|(name, ms)| format!("- {name}: {ms:.0} ms")),
        );
    };
    let names = by_name(&events);
    let mut kinds: HashMap<String, f64> = HashMap::new();
    for (name, ms) in &names {
        *kinds.entry(kind(name).to_owned()).or_default() += ms;
    }
    table("The main thread's time, by kind", kinds, 10);
    table("The trace's events, by name", names, 15);
    table(
        "The script's samples, by where its code came from",
        by_source(&profile),
        12,
    );
    table(
        "The functions the samples stopped in most",
        by_function(&profile),
        20,
    );
    lines
}

/// The renderer's main thread's complete events, each one's own time, less its children's, by
/// name, in milliseconds.
fn by_name(events: &[Value]) -> HashMap<String, f64> {
    let main = events
        .iter()
        .find(|event| event["name"] == "thread_name" && event["args"]["name"] == "CrRendererMain");
    let Some(main) = main else {
        return HashMap::new();
    };
    let (pid, tid) = (main["pid"].clone(), main["tid"].clone());
    let mut spans: Vec<(f64, f64, String)> = events
        .iter()
        .filter(|event| event["ph"] == "X" && event["pid"] == pid && event["tid"] == tid)
        .filter_map(|event| {
            let ts = event["ts"].as_f64()?;
            let dur = event["dur"].as_f64()?;
            Some((ts, ts + dur, event["name"].as_str()?.to_owned()))
        })
        .collect();
    spans.sort_by(|a, b| a.0.total_cmp(&b.0).then(b.1.total_cmp(&a.1)));
    let mut totals: HashMap<String, f64> = HashMap::new();
    // The spans open around the one read, each with its own time so far: its length, less its
    // children's.
    let mut open: Vec<(f64, String, f64)> = Vec::new();
    let mut close = |open: &mut Vec<(f64, String, f64)>| {
        let (_, name, own) = open.pop().expect("an open span");
        *totals.entry(name).or_default() += own / 1000.0;
    };
    for (start, end, name) in spans {
        while open.last().is_some_and(|parent| parent.0 <= start) {
            close(&mut open);
        }
        if let Some(parent) = open.last_mut() {
            parent.2 -= end - start;
        }
        open.push((end, name, end - start));
    }
    while !open.is_empty() {
        close(&mut open);
    }
    totals
}

/// What kind of work a trace's event is: script, style and layout, paint, or the rest.
fn kind(name: &str) -> &'static str {
    match name {
        "FunctionCall"
        | "EvaluateScript"
        | "TimerFire"
        | "FireAnimationFrame"
        | "RunMicrotasks"
        | "EventDispatch"
        | "v8.callFunction"
        | "v8.run"
        | "V8.Execute"
        | "v8.compile"
        | "v8.compileModule"
        | "v8.evaluateModule"
        | "FireIdleCallback"
        | "XHRReadyStateChange" => "script",
        "MinorGC"
        | "MajorGC"
        | "V8.GCScavenger"
        | "V8.GC_MARK_COMPACTOR"
        | "BlinkGC.AtomicPhase" => "garbage collection",
        "UpdateLayoutTree"
        | "Layout"
        | "RecalculateStyles"
        | "ParseHTML"
        | "HitTest"
        | "IntersectionObserverController::computeIntersections" => "style and layout",
        "Paint" | "PrePaint" | "Layerize" | "UpdateLayer" | "CompositeLayers" | "Commit"
        | "PaintImage" | "Decode Image" => "paint",
        _ => "other",
    }
}

/// The samples' time by the source of the function they stopped in: Native Shell's engine in
/// WebAssembly, its page script, the app's modules, or the browser's own.
fn by_source(profile: &Value) -> HashMap<String, f64> {
    samples(profile, |frame| {
        let url = frame["url"].as_str().unwrap_or_default();
        let function = frame["functionName"].as_str().unwrap_or_default();
        let file = url.rsplit('/').next().unwrap_or_default();
        if url.contains(".wasm") || function.starts_with('$') || function.starts_with("wasm-") {
            "Native Shell's engine (WebAssembly)".to_owned()
        } else if file.is_empty() {
            format!("the browser: {}", named(function))
        } else if file.starts_with("nsh.") || url.contains("/browser.") {
            format!("Native Shell's page script: {file}")
        } else {
            format!("the app: {file}")
        }
    })
}

/// The samples' time by the function they stopped in, with its file and line.
fn by_function(profile: &Value) -> HashMap<String, f64> {
    samples(profile, |frame| {
        let url = frame["url"].as_str().unwrap_or_default();
        let file = url.rsplit('/').next().unwrap_or_default();
        let function = named(frame["functionName"].as_str().unwrap_or_default());
        format!("{function} ({file}:{})", frame["lineNumber"])
    })
}

fn named(function: &str) -> &str {
    if function.is_empty() {
        "(anonymous)"
    } else {
        function
    }
}

/// The profile's samples' time, in milliseconds, by what `name` makes of the frame each stopped in.
fn samples(profile: &Value, name: impl Fn(&Value) -> String) -> HashMap<String, f64> {
    let nodes = profile["nodes"].as_array().cloned().unwrap_or_default();
    let named: HashMap<u64, String> = nodes
        .iter()
        .map(|node| {
            (
                node["id"].as_u64().unwrap_or_default(),
                name(&node["callFrame"]),
            )
        })
        .collect();
    let samples = profile["samples"].as_array().cloned().unwrap_or_default();
    let deltas = profile["timeDeltas"]
        .as_array()
        .cloned()
        .unwrap_or_default();
    let mut totals: HashMap<String, f64> = HashMap::new();
    // Each sample lasts until the next one: its delta is the next's.
    for (sample, delta) in samples.iter().zip(deltas.iter().skip(1)) {
        let id = sample.as_u64().unwrap_or_default();
        let name = named.get(&id).cloned().unwrap_or_default();
        *totals.entry(name).or_default() += delta.as_f64().unwrap_or_default() / 1000.0;
    }
    totals
}
