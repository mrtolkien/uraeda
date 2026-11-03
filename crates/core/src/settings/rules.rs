//! What a host name, a port, and a cap on automatic continues are, the only home of these rules.

/// A port's problem, whatever was typed.
pub const PORT_PROBLEM: &str = "The port is a number from 1 to 65535.";

/// The problem of a cap on automatic continues, whatever was typed.
pub const CONTINUES_PROBLEM: &str = "Automatic continues in a row is a whole number from 1 to 10.";

/// The most automatic continues in a row.
const MOST_CONTINUES: i64 = 10;

/// The longest host name.
const LONGEST: usize = 253;

/// `typed`, trimmed and in lower case, when it is a host name: 1 to 253 characters, labels of ASCII
/// letters, digits, and hyphens joined by dots, none empty, none starting or ending with a hyphen.
/// Otherwise, the problem, with the trimmed text in it.
pub fn host_name(typed: &str) -> Result<String, String> {
    let name = typed.trim();
    let label = |label: &str| {
        !label.is_empty()
            && !label.starts_with('-')
            && !label.ends_with('-')
            && label.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
    };
    if name.is_empty() || name.len() > LONGEST || !name.split('.').all(label) {
        return Err(format!(
            "{name} is not a host name: use letters, digits, hyphens, and dots, like mac.tail1234.ts.net."
        ));
    }
    Ok(name.to_ascii_lowercase())
}

/// `typed`, trimmed, when it is a whole number from 1 to 65535, written in digits only.
pub fn port(typed: &str) -> Result<u16, String> {
    let digits = typed.trim();
    if digits.is_empty() || !digits.chars().all(|c| c.is_ascii_digit()) {
        return Err(PORT_PROBLEM.into());
    }
    match digits.parse::<u16>() {
        Ok(port) if port > 0 => Ok(port),
        _ => Err(PORT_PROBLEM.into()),
    }
}

/// `number`, from the file, when it is a port.
pub fn port_number(number: i64) -> Result<u16, String> {
    u16::try_from(number)
        .ok()
        .filter(|port| *port > 0)
        .ok_or_else(|| PORT_PROBLEM.into())
}

/// `typed`, trimmed, when it is a whole number from 1 to 10, written in digits only.
pub fn automatic_continues(typed: &str) -> Result<i64, String> {
    let digits = typed.trim();
    if digits.is_empty() || !digits.chars().all(|c| c.is_ascii_digit()) {
        return Err(CONTINUES_PROBLEM.into());
    }
    digits
        .parse::<i64>()
        .map_err(|_| CONTINUES_PROBLEM.to_owned())
        .and_then(automatic_continues_number)
}

/// `number`, from the file, when it is from 1 to 10.
pub fn automatic_continues_number(number: i64) -> Result<i64, String> {
    if (1..=MOST_CONTINUES).contains(&number) {
        Ok(number)
    } else {
        Err(CONTINUES_PROBLEM.into())
    }
}
