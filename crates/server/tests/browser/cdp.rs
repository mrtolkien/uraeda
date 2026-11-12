//! A headless Chromium, driven over the DevTools protocol: one page, which a test sizes, opens at
//! an address, types in, reads, and takes pictures of. The browser is the dev shell's,
//! `web-browser`, the Chromium `flake.nix` pins; `URAEDA_BROWSER` names another.
//!
//! A command is a JSON message with an id, answered by the message with that id; what the page
//! says meanwhile, a request that ended, a line of its console, is kept for the test to read.

use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::time::Duration;

use base64::Engine as _;
use base64::engine::general_purpose::STANDARD;
use futures_util::{SinkExt as _, StreamExt as _};
use serde_json::{Value, json};
use tempfile::TempDir;
use tokio::net::TcpStream;
use tokio_tungstenite::tungstenite::Message;
use tokio_tungstenite::{MaybeTlsStream, WebSocketStream};

/// How long the browser gets to start, and a page to show what a test waits for.
const PATIENCE: Duration = Duration::from_secs(60);

/// A size to draw the page at: a desktop's window, or a phone held upright, with its touch
/// screen.
#[derive(Clone, Copy)]
pub struct Size {
    pub width: u32,
    pub height: u32,
    pub phone: bool,
}

pub const DESKTOP: Size = Size {
    width: 1400,
    height: 800,
    phone: false,
};
pub const PHONE: Size = Size {
    width: 390,
    height: 844,
    phone: true,
};

/// A browser with one page open, which goes with it.
pub struct Browser {
    process: Child,
    socket: WebSocketStream<MaybeTlsStream<TcpStream>>,
    session: String,
    next: u64,
    /// What the page said since it was last read: each event's method and parameters.
    events: Vec<(String, Value)>,
    _profile: TempDir,
}

impl Browser {
    /// Starts the browser, with a profile of its own, and opens an empty page.
    pub async fn start() -> Browser {
        let profile = TempDir::new().expect("a temporary folder");
        let program = std::env::var("URAEDA_BROWSER").unwrap_or_else(|_| "web-browser".to_owned());
        let process = Command::new(&program)
            .arg("--headless")
            .arg("--remote-debugging-port=0")
            .arg(format!("--user-data-dir={}", profile.path().display()))
            .args([
                "--no-first-run",
                "--no-default-browser-check",
                "--disable-extensions",
                "--disable-sync",
                "--mute-audio",
                "--disable-component-update",
                "--disable-background-networking",
                "--hide-scrollbars",
            ])
            // A CI runner forbids the user namespaces Chromium's own sandbox needs: the page it
            // loads is the test's server's alone.
            .args(std::env::var_os("CI").map(|_| "--no-sandbox"))
            .arg("about:blank")
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .unwrap_or_else(|error| {
                panic!("{program} does not start: {error}: run in the dev shell")
            });
        // The browser writes where it listens, once it does: its port, then its path.
        let listening = profile.path().join("DevToolsActivePort");
        let address = wait_for("the browser to listen", || {
            let text = std::fs::read_to_string(&listening).ok()?;
            let mut lines = text.lines();
            Some(format!("ws://127.0.0.1:{}{}", lines.next()?, lines.next()?))
        })
        .await;
        let (socket, _) = tokio_tungstenite::connect_async(&address)
            .await
            .expect("the browser's DevTools socket");
        let mut browser = Browser {
            process,
            socket,
            session: String::new(),
            next: 0,
            events: Vec::new(),
            _profile: profile,
        };
        let target = browser
            .command("Target.createTarget", json!({ "url": "about:blank" }))
            .await;
        let attach = json!({ "targetId": target["targetId"], "flatten": true });
        let attached = browser.command("Target.attachToTarget", attach).await;
        browser.session = attached["sessionId"]
            .as_str()
            .expect("a session")
            .to_owned();
        for domain in ["Page", "Network", "Runtime", "Log"] {
            browser
                .command(&format!("{domain}.enable"), json!({}))
                .await;
        }
        browser
    }

    /// Sends a command, and waits for its answer: what the page says meanwhile is kept.
    pub async fn command(&mut self, method: &str, params: Value) -> Value {
        self.next += 1;
        let id = self.next;
        let mut message = json!({ "id": id, "method": method, "params": params });
        if !self.session.is_empty() {
            message["sessionId"] = self.session.clone().into();
        }
        self.socket
            .send(Message::Text(message.to_string().into()))
            .await
            .expect("the browser takes a command");
        loop {
            let answer = self.read().await;
            if answer["id"] == id {
                assert!(answer["error"].is_null(), "{method}: {}", answer["error"]);
                return answer["result"].clone();
            }
        }
    }

    /// The browser's next message: an event is kept, and an answer returned.
    async fn read(&mut self) -> Value {
        loop {
            let next = tokio::time::timeout(PATIENCE, self.socket.next()).await;
            let message = next.expect("the browser answers").expect("a message");
            let Message::Text(text) = message.expect("the browser's socket") else {
                continue;
            };
            let message: Value = serde_json::from_str(&text).expect("JSON from the browser");
            match message["method"].as_str() {
                Some(method) => self
                    .events
                    .push((method.to_owned(), message["params"].clone())),
                None => return message,
            }
        }
    }

