//! A web page served on loopback, as the server serves a preview, and real key presses on the
//! hidden display, which reach a window as a keyboard's do.

use std::io::{Read, Write};
use std::net::TcpListener;
use std::process::Command;

/// Serves `page` at every path of a loopback address, which it returns, until the process ends.
pub fn serve(page: &'static str) -> String {
    let listener = TcpListener::bind("127.0.0.1:0").expect("a loopback port");
    let port = listener.local_addr().expect("the port's number").port();
    std::thread::spawn(move || {
        for mut stream in listener.incoming().flatten() {
            // One read takes the whole request: the checks only send small GETs.
            let _ = stream.read(&mut [0; 8192]);
            let _ = write!(
                stream,
                "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\n\
                 Content-Length: {}\r\nConnection: close\r\n\r\n{page}",
                page.len()
            );
        }
    });
    format!("http://127.0.0.1:{port}/")
}

/// Moves the pointer, clicks, and presses keys on the hidden display, through the X server's
/// test extension: `steps` are `xdotool`'s, as `["mousemove", "400", "300", "click", "1"]`.
pub fn input(steps: &[&str]) {
    let status = Command::new("xdotool")
        .args(steps)
        .status()
        .expect("xdotool, from the dev shell");
    assert!(status.success(), "xdotool {steps:?} failed");
}
