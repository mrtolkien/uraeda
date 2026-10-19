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