    /// Draws the page at a size, in a theme's mode, `dark` or `light`: a phone has a touch
    /// screen and a phone's name, which Native Shell reads its kind of device from as it starts.
    pub async fn show(&mut self, size: Size, mode: &str) {
        let metrics = json!({
            "width": size.width,
            "height": size.height,
            "deviceScaleFactor": 1,
            "mobile": size.phone,
        });
        self.command("Emulation.setDeviceMetricsOverride", metrics)
            .await;
        let touch = json!({ "enabled": size.phone });
        self.command("Emulation.setTouchEmulationEnabled", touch)
            .await;
        let scheme = json!({ "features": [{ "name": "prefers-color-scheme", "value": mode }] });
        self.command("Emulation.setEmulatedMedia", scheme).await;
    }

    #[allow(dead_code, reason = "for the benchmarks of the plan's task 60")]
    /// Slows the page's processor `times` over, as a slow phone's: 1 is the machine's own.
    pub async fn slow(&mut self, times: u32) {
        self.command("Emulation.setCPUThrottlingRate", json!({ "rate": times }))
            .await;
    }

    /// Opens an address, forgetting what the page before said.
    pub async fn open(&mut self, url: &str) {
        self.events.clear();
        self.command("Page.navigate", json!({ "url": url })).await;
    }

    /// The value of a JavaScript expression in the page, once it settled when it is a promise.
    pub async fn evaluate(&mut self, expression: &str) -> Value {
        let params =
            json!({ "expression": expression, "returnByValue": true, "awaitPromise": true });
        self.command("Runtime.evaluate", params).await["result"]["value"].clone()
    }

    /// Waits until the page shows `words` anywhere in its text.
    pub async fn shows(&mut self, words: &str) {
        let asked = format!("document.body.innerText.includes({})", json!(words));
        let started = std::time::Instant::now();
        while self.evaluate(&asked).await != true {
            if started.elapsed() > PATIENCE {
                let text = self.evaluate("document.body.innerText").await;
                panic!(
                    "the page never showed {words:?}: it shows {text}\n{}",
                    self.said()
                );
            }
            tokio::time::sleep(Duration::from_millis(50)).await;
        }
    }

    /// Types text where the focus is, as a paste does.
    pub async fn types(&mut self, text: &str) {
        self.command("Input.insertText", json!({ "text": text }))
            .await;
    }

    /// Presses and releases Enter.
    pub async fn enter(&mut self) {
        for kind in ["keyDown", "keyUp"] {
            let key = json!({
                "type": kind,
                "key": "Enter",
                "code": "Enter",
                "windowsVirtualKeyCode": 13,
                "text": if kind == "keyDown" { "\r" } else { "" },
            });
            self.command("Input.dispatchKeyEvent", key).await;
        }
    }

    /// Reloads the page, forgetting what it said.
    pub async fn reload(&mut self) {
        self.events.clear();
        self.command("Page.reload", json!({})).await;
    }

    /// The page's address within the app: its path and its query.
    pub async fn path(&mut self) -> String {
        let path = self.evaluate("location.pathname + location.search").await;
        path.as_str().unwrap_or_default().to_owned()
    }

    /// Waits until the page's address is `path`, its path and its query.
    pub async fn at(&mut self, path: &str) {
        let started = std::time::Instant::now();
        loop {
            let now = self.path().await;
            if now == path {
                return;
            }
            assert!(
                started.elapsed() < PATIENCE,
                "the address never became {path}: it is {now}"
            );
            tokio::time::sleep(Duration::from_millis(50)).await;
        }
    }

