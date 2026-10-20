# Changelog

## Unreleased

- Misses and rate limits now come back as typed errors with stable codes instead of generic messages or empty results. An unknown DOI or id returns a not found error that suggests a title search or checking the DOI format, HTTP 429 returns a rate limit error that says to wait about a minute and retry, a malformed reference returns an invalid ref error, and empty search results say which filter may be hiding matches.

## 0.1.0

- First release. Paper search, paper details, related papers and cited-by tools backed by OpenAlex, with tests.
