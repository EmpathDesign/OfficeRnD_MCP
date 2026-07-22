# OfficeRnD MCP Server

A production-ready **Model Context Protocol (MCP) server** that exposes the complete [OfficeRnD](https://www.officernd.com/) REST API as AI-friendly tools. Enables AI clients (Claude Desktop, ChatGPT, Cursor, VS Code, and others) to interact with your coworking space management platform using natural language.

[![CI](https://github.com/EmpathDesign/OfficeRnD_MCP/actions/workflows/ci.yml/badge.svg)](https://github.com/EmpathDesign/OfficeRnD_MCP/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Installation](#installation)
- [Authentication](#authentication)
- [Configuration](#configuration)
- [MCP Tools](#mcp-tools)
- [Client Setup](#client-setup)
  - [VS Code (Copilot)](#vs-code-copilot)
  - [Claude Desktop](#claude-desktop)
  - [Cursor](#cursor)
  - [ChatGPT](#chatgpt)
- [VS Code Extension](#vs-code-extension)
- [Development](#development)
- [Troubleshooting](#troubleshooting)
- [Deferred Endpoints](#deferred-endpoints)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

This monorepo provides everything needed to connect any MCP-compatible AI client to OfficeRnD:

| Package                                   | Description                                                          |
| ----------------------------------------- | -------------------------------------------------------------------- |
| [`@officernd/sdk`](packages/sdk)          | Reusable OfficeRnD REST API SDK — OAuth2, retries, pagination        |
| [`@officernd/core`](packages/core)        | Business logic helpers — available rooms, expiring memberships, etc. |
| [`@officernd/mcp`](packages/mcp)          | MCP server exposing 130+ tools over stdio                            |
| [`officernd-mcp-vscode`](packages/vscode) | VS Code extension for credential management and MCP configuration    |

---

## Architecture

```
AI Client
(Claude Desktop / ChatGPT / Cursor / VS Code)

           │
           │  MCP (stdio)
           ▼

┌─────────────────────────────────────────┐
│           @officernd/mcp                │
│  Tool Registry (130+ CRUD + business)   │
├─────────────────────────────────────────┤
│           @officernd/core               │
│  Business helpers (rooms, members, …)  │
├─────────────────────────────────────────┤
│           @officernd/sdk                │
│  OAuth2 · HTTP Client · Pagination      │
│  Retries · Rate Limiting · Logging      │
└─────────────────────────────────────────┘

           │
           ▼

    OfficeRnD REST API
```

The SDK has **no MCP dependency**, making it reusable in non-MCP contexts.

---

## Installation

### Prerequisites

- Node.js 22 or later
- An OfficeRnD account with API access
- OAuth2 Client ID and Client Secret ([see Authentication](#authentication))

### Install the MCP Server

```bash
npm install -g @officernd/mcp
```

This installs the `officernd-mcp` command globally.

### Verify Installation

```bash
officernd-mcp --version
```

---

## Authentication

OfficeRnD uses **OAuth2 Client Credentials** for API access.

### Obtain Credentials

1. Log in to your OfficeRnD dashboard
2. Go to **Settings → Integrations → API**
3. Create a new OAuth2 application
4. Copy your **Client ID** and **Client Secret**
5. Note your **Organization Slug** (the subdomain in your OfficeRnD URL, e.g. `my-space` from `my-space.officernd.com`)

### Required Scopes

For the **Flex API v2** (recommended), grant your OAuth2 application the specific scopes it needs. Examples:

```
flex.community.members.read
flex.community.members.create
flex.space.bookings.read
flex.space.bookings.create
flex.billing.charges.read
```

Your OfficeRnD OAuth2 application must be configured with the scopes you want the MCP server to use. You must specify at least one scope — OfficeRnD will reject token requests that do not include a scope. Configure the `OFFICERND_SCOPES` environment variable (space-separated list) for the MCP server, or set `officernd.scopes` in VS Code settings for the extension.

The token endpoint is rate-limited to **5 requests per minute**. The SDK automatically caches tokens and reuses them until 60 seconds before expiry.

---

## Configuration

Configure the server using environment variables:

| Variable                  | Required    | Description                                                                                |
| ------------------------- | ----------- | ------------------------------------------------------------------------------------------ |
| `OFFICERND_CLIENT_ID`     | ✅          | Your OAuth2 Client ID                                                                      |
| `OFFICERND_CLIENT_SECRET` | ✅          | Your OAuth2 Client Secret                                                                  |
| `OFFICERND_ORG`           | Recommended | Organization slug (subdomain)                                                              |
| `OFFICERND_SCOPES`        | ✅          | Space-separated OAuth2 scopes (e.g. `flex.community.members.read`). Required by OfficeRnD. |
| `OFFICERND_API_VERSION`   | No          | API version: `v2` (default) or `v1`                                                        |
| `OFFICERND_LOG_LEVEL`     | No          | Log level: `debug`, `info` (default), `warn`, `error`                                      |

### Example

```bash
export OFFICERND_CLIENT_ID="your_client_id"
export OFFICERND_CLIENT_SECRET="your_client_secret"
export OFFICERND_ORG="my-coworking-space"
export OFFICERND_SCOPES="flex.community.members.read flex.space.bookings.read"
officernd-mcp
```

> **Security note:** Never hardcode credentials in configuration files. Use environment variables or a secrets manager. The VS Code extension generates MCP config with `${env:...}` placeholders so secrets are never written to disk.

---

## MCP Tools

The server automatically generates tools from the resource registry. Every resource supports a consistent set of operations:

### CRUD Tools (per resource)

| Tool Pattern        | Description                          |
| ------------------- | ------------------------------------ |
| `list_{resources}`  | List all items with optional filters |
| `get_{resource}`    | Get a specific item by ID            |
| `count_{resources}` | Count items matching filters         |
| `create_{resource}` | Create a new item                    |
| `update_{resource}` | Update an existing item              |
| `delete_{resource}` | Delete an item                       |

### Supported Resources

| Resource                      | Tools                                                                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Members                       | `list_members`, `get_member`, `count_members`, `create_member`, `update_member`, `delete_member`                         |
| Companies                     | `list_companies`, `get_company`, `count_companies`, `create_company`, `update_company`, `delete_company`                 |
| Teams                         | `list_teams`, `get_team`, `count_teams`, `create_team`, `update_team`, `delete_team`                                     |
| Memberships                   | `list_memberships`, `get_membership`, `count_memberships`, `create_membership`, `update_membership`, `delete_membership` |
| Bookings                      | `list_bookings`, `get_booking`, `count_bookings`, `create_booking`, `update_booking`, `delete_booking`                   |
| Rooms                         | `list_rooms`, `get_room`, `count_rooms`, `create_room`, `update_room`, `delete_room`                                     |
| Invoices                      | `list_invoices`, `get_invoice`, `count_invoices`, `create_invoice`, `update_invoice`, `delete_invoice`                   |
| Visitors                      | `list_visitors`, `get_visitor`, `count_visitors`, `create_visitor`, `update_visitor`, `delete_visitor`                   |
| Events                        | `list_events`, `get_event`, `count_events`, `create_event`, `update_event`, `delete_event`                               |
| Locations                     | `list_locations`, `get_location`, `create_location`, `update_location`, `delete_location`                                |
| … and 25+ more resource types |                                                                                                                          |

### Business / AI Convenience Tools

| Tool                             | Description                                   |
| -------------------------------- | --------------------------------------------- |
| `find_available_rooms`           | Find available meeting rooms for a time range |
| `find_memberships_expiring_soon` | Find memberships expiring within N days       |
| `get_todays_visitors`            | Get all visitors for today                    |
| `get_todays_bookings`            | Get all room bookings for today               |
| `get_unpaid_invoices`            | Get all outstanding invoices                  |
| `get_members_by_company`         | Get all members from a company                |
| `get_active_members`             | Get all currently active members              |

### Example AI Interactions

```
"Show me all members who joined in the last 30 days"
→ list_members with date filters

"Find available meeting rooms tomorrow at 2pm for 8 people"
→ find_available_rooms

"Which memberships are expiring this month?"
→ find_memberships_expiring_soon with daysUntilExpiry: 30

"Show today's visitors"
→ get_todays_visitors

"How many unpaid invoices do we have?"
→ get_unpaid_invoices
```

---

## Client Setup

### VS Code (Copilot)

#### Option A: Using the VS Code Extension (Recommended)

1. Install the **OfficeRnD MCP** extension from the VS Code Marketplace
2. Run command: `OfficeRnD: Configure Connection`
3. Enter your Client ID, Client Secret, and Organization Slug
4. Run command: `OfficeRnD: Generate MCP Configuration`
5. The extension writes `.vscode/mcp.json` with secure environment variable references

#### Option B: Manual Configuration

Create or edit `.vscode/mcp.json` in your workspace:

```json
{
  "servers": {
    "officernd": {
      "command": "officernd-mcp",
      "env": {
        "OFFICERND_CLIENT_ID": "${env:OFFICERND_CLIENT_ID}",
        "OFFICERND_CLIENT_SECRET": "${env:OFFICERND_CLIENT_SECRET}",
        "OFFICERND_ORG": "your-org-slug"
      }
    }
  }
}
```

Set environment variables in your shell profile (`.bashrc`, `.zshrc`, etc.):

```bash
export OFFICERND_CLIENT_ID="your_client_id"
export OFFICERND_CLIENT_SECRET="your_client_secret"
```

---

### Claude Desktop

Edit your Claude Desktop configuration file:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "officernd": {
      "command": "officernd-mcp",
      "env": {
        "OFFICERND_CLIENT_ID": "your_client_id",
        "OFFICERND_CLIENT_SECRET": "your_client_secret",
        "OFFICERND_ORG": "your-org-slug"
      }
    }
  }
}
```

Restart Claude Desktop. You should see "officernd" in the MCP servers list.

---

### Cursor

Create or edit `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "officernd": {
      "command": "officernd-mcp",
      "env": {
        "OFFICERND_CLIENT_ID": "your_client_id",
        "OFFICERND_CLIENT_SECRET": "your_client_secret",
        "OFFICERND_ORG": "your-org-slug"
      }
    }
  }
}
```

---

### ChatGPT

ChatGPT supports MCP via the OpenAI desktop app. Configure in the app's MCP settings using the same `officernd-mcp` command with the required environment variables.

---

## VS Code Extension

The `officernd-mcp-vscode` extension provides a first-class developer experience:

### Commands

| Command                                 | Description                                        |
| --------------------------------------- | -------------------------------------------------- |
| `OfficeRnD: Configure Connection`       | Guided setup wizard for credentials                |
| `OfficeRnD: Test Connection`            | Verify credentials and API connectivity            |
| `OfficeRnD: Show Configuration`         | Display current config (secrets masked)            |
| `OfficeRnD: Update Credentials`         | Update stored credentials                          |
| `OfficeRnD: Clear Credentials`          | Remove all stored credentials                      |
| `OfficeRnD: Generate MCP Configuration` | Write `.vscode/mcp.json` with env var placeholders |
| `OfficeRnD: Open Logs`                  | Open the output channel for debug logs             |

### Status Bar

The status bar shows the current connection state:

- `$(check) OfficeRnD Connected` — credentials configured
- `$(warning) OfficeRnD Disconnected` — no credentials

### Security

Credentials are stored in VS Code's **SecretStorage** (OS keychain). Secrets are **never** written to:

- `settings.json`
- Workspace settings
- `mcp.json` — env var references (`${env:...}`) are used instead

---

## Development

### Prerequisites

```bash
node --version  # Must be >= 22
npm --version
```

### Clone and Install

```bash
git clone https://github.com/EmpathDesign/OfficeRnD_MCP.git
cd OfficeRnD_MCP
npm install
```

### Build

```bash
npm run build
```

### Test

```bash
npm test
```

### Lint and Format

```bash
npm run lint          # ESLint
npm run format:check  # Prettier check
npm run format        # Prettier fix
```

### Monorepo Structure

```
packages/
├── sdk/          @officernd/sdk     — REST API SDK
├── core/         @officernd/core    — Business helpers
├── mcp/          @officernd/mcp     — MCP server + CLI
└── vscode/       officernd-mcp-vscode — VS Code extension
```

### Adding a New Resource

The resource registry in `packages/sdk/src/resources/registry.ts` is the single source of truth. Add a new entry:

```typescript
{
  name: 'my_resource',
  path: '/my-resources',
  description: 'Description of the resource',
  operations: ['list', 'get', 'create', 'update', 'delete', 'count'],
}
```

The MCP server automatically generates all tools from this registry. No additional code changes are needed.

---

## Troubleshooting

### Server doesn't start

```
Error: OFFICERND_CLIENT_ID and OFFICERND_CLIENT_SECRET environment variables are required.
```

Ensure both environment variables are set before running `officernd-mcp`.

### Authentication errors

```
OAuth2 token request failed: 401
```

- Verify your Client ID and Client Secret are correct
- Ensure the OAuth2 application has the Flex API scopes your workflows need (for example `flex.community.members.read`)
- Check that your organization slug matches your OfficeRnD URL

### Rate limiting

The token endpoint is limited to 5 requests/minute. The SDK caches tokens automatically — this should only occur if the server is restarted very frequently.

### 404 errors on API calls

- Verify your `OFFICERND_ORG` is set to the correct organization slug
- Check that the API version (`OFFICERND_API_VERSION`) matches what your account supports

### Enabling debug logging

```bash
OFFICERND_LOG_LEVEL=debug officernd-mcp
```

Logs are written to **stderr** to keep MCP's stdout protocol clean.

---

## Deferred Endpoints

The following OfficeRnD API resources are not yet implemented. They are documented here for follow-up:

| Resource                | Notes                        |
| ----------------------- | ---------------------------- |
| Access Control          | Badge/door access management |
| Occupancy tracking      | Real-time sensor data        |
| Checkout flows          | Online booking checkout      |
| Multi-org federation    | Cross-organization queries   |
| Webhooks management     | Endpoint delivery status     |
| Document uploads        | Binary file operations       |
| OpenAPI code generation | Automatic SDK regeneration   |

The `RESOURCES` registry in `packages/sdk/src/resources/registry.ts` is designed for declarative extension — adding a new resource requires a single entry.

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make changes and add tests
4. Verify: `npm run build && npm test && npm run lint`
5. Submit a pull request

All PRs run the CI workflow (lint → format check → build → test) automatically.

---

## License

[MIT](LICENSE) © EmpathDesign
