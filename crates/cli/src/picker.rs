//! The picker: one question, drawn inline under the command's output, answered with the arrow
//! keys, Space, and Enter. Its key handling, `handle`, is separate from its drawing, `render`, so
//! both are tested without a terminal; `run` puts them on the terminal.

use std::io;

use ratatui::crossterm::event::{self, Event, KeyCode, KeyEventKind, KeyModifiers};
use ratatui::crossterm::terminal::disable_raw_mode;
use ratatui::style::{Color, Modifier, Style};
use ratatui::text::{Line, Text};
use ratatui::{DefaultTerminal, Frame, TerminalOptions, Viewport};

use crate::output;

/// A row: its label, then its detail, right after it in a select picker, in a column in a multi
/// one.
pub struct Item {
    pub label: String,
    pub detail: String,
}

/// A picker of one item, or of any number of checked items.
pub struct Picker {
    title: String,
    items: Vec<Item>,
    cursor: usize,
    /// `None` in a select picker, each item's box in a multi one.
    checked: Option<Vec<bool>>,
    /// Set by Enter with nothing checked, cleared by Space.
    warning: bool,
    colours: bool,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Answer {
    /// The chosen item of a select picker.
    One(usize),
    /// Each item's box of a multi picker, one at least checked.
    Many(Vec<bool>),
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Step {
    Continue,
    Done(Answer),
    Cancel,
}

impl Picker {
    /// A picker of one item, the cursor on `cursor`.
    pub fn select(title: &str, items: Vec<Item>, cursor: usize) -> Self {
        Self::new(title, items, cursor, None)
    }

    /// A picker of any number of items, one at least, each checked as `checked` says.
    pub fn multi(title: &str, items: Vec<Item>, checked: Vec<bool>) -> Self {
        Self::new(title, items, 0, Some(checked))
    }

    fn new(title: &str, items: Vec<Item>, cursor: usize, checked: Option<Vec<bool>>) -> Self {
        Self {
            title: title.to_string(),
            items,
            cursor,
            checked,
            warning: false,
            colours: output::colours(),
        }
    }

    /// The lines the picker draws: its title, its items, and its help line.
    pub fn height(&self) -> u16 {
        u16::try_from(self.items.len() + 2).unwrap_or(u16::MAX)
    }

    /// Moves, checks, confirms, or cancels on a key press; every other event changes nothing.
    pub fn handle(&mut self, event: &Event) -> Step {
        let Event::Key(key) = event else {
            return Step::Continue;
        };
        if key.kind != KeyEventKind::Press {
            return Step::Continue;
        }
        match key.code {
            KeyCode::Char('c') if key.modifiers.contains(KeyModifiers::CONTROL) => Step::Cancel,
            KeyCode::Esc | KeyCode::Char('q') => Step::Cancel,
            KeyCode::Up | KeyCode::Char('k') => {
                self.cursor = self.cursor.saturating_sub(1);
                Step::Continue
            }
            KeyCode::Down | KeyCode::Char('j') => {
                self.cursor = (self.cursor + 1).min(self.items.len().saturating_sub(1));
                Step::Continue
            }
            KeyCode::Char(' ') => {
                if let Some(checked) = &mut self.checked {
                    checked[self.cursor] = !checked[self.cursor];
                    self.warning = false;
                }
                Step::Continue
            }
            KeyCode::Enter => match &self.checked {
                None => Step::Done(Answer::One(self.cursor)),
                Some(checked) if checked.contains(&true) => {
                    Step::Done(Answer::Many(checked.clone()))
                }
                Some(_) => {
                    self.warning = true;
                    Step::Continue
                }
            },
            _ => Step::Continue,
        }
    }

    /// Draws the title, the items with `>` at the cursor and `[x]` on checked ones, and the help.
    pub fn render(&self, frame: &mut Frame) {
        let width = self.items.iter().map(|item| item.label.chars().count());
        let width = width.max().unwrap_or(0) + 3;
        let mut lines = vec![Line::raw(self.title.as_str())];
        for (index, item) in self.items.iter().enumerate() {
            let pointer = if index == self.cursor { ">" } else { " " };
            let text = match &self.checked {
                None => format!("{pointer} {}{}", item.label, item.detail),
                Some(checked) => {
                    let check = if checked[index] { "x" } else { " " };
                    format!("{pointer} [{check}] {:width$}{}", item.label, item.detail)
                }
            };
            let style = if index == self.cursor && self.colours {
                Style::new().fg(Color::Cyan).add_modifier(Modifier::BOLD)
            } else {
                Style::new()
            };
            lines.push(Line::styled(text, style));
        }
        let help = match (&self.checked, self.warning) {
            (None, _) => "↑/↓ move · enter confirm · esc cancel",
            (Some(_), false) => "↑/↓ move · space check · enter confirm · esc cancel",
            (Some(_), true) => "check at least one folder · ↑/↓ move · space check · esc cancel",
        };
        let style = if self.colours {
            Style::new().add_modifier(Modifier::DIM)
        } else {
            Style::new()
        };
        lines.push(Line::styled(help, style));
        frame.render_widget(Text::from(lines), frame.area());
    }
}

/// Leaves raw mode when dropped, on every return of `run`; ratatui's panic hook covers panics.
struct Raw;

impl Drop for Raw {
    fn drop(&mut self) {
        // Not `ratatui::restore`: it also leaves the alternate screen, which an inline viewport
        // never entered, and some terminals then move the cursor to a saved position.
        let _ = disable_raw_mode();
    }
}

/// Asks in the terminal, inline, under the command's output, until Enter or a cancel, then clears
/// the picker's lines and leaves the cursor at their start, for the caller's answer line. `None`
/// on a cancel.
pub fn run(mut picker: Picker) -> io::Result<Option<Answer>> {
    let _raw = Raw;
    let mut terminal = ratatui::try_init_with_options(TerminalOptions {
        viewport: Viewport::Inline(picker.height()),
    })?;
    let answer = ask(&mut terminal, &mut picker);
    let closed = close(&mut terminal);
    let answer = answer?;
    closed?;
    Ok(answer)
}

fn ask(terminal: &mut DefaultTerminal, picker: &mut Picker) -> io::Result<Option<Answer>> {
    loop {
        terminal.draw(|frame| picker.render(frame))?;
        match picker.handle(&event::read()?) {
            Step::Continue => {}
            Step::Done(answer) => return Ok(Some(answer)),
            Step::Cancel => return Ok(None),
        }
    }
}

/// Clears the viewport, and puts the cursor back at its first line, shown.
fn close(terminal: &mut DefaultTerminal) -> io::Result<()> {
    let origin = terminal.get_frame().area().as_position();
    terminal.clear()?;
    terminal.set_cursor_position(origin)?;
    terminal.show_cursor()
}

#[cfg(test)]
mod tests {
    use ratatui::Terminal;
    use ratatui::backend::TestBackend;
    use ratatui::crossterm::event::{Event, KeyCode, KeyEvent, KeyEventKind, KeyModifiers};
    use ratatui::style::Color;

    use super::*;

    fn key(code: KeyCode) -> Event {
        Event::Key(KeyEvent::new(code, KeyModifiers::NONE))
    }

    fn two() -> Picker {
        Picker::select(
            "Pick:",
            vec![
                Item {
                    label: "One".to_string(),
                    detail: String::new(),
                },
                Item {
                    label: "Two".to_string(),
                    detail: String::new(),
                },
            ],
            0,
        )
    }

    fn both() -> Picker {
        crate::install::folders_picker()
    }

    /// Hands every event to the picker, and returns the last step.
    fn press(picker: &mut Picker, events: &[Event]) -> Step {
        let mut step = Step::Continue;
        for event in events {
            step = picker.handle(event);
        }
        step
    }

    #[test]
    fn keys() {
        use KeyCode::{Down, Enter, Esc, Tab, Up};
        let char = |c| key(KeyCode::Char(c));
        let ctrl_c = Event::Key(KeyEvent::new(KeyCode::Char('c'), KeyModifiers::CONTROL));
        let release = Event::Key(KeyEvent::new_with_kind(
            Down,
            KeyModifiers::NONE,
            KeyEventKind::Release,
        ));
        // (picker, events) → the last step.
        type Row = (fn() -> Picker, Vec<Event>, Step);
        let rows: Vec<Row> = vec![
            (two, vec![key(Enter)], Step::Done(Answer::One(0))),
            (two, vec![key(Down), key(Enter)], Step::Done(Answer::One(1))),
            (
                two,
                vec![key(Down), key(Down), key(Enter)],
                Step::Done(Answer::One(1)),
            ),
            (two, vec![key(Up), key(Enter)], Step::Done(Answer::One(0))),
            (two, vec![char('j'), key(Enter)], Step::Done(Answer::One(1))),
            (
                two,
                vec![char('j'), char('k'), key(Enter)],
                Step::Done(Answer::One(0)),
            ),
            (two, vec![key(Esc)], Step::Cancel),
            (two, vec![char('q')], Step::Cancel),
            (two, vec![ctrl_c.clone()], Step::Cancel),
            (both, vec![ctrl_c], Step::Cancel),
            // Keys the help line does not name change nothing.
            (
                two,
                vec![
                    char('a'),
                    char('1'),
                    key(Tab),
                    Event::Resize(80, 24),
                    key(Enter),
                ],
                Step::Done(Answer::One(0)),
            ),
            (two, vec![char(' '), key(Enter)], Step::Done(Answer::One(0))),
            (two, vec![release, key(Enter)], Step::Done(Answer::One(0))),
            (
                both,
                vec![key(Enter)],
                Step::Done(Answer::Many(vec![true, true])),
            ),
            (
                both,
                vec![key(Down), char(' '), key(Enter)],
                Step::Done(Answer::Many(vec![true, false])),
            ),
            (
                both,
                vec![char(' '), key(Down), char(' '), key(Enter)],
                Step::Continue,
            ),
        ];
        for (picker, events, expected) in rows {
            let mut picker = picker();
            assert_eq!(press(&mut picker, &events), expected, "{events:?}");
        }
    }

    #[test]
    fn nothing_checked_warns_until_space() {
        let mut picker = both();
        let space = key(KeyCode::Char(' '));
        press(
            &mut picker,
            &[space.clone(), key(KeyCode::Down), space.clone()],
        );
        assert!(!picker.warning);
        press(&mut picker, &[key(KeyCode::Enter)]);
        assert!(picker.warning);
        press(&mut picker, &[space]);
        assert!(!picker.warning);
    }

    /// The picker's lines, drawn 100 columns wide, trimmed at the end.
    fn drawn(picker: &Picker) -> Vec<String> {
        let mut terminal = Terminal::new(TestBackend::new(100, picker.height())).unwrap();
        terminal.draw(|frame| picker.render(frame)).unwrap();
        let buffer = terminal.backend().buffer();
        (0..buffer.area.height)
            .map(|y| {
                let row: String = (0..buffer.area.width)
                    .map(|x| buffer[(x, y)].symbol())
                    .collect();
                row.trim_end().to_string()
            })
            .collect()
    }

    #[test]
    fn draws_the_scope_picker() {
        assert_eq!(
            drawn(&crate::install::scope_picker("uraeda")),
            [
                "Install the Uraeda skill for:",
                "> Your user, in ~/: every repository on this machine",
                "  This repository, in uraeda/",
                "↑/↓ move · enter confirm · esc cancel",
            ]
        );
    }

    #[test]
    fn draws_the_folder_picker() {
        assert_eq!(
            drawn(&both()),
            [
                "Into the folders your agents read:",
                "> [x] .agents/skills   Codex, Gemini CLI, Copilot, Cursor, OpenCode, Amp",
                "  [x] .claude/skills   Claude Code",
                "↑/↓ move · space check · enter confirm · esc cancel",
            ]
        );
    }

    #[test]
    fn draws_nothing_checked() {
        let mut picker = both();
        let space = key(KeyCode::Char(' '));
        press(
            &mut picker,
            &[
                space.clone(),
                key(KeyCode::Down),
                space,
                key(KeyCode::Enter),
            ],
        );
        assert_eq!(
            drawn(&picker),
            [
                "Into the folders your agents read:",
                "  [ ] .agents/skills   Codex, Gemini CLI, Copilot, Cursor, OpenCode, Amp",
                "> [ ] .claude/skills   Claude Code",
                "check at least one folder · ↑/↓ move · space check · esc cancel",
            ]
        );
    }

    #[test]
    fn draws_the_init_question() {
        assert_eq!(
            drawn(&crate::init::question()),
            [
                "Install the Uraeda skill for your user?",
                "> Yes, in ~/: every repository on this machine",
                "  No",
                "↑/↓ move · enter confirm · esc cancel",
            ]
        );
    }

    #[test]
    fn the_cursor_reads_without_colour() {
        for colours in [true, false] {
            let mut picker = both();
            picker.colours = colours;
            let mut terminal = Terminal::new(TestBackend::new(100, picker.height())).unwrap();
            terminal.draw(|frame| picker.render(frame)).unwrap();
            let buffer = terminal.backend().buffer();
            let row: String = (0..100).map(|x| buffer[(x, 1)].symbol()).collect();
            assert!(row.starts_with("> [x] "), "{row}");
            let fg = if colours { Color::Cyan } else { Color::Reset };
            // The row's text, `> [x] .claude/skills   Claude Code`.
            assert!(
                (0..34).all(|x| buffer[(x, 1)].fg == fg),
                "colours {colours}"
            );
        }
    }
}
