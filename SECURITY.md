# Security

Do not publish OAuth device codes, callback URLs, credential files, access tokens, or refresh tokens in issues or screenshots. Redact account identifiers and authorization data before sharing diagnostics.

The plugin stores OAuth credentials through DSH's local credentials service. The settings Remote returns only login state, verification URL, device code, and token expiry. It does not expose credential values to the browser UI.

For a security report, open a private GitHub security advisory for this repository when available. Public issues should contain no credentials or unredacted logs.
