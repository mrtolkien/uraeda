//! The editor of every text field, `TextEditor` in TSX: Native Shell's `Editor` set as a field
//! (Markdown highlighted, wrapped, no gutter), the keys a field takes back from the editor, and
//! Vim's keys from `uraeda-vim` while the setting is on.
//!
//! A key never crosses into TSX: it is bound here while the field has the focus, and its edits
//! are carried out on the editor's own API at once, one replacement as one step of undo, so the
//! next key reads the text the last one left. With Vim off, no key reaches the Vim layer.
//!
//! The field's own keys, bound after the editor's so they win over them, each told to TSX as
//! `onKey`: `escape`, the field's Escape once Vim leaves it (`quit` for `:q`); `leave`, Shift+Escape
//! in any mode; `save`, Ctrl+Enter or `:w` (`:wq` is both); `enter`, a one-line field's Enter,
//! which never adds a line; `down` and `up`, `j` and `k` in normal mode in a one-line field, as a
//! picker's filter moves its list; and each keystroke of `keys`, the keys the field's owner hears
//! in it, as a dialog's Tab.

use std::cell::{Cell, RefCell};
use std::rc::Rc;
use std::time::Duration;

use nsh_base::editor::{
    Editor, EditorApi, EditorClasses, EditorCommand, EditorDecoration, EditorEdit, EditorPosition,
    EditorRange, EditorScrollBeyond, EditorSelection, editor,
};
use nsh_core::keymap::When;
use nsh_core::prelude::*;
use nsh_core::time::Instant;
use uraeda_vim::{Edit, Key, Lines, Mode, TextView, Vim};

mod api;
mod echo;
mod keys;
mod types;

pub use api::TextEditorApi;
use keys::{editor_position, position, vim_key, vim_strokes};
pub use types::*;

thread_local! {
    /// The one layer of every field, as one Vim serves every buffer: registers, the last search,
    /// and the change `.` repeats go from field to field.
    static VIM: RefCell<Vim> = RefCell::new(Vim::new());
    /// The calls into the layer since the app started, and the microseconds they took with their
    /// edits carried out.
    static COUNT: Cell<(u64, u64)> = const { Cell::new((0, 0)) };
}

/// What the Vim layer costs.
#[module]
pub(crate) struct VimBridge;

#[module(flat)]
impl VimBridge {
    /// How many times the text fields called the Vim layer since the app started, and how long
    /// those calls took with their edits carried out: a field with Vim off never calls it.
    #[expect(clippy::cast_precision_loss, reason = "a count far under 2^52")]
    pub(crate) fn vim_keys() -> VimCount {
        let (keys, micros) = COUNT.get();
        VimCount {
            keys: keys as f64,
            micros: micros as f64,
        }
    }
}

/// A field's editor and what it keeps between keys.
#[derive(Clone)]
struct Field {
    ed: ComponentRef<Editor>,
    props: TextEditorProps,
    cx: Scope<TextEditorEvent>,
    focused: Signal<bool>,
    /// Whether keys type: Vim off, or in insert mode.
    typing: Signal<bool>,
    caret: Signal<EditorPosition>,
    keep: Rc<Keep>,
}

/// What a field keeps outside the reactive graph.
#[derive(Default)]
struct Keep {
    /// While the field carries out the layer's edits: the selections they make are its own.
    applying: Cell<bool>,
    /// Whether the text changed since the caret was last seen: a move with an edit is no jump.
    edited: Cell<bool>,
    /// The caret last seen, and its box.
    seen: Cell<Option<(EditorPosition, Option<CaretBox>)>>,
    /// The command typed after `:`, while it is.
    command: RefCell<Option<String>>,
    /// The status last told.
    told: RefCell<VimStatus>,
    /// The texts told to the owner since it last caught up (`echo.rs`).
    texts: RefCell<echo::Told>,
}

/// The editor of every text field: Native Shell's editor set as a field, Markdown highlighted, or
/// the language its owner names, and wrapped, with the field's own keys, and Vim's while `vim` is on. Keys are handled in Rust.
#[component(methods = TextEditorApi)]
pub fn TextEditor(props: TextEditorProps, cx: Scope<TextEditorEvent>) -> impl IntoElement {
    let field = Field {
        ed: component_ref::<Editor>(),
        props,
        cx,
        focused: signal(false),
        typing: signal(true),
        caret: signal(EditorPosition::default()),
        keep: Rc::new(Keep::default()),
    };
    cx.methods(TextEditorApi::new(field.clone()));
    field.bind_keys();
    field.view()
}

