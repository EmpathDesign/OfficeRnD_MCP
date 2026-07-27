import * as vscode from 'vscode';
import { buildConnectionTestRequestBody, normalizeScopes } from './auth.js';

const SECRET_KEY_CLIENT_ID = 'officernd.clientId';
const SECRET_KEY_CLIENT_SECRET = 'officernd.clientSecret';
const CONFIG_KEY_ORG_SLUG = 'officernd.organizationSlug';
const CONFIG_KEY_API_VERSION = 'officernd.apiVersion';
const CONFIG_KEY_SCOPES = 'officernd.scopes';

export function activate(context: vscode.ExtensionContext): void {
  const outputChannel = vscode.window.createOutputChannel('OfficeRnD MCP');
  context.subscriptions.push(outputChannel);

  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBar.text = '$(server) OfficeRnD';
  statusBar.tooltip = 'OfficeRnD MCP Server';
  statusBar.show();
  context.subscriptions.push(statusBar);

  const treeProvider = new OfficeRnDTreeProvider(context.secrets);
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('officerndStatus', treeProvider),
  );

  const updateStatus = async (): Promise<void> => {
    const clientId = await context.secrets.get(SECRET_KEY_CLIENT_ID);
    statusBar.text = clientId
      ? '$(check) OfficeRnD Connected'
      : '$(warning) OfficeRnD Disconnected';
  };

  void updateStatus();

  context.subscriptions.push(
    vscode.commands.registerCommand('officernd.configure', async () => {
      const clientId = await vscode.window.showInputBox({
        prompt: 'OfficeRnD Client ID',
        ignoreFocusOut: true,
        placeHolder: 'Enter your OfficeRnD Client ID',
      });
      if (!clientId) {
        return;
      }

      const clientSecret = await vscode.window.showInputBox({
        prompt: 'OfficeRnD Client Secret',
        ignoreFocusOut: true,
        password: true,
        placeHolder: 'Enter your OfficeRnD Client Secret',
      });
      if (!clientSecret) {
        return;
      }

      const orgSlug = await vscode.window.showInputBox({
        prompt: 'Organization Slug (optional)',
        ignoreFocusOut: true,
        placeHolder: 'e.g. my-coworking-space',
      });

      await context.secrets.store(SECRET_KEY_CLIENT_ID, clientId);
      await context.secrets.store(SECRET_KEY_CLIENT_SECRET, clientSecret);

      if (orgSlug) {
        const config = vscode.workspace.getConfiguration();
        await config.update(CONFIG_KEY_ORG_SLUG, orgSlug, vscode.ConfigurationTarget.Global);
      }

      outputChannel.appendLine('OfficeRnD credentials updated.');
      await updateStatus();
      treeProvider.refresh();

      const generateNow = await vscode.window.showInformationMessage(
        'OfficeRnD credentials saved. Generate MCP configuration now?',
        'Yes',
        'No',
      );
      if (generateNow === 'Yes') {
        await vscode.commands.executeCommand('officernd.generateMcpConfig');
      }
    }),
    vscode.commands.registerCommand('officernd.testConnection', async () => {
      const clientId = await context.secrets.get(SECRET_KEY_CLIENT_ID);
      const clientSecret = await context.secrets.get(SECRET_KEY_CLIENT_SECRET);
      const config = vscode.workspace.getConfiguration();
      const apiVersion = config.get<string>(CONFIG_KEY_API_VERSION, 'v2');
      const orgSlug = config.get<string>(CONFIG_KEY_ORG_SLUG, '');
      const scopes = normalizeScopes(config.get<string[]>(CONFIG_KEY_SCOPES, []));

      if (!clientId || !clientSecret) {
        void vscode.window.showErrorMessage(
          'No credentials configured. Run "OfficeRnD: Configure Connection" first.',
        );
        return;
      }

      try {
        statusBar.text = '$(sync~spin) OfficeRnD Testing...';
        outputChannel.appendLine(
          `Testing OfficeRnD connection (tokenUrl=https://identity.officernd.com/oauth/token, clientId=***${clientId.slice(-4)}, org=${orgSlug || '(not set)'}, apiVersion=${apiVersion}, scopes=${scopes.length > 0 ? scopes.join(' ') : '(none)'})`,
        );
        const response = await fetch('https://identity.officernd.com/oauth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: buildConnectionTestRequestBody(clientId, clientSecret, scopes),
        });

        if (response.ok) {
          statusBar.text = '$(check) OfficeRnD Connected';
          outputChannel.appendLine('OfficeRnD connection test succeeded.');
          void vscode.window.showInformationMessage('✓ Connected to OfficeRnD successfully!');
        } else {
          const errorText = await response.text().catch(() => response.statusText);
          const requestId =
            response.headers.get('x-request-id') ??
            response.headers.get('x-correlation-id') ??
            '(not provided)';
          const parsedErrorText = parseTokenEndpointError(errorText);
          statusBar.text = '$(error) OfficeRnD Error';
          outputChannel.appendLine(
            `OfficeRnD connection failed (status=${response.status}, requestId=${requestId}): ${parsedErrorText}`,
          );
          if (parsedErrorText !== errorText) {
            outputChannel.appendLine(`Raw token endpoint response: ${errorText}`);
          }
          if (parsedErrorText.toLowerCase().includes('invalid scope')) {
            if (scopes.length === 0) {
              outputChannel.appendLine(
                'No scopes are configured. OfficeRnD requires at least one scope to be specified. ' +
                  'Add scopes to "officernd.scopes" in VS Code settings (e.g. "flex.community.members.read") and retry the connection test.',
              );
            } else {
              outputChannel.appendLine(
                `Scope troubleshooting: the configured scopes (${scopes.join(', ')}) were rejected. ` +
                  'Verify these scopes are enabled on your OfficeRnD OAuth2 application, or update "officernd.scopes" in VS Code settings.',
              );
            }
          }
          void vscode.window.showErrorMessage(`Connection failed: ${parsedErrorText}`);
        }
      } catch (error) {
        statusBar.text = '$(error) OfficeRnD Error';
        const message = error instanceof Error ? error.message : String(error);
        outputChannel.appendLine(`OfficeRnD connection error: ${message}`);
        void vscode.window.showErrorMessage(`Connection error: ${message}`);
      }
    }),
    vscode.commands.registerCommand('officernd.showConfig', async () => {
      const clientId = await context.secrets.get(SECRET_KEY_CLIENT_ID);
      const clientSecret = await context.secrets.get(SECRET_KEY_CLIENT_SECRET);
      const config = vscode.workspace.getConfiguration();
      const orgSlug = config.get<string>(CONFIG_KEY_ORG_SLUG, '(not set)');
      const apiVersion = config.get<string>(CONFIG_KEY_API_VERSION, 'v2');
      const scopes = config.get<string[]>(CONFIG_KEY_SCOPES, []);

      const message = [
        'OfficeRnD Configuration:',
        `  Client ID: ${clientId ? `***${clientId.slice(-4)}` : '(not set)'}`,
        `  Client Secret: ${clientSecret ? '••••••••' : '(not set)'}`,
        `  Organization: ${orgSlug}`,
        `  API Version: ${apiVersion}`,
        `  Scopes: ${scopes.length > 0 ? scopes.join(', ') : '(all available)'}`,
      ].join('\n');

      void vscode.window.showInformationMessage(message, { modal: true });
    }),
    vscode.commands.registerCommand('officernd.updateCredentials', async () => {
      await vscode.commands.executeCommand('officernd.configure');
    }),
    vscode.commands.registerCommand('officernd.clearCredentials', async () => {
      const confirm = await vscode.window.showWarningMessage(
        'Clear OfficeRnD credentials?',
        { modal: true },
        'Yes, Clear',
      );
      if (confirm !== 'Yes, Clear') {
        return;
      }

      await context.secrets.delete(SECRET_KEY_CLIENT_ID);
      await context.secrets.delete(SECRET_KEY_CLIENT_SECRET);
      outputChannel.appendLine('OfficeRnD credentials cleared.');
      await updateStatus();
      treeProvider.refresh();
      void vscode.window.showInformationMessage('OfficeRnD credentials cleared.');
    }),
    vscode.commands.registerCommand('officernd.generateMcpConfig', async () => {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders?.length) {
        void vscode.window.showErrorMessage('No workspace folder open.');
        return;
      }

      const config = vscode.workspace.getConfiguration();
      const orgSlug = config.get<string>(CONFIG_KEY_ORG_SLUG, '');
      const apiVersion = config.get<string>(CONFIG_KEY_API_VERSION, 'v2');
      const mcpConfig = {
        servers: {
          officernd: {
            command: 'officernd-mcp',
            env: {
              OFFICERND_CLIENT_ID: '${env:OFFICERND_CLIENT_ID}',
              OFFICERND_CLIENT_SECRET: '${env:OFFICERND_CLIENT_SECRET}',
              ...(orgSlug ? { OFFICERND_ORG: orgSlug } : {}),
              OFFICERND_API_VERSION: apiVersion,
            },
          },
        },
      };

      const vscodeDir = vscode.Uri.joinPath(workspaceFolders[0].uri, '.vscode');
      await vscode.workspace.fs.createDirectory(vscodeDir);
      const configPath = vscode.Uri.joinPath(vscodeDir, 'mcp.json');
      const content = JSON.stringify(mcpConfig, null, 2);
      const encoder = new TextEncoder();
      await vscode.workspace.fs.writeFile(configPath, encoder.encode(content));
      outputChannel.appendLine(`MCP configuration written to ${configPath.fsPath}`);
      void vscode.window.showInformationMessage('MCP configuration written to .vscode/mcp.json');
    }),
    vscode.commands.registerCommand('officernd.openLogs', () => {
      outputChannel.show();
    }),
  );
}

