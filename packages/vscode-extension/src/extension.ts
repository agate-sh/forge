import * as vscode from 'vscode'
import { createForgeClient, type ForgeClient } from '@forge/sdk'
import { TREE_VIEW_ID, DEFAULT_SERVER_PORT } from './constants'
import { state } from './state'
import { WorkspaceProvider, WorkspaceTreeItem, SessionTreeItem } from './workspace-provider'
import { TerminalManager } from './terminal-manager'
import { ensureServerRunning, isServerRunning } from './server-manager'
import { EventSubscriber } from './event-subscriber'

let client: ForgeClient | null = null

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  // Get the workspace folder
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath

  if (!workspaceFolder) {
    vscode.window.showWarningMessage('Forge: No workspace folder open')
  }

  // Get server port from configuration or use default
  const config = vscode.workspace.getConfiguration('forge')
  const serverPort = config.get<number>('serverPort', DEFAULT_SERVER_PORT)

  // Create the Forge client immediately (even if server isn't running yet)
  client = createForgeClient({
    baseUrl: `http://localhost:${serverPort}`,
    directory: workspaceFolder,
  })

  // Create the workspace provider and register tree view FIRST
  // This prevents "no data provider registered" error
  const workspaceProvider = new WorkspaceProvider(client)

  const treeView = vscode.window.createTreeView(TREE_VIEW_ID, {
    treeDataProvider: workspaceProvider,
    showCollapseAll: true,
  })

  // Create the terminal manager
  const terminalManager = new TerminalManager(context)

  // Create event subscriber for real-time updates
  const eventSubscriber = new EventSubscriber(serverPort)

  // Listen for relevant events and refresh the tree
  // Events from GlobalBus have structure: { directory: string, payload: { type: string, properties: {...} } }
  const eventListener = eventSubscriber.onEvent((event) => {
    const eventType = (event as any).payload?.type ?? event.type
    // Refresh tree on workspace or session changes
    if (
      eventType?.startsWith('workspace.') ||
      eventType?.startsWith('session.') ||
      eventType === 'server.connected'
    ) {
      workspaceProvider.refresh()
    }
  })

  // Detect if we're in development mode
  const isDevelopment = context.extensionMode === vscode.ExtensionMode.Development

  // Now ensure the server is running (async, don't block activation)
  ensureServerRunning({
    port: serverPort,
    isDevelopment,
    extensionPath: context.extensionPath,
  }).then((started) => {
    if (started) {
      // Server is ready, connect to events and refresh
      eventSubscriber.connect()
      workspaceProvider.refresh()
    } else {
      vscode.window.showWarningMessage(
        'Forge: Could not start server. Some features may not work.'
      )
    }
  })

  // Subscribe to tree view selection changes
  treeView.onDidChangeSelection((event) => {
    const selected = event.selection[0]
    if (selected instanceof WorkspaceTreeItem) {
      state.selectWorkspace(selected.workspaceId)
    } else if (selected instanceof SessionTreeItem) {
      state.selectWorkspace(selected.workspaceId)
    }
  })

  // Register commands
  const openSessionCommand = vscode.commands.registerCommand(
    'forge.openSession',
    (item: SessionTreeItem) => {
      const workspace = workspaceProvider.getWorkspaceById(item.workspaceId)
      terminalManager.openSession(item.session, workspace)
    }
  )

  const createNewSessionCommand = vscode.commands.registerCommand(
    'forge.createNewSession',
    async (item?: WorkspaceTreeItem) => {
      let workspace = null

      if (item) {
        workspace = item.workspace
      } else if (state.selectedWorkspaceId !== null) {
        workspace = workspaceProvider.getWorkspaceById(state.selectedWorkspaceId)
      }

      terminalManager.createNewSession(workspace)
      // Tree will refresh automatically via SSE events
    }
  )

  const addWorkspaceCommand = vscode.commands.registerCommand(
    'forge.addWorkspace',
    async () => {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
      if (!workspaceFolder) {
        vscode.window.showErrorMessage('Forge: No workspace folder open')
        return
      }

      // Ensure server is running before making API calls
      if (!(await isServerRunning(serverPort))) {
        const started = await ensureServerRunning({
          port: serverPort,
          isDevelopment,
          extensionPath: context.extensionPath,
        })
        if (!started) {
          vscode.window.showErrorMessage('Forge: Server is not running')
          return
        }
      }

      try {
        // Get suggested name from backend
        const suggestResponse = await client!.workspace.suggestName()
        const suggestedName = suggestResponse.data?.name ?? 'new-workspace'

        // Show input box with suggested name pre-filled
        const name = await vscode.window.showInputBox({
          prompt: 'Enter a name for the new workspace',
          value: suggestedName,
          valueSelection: [0, suggestedName.length],
        })

        if (name === undefined) return // User cancelled

        // Create workspace via API
        const response = await client!.workspace.create({
          body: { name: name.trim(), repoRoot: workspaceFolder },
        })

        const workspace = response.data
        if (workspace) {
          // Update global state to select the new workspace
          state.selectWorkspace(workspace.id)

          // Create a new session in the workspace (opens terminal)
          terminalManager.createNewSession(workspace)

          // Tree will refresh automatically via SSE events
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to create workspace: ${error}`)
      }
    }
  )

  const deleteSessionCommand = vscode.commands.registerCommand(
    'forge.deleteSession',
    async (item: SessionTreeItem) => {
      const confirm = await vscode.window.showWarningMessage(
        `Delete session "${item.session.title || 'Untitled'}"?`,
        { modal: true },
        'Delete'
      )

      if (confirm === 'Delete') {
        try {
          await client!.session.delete({ path: { id: item.session.id } })
          // Tree will refresh automatically via SSE events
          vscode.window.showInformationMessage('Session deleted')
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to delete session: ${error}`)
        }
      }
    }
  )

  // Push all disposables to subscriptions
  context.subscriptions.push(
    treeView,
    openSessionCommand,
    createNewSessionCommand,
    addWorkspaceCommand,
    deleteSessionCommand,
    eventSubscriber,
    eventListener,
    state
  )

  // Initial refresh - handle server not running gracefully
  try {
    await workspaceProvider.refresh()
  } catch (error) {
    console.log('Forge: Server not running or unreachable, tree view will be empty')
  }
}

export function deactivate(): void {
  state.dispose()
  client = null
}
