//! A finished feature or change, read from its record in `specs/done/`, its only file.

use std::collections::BTreeMap;

use super::{
    Feature, FileKind, Kind, Problem, Severity, Source, WorkflowFile, folder_branch, folder_slug,
    record_path,
};
use crate::files::frontmatter;
use crate::steps::{self, PullRequest, Step};

/// A record's kind, from its frontmatter: a feature unless it says `change`.
pub(super) fn record_kind(text: &str) -> Kind {
    match frontmatter::parse(text)
        .ok()
        .and_then(|f| f.text("kind").map(String::from))
    {
        Some(kind) if kind == "change" => Kind::Change,
        _ => Kind::Feature,
    }
}

impl Feature {
    /// A finished feature or change, from its record's text: its only file.
    pub fn from_record(kind: Kind, folder: &str, text: String) -> Feature {
        let name = format!("{folder}.md");
        let path = record_path(folder);
        let mut problems = Vec::new();
        match frontmatter::parse(&text) {
            Ok(front) => {
                if !matches!(front.text("kind"), Some("feature" | "change")) {
                    problems.push(Problem {
                        file: path.clone(),
                        line: front.line("kind"),
                        rule: "frontmatter.kind".into(),
                        message: "kind is not one of feature, change".into(),
                        severity: Severity::Error,
                    });
                }
            }
            Err(error) => problems.push(Problem {
                file: path.clone(),
                line: Some(1),
                rule: "frontmatter.parse".into(),
                message: error.to_string(),
                severity: Severity::Error,
            }),
        }
        let mut feature = Feature {
            kind,
            folder: folder.to_string(),
            slug: folder_slug(folder).unwrap_or(folder).to_string(),
            branch: Some(folder_branch(kind, folder)),
            source: Source::Local,
            worktree: None,
            uncommitted: false,
            behind: None,
            files: vec![WorkflowFile {
                name: name.clone(),
                kind: FileKind::Record,
                round: None,
                status: None,
                waiting_line: None,
            }],
            mockups: Vec::new(),
            step: Step::none(),
            pull_request: None,
            problems,
            left_worktree: None,
            left_branch: None,
            path: "specs/done".to_string(),
            proposal_committed: true,
            decisions_pending: false,
            task_branch_done: Default::default(),
            texts: BTreeMap::from([(name, text)]),
            at_tip: None,
        };
        feature.step = steps::step(&feature, PullRequest::Unknown);
        feature
    }
}
