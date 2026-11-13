//! A repository's pre-commit hook, as a test holds it.

use std::fs;
use std::path::PathBuf;

use super::repo::TestRepo;

/// The repository's pre-commit hook, held by the test: each commit waits until the test lets
/// the hooks go, is refused while the test says so, and writes in a log when it starts, with
/// the files it commits, and when it ends.
pub struct Hook {
    folder: PathBuf,
}

impl Hook {
    /// Replaces the repository's hook with one that waits.
    pub fn held(repo: &TestRepo) -> Hook {
        let folder = repo.parent().join("hook");
        fs::create_dir_all(&folder).expect("the hook's folder");
        let at = |name: &str| folder.join(name).display().to_string();
        let (gate, refuse, log) = (at("gate"), at("refuse"), at("log"));
        // A test that ends without letting it go takes its folder with it: the hook ends too,
        // where it waited forever, a process left behind on the machine.
        let folder_shown = folder.display().to_string();
        repo.set_hook(&format!(
            "echo \"start $(git diff --cached --name-only | tr '\\n' ' ')\" >> \"{log}\"\n\
             while [ ! -e \"{gate}\" ] && [ -d \"{folder_shown}\" ]; do sleep 0.02; done\n\
             sleep 0.05\n\
             echo end >> \"{log}\"\n\
             if [ -e \"{refuse}\" ]; then echo \"lint: 1 problem\"; exit 1; fi"
        ));
        Hook { folder }
    }

    /// Lets the commits waiting, and every later one, go on.
    pub fn release(&self) {
        fs::write(self.folder.join("gate"), "").expect("the gate");
    }

    /// Refuses the commits that end from now on, or lets them land again.
    pub fn refusing(&self, on: bool) {
        let refuse = self.folder.join("refuse");
        if on {
            fs::write(refuse, "").expect("the refusal");
        } else {
            fs::remove_file(refuse).expect("a refusal to take back");
        }
    }

    /// The log's lines: `start <files>` and `end`, in the order the hooks wrote them.
    pub fn log(&self) -> Vec<String> {
        let log = fs::read_to_string(self.folder.join("log")).unwrap_or_default();
        log.lines().map(|line| line.trim().to_owned()).collect()
    }
}
