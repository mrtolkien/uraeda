//! The keys of normal, visual, and operator-pending mode: a count, a register, an operator, then
//! a motion, an object, or a command.

use crate::motion::{self, Env, Find, Motion, Target};
use crate::operator::{self, Operator};
use crate::out::Out;
use crate::register::is_register;
use crate::search::Prompt;
use crate::state::{State, Vim, Wait};
use crate::text::{Doc, Span};
use crate::{Edit, Key, object};

/// The subset of Vim the layer has, each item as the keys that reach it, in the notation of
/// [`crate::keys`]. A key that is in no item does nothing, and every item has a row in the
/// layer's table of cases: both are tested.
pub const SUBSET: &[&str] = &[
    // Motions, each with a count.
    "h", "j", "k", "l", "w", "b", "e", "W", "B", "E", "0", "^", "$", "gg", "G", "f", "F", "t", "T",
    ";", ",", "%", "{", "}", // Operators, and each one doubled for a line.
    "d", "c", "y", ">", "<lt>", "dd", "cc", "yy", ">>", "<lt><lt>",
    // Commands on the caret's character or line.
    "D", "C", "Y", "x", "X", "s", "S", "r", "J", "~", "p", "P", // Text objects.
    "iw", "aw", "iW", "aW", "ip", "ap", "i\"", "a\"", "i'", "a'", "i(", "a(", "i[", "a[", "i{",
    "a{", "it", "at", "i`", "a`", // Visual mode, with `o` for the selection's other end.
    "v", "V", "vo", // Registers: the unnamed one needs no key.
    "\"a", "\"0", "\"+", // Search, repeat, undo, and the ways into insert mode.
    "/", "?", "n", "N", "*", "#", ".", "u", "<C-r>", "i", "a", "I", "A", "o", "O",
];

impl Vim {
    /// One key of a command. True while the command waits for more keys.
    pub(crate) fn step(&mut self, key: Key, out: &mut Out<'_>) -> bool {
        self.typed.push_str(&key.to_string());
        if let Some(wait) = self.pending.wait.take() {
            self.record.push(key);
            return self.argument(wait, key, out);
        }
        let Key::Char(typed) = key else {
            return self.special(key, out);
        };
        // `0` is a motion, unless a count is being typed.
        if let Some(digit) = typed
            .to_digit(10)
            .filter(|digit| *digit != 0 || self.pending.count.is_some())
        {
            self.pending.digit(digit);
            return true;
        }
        self.record.push(key);
        self.command(typed, out)
    }

    /// A key that types nothing. Enter and unknown Control keys are the field's own, unless a
    /// command is half typed: they then cancel it.
    fn special(&mut self, key: Key, out: &mut Out<'_>) -> bool {
        let idle = self.pending.operator.is_none() && self.pending.register.is_none();
        match key {
            Key::Ctrl('r') if idle && matches!(self.mode, State::Normal) => {
                out.effects
                    .extend(std::iter::repeat_n(Edit::Redo, self.pending.times()));
            }
            Key::Enter | Key::Ctrl(_) if idle && self.pending.count.is_none() => {
                out.effects.push(Edit::Pass)
            }
            _ => {}
        }
        false
    }

    fn wait(&mut self, wait: Wait) -> bool {
        self.pending.wait = Some(wait);
        true
    }

    fn command(&mut self, typed: char, out: &mut Out<'_>) -> bool {
        let operating = self.pending.operator.is_some();
        let visual = matches!(self.mode, State::Visual { .. });
        match typed {
            '"' if !operating => self.wait(Wait::Register),
            'g' => self.wait(Wait::Go),
            'f' | 'F' | 't' | 'T' => self.wait(Wait::Find {
                forward: typed.is_lowercase(),
                till: typed.eq_ignore_ascii_case(&'t'),
            }),
            'r' if !operating => self.wait(Wait::Replace),
            'i' | 'a' if operating || visual => self.wait(Wait::Object {
                around: typed == 'a',
            }),
            '/' | '?' => {
                self.prompt = Some(Prompt {
                    forward: typed == '/',
                    text: String::new(),
                });
                true
            }
            _ => self.run(typed, out),
        }
    }

    /// A key that needs no other key after it, except an operator, which waits for its motion.
    fn run(&mut self, typed: char, out: &mut Out<'_>) -> bool {
        if let Some(target) = self.motion(typed, out.doc) {
            self.moved(target, out);
            return false;
        }
        if let Some(operator) = Operator::of(typed) {
            return self.operator_key(operator, out);
        }
        match self.mode {
            _ if self.pending.operator.is_some() => {}
            State::Visual { .. } => self.visual_command(typed, out),
            _ => self.normal_command(typed, out),
        }
        false
    }

    /// The key after one that waits.
    fn argument(&mut self, wait: Wait, key: Key, out: &mut Out<'_>) -> bool {
        let Key::Char(typed) = key else { return false };
        match wait {
            Wait::Register if is_register(typed) => {
                self.pending.register = Some(typed);
                return true;
            }
            Wait::Register => {}
            Wait::Go if typed == 'g' => {
                let target = self.motion_of(Motion::FirstLine, out.doc);
                self.moved(target, out);
            }
            Wait::Go => {}
            Wait::Find { forward, till } => {
                let find = Find {
                    target: typed,
                    forward,
                    till,
                    again: false,
                };
                self.find = Some(find);
                let target = self.motion_of(Motion::Find(find), out.doc);
                self.moved(target, out);
            }
            Wait::Replace => self.replace_char(typed, out),
            Wait::Object { around } => self.object(typed, around, out),
        }
        false
    }