impl Field {
    fn api(&self) -> Option<Rc<EditorApi>> {
        self.ed.api::<EditorApi>()
    }

    fn view(&self) -> impl IntoElement + use<> {
        // The editor wraps its rows itself, and a row keeps the space it broke after. Native Shell's
        // text on GTK wraps a line whose trailing space passes its box, where CSS and Pango let it
        // hang: a row that fits but for that space broke again, its last word drawn over the next
        // row. So no row's text wraps; the placeholder, one text, still does. Ruling R198; still
        // so in Native Shell 0.5.0, where the editor's `line` part's style is not drawn either.
        let mut classes = EditorClasses::default();
        classes.placeholder = Some("whitespace-normal".into());
        view()
            .app_class(Some(SharedString::from("whitespace-nowrap")))
            .w_full()
            .child(self.editor(classes))
    }

    fn editor(&self, classes: EditorClasses) -> impl IntoElement + use<> {
        let props = self.props;
        let (block, changed, selected) = (self.clone(), self.clone(), self.clone());
        let (focus, blur) = (self.clone(), self.clone());
        editor()
            .component_ref(&self.ed)
            .classes(classes)
            // A text the keys typed past since is an echo that came late: the field keeps its own.
            .value({
                let echoes = self.keep.clone();
                move || {
                    let value = props.value.get();
                    echoes.texts.borrow_mut().takes(&value).then_some(value)
                }
            })
            .language(move || {
                Some(
                    props
                        .language
                        .get()
                        .unwrap_or_else(|| SharedString::from("markdown")),
                )
            })
            .soft_wrap(true)
            .line_numbers(false)
            .folding(false)
            .active_line(false)
            .indent_guides(false)
            .auto_close(false)
            .scroll_beyond_last_line(EditorScrollBeyond::None)
            .placeholder(props.placeholder)
            .read_only(props.read_only)
            .min_rows(props.min_rows)
            .max_rows(props.max_rows)
            .font_family(props.font_family)
            .font_size(props.font_size)
            .line_height(props.line_height)
            .styles(props.styles)
            .accessibility_label(props.accessibility_label)
            .decorations(move || block.block())
            .on_change(move |value: &SharedString| {
                changed.keep.edited.set(true);
                changed.keep.texts.borrow_mut().told(value);
                changed.cx.emit(TextEditorEvent::Change(value.clone()));
            })
            .on_selection_change(move |all: &Vec<EditorSelection>| selected.selected(all))
            .on_focus(move || focus.focus_changed(true))
            .on_blur(move || blur.focus_changed(false))
            .w_full()
    }

    /// The character under the caret, drawn as a block outside insert mode.
    fn block(&self) -> Vec<EditorDecoration> {
        let style = self.props.block.get();
        if self.typing.get() || !self.focused.get() || style.is_none() {
            return Vec::new();
        }
        let at = self.caret.get();
        let next = EditorPosition::new(at.line, at.column + 1);
        let mut block = EditorDecoration::default();
        block.range = EditorRange::new(at, next);
        block.style = style;
        vec![block]
    }

    /// The keys the field takes while it has the focus: its own, its owner's, and Vim's outside
    /// insert mode. Native Shell gives a key to the newest view binding of it, and any view's
    /// binding wins over the script's: they are bound a moment after the change that asks for
    /// them, after the editor's own, which it binds as it takes the focus.
    fn bind_keys(&self) {
        let field = self.clone();
        effect(move || {
            if !field.focused.get() {
                return;
            }
            let props = field.props;
            let mut strokes: Vec<String> = ["escape", "shift+escape", "mod+enter"]
                .map(str::to_owned)
                .to_vec();
            if props.one_line.get() {
                strokes.extend(["enter", "shift+enter"].map(str::to_owned));
            } else if props.takes_enter.get() {
                strokes.push("enter".to_owned());
            }
            strokes.extend(props.keys.get().iter().map(ToString::to_string));
            if props.vim.get() && !field.typing.get() {
                strokes.extend(vim_strokes());
            }
            strokes.sort();
            strokes.dedup();
            let field = field.clone();
            // Ends, its bindings with it, as the effect runs again.
            set_timeout(Duration::ZERO, move || field.bind(strokes));
        });
    }

