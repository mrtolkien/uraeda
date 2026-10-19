# Inbox

## Catalog import

- [agent] [openlibrary-author-matching] Production's ~ is still a case-sensitive LIKE in the
  vendored infogami, with _ literal, so import author matching stays case-sensitive until infogami
  does ILIKE; the surname lookup's leading * has no index to serve it

## Deferred fixes

- [agent] [openlibrary-author-matching] _walk_redirects in load_book.py takes a seen set that no
  caller reads any more
- [agent] [openlibrary-author-matching] _query_authors' docstring says "ignoring case", true only in
  the mock while production's ~ is LIKE
- [agent] [openlibrary-author-matching] An integer birth_date or death_date raises TypeError in
  find_author, as it raised before in author_dates_match
- [agent] [openlibrary-author-matching] No test pins an organization with a comma or dates, a
  surname inside a longer name ("Fitzbrewer"), or step 3 against an author with a birth year only
