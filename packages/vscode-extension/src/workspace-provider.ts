import * as vscode from "vscode"
import type { Session, Workspace, ForgeClient, Project } from "@forge/sdk"

/**
 * Tree item representing a workspace (git worktree).
 * Acts as a collapsible parent containing sessions.
 */
export class WorkspaceTreeItem extends vscode.TreeItem {
  constructor(
    public readonly workspace: Workspace | null,
    public readonly isMain: boolean,
    mainBranch: string
  ) {
    // For main worktree (workspace=null): label = `${mainBranch} (main)`
    // For user workspaces: label = workspace.name
    const label = isMain ? `${mainBranch} (main)` : workspace!.name

    super(label, vscode.TreeItemCollapsibleState.Expanded)

    this.contextValue = "workspace"
    this.iconPath = new vscode.ThemeIcon("git-branch")
  }

  /**
   * Get the workspace ID, or null for main worktree.
   */
  get workspaceId(): string | null {
    return this.workspace?.id ?? null
  }
}

/**
 * Tree item representing a session within a workspace.
 * Clickable to open the session.
 */
export class SessionTreeItem extends vscode.TreeItem {
  constructor(
    public readonly session: Session,
    public readonly workspaceId: string | null
  ) {
    const label = session.title || "Untitled"

    super(label, vscode.TreeItemCollapsibleState.None)

    this.contextValue = "session"
    this.command = {
      command: "forge.openSession",
      title: "Open Session",
      arguments: [this],
    }
  }
}

/**
 * TreeDataProvider for displaying workspaces and sessions in VS Code's explorer.
 * Groups sessions by their workspace (git worktree).
 */
export class WorkspaceProvider
  implements vscode.TreeDataProvider<WorkspaceTreeItem | SessionTreeItem>
{
  private _onDidChangeTreeData = new vscode.EventEmitter<
    WorkspaceTreeItem | SessionTreeItem | undefined | null | void
  >()
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event

  private workspaces: Workspace[] = []
  private sessions: Session[] = []
  private mainBranch: string = "main"
  private project: Project | null = null

  constructor(private readonly client: ForgeClient) {}

  /**
   * Look up a workspace by its ID.
   * Returns null for the main worktree (id === null) or if not found.
   */
  getWorkspaceById(id: string | null): Workspace | null {
    if (id === null) {
      return null
    }
    return this.workspaces.find((w) => w.id === id) ?? null
  }

  /**
   * Refresh the tree view by fetching latest data from the server.
   */
  async refresh(): Promise<void> {
    try {
      // Fetch project first to get mainBranch and repoID
      const projectResponse = await this.client.project.current()
      this.project = projectResponse.data ?? null
      this.mainBranch =
        this.project?.mainBranch ?? this.project?.branch ?? "main"

      // Fetch workspaces if we have a project ID
      if (this.project?.id) {
        const workspacesResponse = await this.client.workspace.list({
          query: { repoID: this.project.id },
        })
        this.workspaces = workspacesResponse.data ?? []
      } else {
        this.workspaces = []
      }

      // Fetch sessions
      const sessionsResponse = await this.client.session.list()
      this.sessions = sessionsResponse.data ?? []

      // Fire the change event to refresh the tree
      this._onDidChangeTreeData.fire()
    } catch (error) {
      console.error("Failed to refresh workspace provider:", error)
    }
  }

  getTreeItem(
    element: WorkspaceTreeItem | SessionTreeItem
  ): vscode.TreeItem | Thenable<vscode.TreeItem> {
    return element
  }

  async getChildren(
    element?: WorkspaceTreeItem | SessionTreeItem
  ): Promise<(WorkspaceTreeItem | SessionTreeItem)[]> {
    if (!element) {
      // Root level: return workspace tree items
      // First, fetch the data if not already loaded
      if (this.sessions.length === 0 && this.workspaces.length === 0) {
        await this.refresh()
      }

      const items: WorkspaceTreeItem[] = []

      // Main worktree always at top
      items.push(new WorkspaceTreeItem(null, true, this.mainBranch))

      // User-created workspaces sorted by access time (most recent first)
      const sortedWorkspaces = [...this.workspaces].sort(
        (a, b) => b.time.accessed - a.time.accessed
      )
      for (const workspace of sortedWorkspaces) {
        items.push(new WorkspaceTreeItem(workspace, false, this.mainBranch))
      }

      return items
    }

    if (element instanceof WorkspaceTreeItem) {
      // Return sessions belonging to this workspace
      const workspaceId = element.workspaceId

      // Filter sessions: workspaceID === null go to main, others to their workspace
      const filteredSessions = this.sessions.filter((session) => {
        const sessionWorkspaceId = session.workspaceID ?? null
        return sessionWorkspaceId === workspaceId
      })

      // Sort by updated time (most recent first)
      const sortedSessions = filteredSessions.sort(
        (a, b) => b.time.updated - a.time.updated
      )

      return sortedSessions.map(
        (session) => new SessionTreeItem(session, workspaceId)
      )
    }

    // SessionTreeItem has no children
    return []
  }
}
