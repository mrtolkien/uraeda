//! A record's counts: the questions and the rounds of its `## Questions` section.

/// The questions of a record and the rounds they were asked in.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct RecordCounts {
    pub questions: u32,
    pub rounds: u32,
}

/// The `#### Q` and `### Round` headings under `## Questions`, outside code blocks.
pub fn counts(text: &str) -> RecordCounts {
    let mut counts = RecordCounts::default();
    let mut in_questions = false;
    for (_, line) in super::lines_outside_code(text) {
        if line.starts_with("## ") {
            in_questions = line.trim_end() == "## Questions";
        } else if in_questions && line.starts_with("### Round") {
            counts.rounds += 1;
        } else if in_questions && line.starts_with("#### Q") {
            counts.questions += 1;
        }
    }
    counts
}
