//! A turn's transcript, read by pages: the lines its log's events make, as the module's
//! documentation says a log reads, [`PAGE`] lines at a time.
//!
//! A line is named by the place of the event that started it, which never changes, and a page
//! holds the lines numbered from `page * PAGE`: a page is found through the log's index of
//! lines, and read with its own events, then with the few later ones that changed a line of
//! it, as the end of a tool call. So a read costs a page, whatever the turn's length.

use std::collections::HashMap;
use std::time::SystemTime;

use rusqlite::{Connection, OptionalExtension};
use uraeda_protocol::{Item, MessageOrigin, TURN_PAGE, ToolStatus};

use super::event::{Activity, Event, Origin, ToolKind};
use super::log;
use super::store::{Store, StoreError, millis};

/// The lines in each page of a transcript.
pub const PAGE: u64 = TURN_PAGE as u64;

/// A tool's output, and a thought's text, are cut to this many characters.
pub const OUTPUT_LIMIT: usize = 4000;

/// A blocked action of a turn, as its log has it.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Blocked {
    /// Its place in its turn's log.
    pub seq: u64,
    pub tool: String,
    pub target: Option<String>,
    /// The rule that allows it alone: none when no rule does.
    pub rule: Option<String>,
    /// Whether the human allowed it since.
    pub allowed: bool,
}

impl Store {
    /// How many pages a turn's transcript has.
    pub fn pages(&self, turn: i64) -> Result<u32, StoreError> {
        let lines = self.read(|db| Ok(log::lines(db, turn)?))?;
        Ok(u32::try_from(lines.div_ceil(PAGE)).unwrap_or(u32::MAX))
    }

    /// The page of the line that the event at `seq` started: none for an event that started
    /// none.
    pub fn page_of(&self, turn: i64, seq: u64) -> Result<Option<u32>, StoreError> {
        self.read(|db| {
            let line: Option<Option<u64>> = db
                .prepare_cached("SELECT item FROM events WHERE turn_id = ?1 AND seq = ?2")?
                .query_row((turn, seq), |row| row.get(0))
                .optional()?;
            let page = line.flatten().map(|line| line / PAGE);
            Ok(page.map(|page| u32::try_from(page).unwrap_or(u32::MAX)))
        })
    }

    /// A page of a turn's transcript, its lines in order, without the messages taken back.
    /// `agent` is the agent's name for people, which the line of skipped output names.
    pub fn page(&self, turn: i64, page: u32, agent: &str) -> Result<Vec<Item>, StoreError> {
        self.read(|db| read_page(db, turn, u64::from(page), agent))
    }

    /// The blocked actions of a turn, in order, each allowed or not.
    pub fn blocked(&self, turn: i64) -> Result<Vec<Blocked>, StoreError> {
        self.read(|db| {
            let mut read = db.prepare_cached(
                "SELECT seq, data FROM events
                 WHERE turn_id = ?1 AND type IN ('denial', 'allowed') ORDER BY seq",
            )?;
            let mut rows = read.query([turn])?;
            let mut blocked: Vec<Blocked> = Vec::new();
            while let Some(row) = rows.next()? {
                let (seq, data): (u64, String) = (row.get(0)?, row.get(1)?);
                note_blocked(&mut blocked, seq, Event::parse(&data)?);
            }
            Ok(blocked)
        })
    }

    /// The last whole text of a turn: what a sub-session answers its parent with.
    pub fn last_text(&self, turn: i64) -> Result<Option<String>, StoreError> {
        self.read(|db| {
            let data: Option<String> = db
                .prepare_cached(
                    "SELECT data FROM events WHERE turn_id = ?1 AND type = 'text'
                     ORDER BY seq DESC LIMIT 1",
                )?
                .query_row([turn], |row| row.get(0))
                .optional()?;
            Ok(match data.map(|data| Event::parse(&data)).transpose()? {
                Some(Event::Text { text }) => Some(text),
                _ => None,
            })
        })
    }

    /// The files a session's agent edited with its tools, each with its count of edits that
    /// completed, in the order of their first: of every turn and sub-agent. A failed or a
    /// running edit does not count.
    pub fn edited_files(&self, session: &str) -> Result<Vec<(String, u32)>, StoreError> {
        self.read(|db| {
            let mut read = db.prepare_cached(
                "SELECT e.turn_id, e.type, e.data FROM events e
                 JOIN turns t ON t.id = e.turn_id
                 WHERE t.session_id = ?1 AND e.type IN ('toolStart', 'toolEnd')
                 ORDER BY e.turn_id, e.seq",
            )?;
            let mut rows = read.query([session])?;
            let mut edits = Edits::default();
            while let Some(row) = rows.next()? {
                let (turn, data): (i64, String) = (row.get(0)?, row.get(2)?);
                edits.note(turn, Event::parse(&data)?);
            }
            let files = edits.files;
            Ok(files)
        })
    }

