//! The page of the human's notes: the starter vault, which carries the address it was asked at,
//! and the vault's place, saved in the settings.

mod support;

use std::io::Read;

use support::Server;
use uraeda_vault::Vault;

#[test]
fn the_starter_vault_carries_the_address_it_was_asked_at() {
    let dir = tempfile::tempdir().unwrap();
    let server = Server::syncing(Default::default(), Vault::new(dir.path().join("Notes")));
    let mut page = server.get(&format!("/{}/vault", server.token));
    let body = page.body_mut().read_to_string().unwrap();
    assert!(body.contains("href=\"vault/start.zip\""), "{body}");
    assert!(body.contains("this computer's own address"), "{body}");

    let mut response = server.get(&format!("/{}/vault/start.zip", server.token));
    assert_eq!(response.status().as_u16(), 200);
    let bytes = response.body_mut().read_to_vec().unwrap();
    let mut zip = zip::ZipArchive::new(std::io::Cursor::new(bytes)).unwrap();
    let mut data = String::new();
    zip.by_name("Notes/.obsidian/plugins/uraeda/data.json")
        .unwrap()
        .read_to_string(&mut data)
        .unwrap();
    let url = format!("http://{}/{}/", server.host(), server.token);
    assert!(data.contains(&url), "{data}");
}

#[test]
fn the_place_is_saved_in_the_settings() {
    let dir = tempfile::tempdir().unwrap();
    let config = dir.path().join("config");
    std::fs::create_dir_all(&config).unwrap();
    std::fs::write(config.join("config.toml"), "# mine\n[serve]\nport = 4400\n").unwrap();
    let server = Server::syncing_in(
        Default::default(),
        Vault::new(dir.path().join("A")),
        config.clone(),
    );
    let moved = dir.path().join("B C");
    let form = format!("path={}", moved.display().to_string().replace(' ', "+"));
    server.write(&format!("/{}/vault/place", server.token), &form);
    let text = std::fs::read_to_string(config.join("config.toml")).unwrap();
    assert!(text.starts_with("# mine\n[serve]\nport = 4400\n"), "{text}");
    assert!(
        text.contains(&format!("path = \"{}\"", moved.display())),
        "{text}"
    );
    let mut page = server.get(&format!("/{}/vault", server.token));
    assert!(page.body_mut().read_to_string().unwrap().contains("B C"));
}