    fn bind(&self, strokes: Vec<String>) {
        for stroke in strokes {
            let (field, repeat) = (self.clone(), !stroke.contains("enter"));
            // The field takes its keys: none goes on to the platform (`pass_through`).
            let options = KeyOptions {
                when: When::Always,
                repeat,
                pass_through: false,
            };
            on_key_with(&stroke, options, move |pressed| field.press(pressed));
        }
    }

    /// One key: Vim's first, while it is on, then the field's.
    fn press(&self, stroke: &str) {
        if self.props.vim.get_untracked() && self.vim_takes(stroke) {
            return;
        }
        self.give(stroke);
    }

    /// A key the field gives its owner.
    fn give(&self, stroke: &str) {
        let key = match stroke {
            "shift+escape" => "leave",
            "mod+enter" => "save",
            "shift+enter" => "enter",
            "enter"
                if !self.props.one_line.get_untracked()
                    && !self.props.takes_enter.get_untracked() =>
            {
                // A field of several lines: an owner's Enter, else Vim's Enter in normal mode.
                if self
                    .props
                    .keys
                    .get_untracked()
                    .iter()
                    .any(|key| key == "enter")
                {
                    "enter"
                } else {
                    if let Some(api) = self.api() {
                        api.run(EditorCommand::MoveDown);
                    }
                    return;
                }
            }
            other => other,
        };
        self.cx
            .emit(TextEditorEvent::Key(SharedString::from(key.to_owned())));
    }

    /// Whether the Vim layer, or the `:` line, took the key.
    fn vim_takes(&self, stroke: &str) -> bool {
        let Some(key) = vim_key(stroke) else {
            return false;
        };
        if self.keep.command.borrow().is_some() {
            self.command_key(key);
            return true;
        }
        let status = VIM.with_borrow(Vim::status);
        let idle = status.mode == Mode::Normal && status.pending.is_empty();
        if status.mode == Mode::Insert && key != Key::Escape {
            return false;
        }
        if idle && self.props.one_line.get_untracked() && matches!(key, Key::Char('j' | 'k')) {
            self.give(if key == Key::Char('j') { "down" } else { "up" });
            return true;
        }
        if idle && key == Key::Char(':') {
            *self.keep.command.borrow_mut() = Some(String::new());
            self.tell_status();
            return true;
        }
        !self.call(|vim, view| vim.key(key, view))
    }

    /// A key of the `:` line: `:w` saves, `:q` is the field's Escape, `:wq` and `:x` both.
    fn command_key(&self, key: Key) {
        let mut ran = None;
        {
            let mut command = self.keep.command.borrow_mut();
            let Some(typed) = command.as_mut() else {
                return;
            };
            match key {
                Key::Char(typed_char) => typed.push(typed_char),
                Key::Backspace if !typed.is_empty() => {
                    typed.pop();
                }
                Key::Enter => ran = command.take(),
                _ => *command = None,
            }
        }
        self.tell_status();
        match ran.as_deref().map(str::trim) {
            Some("w") => self.give("mod+enter"),
            Some("q" | "q!") => self.give("quit"),
            Some("wq" | "x") => {
                self.give("mod+enter");
                self.give("quit");
            }
            _ => {}
        }
    }