    /// The chat images the messages of every session hold, by their ids.
    pub fn images_in_use(&self) -> Result<Vec<String>, StoreError> {
        self.read(|db| {
            let mut read = db.prepare_cached(
                "SELECT DISTINCT json_extract(image.value, '$.id')
                 FROM events, json_each(events.data, '$.images') AS image
                 WHERE events.type = 'message'",
            )?;
            let ids = read.query_map([], |row| row.get::<_, Option<String>>(0))?;
            let ids: Vec<Option<String>> = ids.collect::<rusqlite::Result<_>>()?;
            Ok(ids.into_iter().flatten().collect())
        })
    }
}

/// Takes a `denial` or an `allowed` of a turn's log: a blocked action, or one allowed since.
fn note_blocked(blocked: &mut Vec<Blocked>, seq: u64, event: Event) {
    match event {
        Event::Denial { tool, target, rule } => blocked.push(Blocked {
            seq,
            tool,
            target,
            rule,
            allowed: false,
        }),
        Event::Allowed { denial } => {
            let found = blocked.iter_mut().find(|one| one.seq == denial);
            found.into_iter().for_each(|found| found.allowed = true);
        }
        _ => {}
    }
}

/// The files a session's edit calls wrote, as its log is read.
#[derive(Default)]
struct Edits {
    /// Each edit call still running, by its turn and its id: the file it writes.
    running: HashMap<(i64, String), String>,
    /// The files edited, each with its count of edits that completed, in the order of their
    /// first.
    files: Vec<(String, u32)>,
}

impl Edits {
    /// Takes a tool call's start or its end.
    fn note(&mut self, turn: i64, event: Event) {
        match event {
            Event::ToolStart {
                id,
                kind: ToolKind::Edit,
                target: Some(path),
                ..
            } => drop(self.running.insert((turn, id), path)),
            Event::ToolEnd {
                id,
                is_error: false,
                ..
            } => {
                let Some(path) = self.running.remove(&(turn, id)) else {
                    return;
                };
                match self.files.iter_mut().find(|(file, _)| *file == path) {
                    Some((_, edits)) => *edits += 1,
                    None => self.files.push((path, 1)),
                }
            }
            Event::ToolEnd { id, .. } => drop(self.running.remove(&(turn, id))),
            _ => {}
        }
    }
}

/// The place in a turn's log of the event that started its line `line`: none past its last.
fn place(db: &Connection, turn: i64, line: u64) -> rusqlite::Result<Option<u64>> {
    db.prepare_cached("SELECT seq FROM events WHERE turn_id = ?1 AND item = ?2")?
        .query_row((turn, line), |row| row.get(0))
        .optional()
}

/// A row of the log, as a page reads it.
struct Row {
    seq: u64,
    at: i64,
    /// For a piece of a text, the place of its text's first piece.
    text_start: Option<u64>,
    /// Whether it started a line.
    starts: bool,
    event: Event,
}

/// Reads the rows a statement gives, each to `take`, until it says to stop.
fn each(
    db: &Connection,
    sql: &str,
    params: impl rusqlite::Params,
    mut take: impl FnMut(Row) -> bool,
) -> Result<(), StoreError> {
    let mut read = db.prepare_cached(sql)?;
    let mut rows = read.query(params)?;
    while let Some(row) = rows.next()? {
        let data: String = row.get(2)?;
        let read = Row {
            seq: row.get(0)?,
            at: row.get(1)?,
            text_start: row.get(3)?,
            starts: row.get::<_, Option<u64>>(4)?.is_some(),
            event: Event::parse(&data)?,
        };
        if !take(read) {
            break;
        }
    }
    Ok(())
}

/// The columns [`each`] reads.
const COLUMNS: &str = "seq, at, data, text_start, item";

