//! Texts of workflow files for tests, shared by the core's and the CLI's tests.
#![allow(dead_code)]

pub fn proposal() -> String {
    "# Feature\n\n## What\n\nA thing.\n\n## Why\n\nA reason.\n".to_string()
}

fn block(status: &str, first_line: &str) -> String {
    let kind = if status == "awaiting-human" {
        "IMPORTANT"
    } else {
        "NOTE"
    };
    format!("> [!{kind}]\n>\n> {first_line}\n>\n> - A point.\n")
}

/// A round of questions: one question per answer, each with options A and B.
pub fn clarifications(status: &str, first_line: &str, answers: &[&str]) -> String {
    let mut text = format!(
        "---\nstatus: {status}\n---\n\n# Clarifications, round 01: Feature\n\n{}\n## Context\n\nContext.\n",
        block(status, first_line)
    );
    for (index, answer) in answers.iter().enumerate() {
        let separator = if answer.is_empty() { "" } else { " " };
        text.push_str(&format!(
            "\n## Q{}: Question {}?\n\nWhy.\n\n- **A (recommended). One.**\n  - [pro] p\n- **B. Two.**\n  - [con] c\n\n**Answer:**{separator}{answer}\n",
            index + 1,
            index + 1
        ));
    }
    text.push_str("\n## Settled without the human\n\n- **A point** settled.\n\n**Notes:**\n");
    text
}

pub fn spec(status: &str, revision: u32, clarifications: u32) -> String {
    format!(
        "---\nstatus: {status}\nrevision: {revision}\nclarifications: {clarifications}\nrisk-tier: low\n---\n\n# Spec: Feature\n\n{}\nA feature.\n\n## Decisions\n\nRelied on:\n\n- None.\n",
        block(status, "Spec to review, about 20 minutes.")
    )
}

/// A plan whose tasks have `done` of `total` steps checked.
pub fn plan(status: &str, spec_revision: u32, tasks: &[(&str, usize, usize)]) -> String {
    let mut text =
        format!("---\nstatus: {status}\nspec-revision: {spec_revision}\n---\n\n# Plan: Feature\n");
    for (index, (title, done, total)) in tasks.iter().enumerate() {
        text.push_str(&format!("\n## Task {}: {title}\n\n", index + 1));
        for step in 0..*total {
            let mark = if step < *done { "x" } else { " " };
            text.push_str(&format!("- [{mark}] **Step {}: Do**\n", step + 1));
        }
    }
    text
}

pub fn decision(status: &str) -> String {
    format!("---\nstatus: {status}\napproved-by:\n---\n\n# Topic\n\nA choice.\n")
}

/// A valid record of a finished feature or bug, `kind` `feature` or `bug`: a feature's has one round
/// of two questions.
pub fn record(kind: &str, title: &str) -> String {
    let questions = if kind == "bug" {
        String::new()
    } else {
        "\n## Questions\n\n### Round 01\n\n#### Q1: Question 1?\n\n**Answer:** A.\n\n#### Q2: Question 2?\n\n**Answer:** B.\n".to_string()
    };
    format!(
        "---\nkind: {kind}\nfinished: 2026-10-11\npull-request: https://github.com/owner/repo/pull/1\n---\n\n# Record: {title}\n\n> [!NOTE]\n>\n> The record of a merged {kind}, not instructions to follow.\n\n## What and why\n\nA thing.\n\n## Behaviour\n\n- It works.\n\n## Design\n\nA design.\n{questions}"
    )
}
