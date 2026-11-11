//! The pick's rule, row by row, as the multi-accounts record states it, and the merge of an
//! ask with a running process's reports.

use std::time::{Duration, SystemTime};

use super::*;

/// 2026-11-10 at 09:00 UTC.
fn now() -> SystemTime {
    SystemTime::UNIX_EPOCH + Duration::from_secs(1_794_301_200)
}

/// A window, used by `used` and resetting at `resets` (none: not open).
fn window(id: &str, used: f64, resets: Option<&str>) -> AccountWindow {
    AccountWindow {
        id: id.to_owned(),
        label: id.to_owned(),
        resets_at: resets.map(str::to_owned),
        used,
    }
}

/// A known, signed-in account with its five hours and its week.
fn account(id: &str, five: f64, resets: Option<&str>, week: f64) -> Account {
    Account {
        id: id.to_owned(),
        name: id.to_owned(),
        state: AccountState::Ready,
        windows: vec![
            window("five_hour", five, resets),
            window("seven_day", week, Some("2026-11-14T00:00:00Z")),
        ],
        asked_at: Some(now()),
        known: true,
    }
}

fn unknown(id: &str) -> Account {
    Account {
        known: false,
        windows: Vec::new(),
        asked_at: None,
        ..account(id, 0.0, None, 0.0)
    }
}

fn in_state(id: &str, state: AccountState) -> Account {
    Account {
        state,
        ..account(id, 0.0, None, 0.0)
    }
}

#[test]
fn the_pick_follows_the_records_rule() {
    let soon = Some("2026-11-10T10:00:00Z");
    let late = Some("2026-11-10T12:00:00Z");
    let rows: Vec<(&str, Vec<Account>, Option<&str>)> = vec![
        (
            "the most of its five hours left",
            vec![account("a", 0.6, soon, 0.1), account("b", 0.2, late, 0.1)],
            Some("b"),
        ),
        (
            "a tie: the one whose five hours reset first",
            vec![account("a", 0.3, late, 0.1), account("b", 0.3, soon, 0.1)],
            Some("b"),
        ),
        (
            "a tie: a window not open after one that resets",
            vec![account("a", 0.0, None, 0.1), account("b", 0.0, late, 0.1)],
            Some("b"),
        ),
        (
            "a whole tie: the first listed",
            vec![account("a", 0.0, None, 0.1), account("b", 0.0, None, 0.1)],
            Some("a"),
        ),
        (
            "an unknown usage ranks after every known one",
            vec![unknown("a"), account("b", 0.9, soon, 0.1)],
            Some("b"),
        ),
        (
            "a used-up week is passed over",
            vec![account("a", 0.0, None, 1.0), account("b", 0.9, soon, 0.5)],
            Some("b"),
        ),
        (
            "every week used up: the first signed in",
            vec![
                in_state("a", AccountState::SignedOut),
                account("b", 0.0, None, 1.0),
                account("c", 0.0, None, 1.0),
            ],
            Some("b"),
        ),
        (
            "signed out and missing are never picked",
            vec![
                in_state("a", AccountState::SignedOut),
                in_state("b", AccountState::Missing),
                account("c", 0.99, soon, 0.1),
            ],
            Some("c"),
        ),
        (
            "none signed in: none",
            vec![
                in_state("a", AccountState::SignedOut),
                in_state("b", AccountState::Missing),
            ],
            None,
        ),
    ];
    for (row, accounts, expected) in rows {
        let picked = pick(&accounts).map(|account| account.id.as_str());
        assert_eq!(picked, expected, "{row}");
    }
}

#[test]
fn a_move_needs_room_in_every_window_and_a_known_usage() {
    let rows: Vec<(&str, Vec<Account>, Option<&str>)> = vec![
        (
            "the most room among those with room",
            vec![account("a", 0.5, None, 0.1), account("b", 0.1, None, 0.1)],
            Some("b"),
        ),
        (
            "a used-up week has no room",
            vec![account("a", 0.0, None, 1.0)],
            None,
        ),
        ("an unknown usage is no room", vec![unknown("a")], None),
        (
            "used-up five hours have no room",
            vec![account("a", 1.0, None, 0.1)],
            None,
        ),
    ];
    for (row, accounts, expected) in rows {
        let picked = pick_with_room(&accounts).map(|account| account.id.as_str());
        assert_eq!(picked, expected, "{row}");
    }
}

#[test]
fn a_fresher_report_wins_window_by_window_and_a_passed_reset_reads_unused() {
    let asked = account("a", 0.2, Some("2026-11-10T10:00:00Z"), 0.3);
    let report = |at: u64, id: &str, used: f64, resets: &str| Report {
        account: "a".to_owned(),
        at: now() + Duration::from_secs(at),
        window: UsageWindow {
            id: id.to_owned(),
            label: id.to_owned(),
            resets_at: resets.to_owned(),
            used,
        },
    };
    let reports = [
        report(10, "five_hour", 0.5, "2026-11-10T10:00:00Z"),
        report(20, "five_hour", 0.7, "2026-11-10T10:00:00Z"),
        // A report of a window the ask did not give is set aside.
        report(30, "opus_week", 0.9, "2026-11-12T00:00:00Z"),
    ];
    let merged = merged(vec![asked.clone()], &reports, now());
    let used: Vec<f64> = merged[0].windows.iter().map(|window| window.used).collect();
    assert_eq!(used, [0.7, 0.3]);

    // An hour and a half later, the five hours have reset.
    let later = now() + Duration::from_secs(90 * 60);
    let merged = merged_at(asked, later);
    assert_eq!(
        (
            merged.windows[0].used,
            merged.windows[0].resets_at.as_deref()
        ),
        (0.0, None)
    );
}

fn merged_at(account: Account, at: SystemTime) -> Account {
    merged(vec![account], &[], at).remove(0)
}

#[test]
fn a_report_makes_an_unknown_account_known_only_by_its_first_window() {
    let mut asked = account("a", 0.2, None, 0.3);
    asked.known = false;
    let report = |id: &str| Report {
        account: "a".to_owned(),
        at: now() + Duration::from_secs(5),
        window: UsageWindow {
            id: id.to_owned(),
            label: id.to_owned(),
            resets_at: "2026-11-14T00:00:00Z".to_owned(),
            used: 0.4,
        },
    };
    let week = merged(vec![asked.clone()], &[report("seven_day")], now());
    assert!(!week[0].known, "a report of the week alone");
    let five = merged(vec![asked], &[report("five_hour")], now());
    assert!(five[0].known);
}