    /// The middle of the first innermost element whose own text is `words`, whole on the screen.
    pub async fn middle_of(&mut self, words: &str) -> (f64, f64) {
        let found = format!(
            "(() => {{
                const words = {};
                const all = [...document.querySelectorAll('body *')].filter((el) =>
                    el.childElementCount === 0 && el.textContent.trim() === words);
                const shown = all.map((el) => el.getBoundingClientRect())
                    .filter((box) => box.width > 0 && box.height > 0 && box.y >= 0
                        && box.bottom <= innerHeight && box.x >= 0 && box.right <= innerWidth);
                const box = shown[0];
                return box ? [box.x + box.width / 2, box.y + box.height / 2] : null;
            }})()",
            json!(words)
        );
        let started = std::time::Instant::now();
        loop {
            if let Some(at) = self.evaluate(&found).await.as_array() {
                return (at[0].as_f64().unwrap(), at[1].as_f64().unwrap());
            }
            assert!(
                started.elapsed() < PATIENCE,
                "nothing on the page reads {words:?}"
            );
            tokio::time::sleep(Duration::from_millis(50)).await;
        }
    }

    /// Clicks what reads `words`, with the mouse's main button.
    pub async fn click(&mut self, words: &str) {
        let at = self.middle_of(words).await;
        self.click_at(at).await;
    }

    /// The middle of the page's first text field, once it shows one.
    pub async fn field(&mut self) -> (f64, f64) {
        let found = "(() => { const box = document.querySelector('.nsh-field')?.getBoundingClientRect(); \
            return box && box.width > 0 ? [box.x + box.width / 2, box.y + box.height / 2] : null; })()";
        let started = std::time::Instant::now();
        loop {
            if let Some(at) = self.evaluate(found).await.as_array() {
                return (at[0].as_f64().unwrap(), at[1].as_f64().unwrap());
            }
            assert!(started.elapsed() < PATIENCE, "the page shows no field");
            tokio::time::sleep(Duration::from_millis(50)).await;
        }
    }

    /// Clicks a point with the mouse's main button.
    pub async fn click_at(&mut self, (x, y): (f64, f64)) {
        for kind in ["mouseMoved", "mousePressed", "mouseReleased"] {
            let event = json!({
                "type": kind, "x": x, "y": y, "button": "left", "buttons": 1, "clickCount": 1,
            });
            self.command("Input.dispatchMouseEvent", event).await;
        }
    }

    /// Taps a point with a finger, as a phone's touch screen does.
    pub async fn tap_at(&mut self, (x, y): (f64, f64)) {
        let point = json!([{ "x": x, "y": y }]);
        let start = json!({ "type": "touchStart", "touchPoints": point });
        self.command("Input.dispatchTouchEvent", start).await;
        let end = json!({ "type": "touchEnd", "touchPoints": [] });
        self.command("Input.dispatchTouchEvent", end).await;
    }

    /// Turns the mouse's wheel over a point: `by` pixels down.
    pub async fn wheel(&mut self, (x, y): (f64, f64), by: f64) {
        let event = json!({ "type": "mouseWheel", "x": x, "y": y, "deltaX": 0, "deltaY": by });
        self.command("Input.dispatchMouseEvent", event).await;
    }

    /// Presses and releases a key that types a letter, as a hand does.
    pub async fn press(&mut self, letter: &str) {
        for kind in ["keyDown", "keyUp"] {
            let key = json!({
                "type": kind,
                "key": letter,
                "code": format!("Key{}", letter.to_uppercase()),
                "text": if kind == "keyDown" { letter } else { "" },
            });
            self.command("Input.dispatchKeyEvent", key).await;
        }
    }

    /// Writes a picture of the page as it shows, a PNG.
    pub async fn picture(&mut self, path: &PathBuf) {
        let shot = self
            .command("Page.captureScreenshot", json!({ "format": "png" }))
            .await;
        let png = STANDARD
            .decode(shot["data"].as_str().expect("a picture"))
            .expect("base64");
        std::fs::write(path, png).expect("the picture is written");
    }

    /// What the page's requests took on the wire since it was opened: each request's bytes, as
    /// the server sent them, its encoding, and its address, the heaviest first. What a first
    /// load weighs is their sum.
    pub async fn transferred(&mut self) -> Vec<(u64, String, String)> {
        // The answers of the last commands carried the last events.
        self.evaluate("0").await;
        let of = |method: &'static str| self.events.iter().filter(move |event| event.0 == method);
        let mut requests: Vec<(u64, String, String)> = of("Network.loadingFinished")
            .map(|(_, ended)| {
                let answered = of("Network.responseReceived")
                    .find(|(_, answer)| answer["requestId"] == ended["requestId"])
                    .map(|(_, answer)| &answer["response"]);
                let text =
                    |value: Option<&Value>| value.and_then(Value::as_str).unwrap_or("-").to_owned();
                let encoding = answered.and_then(|answer| {
                    let headers = answer["headers"].as_object()?;
                    let named = headers
                        .iter()
                        .find(|(name, _)| name.eq_ignore_ascii_case("content-encoding"));
                    named.map(|(_, value)| value)
                });
                (
                    ended["encodedDataLength"].as_u64().unwrap_or(0),
                    text(encoding),
                    text(answered.map(|answer| &answer["url"])),
                )
            })
            .collect();
        requests.sort_unstable_by(|a, b| b.cmp(a));
        requests
    }

    /// What the page complained of since it was opened: an error of its console, a throw, a
    /// request its policy refused.
    pub fn said(&self) -> String {
        let complaint = |(method, event): &(String, Value)| match method.as_str() {
            "Log.entryAdded" if event["entry"]["level"] == "error" => Some(format!(
                "{} ({})",
                event["entry"]["text"].as_str().unwrap_or_default(),
                event["entry"]["url"].as_str().unwrap_or_default()
            )),
            "Runtime.exceptionThrown" => Some(event["exceptionDetails"].to_string()),
            _ => None,
        };
        let complaints: Vec<String> = self.events.iter().filter_map(complaint).collect();
        complaints.join("\n")
    }
}

impl Drop for Browser {
    fn drop(&mut self) {
        let _ = self.process.kill();
        let _ = self.process.wait();
    }
}

/// Waits for `found` to give a value.
async fn wait_for<T>(what: &str, found: impl Fn() -> Option<T>) -> T {
    let started = std::time::Instant::now();
    loop {
        if let Some(value) = found() {
            return value;
        }
        assert!(started.elapsed() < PATIENCE, "waited too long for {what}");
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
}
