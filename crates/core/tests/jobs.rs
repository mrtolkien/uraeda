//! Jobs, the `[[jobs]]` tables of the settings file: each read apart with its own problem, and
//! written one at a time, the rest of the file kept byte for byte.

use std::fs;
use std::path::Path;

use tempfile::TempDir;
use uraeda_core::jobs::{self, Job, JobInput, Jobs, Schedule};
use uraeda_core::settings;

fn tempdir() -> TempDir {
    TempDir::new().expect("a temporary folder")
}

fn write(dir: &Path, text: &str) {
    fs::write(dir.join("config.toml"), text).unwrap();
}

fn text(dir: &Path) -> String {
    fs::read_to_string(dir.join("config.toml")).unwrap()
}

/// The `n`th job named `name`, as the file lists them.
fn by_name<'a>(jobs: &'a Jobs, name: &str, n: usize) -> &'a Job {
    jobs.jobs
        .iter()
        .filter(|job| job.name == name)
        .nth(n)
        .unwrap_or_else(|| panic!("no job {name} number {n}"))
}

/// The problem of the only job `name`.
fn problem<'a>(jobs: &'a Jobs, name: &str) -> &'a str {
    by_name(jobs, name, 0)
        .problem
        .as_deref()
        .unwrap_or_default()
}

/// One `[[jobs]]` table.
fn table(name: &str, repositories: &str, schedule: &str, prompt: &str) -> String {
    format!(
        "[[jobs]]\nname = \"{name}\"\nrepositories = [{repositories}]\nschedule = \"{schedule}\"\nprompt = {prompt}\n"
    )
}

fn input(name: &str, schedule: &str, prompt: &str) -> JobInput {
    JobInput {
        name: name.to_owned(),
        repositories: vec!["uraeda".to_owned()],
        schedule: schedule.to_owned(),
        prompt: prompt.to_owned(),
        report_only: false,
        agent: None,
        model: None,
        effort: None,
    }
}

fn refusal(result: Result<(), uraeda_core::api::ApiError>) -> String {
    let error = result.expect_err("a refusal");
    assert_eq!(error.code, "refused");
    error.message
}

#[test]
fn a_job_with_a_problem_is_listed_and_the_others_read() {
    let dir = tempdir();
    let text = [
        "# mine\n[server]\nport = 4310\n\n".to_owned(),
        table(
            "Dependencies",
            "\"uraeda\", \"notes\"",
            "daily 03:00",
            "\"\"\"\nUpgrade.\nRun the tests.\nFix what breaks.\n\"\"\"",
        ),
        table("Code quality", "\"uraeda\"", "dayly 06:00", "\"Review.\""),
        table("Dependencies", "\"uraeda\"", "hourly", "\"Again.\""),
        table("Nowhere", "", "hourly", "\"Review.\""),
        table("Late", "\"uraeda\"", "daily 25:00", "\"Review.\""),
    ]
    .join("\n");
    write(dir.path(), &text);

    let jobs = jobs::read(dir.path());

    assert_eq!(jobs.problem, None);
    assert_eq!(jobs.jobs.len(), 5);
    let first = by_name(&jobs, "Dependencies", 0);
    assert_eq!(first.problem, None);
    assert_eq!(first.repositories, ["uraeda", "notes"]);
    assert_eq!(first.schedule_text, "daily 03:00");
    assert_eq!(first.prompt, "Upgrade.\nRun the tests.\nFix what breaks.\n");
    assert!(first.on && !first.report_only);
    assert_eq!(
        first.schedule,
        Some(Schedule {
            kind: "daily".into(),
            day: None,
            hour: 3,
            minute: 0
        })
    );
    assert_eq!(
        problem(&jobs, "Code quality"),
        "the schedule “dayly 06:00” is not understood"
    );
    assert_eq!(by_name(&jobs, "Code quality", 0).schedule, None);
    assert_eq!(
        by_name(&jobs, "Dependencies", 1).problem.as_deref(),
        Some("Two jobs are named “Dependencies”.")
    );
    assert_eq!(
        problem(&jobs, "Nowhere"),
        "A job runs in one repository at least."
    );
    assert_eq!(problem(&jobs, "Late"), "A time is from 00:00 to 23:59.");
    // Jobs never make the settings unreadable.
    settings::read(dir.path()).unwrap();
}

