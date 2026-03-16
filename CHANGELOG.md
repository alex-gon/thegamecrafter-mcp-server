# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/):

| Change | Bump | Example |
|--------|------|---------|
| Bug fixes, description improvements | Patch | 0.1.0 → 0.1.1 |
| New tools added | Minor | 0.1.0 → 0.2.0 |
| Tools renamed or removed | Major | 0.1.0 → 1.0.0 |

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
