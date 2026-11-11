//! The device's tokens, in the system's secret store: the Secret Service of the session bus, which
//! GNOME's keyring, KDE's wallet, and KeePassXC serve. A token is an item of the default
//! collection, found by two attributes, the app and the server it signs in to, and never written
//! to a file of the app's.
//!
//! The secret crosses the bus in the clear, in a session of the `plain` algorithm: the bus is the
//! user's own, as the store's other clients use it. A locked collection asks the human to unlock
//! it, in the store's own prompt, which the call waits for.

use std::collections::HashMap;
use std::time::{Duration, Instant};

use nsh_platform_linux::gtk4::gio::prelude::*;
use nsh_platform_linux::gtk4::{gio, glib};

const SERVICE: &str = "org.freedesktop.secrets";
const ROOT: &str = "/org/freedesktop/secrets";
const STORE: &str = "org.freedesktop.Secret.Service";
const COLLECTION: &str = "org.freedesktop.Secret.Collection";
const ITEM: &str = "org.freedesktop.Secret.Item";
const PROMPT: &str = "org.freedesktop.Secret.Prompt";

/// The attribute that names the app's items.
const APPLICATION: &str = "dev.uraeda.app";

/// How long the human has to answer the store's prompt.
const PROMPTED: Duration = Duration::from_secs(120);

type Path = glib::variant::ObjectPath;
/// A secret as the store sends it: its session, its parameters, its value, and its type.
type Secret = (Path, Vec<u8>, Vec<u8>, String);

/// A connection to the secret store, with its session open.
struct Store {
    bus: gio::DBusConnection,
    session: Path,
}

/// The token kept for `server`, if any.
///
/// # Errors
///
/// When no secret store answers on the session bus, or it refused.
pub fn read(server: &str) -> Result<Option<String>, String> {
    let store = Store::open()?;
    let Some(item) = store.find(server)?.into_iter().next() else {
        return Ok(None);
    };
    let (secrets,): (HashMap<Path, Secret>,) = store.call(
        ROOT,
        STORE,
        "GetSecrets",
        &(vec![item], store.session.clone()),
    )?;
    let secret = secrets.into_values().next().map(|secret| secret.2);
    Ok(secret.map(|value| String::from_utf8_lossy(&value).into_owned()))
}

/// Keeps `token` for `server`, in place of the one kept before.
///
/// # Errors
///
/// As `read`, and when the human declined to unlock the store.
pub fn keep(server: &str, token: &str) -> Result<(), String> {
    let store = Store::open()?;
    let collection = store.collection()?;
    let attributes = attributes(server);
    let properties = HashMap::from([
        (
            "org.freedesktop.Secret.Item.Label".to_owned(),
            format!("Uraeda's device token for {server}").to_variant(),
        ),
        (
            "org.freedesktop.Secret.Item.Attributes".to_owned(),
            attributes.to_variant(),
        ),
    ]);
    let secret: Secret = (
        store.session.clone(),
        Vec::new(),
        token.as_bytes().to_vec(),
        "text/plain".to_owned(),
    );
    let (_, prompt): (Path, Path) = store.call(
        collection.as_str(),
        COLLECTION,
        "CreateItem",
        &(properties, secret, true),
    )?;
    store.prompt(&prompt)
}

/// Forgets the token kept for `server`.
///
/// # Errors
///
/// As `keep`.
pub fn forget(server: &str) -> Result<(), String> {
    let store = Store::open()?;
    for item in store.find(server)? {
        let (prompt,): (Path,) = store.call(item.as_str(), ITEM, "Delete", &())?;
        store.prompt(&prompt)?;
    }
    Ok(())
}

fn attributes(server: &str) -> HashMap<String, String> {
    HashMap::from([
        ("application".to_owned(), APPLICATION.to_owned()),
        ("server".to_owned(), server.to_owned()),
    ])
}

fn path(text: &str) -> Path {
    Path::try_from(text).expect("a valid object path")
}

impl Store {
    fn open() -> Result<Store, String> {
        let bus = gio::bus_get_sync(gio::BusType::Session, gio::Cancellable::NONE)
            .map_err(|error| format!("The session bus is not there: {error}"))?;
        let mut store = Store {
            bus,
            session: path("/"),
        };
        let plain = glib::Variant::from_variant(&"".to_variant());
        let (_, session): (glib::Variant, Path) =
            store.call(ROOT, STORE, "OpenSession", &("plain", plain))?;
        store.session = session;
        Ok(store)
    }