fn read_page(db: &Connection, turn: i64, page: u64, agent: &str) -> Result<Vec<Item>, StoreError> {
    let Some(first) = place(db, turn, page * PAGE)? else {
        return Ok(Vec::new());
    };
    let end = place(db, turn, (page + 1) * PAGE)?;
    // From after the line before the page: what shows nothing there, as the start of a
    // thinking block, may belong to the page's first line.
    let from = match page {
        0 => 0,
        _ => place(db, turn, page * PAGE - 1)?.map_or(first, |before| before + 1),
    };
    let mut lines = Lines::new(first, agent);
    let until = end.map_or(i64::MAX, |end| i64::try_from(end).unwrap_or(i64::MAX));
    each(
        db,
        &format!(
            "SELECT {COLUMNS} FROM events WHERE turn_id = ?1 AND seq >= ?2 AND seq < ?3
             ORDER BY seq"
        ),
        (turn, from, until),
        |row| {
            lines.add(row);
            true
        },
    )?;
    if let Some(end) = end {
        later(db, turn, end, &mut lines)?;
    }
    Ok(lines.ended())
}

/// Reads what came after a page and changed a line of it: a message read or taken back, a
/// blocked action allowed, more skipped output, a tool call's end, and the rest of a text.
fn later(db: &Connection, turn: i64, end: u64, lines: &mut Lines) -> Result<(), StoreError> {
    if lines.follows_rare() {
        each(
            db,
            &format!(
                "SELECT {COLUMNS} FROM events WHERE turn_id = ?1 AND seq >= ?2
                   AND type IN ('accepted', 'cancelled', 'allowed', 'skipped') ORDER BY seq"
            ),
            (turn, end),
            |row| {
                lines.add(row);
                true
            },
        )?;
    }
    if lines.running() > 0 {
        each(
            db,
            &format!(
                "SELECT {COLUMNS} FROM events WHERE turn_id = ?1 AND seq >= ?2
                   AND type = 'toolEnd' ORDER BY seq"
            ),
            (turn, end),
            |row| {
                lines.add(row);
                lines.running() > 0
            },
        )?;
    }
    if lines.writing.is_some() {
        each(
            db,
            &format!(
                "SELECT {COLUMNS} FROM events WHERE turn_id = ?1 AND seq >= ?2
                   AND text_bytes IS NOT NULL ORDER BY seq"
            ),
            (turn, end),
            |row| {
                lines.add(row);
                lines.writing.is_some()
            },
        )?;
    }
    Ok(())
}

/// Where an event is: its place in the log, its time, the text a piece grows, and whether it
/// is in the page, and starts a line of it.
struct Place {
    seq: u64,
    at: i64,
    text_start: Option<u64>,
    starts: bool,
    inside: bool,
}

impl Place {
    /// The id of the line an event at this place starts.
    fn id(&self) -> String {
        self.seq.to_string()
    }
}

/// A page's lines, as its events make them.
struct Lines<'a> {
    /// The place of the page's first line: what came before only says since when the agent
    /// thinks.
    first: u64,
    agent: &'a str,
    items: Vec<Item>,
    /// Where each line of the page is, by the place of the event that started it.
    at: HashMap<u64, usize>,
    /// The page's messages, by their own ids, and whether each was taken back.
    messages: HashMap<String, (usize, bool)>,
    /// The page's tool calls still running, by their ids: each one's line, and its start.
    tools: HashMap<String, (usize, i64)>,
    /// The page's text being written: its line.
    writing: Option<usize>,
    /// Whether a text is being written, in the page or before it.
    pieces: bool,
    /// The page's line of skipped output, and how many it counts.
    skipped: Option<(usize, u32)>,
    /// Since when the main agent thinks.
    thinking: Option<i64>,
    pending: usize,
    blocked: usize,
}