#[test]
fn a_job_reads_its_options_and_a_missing_key_is_its_problem() {
    let dir = tempdir();
    write(
        dir.path(),
        concat!(
            "[[jobs]]\nname = \"Full\"\nrepositories = [\"a\"]\nschedule = \"hourly\"\nprompt = \"x\"\n",
            "on = false\nreport_only = true\nagent = \"claude\"\nmodel = \"opus\"\neffort = \"high\"\n\n",
            "[[jobs]]\nrepositories = [\"a\"]\nschedule = \"hourly\"\nprompt = \"x\"\n\n",
            "[[jobs]]\nname = \"Quiet\"\nrepositories = [\"a\"]\nschedule = \"hourly\"\nprompt = \"  \\n\"\n\n",
            "[[jobs]]\nname = \"Typed\"\nrepositories = [\"a\"]\nschedule = \"hourly\"\nprompt = \"x\"\non = \"yes\"\n",
        ),
    );

    let jobs = jobs::read(dir.path());

    let full = by_name(&jobs, "Full", 0);
    assert_eq!(full.problem, None);
    assert!(!full.on && full.report_only);
    assert_eq!(
        (
            full.agent.as_deref(),
            full.model.as_deref(),
            full.effort.as_deref()
        ),
        (Some("claude"), Some("opus"), Some("high"))
    );
    assert_eq!(
        by_name(&jobs, "", 0).problem.as_deref(),
        Some("A job has no name.")
    );
    assert_eq!(problem(&jobs, "Quiet"), "A job has no prompt.");
    assert!(problem(&jobs, "Typed").contains("on"));
}

#[test]
fn the_four_schedule_forms_read_to_their_schedules() {
    let day = |kind: &str, day: Option<u32>, hour, minute| {
        Ok(Schedule {
            kind: kind.into(),
            day,
            hour,
            minute,
        })
    };
    let mut rows = vec![
        ("hourly", day("hourly", None, 0, 0)),
        ("daily 03:00", day("daily", None, 3, 0)),
        ("weekdays 03:00", day("weekdays", None, 3, 0)),
        ("daily 23:59", day("daily", None, 23, 59)),
        ("daily 00:00", day("daily", None, 0, 0)),
        (
            "daily 24:00",
            Err("A time is from 00:00 to 23:59.".to_owned()),
        ),
        (
            "daily 03:60",
            Err("A time is from 00:00 to 23:59.".to_owned()),
        ),
        (
            "daily 3:00",
            Err("the schedule “daily 3:00” is not understood".to_owned()),
        ),
        (
            "Daily 03:00",
            Err("the schedule “Daily 03:00” is not understood".to_owned()),
        ),
        (
            "hourly 03:00",
            Err("the schedule “hourly 03:00” is not understood".to_owned()),
        ),
        (
            "funday 04:00",
            Err("the schedule “funday 04:00” is not understood".to_owned()),
        ),
        ("", Err("the schedule “” is not understood".to_owned())),
    ];
    let days = [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
    ];
    let texts: Vec<String> = days.iter().map(|day| format!("{day} 04:00")).collect();
    for (number, text) in texts.iter().enumerate() {
        rows.push((text, day("weekly", Some(number as u32 + 1), 4, 0)));
    }
    for (text, expected) in rows {
        assert_eq!(jobs::schedule(text), expected, "for {text:?}");
    }
}

#[test]
fn jobs_that_are_not_a_list_of_tables_are_the_jobs_own_problem() {
    let dir = tempdir();
    write(dir.path(), "jobs = 3\n\n[server]\nport = 4310\n");

    let jobs = jobs::read(dir.path());

    assert!(jobs.jobs.is_empty());
    assert_eq!(
        jobs.problem.as_deref(),
        Some("jobs is a list of [[jobs]] tables.")
    );
    assert_eq!(settings::read(dir.path()).unwrap().server.port, Some(4310));
    for broken in [
        "jobs = [1, 2]\n",
        "[jobs]\nname = \"x\"\n",
        "jobs = [{ name = \"x\" }, 4]\n",
    ] {
        write(dir.path(), broken);
        assert_eq!(
            jobs::read(dir.path()).problem.as_deref(),
            Some("jobs is a list of [[jobs]] tables."),
            "for {broken:?}"
        );
        settings::read(dir.path()).unwrap();
    }
    // Nothing is written over it.
    write(dir.path(), "jobs = 3\n");
    assert_eq!(
        refusal(jobs::add(dir.path(), &input("A", "hourly", "x"))),
        "jobs is a list of [[jobs]] tables."
    );
    assert_eq!(text(dir.path()), "jobs = 3\n");
}

