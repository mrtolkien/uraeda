//! The registers: the unnamed one, `"a` to `"z`, `"0` for the last yank, and `"+` for the system
//! clipboard, which the layer never touches itself: it says what to write, and is given what was
//! read.

/// What a register holds.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub(crate) struct Entry {
    /// The text: whole lines end with a line break.
    pub text: String,
    /// Whether the text is whole lines, put above or below a line.
    pub linewise: bool,
}

#[derive(Debug, Default)]
pub(crate) struct Registers {
    unnamed: Option<Entry>,
    yanked: Option<Entry>,
    named: [Option<Entry>; 26],
    /// What the layer last sent to the system clipboard, to know lines when it reads them back.
    sent: Option<Entry>,
}

/// Whether `"` followed by `name` is a register of the subset.
pub(crate) fn is_register(name: char) -> bool {
    matches!(name, 'a'..='z' | '0' | '+' | '"')
}

fn letter(name: char) -> Option<usize> {
    name.is_ascii_lowercase()
        .then(|| name as usize - 'a' as usize)
}

impl Registers {
    /// Keeps a yanked or deleted text in `register`, the unnamed one when none is given. Returns
    /// the text to write to the system clipboard, if any: a yank with no register reaches it, a
    /// delete never does.
    pub fn write(&mut self, register: Option<char>, entry: Entry, yank: bool) -> Option<String> {
        let register = register.filter(|name| *name != '"');
        self.unnamed = Some(entry.clone());
        match register {
            None if yank => self.yanked = Some(entry.clone()),
            Some('0') => self.yanked = Some(entry.clone()),
            Some(name) => {
                if let Some(index) = letter(name) {
                    self.named[index] = Some(entry.clone());
                }
            }
            None => {}
        }
        let to_clipboard = register == Some('+') || (register.is_none() && yank);
        to_clipboard.then(|| {
            self.sent = Some(entry.clone());
            entry.text
        })
    }

    /// What `register` holds, the unnamed one when none is given. The system clipboard is read by
    /// the caller: see `of_clipboard`.
    pub fn read(&self, register: Option<char>) -> Option<&Entry> {
        match register {
            None | Some('"') => self.unnamed.as_ref(),
            Some('0') => self.yanked.as_ref(),
            Some(name) => self.named[letter(name)?].as_ref(),
        }
    }

    /// The entry for a text read from the system clipboard: lines when the layer sent it as lines,
    /// or when another program left a text that ends with a line break.
    pub fn of_clipboard(&self, contents: &str) -> Entry {
        let text = contents.replace("\r\n", "\n");
        match &self.sent {
            Some(sent) if sent.text == text => sent.clone(),
            _ => Entry {
                linewise: text.ends_with('\n'),
                text,
            },
        }
    }
}
