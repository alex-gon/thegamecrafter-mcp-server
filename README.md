# The Game Crafter MCP Server

An MCP server that connects Claude to [The Game Crafter](https://www.thegamecrafter.com/) API, letting you design, manage, and price tabletop games through natural conversation.

Browse the component catalog, create game projects, add card decks and boards, upload artwork, and get instant pricing estimates — all without leaving Claude.

## Who it's for

Indie board game designers, tabletop creators, and TGC users who want to manage their projects through Claude instead of navigating the TGC web interface manually.

## Prerequisites

- **Node.js** 18 or later
- A **TGC account** — [sign up here](https://www.thegamecrafter.com/)
- A **TGC API key** — [generate one here](https://www.thegamecrafter.com/account/apikeys)

## Installation

1. Clone and build the server:

```bash
git clone <repo-url> tgc-mcp-server
cd tgc-mcp-server
npm install
npm run build
```

2. Add the server to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "thegamecrafter": {
      "command": "node",
      "args": ["/absolute/path/to/tgc-mcp-server/dist/index.js"],
      "env": {
        "TGC_API_KEY_ID": "your-api-key-id",
        "TGC_USERNAME": "your-tgc-username",
        "TGC_PASSWORD": "your-tgc-password"
      }
    }
  }
}
```

3. Restart Claude Desktop. The server will appear in your MCP connections.

## Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `TGC_API_KEY_ID` | Yes | Your TGC API key ID |
| `TGC_USERNAME` | Yes | Your TGC account username |
| `TGC_PASSWORD` | Yes | Your TGC account password |
| `TGC_API_BASE` | No | API base URL (defaults to `https://www.thegamecrafter.com/api`) |
| `TGC_UPLOAD_BASE_DIR` | No | Restrict file uploads to this directory (defaults to working directory) |

See `.env.example` for a template.

## Available tools

### Tools

| Tool | Description | Auth |
|------|-------------|------|
| `authenticate` | Create a TGC session using stored credentials | No |
| `logout` | Destroy the current TGC session | Yes |
| `get_game_catalog` | Browse printable component types (cards, boards, boxes) | No |
| `get_component_sizes` | Get pixel dimensions and finished inches for component types | No |
| `get_component_details` | Get detailed info for a component type or game part | No |
| `get_my_designers` | List designer profiles for the authenticated user | Yes |
| `get_my_games` | List all games for a designer (paginated) | Yes |
| `get_game_details` | Get full game info with components, files, and pricing | Yes |
| `create_game` | Create a new game project under a designer | Yes |
| `update_game` | Update a game's name, description, or visibility | Yes |
| `delete_game` | Permanently delete a game project | Yes |
| `add_component_to_game` | Add a printable component or stock part to a game | Yes |
| `upload_file` | Upload an image to a TGC folder (from disk or URL) | Yes |
| `get_pricing_estimate` | Get per-component cost breakdown for a game | Yes |

### Resources

| URI | Description |
|-----|-------------|
| `tgc://catalog` | Full catalog of printable component types (cached 30 min) |
| `tgc://game/{id}/summary` | Complete summary of a game project |
| `tgc://component-sizes` | Pixel dimensions for all component types (cached 30 min) |

### Prompts

| Prompt | Description |
|--------|-------------|
| `new_game_setup` | Guided workflow for creating a complete game project with components |
| `estimate_game_cost` | Step-by-step cost estimation for an existing game |

## Example prompts

Try saying these to Claude:

- "Show me all my games on The Game Crafter with their component lists"
- "Create a new card game called Stellar Drift with a standard poker deck and tuck box"
- "What pixel dimensions do I need for a poker card face image?"
- "Upload this image and assign it as the front face of my card deck"
- "Estimate the cost of my game based on its current components"
- "Help me set up a new game project from scratch — walk me through it"
- "What component types are available for board games?"
- "Delete my test game project"

## Limitations

- **Rate limits** — The server enforces 3 requests/second to TGC (below their 4/sec limit) with per-session budgets of 500 reads and 200 writes.
- **Authentication** — Uses environment variable credentials only. OAuth 2.1 support is planned for a future release with HTTP transport.
- **File uploads** — Maximum 50 MB per file. Images must be between 50x50 and 10,000x10,000 pixels. Supported formats: PNG, JPG, GIF, BMP, TIFF, SVG, WebP, PDF.
- **Transport** — Stdio only. HTTP/SSE transport planned for v2.
- **Read-only catalog** — The component catalog and pricing come from TGC and cannot be modified.

## Contributing

Bug reports and pull requests are welcome. Please open an issue first to discuss what you'd like to change.

To run the development server:

```bash
cp .env.example .env    # fill in your credentials
npm run dev             # starts with tsx + hot reload
npm test                # run the test suite
```

## License

[MIT](LICENSE)
