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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn counts_the_questions_section_only() {
        let text = "# Record\n\n## Design\n\n### Round 9\n\n#### Q9: Not here\n\n\
                    ## Questions\n\n### Round 01\n\n#### Q1: One?\n\n#### Q2: Two?\n\n\
                    ```md\n#### Q3: In code\n```\n\n### Round 02\n\n#### Q1: Again?\n\n\
                    ## Follow-ups\n\n#### Q4: After\n";
        assert_eq!(
            counts(text),
            RecordCounts {
                questions: 3,
                rounds: 2
            }
        );
        assert_eq!(counts("# Record\n"), RecordCounts::default());
    }
}