export function deactivate(): void {
  // no-op
}

function parseTokenEndpointError(errorText: string): string {
  try {
    const parsed = JSON.parse(errorText) as {
      error?: string;
      error_description?: string;
      message?: string;
    };
    const parts = [parsed.error_description, parsed.message, parsed.error]
      .filter((value): value is string => Boolean(value))
      .map((value) => value.trim())
      .filter(Boolean);
    if (parts.length > 0) {
      return parts.join(' | ');
    }
  } catch {
    // no-op; non-JSON responses are handled by returning raw text
  }

  return errorText || 'Unknown token endpoint error';
}

class OfficeRnDTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<
    vscode.TreeItem | undefined | null | void
  >();

  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  constructor(private readonly secrets: vscode.SecretStorage) {}

  refresh(): void {
    this.onDidChangeTreeDataEmitter.fire();
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(): Promise<vscode.TreeItem[]> {
    const clientId = await this.secrets.get(SECRET_KEY_CLIENT_ID);
    if (clientId) {
      return [
        new vscode.TreeItem('Status: Connected', vscode.TreeItemCollapsibleState.None),
        new vscode.TreeItem(
          `Client ID: ***${clientId.slice(-4)}`,
          vscode.TreeItemCollapsibleState.None,
        ),
      ];
    }

    return [new vscode.TreeItem('Status: Not configured', vscode.TreeItemCollapsibleState.None)];
  }
}