    /// Calls the layer on the field's text and selection, and carries out its edits. Says
    /// whether it left the key to the field.
    fn call(&self, run: impl FnOnce(&mut Vim, &TextView<'_>) -> Vec<Edit>) -> bool {
        let Some(api) = self.api() else {
            return true;
        };
        let started = Instant::now();
        let edits = {
            let text = api.value();
            let lines = Lines::new(&text);
            let at = api.selections().last().copied().unwrap_or_default();
            let view = TextView {
                text: &lines,
                anchor: position(at.anchor),
                head: position(at.head),
            };
            VIM.with_borrow_mut(|vim| run(vim, &view))
        };
        let passed = self.carry_out(&api, edits);
        let spent = u64::try_from(started.elapsed().as_micros()).unwrap_or(u64::MAX);
        COUNT.set({
            let (keys, micros) = COUNT.get();
            (keys + 1, micros.saturating_add(spent))
        });
        self.tell_status();
        passed
    }

    /// Carries out one call's edits, in order. Says whether one left the key to the field.
    fn carry_out(&self, api: &EditorApi, edits: Vec<Edit>) -> bool {
        let (mut passed, mut moved_history) = (false, false);
        self.keep.applying.set(true);
        for edit in edits {
            match edit {
                Edit::Replace { start, end, text } => api.edit(vec![EditorEdit::new(
                    EditorRange::new(editor_position(start), editor_position(end)),
                    text,
                )]),
                Edit::Select { anchor, head } => api.set_selections(vec![EditorSelection::new(
                    editor_position(anchor),
                    editor_position(head),
                )]),
                Edit::Undo | Edit::Redo => {
                    api.run(if edit == Edit::Undo {
                        EditorCommand::Undo
                    } else {
                        EditorCommand::Redo
                    });
                    moved_history = true;
                }
                Edit::Clipboard(text) => set_clipboard(text),
                Edit::ReadClipboard => self.read_clipboard(),
                Edit::Pass => passed = true,
            }
        }
        self.keep.applying.set(false);
        self.seen(api);
        if moved_history {
            self.call(|vim, view| vim.sync(view));
        }
        passed
    }

    /// `"+p`: the layer puts the system clipboard's text once it is read.
    fn read_clipboard(&self) {
        let field = self.clone();
        spawn(async move {
            let text = clipboard_string().await;
            field.call(|vim, view| vim.clipboard(&text, view));
        });
    }

    /// The selection changed: the layer hears one made outside it, and a jump leaves a trail.
    fn selected(&self, all: &[EditorSelection]) {
        if let Some(primary) = all.last() {
            self.caret.set(primary.head);
        }
        if self.keep.applying.get() {
            return;
        }
        if let Some(api) = self.api() {
            self.seen(&api);
        }
        if self.props.vim.get_untracked()
            && self.focused.get_untracked()
            && !self.typing.get_untracked()
        {
            self.call(|vim, view| vim.sync(view));
        }
    }

    /// Tells a jump of the caret since it was last seen, as `onTrail`.
    fn seen(&self, api: &EditorApi) {
        let Some(head) = api.selections().last().map(|at| at.head) else {
            return;
        };
        let edited = self.keep.edited.take();
        let now = self
            .props
            .trail
            .get_untracked()
            .then(|| caret_box(api))
            .flatten();
        let before = self.keep.seen.replace(Some((head, now)));
        let Some((was, Some(from))) = before else {
            return;
        };
        let jumped = was.line != head.line || was.column.abs_diff(head.column) > 1;
        if let (true, false, true, Some(to)) = (jumped, edited, self.focused.get_untracked(), now) {
            self.cx
                .emit(TextEditorEvent::Trail(CaretTrail { from, to }));
        }
    }

    fn focus_changed(&self, focused: bool) {
        self.focused.set(focused);
        *self.keep.command.borrow_mut() = None;
        if focused {
            if self.props.vim.get_untracked() {
                let normal = self.props.normal_first.get_untracked();
                self.call(|vim, view| open_vim(vim, view, normal));
            } else {
                self.typing.set(true);
            }
            self.cx.emit(TextEditorEvent::Focus);
        } else {
            self.cx.emit(TextEditorEvent::Blur);
        }
    }

    /// Tells the layer's status when it changed, and whether keys type.
    fn tell_status(&self) {
        let status = match self.keep.command.borrow().as_ref() {
            Some(typed) => VimStatus {
                mode: "COMMAND".into(),
                pending: format!(":{typed}"),
            },
            None => {
                let status = VIM.with_borrow(Vim::status);
                VimStatus {
                    mode: status.mode.label().into(),
                    pending: status.pending,
                }
            }
        };
        self.typing.set(status.mode == Mode::Insert.label());
        if *self.keep.told.borrow() != status {
            self.keep.told.replace(status.clone());
            self.cx.emit(TextEditorEvent::Status(status));
        }
    }
}

/// The layer for a field that takes the focus: typing, or in normal mode as a buffer opens.
fn open_vim(vim: &mut Vim, view: &TextView<'_>, normal: bool) -> Vec<Edit> {
    if normal {
        vim.reset();
        vim.sync(view)
    } else {
        vim.insert(view)
    }
}

/// The caret's box in the field, when it is laid out.
fn caret_box(api: &EditorApi) -> Option<CaretBox> {
    let bounds = api.caret_bounds()?.bounds;
    Some(CaretBox {
        x: f64::from(bounds.origin.x.0),
        y: f64::from(bounds.origin.y.0),
        width: f64::from(bounds.size.width.0),
        height: f64::from(bounds.size.height.0),
    })
}