#[test]
fn an_inline_list_of_tables_reads_as_jobs_and_is_written_in_place() {
    let dir = tempdir();
    write(
        dir.path(),
        "jobs = [{ name = \"Inline\", repositories = [\"a\"], schedule = \"hourly\", prompt = \"x\" }]\n",
    );

    let jobs = jobs::read(dir.path());
    assert_eq!(jobs.problem, None);
    assert_eq!(by_name(&jobs, "Inline", 0).problem, None);

    jobs::set_on(dir.path(), "Inline", false).unwrap();
    jobs::add(dir.path(), &input("Next", "daily 03:00", "a\nb\n")).unwrap();

    let jobs = jobs::read(dir.path());
    assert!(!by_name(&jobs, "Inline", 0).on);
    assert_eq!(by_name(&jobs, "Next", 0).prompt, "a\nb\n");
    assert_eq!(by_name(&jobs, "Next", 0).problem, None);
}

#[test]
fn an_unreadable_settings_file_gives_no_job_and_is_never_written() {
    let dir = tempdir();
    let broken = format!(
        "[server]\nport = \"x\"\n\n{}",
        table("A", "\"a\"", "hourly", "\"x\"")
    );
    write(dir.path(), &broken);

    let jobs = jobs::read(dir.path());

    assert!(jobs.jobs.is_empty());
    let message = jobs.problem.expect("the settings' own message");
    assert!(message.starts_with("Cannot read "), "{message}");
    assert!(message.contains("port"), "{message}");
    for result in [
        jobs::add(dir.path(), &input("B", "hourly", "x")),
        jobs::set_on(dir.path(), "A", false),
        jobs::remove(dir.path(), "A"),
        jobs::update(dir.path(), "A", &input("A", "daily 03:00", "x")),
    ] {
        assert_eq!(result.unwrap_err().code, "unreadable");
    }
    assert_eq!(text(dir.path()), broken);
}

const TWO: &str = r#"# my settings

# the first job
[[jobs]]
name = "Dependencies"
owner = "me"
repositories = ["uraeda"]
schedule = "daily 03:00" # at night
prompt = "Upgrade."

[server]
port = 4310

# the second job
[[jobs]]
name = "Quality"
repositories = ["uraeda", "notes"]
schedule = "hourly"
prompt = """
Review.
"""
"#;

#[test]
fn a_write_changes_its_job_alone() {
    let dir = tempdir();
    write(dir.path(), TWO);

    let mut changed = input("Dependencies", "monday 04:00", "Upgrade.");
    changed.report_only = false;
    jobs::update(dir.path(), "Dependencies", &changed).unwrap();
    let expected = TWO.replace("\"daily 03:00\"", "\"monday 04:00\"");
    assert_eq!(text(dir.path()), expected);

    jobs::set_on(dir.path(), "Dependencies", false).unwrap();
    let expected = expected.replace(
        "prompt = \"Upgrade.\"\n",
        "prompt = \"Upgrade.\"\non = false\n",
    );
    assert_eq!(text(dir.path()), expected);

    // Added last, and read back byte for byte.
    let prompt = "a \"\"\" b\\\nc\\";
    jobs::add(dir.path(), &input("Odd", "hourly", prompt)).unwrap();
    let after = text(dir.path());
    assert!(after.starts_with(&expected), "{after}");
    let jobs = jobs::read(dir.path());
    assert_eq!(jobs.jobs.last().unwrap().name, "Odd");
    assert_eq!(jobs.jobs.last().unwrap().prompt, prompt);
    assert_eq!(by_name(&jobs, "Quality", 0).prompt, "Review.\n");

    assert_eq!(
        refusal(jobs::add(dir.path(), &input("Dependencies", "hourly", "x"))),
        "A job named “Dependencies” exists already."
    );
    assert_eq!(text(dir.path()), after);

    // Its table and the comment above it go.
    jobs::remove(dir.path(), "Dependencies").unwrap();
    let after = text(dir.path());
    assert!(
        !after.contains("the first job") && !after.contains("owner"),
        "{after}"
    );
    assert!(after.contains("# my settings") && after.contains("# the second job"));
    assert!(after.contains("[server]\nport = 4310"));
    let names: Vec<_> = jobs::read(dir.path())
        .jobs
        .into_iter()
        .map(|job| job.name)
        .collect();
    assert_eq!(names, ["Quality", "Odd"]);
}

