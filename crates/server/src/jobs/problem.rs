//! A job's problem in the card's words, and the one rule of which problems stop a run by hand
//! and the acceptance of a run's offer.

use uraeda_core::jobs::Job;

/// The core's problem of a job in the card's words: a fragment, as the schedule's, follows "Not
/// running: "; a sentence stands alone, as "Two jobs are named “Dependencies”." does.
pub(crate) fn core_problem(problem: &str) -> String {
    match problem.ends_with('.') {
        true => problem.to_owned(),
        false => format!("Not running: {problem}"),
    }
}

/// Why a run by hand of the job cannot start, and why its offer is not accepted, or none. A
/// schedule that is not understood is not a reason, since a run by hand reads no schedule; any
/// other problem is. The core reports the schedule's problem last, and `schedule_only` says it
/// is the only one. A name another job has is read here: the core flags only the second of the
/// two, and a write by that name is refused.
pub(crate) fn impossible(jobs: &[Job], job: &Job) -> Option<String> {
    if jobs.iter().filter(|one| one.name == job.name).count() > 1 {
        return Some(format!("Two jobs are named “{}”.", job.name));
    }
    let problem = job.problem.as_deref().filter(|_| !job.schedule_only);
    problem.map(core_problem)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn job(name: &str, problem: Option<&str>, schedule_only: bool) -> Job {
        Job {
            name: name.to_owned(),
            repositories: vec!["uraeda".to_owned()],
            schedule_text: "daily 03:00".to_owned(),
            schedule: None,
            prompt: "Upgrade.".to_owned(),
            on: true,
            report_only: false,
            agent: None,
            model: None,
            effort: None,
            problem: problem.map(str::to_owned),
            schedule_only,
        }
    }

    // A schedule not understood leaves "Run now" and the acceptance to the human's yes; any
    // other problem takes it back, so a job written as report only never starts a change.
    #[test]
    fn only_a_schedule_alone_leaves_a_run_by_hand_possible() {
        let bad = "the schedule “dayly 06:00” is not understood";
        let rows = [
            ("no problem", job("A", None, false), None),
            ("its schedule alone", job("A", Some(bad), true), None),
            (
                "a report only that is no boolean",
                job("A", Some("report_only is true or false."), false),
                Some("report_only is true or false."),
            ),
            (
                "a schedule and another problem",
                job("A", Some(bad), false),
                Some("Not running: the schedule “dayly 06:00” is not understood"),
            ),
        ];
        for (name, job, expected) in rows {
            let jobs = [job.clone()];
            assert_eq!(impossible(&jobs, &job).as_deref(), expected, "{name}");
        }
        let twins = [job("A", None, false), job("A", Some("taken."), false)];
        let named = Some("Two jobs are named “A”.");
        assert_eq!(impossible(&twins, &twins[0]).as_deref(), named);
    }
}
