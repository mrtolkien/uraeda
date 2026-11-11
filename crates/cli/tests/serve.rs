mod common;
// The stand-ins for the agents' commands that the server's own tests use, first on the `PATH` of
// a test's `ura serve`: the server asks each agent for its models as it starts.
#[path = "../../server/tests/support/machine.rs"]
#[allow(
    dead_code,
    reason = "this file uses only the stand-ins and their `PATH`"
)]
mod machine;

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
        fs::create_dir(home.path().join("stand-ins")).unwrap();
        machine::stand_ins(&home.path().join("stand-ins"));
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
        self.ura("serve", dir, args)
    }

    /// `ura pair` in a folder, with the server of this test's data folder.
    fn pair(&self, dir: &Path) -> Command {
        self.ura("pair", dir, &[])
    }

    /// A command of `ura` that takes `--data-dir`, on this test's config and data folders.
    fn ura(&self, name: &str, dir: &Path, args: &[&str]) -> Command {
        let data = self.data();
        let mut all = vec![name, "--data-dir", &data];
        all.extend_from_slice(args);
        let mut command = command(dir, &all);
        // The agents' commands are stand-ins that fail at once: no test runs the real ones.
        let path = machine::path(&[], &self.home.path().join("stand-ins"));
        command
            .env("HOME", self.home.path())
            .env("PATH", path)
            .env("URAEDA_CONFIG_DIR", self.config())
            .env_remove("URAEDA_ALLOWED_HOSTS");
        command
    }
}

/// The status and the body of the answer to a `POST` of JSON sent to the server on `port`.
fn post(port: u16, path: &str, body: &serde_json::Value) -> (u16, String) {
    let body = body.to_string();
    let mut stream = TcpStream::connect(("127.0.0.1", port)).unwrap();
    write!(
        stream,
        "POST {path} HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nContent-Type: application/json\r\n\
         Content-Length: {}\r\nConnection: close\r\n\r\n{body}",
        body.len()
    )
    .unwrap();
    let mut answer = String::new();
    stream.read_to_string(&mut answer).unwrap();
    let status = answer.split_whitespace().nth(1).unwrap().parse().unwrap();
    let body = answer.split_once("\r\n\r\n").map_or("", |(_, body)| body);
    (status, body.to_owned())
}

/// The first lines `ura serve` prints, as many as asked, and the port its first line names.
fn started(server: &mut Running, lines: usize) -> (u16, Vec<String>) {
    let mut output = BufReader::new(server.0.stdout.take().unwrap());
    let mut printed = Vec::new();
    for _ in 0..lines {
        let mut line = String::new();
        output.read_line(&mut line).unwrap();
        printed.push(line.trim_end().to_owned());
    }
    let address = printed[0]
        .strip_prefix("Uraeda server on ")
        .expect(&printed[0]);
    (
        address.rsplit(':').next().unwrap().parse().unwrap(),
        printed,
    )
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

// The contract between `ura pair` and the server: the code it prints is one the server takes,
// once.
#[test]
fn pair_shows_a_code_that_pairs_one_device() {
    let folders = Folders::new();
    let folder = tempfile::TempDir::new().unwrap();

    // Without a server, there is nothing to pair with.
    let none = folders.pair(folder.path()).output().unwrap();
    let no_server = format!(
        "ura: no server runs on {}: start one with `ura serve`\n",
        folders.data()
    );
    assert_eq!(String::from_utf8(none.stderr).unwrap(), no_server);
    assert_eq!(none.status.code(), Some(1));

    let mut serve = folders.serve(folder.path(), &["--port", "0"]);
    let mut server = Running(serve.stdout(Stdio::piped()).spawn().unwrap());
    let (port, printed) = started(&mut server, 3);
    // A first start shows the access key, once.
    let key = printed[1].strip_prefix("Access key, shown once: ura_");
    assert_eq!(key.map(str::len), Some(43), "{printed:?}");

    let shown = folders.pair(folder.path()).output().unwrap();

    assert_eq!(shown.status.code(), Some(0));
    let shown = String::from_utf8(shown.stdout).unwrap();
    let (text, picture) = shown.split_once("\n\n").expect(&shown);
    let lines: Vec<&str> = text.lines().collect();
    let code = lines[0].strip_prefix("Pairing code: ").expect(&shown);
    let groups: Vec<&str> = code.split('-').collect();
    let symbols = |group: &&str| group.len() == 4 && group.chars().all(char::is_alphanumeric);
    assert!(groups.len() == 3 && groups.iter().all(symbols), "{code}");
    let rest = [
        "It pairs one device, once, within 10 minutes.".to_owned(),
        format!("On the device, scan this, or enter the code at http://127.0.0.1:{port}"),
    ];
    assert_eq!(lines[1..], rest);
    // The QR code: a square of modules, two to a character's height, in its light margin.
    let rows: Vec<Vec<char>> = picture.lines().map(|row| row.chars().collect()).collect();
    let width = rows[0].len();
    assert!(
        width >= 21 + 8 && rows.len() == width.div_ceil(2),
        "{picture}"
    );
    let modules = |row: &Vec<char>| row.len() == width && row.iter().all(|c| " ▀▄█".contains(*c));
    assert!(rows.iter().all(modules), "{picture}");
    assert!(rows[..2].iter().all(|row| row.iter().all(|c| *c == ' ')));

    let pair = serde_json::json!({ "code": code, "name": "Phone" });
    let (paired, token) = post(port, "/pair", &pair);
    let (again, _) = post(port, "/pair", &pair);
    assert_eq!((paired, again), (200, 401), "{token}");
    assert!(token.contains("\"token\":"), "{token}");
}
