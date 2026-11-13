//! A stand-in of the system's secret store, the Secret Service of the session bus, as GNOME's
//! keyring and KeePassXC serve it: the part the app uses, with one collection, always unlocked, so
//! it never prompts. It runs on a thread of its own, on the hidden display's bus.

use std::collections::HashMap;
use std::sync::{Arc, Mutex, mpsc};

use nsh_platform_linux::gtk4::gio::prelude::*;
use nsh_platform_linux::gtk4::{gio, glib};

const SERVICE: &str = "org.freedesktop.secrets";
const ROOT: &str = "/org/freedesktop/secrets";
const COLLECTION: &str = "/org/freedesktop/secrets/collection/login";
const SESSION: &str = "/org/freedesktop/secrets/session/1";

const INTERFACES: &str = r#"<node>
  <interface name="org.freedesktop.Secret.Service">
    <method name="OpenSession">
      <arg type="s" direction="in"/><arg type="v" direction="in"/>
      <arg type="v" direction="out"/><arg type="o" direction="out"/>
    </method>
    <method name="SearchItems">
      <arg type="a{ss}" direction="in"/>
      <arg type="ao" direction="out"/><arg type="ao" direction="out"/>
    </method>
    <method name="Unlock">
      <arg type="ao" direction="in"/>
      <arg type="ao" direction="out"/><arg type="o" direction="out"/>
    </method>
    <method name="GetSecrets">
      <arg type="ao" direction="in"/><arg type="o" direction="in"/>
      <arg type="a{o(oayays)}" direction="out"/>
    </method>
    <method name="ReadAlias">
      <arg type="s" direction="in"/><arg type="o" direction="out"/>
    </method>
  </interface>
  <interface name="org.freedesktop.Secret.Collection">
    <method name="CreateItem">
      <arg type="a{sv}" direction="in"/><arg type="(oayays)" direction="in"/>
      <arg type="b" direction="in"/>
      <arg type="o" direction="out"/><arg type="o" direction="out"/>
    </method>
  </interface>
  <interface name="org.freedesktop.Secret.Item">
    <method name="Delete"><arg type="o" direction="out"/></method>
  </interface>
</node>"#;

type Secret = (glib::variant::ObjectPath, Vec<u8>, Vec<u8>, String);

/// An item the store holds: its attributes and its secret.
struct Item {
    attributes: HashMap<String, String>,
    secret: Vec<u8>,
    registration: Option<gio::RegistrationId>,
}

#[derive(Default)]
struct Items {
    by_path: HashMap<String, Item>,
    next: u32,
}

/// The stand-in, while the test keeps it: what it holds.
pub struct Store {
    items: Arc<Mutex<Items>>,
}

impl Store {
    /// The secrets it holds now, as text.
    pub fn secrets(&self) -> Vec<String> {
        let items = self.items.lock().expect("the store");
        let secrets = items.by_path.values();
        secrets
            .map(|item| String::from_utf8_lossy(&item.secret).into_owned())
            .collect()
    }
}

/// Serves the stand-in on the session bus, which must be the hidden display's.
pub fn serve() -> Store {
    let items = Arc::new(Mutex::new(Items::default()));
    let served = Arc::clone(&items);
    let (ready, started) = mpsc::channel();
    std::thread::spawn(move || {
        let context = glib::MainContext::new();
        let _default = context.acquire().expect("the service's context");
        context
            .with_thread_default(|| {
                let bus = connect();
                register(&bus, &served);
                let owned = ready.clone();
                gio::bus_own_name_on_connection(
                    &bus,
                    SERVICE,
                    gio::BusNameOwnerFlags::NONE,
                    move |_, _| {
                        let _ = owned.send(());
                    },
                    |_, _| panic!("the stand-in's name was lost"),
                );
                glib::MainLoop::new(Some(&context), false).run();
            })
            .expect("the service's thread");
    });
    started
        .recv_timeout(std::time::Duration::from_secs(10))
        .expect("the stand-in takes its name");
    Store { items }
}

fn connect() -> gio::DBusConnection {
    let address = gio::dbus_address_get_for_bus_sync(gio::BusType::Session, gio::Cancellable::NONE)
        .expect("the session bus's address");
    assert!(
        std::env::var_os("URAEDA_OUTSIDE_CHECK").is_some(),
        "the stand-in serves only the hidden display's bus"
    );
    gio::DBusConnection::for_address_sync(
        &address,
        gio::DBusConnectionFlags::AUTHENTICATION_CLIENT
            | gio::DBusConnectionFlags::MESSAGE_BUS_CONNECTION,
        None,
        gio::Cancellable::NONE,
    )
    .expect("a connection to the session bus")
}

