//! A stand-in of the server's two routes of extension pages, on loopback, as
//! `contracts/protocol.md` says them: `GET /extensions/key` and `GET /extensions/{name}/page`,
//! each for a signed-in device only. It also answers `/probe`, and counts who reached it: a page
//! must not.

use std::collections::HashMap;
use std::io::{BufRead as _, BufReader, Write as _};
use std::net::{TcpListener, TcpStream};
use std::sync::mpsc::{self, Receiver, Sender};
use std::sync::{Arc, Mutex, PoisonError};

/// The device's token the stand-in takes.
pub const TOKEN: &str = "device-id.device-secret";

#[derive(Default)]
struct Held {
    key: String,
    pages: HashMap<String, Vec<u8>>,
    probes: usize,
    /// The next request of this extension's page waits for the sender's word.
    gate: Option<(String, Receiver<()>)>,
    /// The requests of a page waiting at the gate.
    waiting: usize,
}

/// The server, and what it serves.
#[derive(Clone)]
pub struct Served {
    pub address: String,
    held: Arc<Mutex<Held>>,
}

impl Served {
    /// Serves pages signed under `key`, on a free port, until the test's process ends.
    pub fn start(key: String) -> Served {
        let listener = TcpListener::bind("127.0.0.1:0").expect("a free port");
        let address = format!("http://{}", listener.local_addr().expect("its address"));
        let held = Arc::new(Mutex::new(Held {
            key,
            ..Held::default()
        }));
        let serving = Arc::clone(&held);
        std::thread::spawn(move || {
            // One thread a request: one held at the gate holds no other.
            for stream in listener.incoming().flatten() {
                let serving = Arc::clone(&serving);
                std::thread::spawn(move || answer(stream, &serving));
            }
        });
        Served { address, held }
    }

    /// Serves `package` as the page of `name` from now on, as a save builds a new one.
    pub fn page(&self, name: &str, package: Vec<u8>) {
        let mut held = self.held.lock().unwrap_or_else(PoisonError::into_inner);
        held.pages.insert(name.to_owned(), package);
    }

    /// Gives `key` from now on, as a server does once its data folder was made again.
    pub fn key(&self, key: String) {
        self.held.lock().unwrap_or_else(PoisonError::into_inner).key = key;
    }

    /// Holds the next request of `name`'s page until the sender returned is used or dropped.
    pub fn hold(&self, name: &str) -> Sender<()> {
        let (open, gate) = mpsc::channel();
        self.held().gate = Some((name.to_owned(), gate));
        open
    }

    /// How many requests of a page wait at the gate.
    pub fn waiting(&self) -> usize {
        self.held().waiting
    }

    fn held(&self) -> std::sync::MutexGuard<'_, Held> {
        self.held.lock().unwrap_or_else(PoisonError::into_inner)
    }

    /// How many requests reached `/probe`.
    pub fn probes(&self) -> usize {
        self.held
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .probes
    }

    /// The address of `/probe`.
    pub fn probe(&self) -> String {
        format!("{}/probe", self.address)
    }
}

fn answer(stream: TcpStream, shared: &Mutex<Held>) {
    let mut reader = BufReader::new(&stream);
    let mut first = String::new();
    let _ = reader.read_line(&mut first);
    let mut signed_in = false;
    loop {
        let mut line = String::new();
        if reader.read_line(&mut line).unwrap_or(0) == 0 || line.trim().is_empty() {
            break;
        }
        let bearer = format!("bearer {TOKEN}");
        signed_in |= line.to_lowercase().trim() == format!("authorization: {bearer}");
    }
    let path = first.split(' ').nth(1).unwrap_or_default();
    let lock = || shared.lock().unwrap_or_else(PoisonError::into_inner);
    let mut held = lock();
    let gated = |(name, _): &mut (String, Receiver<()>)| path == format!("/extensions/{name}/page");
    if let Some((_, gate)) = held.gate.take_if(gated) {
        held.waiting += 1;
        drop(held);
        let _ = gate.recv();
        held = lock();
        held.waiting -= 1;
    }
    let (status, body) = match path.split('/').collect::<Vec<_>>()[..] {
        ["", "probe"] => {
            held.probes += 1;
            (200, b"probed".to_vec())
        }
        _ if !signed_in => (401, b"Not signed in".to_vec()),
        ["", "extensions", "key"] => (200, held.key.clone().into_bytes()),
        ["", "extensions", name, "page"] => match held.pages.get(name) {
            Some(package) => (200, package.clone()),
            None => (404, format!("{name} has no page").into_bytes()),
        },
        _ => (404, b"Not found".to_vec()),
    };
    drop(held);
    let mut stream = stream;
    let head = format!(
        "HTTP/1.1 {status} X\r\ncontent-length: {}\r\nconnection: close\r\n\r\n",
        body.len()
    );
    let _ = stream.write_all(head.as_bytes());
    let _ = stream.write_all(&body);
}
