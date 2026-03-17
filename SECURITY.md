# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it responsibly.

**Do not open a public GitHub issue for security vulnerabilities.**

Instead, please email [alex-gon@users.noreply.github.com](mailto:alex-gon@users.noreply.github.com) with:

- A description of the vulnerability
- Steps to reproduce it
- The potential impact
- Any suggested fix (optional but appreciated)

You should receive a response within 72 hours. If the issue is confirmed, a fix will be prioritized and released as a patch version.

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | Yes       |

## Security Model

This MCP server acts as a bridge between an AI assistant and The Game Crafter API. Understanding its trust boundaries is important:

### Credentials

- TGC credentials (API key, username, password) are loaded from environment variables only — never from tool inputs, files, or network.
- Credentials are held in memory for the lifetime of the process. They are never logged, included in error messages, or returned in tool responses.
- Session IDs are managed internally and never exposed to the LLM.

### Input Validation

- All tool inputs are validated against Zod schemas before processing.
- ID fields are checked for path traversal sequences (`/`, `\`, `..`).
- File uploads are validated for extension, size (50 MB max), image dimensions (50–10,000 px), path traversal, and symlink escaping.
- URL uploads enforce HTTPS-only and block private IPs, loopback addresses, and cloud metadata endpoints (SSRF protection).

### Rate Limiting

- A token bucket rate limiter enforces 3 requests/second to TGC (below their 4/sec limit).
- Per-session budgets cap usage at 500 reads and 200 writes.
- The rate limiter pause duration is capped at 300 seconds to prevent denial-of-service via malicious `Retry-After` headers.

### What This Server Does Not Do

- It does not implement authentication for MCP clients — it trusts the MCP transport layer. For multi-user deployments, use an MCP proxy with OAuth 2.1.
- It does not encrypt data at rest — session state is in-memory only and lost on restart.
- It does not validate TGC API response shapes at runtime — it trusts the upstream API contract.
