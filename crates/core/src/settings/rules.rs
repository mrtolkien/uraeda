//! What a host name and a port are, the only home of these rules.

/// A port's problem, whatever was typed.
pub const PORT_PROBLEM: &str = "The port is a number from 1 to 65535.";

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
