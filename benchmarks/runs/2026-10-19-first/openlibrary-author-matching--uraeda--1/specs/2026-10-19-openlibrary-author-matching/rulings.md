# Rulings: Match authors on alternate_names/surname with birth/death date

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: A flipped name is searched for an import with a comma only

- **Decision**: The name step searches "John Smith" for an import "Smith, John", as the edge case
  table says, and does not search "Smith, John" for an import "John Smith".
- **Rationale**: The spec's US1 scenario ("record 'Smith, John', import 'John Smith'") and its edge
  case ("a name has a comma") disagree. The edge case matches the existing code, which flips only
  names with `, `. `flip_name` cannot turn "John Smith" into "Smith, John".
- **Alternatives considered**: Also searching "Last, First" for a comma-less name: it guesses which
  word is the surname, and adds a rule the spec does not state.
- **If wrong**: add the reverse form to the patterns in `find_author`.
- **Where**: task 2, `find_author`.

## R2: Date-only imports keep their date check

- **Decision**: The name step applies `author_dates_match` when the import has both `birth_date` and
  `death_date`, or a `date`.
- **Rationale**: Keeps the existing handling of MARC `date`, which the spec does not mention.
- **Alternatives considered**: Ignoring `date`: a regression for imports that only carry it.
- **If wrong**: drop the `or 'date' in author` term.
- **Where**: task 2, `find_author`.

## R3: A wildcard surname matches by years alone

- **Decision**: An import name ending in `*` (such as "J. *") runs the surname step with the pattern
  `**`, which matches any record with equal birth and death years.
- **Rationale**: `*` is a wildcard everywhere in an import name (spec US4), and the year gate still
  applies.
- **Alternatives considered**: Skipping the step for a surname with `*`: a new rule.
- **If wrong**: skip the surname step when the surname contains `*`.
- **Where**: task 2, `find_author`.