#[test]
fn an_update_keeps_what_it_does_not_change_and_drops_a_default() {
    let dir = tempdir();
    write(
        dir.path(),
        concat!(
            "[[jobs]]\nname = 'Dependencies' # mine\nrepositories = ['uraeda']\nschedule = \"hourly\"\n",
            "prompt = 'Upgrade.'\nreport_only = true\nagent = \"claude\"\nmodel = \"opus\"\n",
            "effort = \"high\" # careful\n",
        ),
    );

    // Same values, quoted as the human wrote them: nothing changes.
    let mut same = input("Dependencies", "hourly", "Upgrade.");
    same.report_only = true;
    same.agent = Some("claude".into());
    same.model = Some("opus".into());
    same.effort = Some("high".into());
    let before = text(dir.path());
    jobs::update(dir.path(), "Dependencies", &same).unwrap();
    assert_eq!(text(dir.path()), before);

    // Back to the defaults: the keys go, the other lines and comments stay.
    let mut plain = input("Dependencies", "hourly", "Upgrade.");
    plain.repositories = vec!["uraeda".into(), "notes".into()];
    jobs::update(dir.path(), "Dependencies", &plain).unwrap();
    assert_eq!(
        text(dir.path()),
        "[[jobs]]\nname = 'Dependencies' # mine\nrepositories = [\"uraeda\", \"notes\"]\nschedule = \"hourly\"\nprompt = 'Upgrade.'\n"
    );
}

#[test]
fn a_write_refuses_what_the_reader_would_flag() {
    let dir = tempdir();
    write(dir.path(), TWO);
    let mut none = input("X", "hourly", "x");
    none.repositories.clear();
    let rows = [
        (input("", "hourly", "x"), "A job has no name."),
        (none, "A job runs in one repository at least."),
        (
            input("X", "dayly 06:00", "x"),
            "the schedule “dayly 06:00” is not understood",
        ),
        (
            input("X", "daily 25:00", "x"),
            "A time is from 00:00 to 23:59.",
        ),
        (input("X", "hourly", " \n"), "A job has no prompt."),
    ];
    for (job, message) in rows {
        assert_eq!(refusal(jobs::add(dir.path(), &job)), message);
        assert_eq!(refusal(jobs::update(dir.path(), "Quality", &job)), message);
    }
    // A rename to a name another job has, or an edit of a job that is not there.
    assert_eq!(
        refusal(jobs::update(
            dir.path(),
            "Quality",
            &input("Dependencies", "hourly", "x")
        )),
        "A job named “Dependencies” exists already."
    );
    assert_eq!(
        refusal(jobs::update(
            dir.path(),
            "Nothing",
            &input("X", "hourly", "x")
        )),
        "There is no job named “Nothing”."
    );
    assert_eq!(
        refusal(jobs::set_on(dir.path(), "Nothing", true)),
        "There is no job named “Nothing”."
    );
    assert_eq!(
        refusal(jobs::remove(dir.path(), "Nothing")),
        "There is no job named “Nothing”."
    );
    assert_eq!(text(dir.path()), TWO);
    // A rename keeps the table.
    jobs::update(dir.path(), "Quality", &input("Code quality", "hourly", "x")).unwrap();
    assert_eq!(jobs::read(dir.path()).jobs[1].name, "Code quality");
}

