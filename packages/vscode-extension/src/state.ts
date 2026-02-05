import * as vscode from 'vscode'

class ForgeState {
  private _selectedWorkspaceId: string | null = null  // null = main worktree
  private _onDidChangeSelection = new vscode.EventEmitter<string | null>()

  readonly onDidChangeSelection = this._onDidChangeSelection.event

  get selectedWorkspaceId() { return this._selectedWorkspaceId }

  selectWorkspace(id: string | null) {
    this._selectedWorkspaceId = id
    this._onDidChangeSelection.fire(id)
  }

  dispose() {
    this._onDidChangeSelection.dispose()
  }
}

export const state = new ForgeState()
