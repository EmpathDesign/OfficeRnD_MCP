# OfficeRnD MCP

VS Code extension for configuring the OfficeRnD MCP server.

## What this extension does

- Stores your OfficeRnD client credentials in VS Code secret storage
- Tests your OAuth2 client credentials
- Generates a workspace `.vscode/mcp.json` file for MCP clients
- Shows connection status and quick commands inside VS Code

## Quick start

1. Install the **OfficeRnD MCP** extension.
2. Run **OfficeRnD: Configure Connection**.
3. Enter your **Client ID**, **Client Secret**, and optional **Organization Slug**.
4. Run **OfficeRnD: Test Connection** to verify your credentials.
5. Run **OfficeRnD: Generate MCP Configuration** to create `.vscode/mcp.json`.
6. Set `OFFICERND_CLIENT_ID` and `OFFICERND_CLIENT_SECRET` in your environment before starting your MCP client.

Example generated configuration:

```json
{
  "servers": {
    "officernd": {
      "command": "officernd-mcp",
      "env": {
        "OFFICERND_CLIENT_ID": "${env:OFFICERND_CLIENT_ID}",
        "OFFICERND_CLIENT_SECRET": "${env:OFFICERND_CLIENT_SECRET}",
        "OFFICERND_ORG": "your-org-slug",
        "OFFICERND_API_VERSION": "v2"
      }
    }
  }
}
```

## Commands

- **OfficeRnD: Configure Connection**
- **OfficeRnD: Test Connection**
- **OfficeRnD: Show Configuration**
- **OfficeRnD: Update Credentials**
- **OfficeRnD: Clear Credentials**
- **OfficeRnD: Generate MCP Configuration**
- **OfficeRnD: Open Logs**

## Authentication

OfficeRnD uses OAuth2 client credentials. Create an OAuth2 application in OfficeRnD, then copy the client ID and client secret into the extension.

If the MCP server later receives authorization errors for specific resources, update the scopes assigned to your OfficeRnD OAuth2 application to match the API operations you want to use.

## Learn more

- Full project documentation: https://github.com/EmpathDesign/OfficeRnD_MCP/blob/main/README.md
- OfficeRnD MCP server package: https://www.npmjs.com/package/@officernd/mcp