    /// Calls `method` of `interface` on the object `at`, and reads its answer as `Answer`.
    fn call<Answer: glib::variant::FromVariant + glib::variant::StaticVariantType>(
        &self,
        at: &str,
        interface: &str,
        method: &str,
        arguments: &impl ToVariant,
    ) -> Result<Answer, String> {
        let answer = self
            .bus
            .call_sync(
                Some(SERVICE),
                at,
                interface,
                method,
                Some(&arguments.to_variant()),
                Some(&Answer::static_variant_type()),
                gio::DBusCallFlags::NONE,
                // The store may wait for the human's answer to its own window.
                i32::try_from(PROMPTED.as_millis()).unwrap_or(i32::MAX),
                gio::Cancellable::NONE,
            )
            .map_err(|error| {
                format!(
                    "The system's secret store did not answer: {}",
                    error.message()
                )
            })?;
        answer
            .get::<Answer>()
            .ok_or_else(|| format!("The system's secret store answered {method} oddly."))
    }

    /// The app's items for `server`, unlocked.
    fn find(&self, server: &str) -> Result<Vec<Path>, String> {
        let (mut unlocked, locked): (Vec<Path>, Vec<Path>) =
            self.call(ROOT, STORE, "SearchItems", &(attributes(server),))?;
        if !locked.is_empty() {
            unlocked.extend(self.unlock(locked)?);
        }
        Ok(unlocked)
    }

    /// The default collection, made when the store has none.
    fn collection(&self) -> Result<Path, String> {
        let (collection,): (Path,) = self.call(ROOT, STORE, "ReadAlias", &("default",))?;
        if collection.as_str() != "/" {
            self.unlock(vec![collection.clone()])?;
            return Ok(collection);
        }
        let label = HashMap::from([(
            "org.freedesktop.Secret.Collection.Label".to_owned(),
            "Login".to_variant(),
        )]);
        let (made, prompt): (Path, Path) =
            self.call(ROOT, STORE, "CreateCollection", &(label, "default"))?;
        if made.as_str() != "/" {
            return Ok(made);
        }
        self.prompt(&prompt)?;
        let (collection,): (Path,) = self.call(ROOT, STORE, "ReadAlias", &("default",))?;
        Ok(collection)
    }

    fn unlock(&self, objects: Vec<Path>) -> Result<Vec<Path>, String> {
        let (unlocked, prompt): (Vec<Path>, Path) =
            self.call(ROOT, STORE, "Unlock", &(objects.clone(),))?;
        if prompt.as_str() == "/" {
            return Ok(unlocked);
        }
        self.prompt(&prompt)?;
        Ok(objects)
    }

    /// Shows the store's prompt, when it asks for one, and waits for the human's answer.
    fn prompt(&self, prompt: &Path) -> Result<(), String> {
        if prompt.as_str() == "/" {
            return Ok(());
        }
        let context = glib::MainContext::new();
        context
            .with_thread_default(|| {
                let answer = std::rc::Rc::new(std::cell::Cell::new(None));
                let heard = std::rc::Rc::clone(&answer);
                let _subscription = self.bus.subscribe_to_signal(
                    Some(SERVICE),
                    Some(PROMPT),
                    Some("Completed"),
                    Some(prompt.as_str()),
                    None,
                    gio::DBusSignalFlags::NONE,
                    move |signal| {
                        let dismissed = signal.parameters.get::<(bool, glib::Variant)>();
                        heard.set(Some(dismissed.is_none_or(|(dismissed, _)| dismissed)));
                    },
                );
                let _: () = self.call(prompt.as_str(), PROMPT, "Prompt", &("",))?;
                let asked = Instant::now();
                while answer.get().is_none() && asked.elapsed() < PROMPTED {
                    if !context.iteration(false) {
                        std::thread::sleep(Duration::from_millis(20));
                    }
                }
                match answer.get() {
                    Some(false) => Ok(()),
                    Some(true) => Err("The secret store was not unlocked.".to_owned()),
                    None => Err("The secret store's prompt was not answered.".to_owned()),
                }
            })
            .map_err(|error| error.to_string())?
    }
}