#[test]
fn every_prompt_reads_back_byte_for_byte() {
    let prompts = [
        "one line",
        "a \"\"\" b\\\nc\\",
        "ends with a backslash\\",
        "a line ends in\\\nthe next line",
        "\\\n\\\n",
        "\nstarts with a newline",
        "two\nlines\n",
        "\n\nblank lines\n\n",
        "quotes \"\"\"\"\" and \"\"\"\n\"\"\"",
        "'''\ntriple single\n'''",
        "single ' and double \" quotes\nsecond",
        "tab\there\nand a form feed \u{c} too",
        "crlf\r\nline\r\n",
        "a lone\rcarriage return",
        "unicode é 日本 🙂\nsecond",
        "  indented\n    more",
        "`code` and $dollar and #hash\n# not a comment",
        "back\\slash \\n not a newline\nreal",
        "nul-free control \u{7f} \u{1b}[0m\nescape",
    ];
    for prompt in prompts {
        for (name, start) in [
            ("new file", None),
            ("a file", Some("# mine\n[server]\nport = 4310\n")),
        ] {
            let dir = tempdir();
            if let Some(start) = start {
                write(dir.path(), start);
            }
            jobs::add(dir.path(), &input("P", "hourly", prompt)).unwrap();
            jobs::add(dir.path(), &input("Q", "hourly", "after")).unwrap();
            let jobs = jobs::read(dir.path());
            assert_eq!(jobs.problem, None, "{prompt:?} in {name}");
            assert_eq!(
                by_name(&jobs, "P", 0).prompt,
                prompt,
                "{prompt:?} in {name}"
            );
            assert_eq!(by_name(&jobs, "Q", 0).prompt, "after");
            // An update to a prompt that is the same changes nothing; to another one, only it.
            let before = text(dir.path());
            jobs::update(dir.path(), "P", &input("P", "hourly", prompt)).unwrap();
            assert_eq!(text(dir.path()), before, "{prompt:?}");
            jobs::update(dir.path(), "P", &input("P", "hourly", "changed\n")).unwrap();
            jobs::update(dir.path(), "P", &input("P", "hourly", prompt)).unwrap();
            assert_eq!(by_name(&jobs::read(dir.path()), "P", 0).prompt, prompt);
            if start.is_some() {
                assert_eq!(settings::read(dir.path()).unwrap().server.port, Some(4310));
            }
        }
    }
}

#[test]
fn a_file_with_windows_line_ends_keeps_them() {
    let dir = tempdir();
    write(dir.path(), "[server]\r\nport = 4310\r\n");

    let prompt = "a\nb\\\nc\r\nd\n";
    jobs::add(dir.path(), &input("P", "hourly", prompt)).unwrap();

    let raw = fs::read_to_string(dir.path().join("config.toml")).unwrap();
    assert!(!raw.replace("\r\n", "").contains('\n'), "{raw:?}");
    assert_eq!(by_name(&jobs::read(dir.path()), "P", 0).prompt, prompt);
}

#[test]
fn the_switch_is_a_run_setting() {
    let dir = tempdir();
    assert_eq!(
        settings::read(dir.path()).unwrap().runs.scheduled_jobs,
        None
    );

    let settings = settings::set_continue(dir.path(), settings::ContinueKey::Jobs, false).unwrap();

    assert_eq!(settings.runs.scheduled_jobs, Some(false));
    assert!(text(dir.path()).contains("scheduled_jobs = false"));
    write(dir.path(), "[runs]\nscheduled_jobs = 3\n");
    assert!(settings::read(dir.path()).is_err());
}

#[test]
fn a_first_job_goes_below_the_files_comments() {
    for (before, header) in [
        (
            None,
            "# Uraeda's settings. The settings page writes this file too, and keeps your comments.",
        ),
        (
            Some("# mine\n\n# more of mine\n"),
            "# mine\n\n# more of mine",
        ),
        (Some("foo = 1\n# after it\n"), "foo = 1\n# after it"),
    ] {
        let dir = tempdir();
        if let Some(before) = before {
            write(dir.path(), before);
        }

        jobs::add(dir.path(), &input("A", "hourly", "x")).unwrap();

        let after = text(dir.path());
        assert!(
            after.starts_with(&format!("{header}\n\n[[jobs]]\nname = \"A\"\n")),
            "{after}"
        );
        assert_eq!(
            after.matches("# ").count(),
            header.matches("# ").count(),
            "{after}"
        );
    }

    // Removed, the header it was above stays above the next table.
    let dir = tempdir();
    jobs::add(dir.path(), &input("A", "hourly", "x")).unwrap();
    jobs::add(dir.path(), &input("B", "hourly", "x")).unwrap();
    jobs::remove(dir.path(), "A").unwrap();
    let after = text(dir.path());
    assert!(after.starts_with("# Uraeda's settings."), "{after}");
    assert!(after.contains("[[jobs]]\nname = \"B\""), "{after}");
}
