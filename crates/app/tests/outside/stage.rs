//! A GTK window holding one embedded view, as the Linux host will hold an extension page: the
//! checks load a page in it, and wait for what it tells its host.

use std::rc::Rc;
use std::sync::mpsc::{self, Receiver};
use std::thread::ThreadId;
use std::time::{Duration, Instant};

use gtk::prelude::*;
use nsh_platform_linux::gtk4::{self as gtk, glib};
use nsh_platform_linux::{App, AppOptions, AppView};
use serde_json::Value;

/// The window's size, in points: smaller than the hidden display.
pub const SIZE: (i32, i32) = (800, 600);

/// A window on the hidden display, and the view it shows.
pub struct Stage {
    pub window: gtk::Window,
    pub view: Rc<AppView>,
}

impl Stage {
    /// Opens a window showing an empty view made with `options`.
    pub fn open(options: AppOptions) -> Stage {
        gtk::init().expect("GTK starts on the hidden display");
        let view = AppView::new(options);
        let window = gtk::Window::new();
        window.set_default_size(SIZE.0, SIZE.1);
        window.set_child(Some(&view.widget()));
        window.present();
        Stage { window, view }
    }

    /// Runs `app` in the view, replacing what ran.
    pub fn load(&self, app: impl Into<App>) {
        self.view.load(app.into());
    }

    /// What the page posts to its host under `name`, from now on. NSH runs the handler on the
    /// engine's thread, so the posts cross to the test's.
    pub fn posts(&self, name: &str) -> Receiver<Value> {
        let (sender, receiver) = mpsc::channel();
        self.view.host().handle(name, move |mut call| {
            let _ = sender.send(call.take_data());
            call.resolve(Value::Null);
        });
        receiver
    }

    /// Answers the page's calls of `name` with `answer`, which runs on the engine's thread.
    pub fn answers(
        &self,
        name: &str,
        answer: impl Fn(Value) -> Result<Value, String> + Send + Sync + 'static,
    ) {
        self.view.host().handle(name, move |mut call| {
            let data = call.take_data();
            call.reply(answer(data));
        });
    }

    /// The thread of the engine that runs each page the view loads, which the page's first
    /// statement tells by posting `start`: a new engine, on a new thread, runs each load.
    pub fn engines(&self) -> Receiver<ThreadId> {
        let (sender, receiver) = mpsc::channel();
        self.view.host().handle("start", move |call| {
            let _ = sender.send(std::thread::current().id());
            call.resolve(Value::Null);
        });
        receiver
    }

    /// What the window shows now, as GTK draws it.
    pub fn picture(&self) -> Picture {
        let (width, height) = (self.window.width(), self.window.height());
        let snapshot = gtk::Snapshot::new();
        gtk::WidgetPaintable::new(Some(&self.window)).snapshot(
            &snapshot,
            f64::from(width),
            f64::from(height),
        );
        let node = snapshot.to_node().expect("a window that draws something");
        let renderer = self.window.renderer().expect("the window's renderer");
        let texture = renderer.render_texture(node, None);
        let (width, height) = (texture.width() as usize, texture.height() as usize);
        let mut pixels = vec![0; width * height * 4];
        texture.download(&mut pixels, width * 4);
        Picture { pixels }
    }

    /// Sends the page the event `name`.
    pub fn send(&self, name: &str) {
        self.view
            .host()
            .send(name, Value::Null)
            .expect("an event sent to the page");
    }
}

impl Drop for Stage {
    fn drop(&mut self) {
        self.view.stop();
        self.window.destroy();
    }
}

/// Runs GTK's main loop until `found` answers, and panics with `what` after `seconds`.
pub fn wait_for<T>(what: &str, seconds: u64, mut found: impl FnMut() -> Option<T>) -> T {
    let end = Instant::now() + Duration::from_secs(seconds);
    loop {
        spin(Duration::from_millis(10));
        if let Some(value) = found() {
            return value;
        }
        assert!(Instant::now() < end, "timed out after {seconds} s: {what}");
    }
}

/// Runs GTK's main loop for `time`.
pub fn spin(time: Duration) {
    let context = glib::MainContext::default();
    let end = Instant::now() + time;
    while Instant::now() < end {
        while context.iteration(false) {}
        std::thread::sleep(Duration::from_millis(2));
    }
}

/// A window's pixels, four bytes each: blue, green, red, alpha.
pub struct Picture {
    pixels: Vec<u8>,
}

impl Picture {
    /// How many pixels `wanted` takes, given their red, green, and blue.
    pub fn count(&self, wanted: impl Fn(u8, u8, u8) -> bool) -> usize {
        self.pixels
            .chunks_exact(4)
            .filter(|pixel| wanted(pixel[2], pixel[1], pixel[0]))
            .count()
    }
}
