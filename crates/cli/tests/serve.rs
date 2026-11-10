mod common;

use std::fs;
use std::io::{BufRead, BufReader, Read, Write};
use std::net::TcpStream;
use std::path::Path;
use std::process::{Child, Command, Stdio};

use common::*;

/// A started `ura serve`, killed with the test when the test did not stop it.
struct Running(Child);

impl Drop for Running {
    fn drop(&mut self) {
        let _ = self.0.kill();
        let _ = self.0.wait();
    }
}

/// The folders of a test's server, and the variables that point `ura` at them.
struct Folders {
    home: tempfile::TempDir,
}

impl Folders {
    fn new() -> Folders {
        let home = tempfile::TempDir::new().unwrap();
        fs::create_dir(home.path().join("config")).unwrap();
        Folders { home }
    }

    fn config(&self) -> String {
        self.home.path().join("config").display().to_string()
    }

    fn data(&self) -> String {
        self.home.path().join("data").display().to_string()
    }

    /// `ura serve` in a folder, on this test's config and data folders.
    fn serve(&self, dir: &Path, args: &[&str]) -> Command {
        let data = self.data();
        let mut all = vec!["serve", "--data-dir", &data];
        all.extend_from_slice(args);
        let mut command = command(dir, &all);
        command
            .env("HOME", self.home.path())
            .env("URAEDA_CONFIG_DIR", self.config())
            .env_remove("URAEDA_ALLOWED_HOSTS");
        command
    }
}

/// The status of the answer to a `GET` sent to the server on `port`, under a `Host`.
fn status(port: u16, host: &str) -> u16 {
    let mut stream = TcpStream::connect(("127.0.0.1", port)).unwrap();
    write!(
        stream,
        "GET /nothing HTTP/1.1\r\nHost: {host}\r\nConnection: close\r\n\r\n"
    )
    .unwrap();
    let mut answer = String::new();
    stream.read_to_string(&mut answer).unwrap();
    answer.split_whitespace().nth(1).unwrap().parse().unwrap()
}

/// The names of the list of repositories, as stored.
fn listed(data: &str) -> Vec<String> {
    let text = fs::read_to_string(Path::new(data).join("repositories.json")).unwrap();
    let file: serde_json::Value = serde_json::from_str(&text).unwrap();
    let names = file["repositories"].as_array().unwrap().iter();
    let mut names: Vec<String> = names
        .map(|entry| entry["name"].as_str().unwrap().into())
        .collect();
    names.sort();
    names
}

#[test]
fn serve_runs_until_it_is_stopped_and_a_second_start_hands_over() {
    let folders = Folders::new();
    let repo = TestRepo::named("todo-app");
    // Only the config folder's `.env` is read: never the one of the folder the server runs in.
    fs::write(
        Path::new(&folders.config()).join(".env"),
        "URAEDA_ALLOWED_HOSTS=mac.tail1234.ts.net\n",
    )
    .unwrap();
    repo.write(".env", "URAEDA_ALLOWED_HOSTS=evil.example\n");

    let mut first = Running(
        folders
            .serve(repo.path(), &["--port", "0"])
            .stdout(Stdio::piped())
            .spawn()
            .unwrap(),
    );
    let mut line = String::new();
    BufReader::new(first.0.stdout.take().unwrap())
        .read_line(&mut line)
        .unwrap();

    let address = line
        .trim_end()
        .strip_prefix("Uraeda server on ")
        .expect(&line)
        .to_owned();
    let port: u16 = address.rsplit(':').next().unwrap().parse().unwrap();
    assert_eq!(address, format!("http://127.0.0.1:{port}"));
    assert_eq!(status(port, "mac.tail1234.ts.net"), 404);
    assert_eq!(status(port, "evil.example"), 403);

    // A second start, in another repository, on the same data folder.
    let notes = TestRepo::named("notes");
    let second = folders.serve(notes.path(), &[]).output().unwrap();

    assert_eq!(
        String::from_utf8(second.stdout).unwrap(),
        format!("Uraeda already runs at {address}/r/notes/\n")
    );
    assert_eq!(second.status.code(), Some(0));
    assert_eq!(listed(&folders.data()), ["notes", "todo-app"]);

    // A signal stops the server, which leaves no status file behind.
    let status_file = Path::new(&folders.data()).join("run/server.json");
    assert!(status_file.exists());
    let killed = Command::new("kill")
        .args(["-TERM", &first.0.id().to_string()])
        .status()
        .unwrap();
    assert!(killed.success());
    assert_eq!(first.0.wait().unwrap().code(), Some(0));
    assert!(!status_file.exists());
}
