# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/):

| Change | Bump | Example |
|--------|------|---------|
| Bug fixes, description improvements | Patch | 0.1.0 → 0.1.1 |
| New tools added | Minor | 0.1.0 → 0.2.0 |
| Tools renamed or removed | Major | 0.1.0 → 1.0.0 |

## [0.2.0] - 2026-04-01

### Added
- Remote authentication: `authenticate` tool now accepts optional `api_key_id`,
  `username`, and `password` parameters for remote usage (e.g., via Apify)
- Remote Streamable HTTP endpoint via Apify Actor at
  `https://chillbot3000--tgc-mcp-server.apify.actor/mcp`
- Listed on Glama Connectors for one-click remote access

### Changed
- Environment variables `TGC_API_KEY_ID`, `TGC_USERNAME`, `TGC_PASSWORD` are
  now optional — credentials can be provided via tool parameters instead
- Server starts without credentials (validation moved to authenticate-time)
- Updated MCP Registry metadata with remote endpoint and v0.2.0

## [0.1.1] - 2026-03-17

### Added
- Published to Official MCP Registry (registry.modelcontextprotocol.io)
- SECURITY.md with vulnerability reporting and security model
- Graceful shutdown on SIGINT/SIGTERM
- GitHub Actions CI with Node 18 + 20 matrix

### Fixed
- Rate limiter pause capped at 300s (prevents DoS via malicious Retry-After)
- Validate create_api path in components handler (defense-in-depth)
- Trim whitespace from name fields before validation
- Package metadata: added author, engines, bugs, homepage fields

## [0.1.0] - 2026-03-16

### Added
- 14 tools: authenticate, logout, get_game_catalog, get_my_designers,
  get_my_games, get_game_details, create_game, update_game, delete_game,
  add_component_to_game, upload_file, get_component_sizes,
  get_component_details, get_pricing_estimate
- 3 resources: tgc://catalog, tgc://game/{id}/summary, tgc://component-sizes
- 2 prompts: new_game_setup, estimate_game_cost
- Input validation with Zod schemas on all tool inputs
- File upload security: path traversal prevention, HTTPS-only URLs,
  SSRF protection, image dimension validation (50-10000px)
- Rate limiting: 3 req/sec token bucket, per-session request budgets
  (500 reads, 200 writes)
- Retry with exponential backoff for transient TGC API errors
