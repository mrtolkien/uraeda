//! Writes the client's TypeScript types to the file given: `just protocol-types`.

use std::path::PathBuf;

fn main() -> std::io::Result<()> {
    let path = std::env::args_os()
        .nth(1)
        .map(PathBuf::from)
        .expect("the file to write, as `app/store/protocol.d.ts`");
    if let Some(folder) = path.parent() {
        std::fs::create_dir_all(folder)?;
    }
    std::fs::write(
        path,
        uraeda_protocol::typescript(&uraeda_protocol::catalog()),
    )
}