impl<'a> Lines<'a> {
    fn new(first: u64, agent: &'a str) -> Lines<'a> {
        Lines {
            first,
            agent,
            items: Vec::new(),
            at: HashMap::new(),
            messages: HashMap::new(),
            tools: HashMap::new(),
            writing: None,
            pieces: false,
            skipped: None,
            thinking: None,
            pending: 0,
            blocked: 0,
        }
    }

    /// Whether an event after the page may change a message, a blocked action, or the skipped
    /// output's line of it.
    fn follows_rare(&self) -> bool {
        self.pending > 0 || self.blocked > 0 || self.skipped.is_some()
    }

    /// How many tool calls of the page still run.
    fn running(&self) -> usize {
        self.tools.len()
    }

    fn push(&mut self, seq: u64, item: Item) -> usize {
        self.at.insert(seq, self.items.len());
        self.items.push(item);
        self.items.len() - 1
    }

    /// Takes an event: one before the page only moves what the agent does, one of the page
    /// may start a line, and any may change a line of the page.
    fn add(&mut self, row: Row) {
        let at = Place {
            seq: row.seq,
            at: row.at,
            text_start: row.text_start,
            starts: row.starts && row.seq >= self.first,
            inside: row.seq >= self.first,
        };
        match row.event {
            Event::Activity { activity } => {
                self.thinking = matches!(activity, Activity::Thinking).then_some(at.at);
            }
            Event::Message {
                id,
                origin,
                text,
                opening,
                images,
            } if at.inside => {
                let item = Item::Message {
                    id: at.id(),
                    message: id.clone(),
                    at: millis_of(at.at),
                    origin: match origin {
                        Origin::Human => MessageOrigin::Human,
                        Origin::Workflow => MessageOrigin::Workflow,
                    },
                    read: false,
                    text,
                    opening,
                    images,
                };
                let line = self.push(at.seq, item);
                self.messages.insert(id, (line, false));
                self.pending += 1;
            }
            Event::Accepted { id } => self.settle(&id, false),
            Event::Cancelled { id } => self.settle(&id, true),
            Event::TextDelta { text } => self.piece(&at, text),
            Event::Text { text } => self.whole(&at, text),
            Event::ToolEnd {
                id,
                is_error,
                output,
            } => self.tool_end(&at, &id, is_error, &output),
            Event::Skipped => self.skipped(&at),
            Event::Allowed { denial } => self.allowed(denial),
            started => self.start(&at, started),
        }
    }

    /// Marks a message of the page read, or taken back.
    fn settle(&mut self, message: &str, taken: bool) {
        let Some((line, was_taken)) = self.messages.get_mut(message) else {
            return;
        };
        let Item::Message { read, .. } = &mut self.items[*line] else {
            return;
        };
        if !*read && !*was_taken {
            self.pending -= 1;
        }
        match taken {
            true => *was_taken = true,
            false => *read = true,
        }
    }

    /// A piece of a text: the first starts its line, and the next ones grow it.
    fn piece(&mut self, at: &Place, text: String) {
        self.thinking = None;
        self.pieces = true;
        if at.starts {
            let item = Item::Text {
                id: at.id(),
                streaming: true,
                text,
            };
            self.writing = Some(self.push(at.seq, item));
            return;
        }
        let line = at.text_start.and_then(|start| self.at.get(&start));
        if let Some(Item::Text { text: whole, .. }) = line.map(|line| &mut self.items[*line]) {
            whole.push_str(&text);
        }
    }

    /// A whole text: it ends the pieces before it, which it repeats, or is a line of its own.
    fn whole(&mut self, at: &Place, text: String) {
        self.thinking = None;
        let was_writing = std::mem::take(&mut self.pieces);
        match (self.writing.take(), at.starts) {
            (Some(line), _) => {
                self.items[line] = Item::Text {
                    id: item_id(&self.items[line]),
                    streaming: false,
                    text,
                };
            }
            (None, true) if !was_writing => {
                let item = Item::Text {
                    id: at.id(),
                    streaming: false,
                    text,
                };
                self.push(at.seq, item);
            }
            _ => {}
        }
    }

    /// A tool call's end: its line reads completed or failed, with its result and its time.
    fn tool_end(&mut self, at: &Place, call: &str, is_error: bool, output: &str) {
        let Some((line, started)) = self.tools.remove(call) else {
            return;
        };
        let Item::Tool {
            status,
            output: shown,
            duration_ms,
            ..
        } = &mut self.items[line]
        else {
            return;
        };
        *status = match is_error {
            true => ToolStatus::Failed,
            false => ToolStatus::Completed,
        };
        *shown = Some(cut(output));
        *duration_ms = Some(millis_of(at.at - started));
    }

    /// Output the agent printed that Uraeda does not read: the first of a turn is a line,
    /// which the next ones count on.
    fn skipped(&mut self, at: &Place) {
        match (&mut self.skipped, at.starts) {
            (Some((line, count)), _) => {
                *count += 1;
                let (line, text) = (*line, skipped_text(*count, self.agent));
                self.items[line] = Item::System {
                    id: item_id(&self.items[line]),
                    text,
                };
            }
            (None, true) => {
                let text = skipped_text(1, self.agent);
                let line = self.push(at.seq, Item::System { id: at.id(), text });
                self.skipped = Some((line, 1));
            }
            (None, false) => {}
        }
    }

    /// A blocked action of the page was allowed.
    fn allowed(&mut self, denial: u64) {
        let Some(line) = self.at.get(&denial) else {
            return;
        };
        if let Item::Denial { allowed, .. } = &mut self.items[*line]
            && !*allowed
        {
            *allowed = true;
            self.blocked -= 1;
        }
    }

    /// What starts a line by itself: a tool call, a thought, a line of Uraeda's or of the
    /// agent's, a blocked action.
    fn start(&mut self, at: &Place, event: Event) {
        let id = at.id();
        let item = match event {
            Event::ToolStart {
                id: call,
                kind,
                name,
                parent,
                subagent,
                target,
                ..
            } => {
                if parent.is_none() {
                    self.thinking = None;
                }
                if !at.inside {
                    return;
                }
                let item = Item::Tool {
                    id,
                    call: call.clone(),
                    name,
                    tool_kind: tool_kind(kind),
                    target,
                    parent,
                    subagent: subagent.map(|subagent| subagent.description),
                    status: ToolStatus::InProgress,
                    output: None,
                    duration_ms: None,
                };
                let line = self.push(at.seq, item);
                self.tools.insert(call, (line, at.at));
                return;
            }
            Event::Thought { parent, text } => {
                let started = match parent {
                    None => self.thinking.take(),
                    Some(_) => None,
                };
                Item::Thought {
                    id,
                    parent,
                    text: text.as_deref().map(cut),
                    duration_ms: started.map_or(0, |started| millis_of(at.at - started)),
                }
            }
            Event::Notice { text } => Item::System { id, text },
            Event::Retry {
                delay_ms, error, ..
            } => Item::System {
                id,
                text: retry_text(delay_ms, &error),
            },
            Event::Denial { tool, target, rule } => {
                self.blocked += usize::from(at.inside);
                Item::Denial {
                    id,
                    tool,
                    target,
                    rule,
                    allowed: false,
                }
            }
            _ => return,
        };
        if at.inside {
            self.push(at.seq, item);
        }
    }

    /// The page's lines, without the messages taken back.
    fn ended(self) -> Vec<Item> {
        let taken: Vec<usize> = self
            .messages
            .values()
            .filter(|(_, taken)| *taken)
            .map(|(line, _)| *line)
            .collect();
        let kept = self.items.into_iter().enumerate();
        kept.filter(|(line, _)| !taken.contains(line))
            .map(|(_, item)| item)
            .collect()
    }
}

/// A line's id.
fn item_id(item: &Item) -> String {
    match item {
        Item::Message { id, .. }
        | Item::Text { id, .. }
        | Item::Tool { id, .. }
        | Item::Thought { id, .. }
        | Item::System { id, .. }
        | Item::Denial { id, .. } => id.clone(),
    }
}

/// A span or a time of the store, never negative, as a client reads it.
fn millis_of(millis: i64) -> u64 {
    u64::try_from(millis).unwrap_or_default()
}

/// A time as a client reads it: the milliseconds since 1970.
pub fn sent(time: SystemTime) -> u64 {
    millis_of(millis(time))
}

/// A tool's output, or a thought's text, cut to its first [`OUTPUT_LIMIT`] characters.
fn cut(text: &str) -> String {
    text.chars().take(OUTPUT_LIMIT).collect()
}

pub(super) fn tool_kind(kind: ToolKind) -> uraeda_protocol::ToolKind {
    use uraeda_protocol::ToolKind as Sent;
    match kind {
        ToolKind::Read => Sent::Read,
        ToolKind::Edit => Sent::Edit,
        ToolKind::Delete => Sent::Delete,
        ToolKind::Move => Sent::Move,
        ToolKind::Search => Sent::Search,
        ToolKind::Execute => Sent::Execute,
        ToolKind::Think => Sent::Think,
        ToolKind::Fetch => Sent::Fetch,
        ToolKind::Other => Sent::Other,
    }
}

/// The line of an agent's API that failed, and is tried again.
fn retry_text(delay_ms: u64, error: &str) -> String {
    let seconds = (delay_ms + 500) / 1000;
    match error {
        "rate_limit" => format!("Rate limited, retrying in {seconds} s."),
        _ => format!("The API failed ({error}), retrying in {seconds} s."),
    }
}

/// The line of the output an agent printed that Uraeda does not read.
fn skipped_text(count: u32, agent: &str) -> String {
    let lines = match count {
        1 => "line",
        _ => "lines",
    };
    format!("Skipped {count} {lines} {agent} printed that Uraeda does not read.")
}
