//! The native component `uraeda.extension`: an extension's page, in a view of its own, with
//! NSH's limits, and no rights beyond its host's functions. A page that breaks stops alone:
//! the app goes on, and is told what happened.
//!
//! The app's TSX draws it as `ExtensionView` (`app/extensions/ExtensionPlace.tsx`), with:
//!
//! - **props**: `server`, the server's address, and `token`, the device's, which the view fetches
//!   the page with and the page never sees; `name`, the extension's; `version`, the page's
//!   version the app last read, which loads it again as it changes; and `params`, what the page
//!   reads as `host.params`: which of its parts to draw, the repository, and the app's theme. A
//!   change of `params` loads the page again.
//! - **events**: `ready`, `{ declarations, version }`, once the page drew; `problem`,
//!   `{ kind, message, version }`, `kind` one of `unreachable`, `untrusted`, `load`, `threw`,
//!   `slow`, and `stopped`; and `message`, `{ id, name, data }`, a `record`, `call`, or `navigate`
//!   of the page for the app to answer, with an `id` when it waits for the answer.
//! - **commands**: `send`, `{ name, data }`, an event to the page, and `reply`, `{ id, value }`
//!   or `{ id, error }`, the answer to the page's call `id`.

mod channel;
mod fetch;

use std::cell::{Cell, RefCell};
use std::rc::Rc;

use nsh_core::JsonValue;
use nsh_engine::Bundle;
use nsh_platform_linux::gtk4::{self as gtk, gio, glib};
use nsh_platform_linux::{AppOptions, AppView, ComponentContext, Components, NativeComponent};
use serde_json::Value;

use self::channel::{Channel, PING};
use self::fetch::{Refused, Source};

/// The component's name, as the app's TSX declares it.
pub(crate) const COMPONENT: &str = "uraeda.extension";

/// Registers the component on `components`.
pub(crate) fn register(components: &Components) {
    components.register(
        COMPONENT,
        Rc::new(|context| Box::new(ExtensionView::new(context))),
    );
}

/// What the app asked to show.
#[derive(Clone, Debug, Default, PartialEq)]
struct Asked {
    source: Source,
    name: String,
    version: Option<u64>,
    params: serde_json::Map<String, Value>,
}

/// What a view shows: the page loaded, and what it was loaded for.
struct Shown {
    view: Rc<AppView>,
    channel: Channel,
    asked: RefCell<Asked>,
    /// What the last load was asked for.
    loaded: RefCell<Option<Asked>>,
    /// A load is on its way: the next change of the props waits for it.
    fetching: Cell<bool>,
}

/// One extension page.
struct ExtensionView {
    shown: Rc<Shown>,
}

impl ExtensionView {
    fn new(context: ComponentContext) -> ExtensionView {
        let view = AppView::new(AppOptions::default());
        // A page draws no page of its own: the app's components are every view's, its own too.
        view.register_component(COMPONENT, Rc::new(|_| Box::new(Nothing::default())));
        let channel = Channel::answer(view.host(), context);
        let shown = Rc::new(Shown {
            view,
            channel,
            asked: RefCell::default(),
            loaded: RefCell::default(),
            fetching: Cell::new(false),
        });
        let watched = Rc::downgrade(&shown);
        glib::timeout_add_local(PING, move || match watched.upgrade() {
            Some(shown) => {
                shown.channel.watch();
                glib::ControlFlow::Continue
            }
            None => glib::ControlFlow::Break,
        });
        ExtensionView { shown }
    }
}

impl Shown {
    /// Loads the page again when what the app asks for changed since the last load, once the
    /// props stopped coming: they come one by one.
    fn changed(self: &Rc<Self>) {
        let shown = Rc::downgrade(self);
        glib::idle_add_local_once(move || {
            if let Some(shown) = shown.upgrade() {
                shown.load();
            }
        });
    }

    fn load(self: &Rc<Self>) {
        let asked = self.asked.borrow().clone();
        let ready = !asked.name.is_empty() && !asked.source.server.is_empty();
        if !ready || self.fetching.get() || self.loaded.borrow().as_ref() == Some(&asked) {
            return;
        }
        self.fetching.set(true);
        let shown = Rc::clone(self);
        glib::spawn_future_local(async move {
            let (source, name) = (asked.source.clone(), asked.name.clone());
            let fetched = gio::spawn_blocking(move || fetch::page(&source, &name)).await;
            shown.fetching.set(false);
            match fetched {
                Ok(Ok(package)) => shown.run(&package),
                Ok(Err(Refused::Unreachable(message))) => {
                    shown.channel.problem("unreachable", &message);
                }
                Ok(Err(Refused::Untrusted(message))) => {
                    shown.channel.problem("untrusted", &message);
                }
                Err(_) => shown.channel.problem("unreachable", "the fetch stopped"),
            }
            // Tried once for what was asked, whatever came of it: a change of the props tries
            // again, as a new version does.
            *shown.loaded.borrow_mut() = Some(asked);
            shown.load();
        });
    }

    /// Runs a verified page, in place of the one before, with the capabilities it is signed
    /// with and no other.
    fn run(&self, package: &nsh_engine::package::VerifiedPackage) {
        let bundle = match Bundle::from_package(package) {
            Ok(bundle) => bundle,
            Err(message) => return self.channel.problem("untrusted", &message),
        };
        self.channel.loading(package.app.build);
        let params = self.asked.borrow().params.clone();
        self.view.host().set_params(params);
        self.view.load(bundle.into());
    }
}

impl NativeComponent for ExtensionView {
    fn widget(&self) -> gtk::Widget {
        self.shown.view.widget()
    }

    fn set_prop(&mut self, name: &str, value: Option<&JsonValue>) {
        {
            let mut asked = self.shown.asked.borrow_mut();
            let text = || value.and_then(Value::as_str).map(str::to_owned);
            match name {
                "server" => asked.source.server = text().unwrap_or_default(),
                "token" => asked.source.token = text(),
                "name" => asked.name = text().unwrap_or_default(),
                "version" => asked.version = value.and_then(Value::as_u64),
                "params" => {
                    let params = value.and_then(Value::as_object).cloned();
                    asked.params = params.unwrap_or_default();
                }
                _ => return,
            }
        }
        self.shown.changed();
    }

    fn command(&mut self, name: &str, args: &JsonValue) {
        match name {
            "send" => {
                if let Some(event) = args["name"].as_str() {
                    self.shown.channel.send(event, args["data"].clone());
                }
            }
            "reply" => {
                let Some(id) = args["id"].as_u64() else {
                    return;
                };
                let answer = match args["error"].as_str() {
                    Some(error) => Err(error.to_owned()),
                    None => Ok(args["value"].clone()),
                };
                self.shown.channel.reply(id, answer);
            }
            _ => {}
        }
    }
}

impl Drop for ExtensionView {
    fn drop(&mut self) {
        self.shown.view.stop();
    }
}

/// What a page gets for `uraeda.extension`: an empty view.
#[derive(Default)]
struct Nothing(gtk::Box);

impl NativeComponent for Nothing {
    fn widget(&self) -> gtk::Widget {
        use gtk::prelude::Cast as _;
        self.0.clone().upcast()
    }

    fn set_prop(&mut self, _: &str, _: Option<&JsonValue>) {}
}
