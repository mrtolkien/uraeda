//! A system notification on Linux. NSH has no notification API, so the app speaks the desktop's
//! own: the `org.freedesktop.Notifications` service of the session bus, through GTK's `gio`. The
//! test's service takes that name on the hidden display's bus, where no desktop listens.

use std::collections::HashMap;
use std::sync::mpsc::{self, Receiver};

use gio::prelude::*;
use nsh_platform_linux::gtk4::{gio, glib};

const SERVICE: &str = "org.freedesktop.Notifications";
const PATH: &str = "/org/freedesktop/Notifications";
/// The app's id, which names its desktop entry: the desktop shows the app's name and icon.
const APP_ID: &str = "dev.uraeda.app";
/// The id the test's service gives the notification it gets.
const SHOWN_ID: u32 = 7;

/// The part of the desktop's notification interface the app uses.
const INTERFACE: &str = r#"<node>
  <interface name="org.freedesktop.Notifications">
    <method name="Notify">
      <arg type="s" name="app_name" direction="in"/>
      <arg type="u" name="replaces_id" direction="in"/>
      <arg type="s" name="app_icon" direction="in"/>
      <arg type="s" name="summary" direction="in"/>
      <arg type="s" name="body" direction="in"/>
      <arg type="as" name="actions" direction="in"/>
      <arg type="a{sv}" name="hints" direction="in"/>
      <arg type="i" name="expire_timeout" direction="in"/>
      <arg type="u" name="id" direction="out"/>
    </method>
    <signal name="ActionInvoked">
      <arg type="u" name="id"/>
      <arg type="s" name="action_key"/>
    </signal>
  </interface>
</node>"#;

/// `Notify`'s arguments, in the interface's order.
type Notify = (
    String,
    u32,
    String,
    String,
    String,
    Vec<String>,
    HashMap<String, glib::Variant>,
    i32,
);

/// Sends a notification as the app will: one default action, which a click on the notification
/// invokes, and no timeout of its own. `sent` gets the id the desktop gives it.
pub fn send(
    bus: &gio::DBusConnection,
    summary: &str,
    body: &str,
    sent: impl FnOnce(u32) + 'static,
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
        Some(glib::VariantTy::new("(u)").expect("a type")),
        gio::DBusCallFlags::NONE,
        5000,
        gio::Cancellable::NONE,
        move |reply| {
            let (id,) = reply
                .expect("the desktop takes the notification")
                .get::<(u32,)>()
                .expect("the notification's id");
            sent(id);
        },
    );
}

/// The ids of the notifications the human clicks, from now on, while the subscription is kept.
pub fn clicks(bus: &gio::DBusConnection) -> (gio::SignalSubscription, Receiver<u32>) {
    let (sender, receiver) = mpsc::channel();
    let subscription = bus.subscribe_to_signal(
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
                let _ = sender.send(id);
            }
        },
    );
    (subscription, receiver)
}

/// What the test's notification service was asked to show.
#[derive(Debug, PartialEq, Eq)]
pub struct Shown {
    pub app: String,
    pub summary: String,
    pub body: String,
    pub actions: Vec<String>,
    pub desktop_entry: Option<String>,
}

/// A notification service on the session bus, on a connection of its own: it records what it is
/// asked to show, and clicks it at once, as a human would.
pub fn serve() -> Receiver<Shown> {
    let address = gio::dbus_address_get_for_bus_sync(gio::BusType::Session, gio::Cancellable::NONE)
        .expect("the session bus's address");
    let bus = gio::DBusConnection::for_address_sync(
        &address,
        gio::DBusConnectionFlags::AUTHENTICATION_CLIENT
            | gio::DBusConnectionFlags::MESSAGE_BUS_CONNECTION,
        None,
        gio::Cancellable::NONE,
    )
    .expect("a second connection to the session bus");
    assert!(
        !answers(&bus),
        "a notification service answers on this bus, so it is not the hidden display's: \
         run the test through `hidden-display`"
    );
    let interface = gio::DBusNodeInfo::for_xml(INTERFACE)
        .expect("the interface's description")
        .lookup_interface(SERVICE)
        .expect("the notification interface");
    let (sender, receiver) = mpsc::channel();
    bus.register_object(PATH, &interface)
        .method_call(move |bus, _, _, _, _, arguments, invocation| {
            let (app, _, _, summary, body, actions, hints, _) =
                arguments.get::<Notify>().expect("Notify's arguments");
            let desktop_entry = hints.get("desktop-entry").and_then(glib::Variant::get);
            let _ = sender.send(Shown {
                app,
                summary,
                body,
                actions,
                desktop_entry,
            });
            invocation.return_value(Some(&(SHOWN_ID,).to_variant()));
            let click = (SHOWN_ID, "default").to_variant();
            bus.emit_signal(None, PATH, SERVICE, "ActionInvoked", Some(&click))
                .expect("a click sent back");
        })
        .build()
        .expect("the service's object");
    let (owned, owner) = mpsc::channel();
    gio::bus_own_name_on_connection(
        &bus,
        SERVICE,
        gio::BusNameOwnerFlags::NONE,
        move |_, _| {
            let _ = owned.send(());
        },
        |_, _| panic!("the notification service's name was lost"),
    );
    crate::stage::wait_for("the test's service takes its name", 10, || {
        owner.try_recv().ok()
    });
    receiver
}

/// Whether a notification service already answers on `bus`.
fn answers(bus: &gio::DBusConnection) -> bool {
    let reply = bus
        .call_sync(
            Some("org.freedesktop.DBus"),
            "/org/freedesktop/DBus",
            "org.freedesktop.DBus",
            "NameHasOwner",
            Some(&(SERVICE,).to_variant()),
            Some(glib::VariantTy::new("(b)").expect("a type")),
            gio::DBusCallFlags::NONE,
            5000,
            gio::Cancellable::NONE,
        )
        .expect("the bus answers");
    reply.get::<(bool,)>().expect("a yes or a no").0
}
