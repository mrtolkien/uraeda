//! The repository a record or an action names.

// JOIN(wave 6): `records::repositories::find` (task 7), which keeps the list as last read.

use uraeda_core::repositories::{self, ListError, Repository};

use crate::live::Fault;
use crate::shared::Shared;

/// The listed repository of a name, whose `path` is its main checkout: what every record and
/// action of one repository starts from.
///
/// # Errors
///
/// `refused` for a name the list does not have, for a repository whose folder is gone, and for a
/// list that cannot be read.
pub(super) fn find(shared: &Shared, name: &str) -> Result<Repository, Fault> {
    let rows = repositories::read(shared.data_dir())?;
    let unknown = || ListError::Unknown(name.to_owned());
    let row = rows.into_iter().find(|row| row.name == name);
    let row = row.ok_or_else(unknown)?;
    if row.missing {
        let folder = row.path.display();
        return Err(Fault::refused(format!(
            "{name} is no longer at {folder}: move it back, or remove it from the list."
        )));
    }
    Ok(row)
}