    /// The motion of a key: none when the key is no motion, and no target when it cannot move.
    fn motion(&mut self, typed: char, doc: Doc<'_>) -> Option<Option<Target>> {
        let motion = match typed {
            'h' => Motion::Left,
            'l' => Motion::Right,
            'j' => Motion::Down,
            'k' => Motion::Up,
            'w' | 'W' => Motion::Word { big: typed == 'W' },
            'b' | 'B' => Motion::Back { big: typed == 'B' },
            'e' | 'E' => Motion::End { big: typed == 'E' },
            '0' => Motion::LineStart,
            '^' => Motion::FirstNonBlank,
            '$' => Motion::LineEnd,
            'G' => Motion::LastLine,
            '%' => Motion::Match,
            '{' | '}' => Motion::Paragraph {
                forward: typed == '}',
            },
            ';' | ',' => {
                let Some(find) = self.find else {
                    return Some(None);
                };
                Motion::Find(Find {
                    forward: find.forward == (typed == ';'),
                    again: true,
                    ..find
                })
            }
            'n' | 'N' => return Some(self.search_again(doc, typed == 'N')),
            '*' | '#' => return Some(self.search_word(doc, typed == '*')),
            _ => return None,
        };
        Some(self.motion_of(motion, doc))
    }

    pub(crate) fn motion_of(&mut self, motion: Motion, doc: Doc<'_>) -> Option<Target> {
        let env = Env {
            doc,
            from: self.cursor,
            count: self.pending.total(),
            operator: self.pending.operator,
            visual: matches!(self.mode, State::Visual { .. }),
            want: self.want,
        };
        let target = motion::run(motion, &env)?;
        // Under an operator the caret does not go where the motion goes: its column stays.
        if target.want.is_some() && self.pending.operator.is_none() {
            self.want = target.want;
            self.vertical = true;
        }
        Some(target)
    }

    /// A motion's end: the operator's text when one waits, else the caret's new place.
    pub(crate) fn moved(&mut self, target: Option<Target>, out: &mut Out<'_>) {
        let Some(target) = target else { return };
        let Some(operator) = self.pending.operator else {
            self.cursor = target.pos;
            return;
        };
        self.operate(operator, operator::span(out.doc, self.cursor, target), out);
    }

    /// An operator's key: it acts on the selection, on lines when doubled, or waits for a motion.
    fn operator_key(&mut self, operator: Operator, out: &mut Out<'_>) -> bool {
        if matches!(self.mode, State::Visual { .. }) {
            self.visual_operate(operator, out);
            return false;
        }
        match self.pending.operator {
            None => {
                self.pending.operator = Some(operator);
                self.pending.operator_count = self.pending.count.take();
                true
            }
            Some(waiting) if waiting == operator => {
                self.lines(operator, out);
                false
            }
            Some(_) => false,
        }
    }

    /// A doubled operator: `count` lines from the caret's. Like `j`, a count stops at the last
    /// line, and does nothing from it.
    pub(crate) fn lines(&mut self, operator: Operator, out: &mut Out<'_>) {
        let (first, more) = (self.cursor.line, self.pending.times() - 1);
        if more > 0 && first == out.doc.last() {
            return;
        }
        let last = (first + more).min(out.doc.last());
        self.operate(operator, Span::lines(first, last, self.cursor), out);
    }

    /// An operator with the motion of its one-key form: `x` is `dl`, `D` is `d$`.
    fn short(&mut self, operator: Operator, motion: Motion, out: &mut Out<'_>) {
        self.pending.operator = Some(operator);
        let target = self.motion_of(motion, out.doc);
        self.moved(target, out);
    }

    fn object(&mut self, name: char, around: bool, out: &mut Out<'_>) {
        let Some(operator) = self.pending.operator else {
            return self.visual_object(name, around, out.doc);
        };
        if let Some(span) = object::find(out.doc, self.cursor, name, around, self.pending.times()) {
            self.operate(operator, span, out);
        }
    }

    fn normal_command(&mut self, typed: char, out: &mut Out<'_>) {
        match typed {
            'x' => self.short(Operator::Delete, Motion::Right, out),
            'X' => self.short(Operator::Delete, Motion::Left, out),
            's' => self.short(Operator::Change, Motion::Right, out),
            'D' => self.short(Operator::Delete, Motion::LineEnd, out),
            'C' => self.short(Operator::Change, Motion::LineEnd, out),
            'Y' => self.short(Operator::Yank, Motion::LineEnd, out),
            'S' => self.lines(Operator::Change, out),
            'J' => {
                self.note_change(None);
                self.join(self.cursor.line, self.pending.times().max(2), out);
            }
            '~' => self.switch_case(out),
            'p' | 'P' => self.put(typed == 'P', out),
            '.' => self.repeat(out),
            'u' => out
                .effects
                .extend(std::iter::repeat_n(Edit::Undo, self.pending.times())),
            'i' | 'a' | 'I' | 'A' | 'o' | 'O' => self.insert_command(typed, out),
            'v' | 'V' => {
                self.mode = State::Visual {
                    anchor: self.cursor,
                    linewise: typed == 'V',
                }
            }
            _ => {}
        }
    }
}