fn interface(name: &str) -> gio::DBusInterfaceInfo {
    gio::DBusNodeInfo::for_xml(INTERFACES)
        .expect("the interfaces")
        .lookup_interface(name)
        .expect("an interface")
}

fn path(text: &str) -> glib::variant::ObjectPath {
    glib::variant::ObjectPath::try_from(text).expect("an object path")
}

/// The service's and the collection's objects.
fn register(bus: &gio::DBusConnection, items: &Arc<Mutex<Items>>) {
    let held = Arc::clone(items);
    bus.register_object(ROOT, &interface("org.freedesktop.Secret.Service"))
        .method_call(move |_, _, _, _, method, arguments, invocation| {
            let items = held.lock().expect("the store");
            let answer = match method {
                "OpenSession" => {
                    (glib::Variant::from_variant(&"".to_variant()), path(SESSION)).to_variant()
                }
                "SearchItems" => {
                    let (asked,) = arguments
                        .get::<(HashMap<String, String>,)>()
                        .expect("attributes");
                    let found = items.by_path.iter().filter(|(_, item)| {
                        asked
                            .iter()
                            .all(|(key, value)| item.attributes.get(key) == Some(value))
                    });
                    let found: Vec<_> = found.map(|(at, _)| path(at)).collect();
                    (found, Vec::<glib::variant::ObjectPath>::new()).to_variant()
                }
                "Unlock" => {
                    let (asked,) = arguments
                        .get::<(Vec<glib::variant::ObjectPath>,)>()
                        .expect("paths");
                    (asked, path("/")).to_variant()
                }
                "GetSecrets" => {
                    let (asked, _) = arguments
                        .get::<(Vec<glib::variant::ObjectPath>, glib::variant::ObjectPath)>()
                        .expect("paths");
                    let secrets: HashMap<glib::variant::ObjectPath, Secret> = asked
                        .into_iter()
                        .filter_map(|at| {
                            let item = items.by_path.get(at.as_str())?;
                            let secret = (
                                path(SESSION),
                                vec![],
                                item.secret.clone(),
                                "text/plain".to_owned(),
                            );
                            Some((at, secret))
                        })
                        .collect();
                    (secrets,).to_variant()
                }
                _ => (path(COLLECTION),).to_variant(),
            };
            invocation.return_value(Some(&answer));
        })
        .build()
        .expect("the service's object");
    let held = Arc::clone(items);
    bus.register_object(COLLECTION, &interface("org.freedesktop.Secret.Collection"))
        .method_call(move |bus, _, _, _, _, arguments, invocation| {
            let (properties, secret, replace) = arguments
                .get::<(HashMap<String, glib::Variant>, Secret, bool)>()
                .expect("CreateItem's arguments");
            let attributes: HashMap<String, String> = properties
                .get("org.freedesktop.Secret.Item.Attributes")
                .and_then(glib::Variant::get)
                .expect("the item's attributes");
            if replace {
                remove(&bus, &held, |item| item.attributes == attributes);
            }
            let at = {
                let mut items = held.lock().expect("the store");
                items.next += 1;
                format!("{COLLECTION}/{}", items.next)
            };
            let registration = register_item(&bus, &held, &at);
            held.lock().expect("the store").by_path.insert(
                at.clone(),
                Item {
                    attributes,
                    secret: secret.2,
                    registration: Some(registration),
                },
            );
            invocation.return_value(Some(&(path(&at), path("/")).to_variant()));
        })
        .build()
        .expect("the collection's object");
}

fn register_item(
    bus: &gio::DBusConnection,
    items: &Arc<Mutex<Items>>,
    at: &str,
) -> gio::RegistrationId {
    let held = Arc::clone(items);
    let own = at.to_owned();
    bus.register_object(at, &interface("org.freedesktop.Secret.Item"))
        .method_call(move |bus, _, _, _, _, _, invocation| {
            let gone = held.lock().expect("the store").by_path.remove(&own);
            if let Some(registration) = gone.and_then(|item| item.registration) {
                let _ = bus.unregister_object(registration);
            }
            invocation.return_value(Some(&(path("/"),).to_variant()));
        })
        .build()
        .expect("an item's object")
}

/// Removes the items `matches` names, and their objects.
fn remove(bus: &gio::DBusConnection, items: &Arc<Mutex<Items>>, matches: impl Fn(&Item) -> bool) {
    let mut items = items.lock().expect("the store");
    let gone: Vec<String> = items
        .by_path
        .iter()
        .filter(|(_, item)| matches(item))
        .map(|(at, _)| at.clone())
        .collect();
    for at in gone {
        if let Some(registration) = items.by_path.remove(&at).and_then(|item| item.registration) {
            let _ = bus.unregister_object(registration);
        }
    }
}
