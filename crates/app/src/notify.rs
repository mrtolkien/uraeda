//! The desktop's notifications. NSH has no notification API, so on Linux the app speaks the
//! desktop's own (ruling R26): the service `org.freedesktop.Notifications` of the session bus,
//! through GTK's `gio`, whose `Notify` shows one, and whose signal `ActionInvoked` says it was
//! clicked. Elsewhere, for now, the app has none, and says so.
//!
//! TSX imports `notifyDesktop(title, body)`, which answers the notification's id, and
//! `nextNotificationClick()`, which answers the id of the next one clicked: the app keeps what
//! each id opens. The bus is spoken from a thread of its own, which runs the main loop `gio`
//! answers on: the engine's thread runs none.

use nsh_core::prelude::*;

/// The desktop's notifications.
#[module]
pub(crate) struct Notifications;

#[module(flat)]
impl Notifications {
    /// Shows `title` and `body` as a notification of the desktop, which a click opens: answers its
    /// id, which `nextNotificationClick` gives back once clicked. Rejects where the desktop has no
    /// notification service, in words that say so.
    pub(crate) async fn notify_desktop(title: String, body: String) -> Result<u32, String> {
        imp::notify(title, body).await
    }

    /// The id of the next notification of the app the human clicks. Rejects where the desktop has
    /// no notification service.
    pub(crate) async fn next_notification_click() -> Result<u32, String> {
        imp::next_click().await
    }
}

#[cfg(all(target_os = "linux", feature = "host"))]
pub use linux::{clicks, send};

#[cfg(all(target_os = "linux", feature = "host"))]
use linux as imp;

#[cfg(not(all(target_os = "linux", feature = "host")))]
mod imp {
    /// Why nothing is shown on a build without the Linux host.
    const NONE: &str = "This build of the app has no desktop notifications.";

    pub(super) async fn notify(_title: String, _body: String) -> Result<u32, String> {
        Err(NONE.to_owned())
    }

    pub(super) async fn next_click() -> Result<u32, String> {
        Err(NONE.to_owned())
    }
}

#[cfg(all(target_os = "linux", feature = "host"))]
mod linux {
    use std::cell::RefCell;
    use std::collections::HashMap;
    use std::sync::OnceLock;

    use gio::prelude::*;
    use nsh_platform_linux::gtk4::{gio, glib};
    use tokio::sync::{Mutex, mpsc, oneshot};

    const SERVICE: &str = "org.freedesktop.Notifications";
    const PATH: &str = "/org/freedesktop/Notifications";
    /// The app's id, which names its desktop entry: the desktop shows the app's name and icon.
    const APP_ID: &str = crate::APP_ID;

    /// Sends a notification: one default action, which a click on the notification invokes, and
    /// no timeout of its own. `sent` gets the id the desktop gives it, or why it took none.
    pub fn send(
        bus: &gio::DBusConnection,
        summary: &str,
        body: &str,
        sent: impl FnOnce(Result<u32, String>) + 'static,
    ) {
        let hints = HashMap::from([("desktop-entry", APP_ID.to_variant())]);
        let notification = (
            "Uraeda",
            0_u32,
            "",
            summary,
            body,
            vec!["default", "Open"],
            hints,
            -1_i32,
        );
        bus.call(
            Some(SERVICE),
            PATH,
            SERVICE,
            "Notify",
            Some(&notification.to_variant()),
            glib::VariantTy::new("(u)").ok(),
            gio::DBusCallFlags::NONE,
            5000,
            gio::Cancellable::NONE,
            move |reply| {
                sent(match reply {
                    Ok(answer) => answer
                        .get::<(u32,)>()
                        .map(|(id,)| id)
                        .ok_or_else(|| "The desktop answered without an id.".to_owned()),
                    Err(error) => Err(format!("The desktop took no notification: {error}")),
                });
            },
        );
    }

    /// Calls `clicked` with the id of each notification the human clicks, while the subscription
    /// is kept.
    pub fn clicks(
        bus: &gio::DBusConnection,
        clicked: impl Fn(u32) + 'static,
    ) -> gio::SignalSubscription {
        bus.subscribe_to_signal(
            Some(SERVICE),
            Some(SERVICE),
            Some("ActionInvoked"),
            Some(PATH),
            None,
            gio::DBusSignalFlags::NONE,
            move |signal| {
                if let Some((id, action)) = signal.parameters.get::<(u32, String)>()
                    && action == "default"
                {
                    clicked(id);
                }
            },
        )
    }

    /// The thread that speaks to the bus: its main loop's context, and the clicks it heard.
    struct Service {
        context: glib::MainContext,
        clicks: Mutex<mpsc::UnboundedReceiver<u32>>,
    }

    thread_local! {
        /// The session bus, on the service's thread.
        static BUS: RefCell<Option<gio::DBusConnection>> = const { RefCell::new(None) };
    }

    /// The service, started at its first use: or why the session bus could not be reached.
    fn service() -> Result<&'static Service, String> {
        static SERVICE: OnceLock<Result<Service, String>> = OnceLock::new();
        SERVICE.get_or_init(start).as_ref().map_err(Clone::clone)
    }

    fn start() -> Result<Service, String> {
        let context = glib::MainContext::new();
        let (clicked, heard) = mpsc::unbounded_channel();
        let (ready, started) = std::sync::mpsc::channel();
        let owned = context.clone();
        std::thread::Builder::new()
            .name("notifications".to_owned())
            .spawn(move || {
                let ran = owned.with_thread_default(|| {
                    let bus = match gio::bus_get_sync(gio::BusType::Session, gio::Cancellable::NONE)
                    {
                        Ok(bus) => bus,
                        Err(error) => {
                            let _ = ready.send(Err(format!("No session bus: {error}")));
                            return;
                        }
                    };
                    let _subscription = clicks(&bus, move |id| {
                        let _ = clicked.send(id);
                    });
                    BUS.with(|kept| kept.replace(Some(bus)));
                    let _ = ready.send(Ok(()));
                    glib::MainLoop::new(Some(&owned), false).run();
                });
                if let Err(error) = ran {
                    let _ = ready.send(Err(error.to_string()));
                }
            })
            .map_err(|error| error.to_string())?;
        started
            .recv()
            .map_err(|_| "The notifications' thread stopped.".to_owned())??;
        Ok(Service {
            context,
            clicks: Mutex::new(heard),
        })
    }

    pub(super) async fn notify(title: String, body: String) -> Result<u32, String> {
        let service = service()?;
        let (answer, answered) = oneshot::channel();
        service.context.invoke(move || {
            BUS.with(|bus| match bus.borrow().as_ref() {
                Some(bus) => send(bus, &title, &body, move |id| {
                    let _ = answer.send(id);
                }),
                None => {
                    let _ = answer.send(Err("No session bus.".to_owned()));
                }
            });
        });
        answered
            .await
            .map_err(|_| "The notifications' thread stopped.".to_owned())?
    }

    pub(super) async fn next_click() -> Result<u32, String> {
        let service = service()?;
        let mut clicks = service.clicks.lock().await;
        clicks
            .recv()
            .await
            .ok_or_else(|| "The notifications' thread stopped.".to_owned())
    }
}
