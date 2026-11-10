//! The ports a preview command listens on, on 127.0.0.1.

use std::net::TcpListener;

use crate::secret;

/// The ports tried for a preview, from here to the ones the system hands out by itself: below,
/// the ones programs ask for by number.
const LOWEST_PORT: u16 = 20_000;
/// How many ports are tried before the system picks one.
const PORT_TRIES: usize = 20;

/// Whether nothing holds `port` of 127.0.0.1 now.
fn port_free(port: u16) -> bool {
    TcpListener::bind(("127.0.0.1", port)).is_ok()
}

/// Whether another program holds `port` of 127.0.0.1 now.
pub(super) fn port_taken(port: u16) -> bool {
    let bound = TcpListener::bind(("127.0.0.1", port));
    bound.is_err_and(|error| error.kind() == std::io::ErrorKind::AddrInUse)
}

/// The first port the system hands out by itself, to a connection or a listener that asks for
/// none: Linux's from its settings, 49152 elsewhere, as macOS's and IANA's.
fn system_ports() -> u16 {
    let range = std::fs::read_to_string("/proc/sys/net/ipv4/ip_local_port_range");
    let first = range
        .ok()
        .and_then(|range| range.split_whitespace().next()?.parse().ok());
    first.unwrap_or(49_152)
}

/// A free port of 127.0.0.1, for a command that listens on it later. Taken at random below the
/// ports the system hands out by itself: one it picked would be free when found, then handed to
/// another process's connection before the command listens. Only a program asking for the same
/// port by number can take it now.
pub(super) fn free_port() -> Option<u16> {
    let span = u32::from(system_ports().saturating_sub(LOWEST_PORT));
    for _ in 0..PORT_TRIES {
        if span == 0 {
            break;
        }
        let random = secret::random_bytes(4);
        let random = u32::from_be_bytes([random[0], random[1], random[2], random[3]]);
        let port = LOWEST_PORT + u16::try_from(random % span).ok()?;
        if port_free(port) {
            return Some(port);
        }
    }
    let listener = TcpListener::bind(("127.0.0.1", 0)).ok()?;
    Some(listener.local_addr().ok()?.port())
}
