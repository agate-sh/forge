import * as vscode from 'vscode'
import type { Session, Workspace } from '@forge/sdk'
import { PORT_MIN, PORT_MAX, ENV_FORGE_PORT, ENV_FORGE_CALLER, DEFAULT_CALLER } from './constants'

export class TerminalManager {
  private context: vscode.ExtensionContext

  constructor(context: vscode.ExtensionContext) {
    this.context = context
  }

  generatePort(): number {
    return Math.floor(Math.random() * (PORT_MAX - PORT_MIN + 1)) + PORT_MIN
  }

  openSession(session: Session, workspace: Workspace | null): void {
    const port = this.generatePort()
    const sessionName = session.title || session.id.slice(0, 8)

    const terminal = vscode.window.createTerminal({
      name: `forge: ${sessionName}`,
      location: vscode.TerminalLocation.Editor,
      env: {
        [ENV_FORGE_PORT]: port.toString(),
        [ENV_FORGE_CALLER]: DEFAULT_CALLER,
      },
    })

    // Build command: forge --port <port> --continue <sessionId>
    let cmd = `forge --port ${port} --continue ${session.id}`
    if (workspace) {
      cmd += ` -w ${workspace.name}`
    }

    terminal.sendText(cmd)
    terminal.show()
  }

  createNewSession(workspace: Workspace | null): void {
    const port = this.generatePort()

    const terminal = vscode.window.createTerminal({
      name: 'forge: new session',
      location: vscode.TerminalLocation.Editor,
      env: {
        [ENV_FORGE_PORT]: port.toString(),
        [ENV_FORGE_CALLER]: DEFAULT_CALLER,
      },
    })

    let cmd = `forge --port ${port}`
    if (workspace) {
      cmd += ` -w ${workspace.name}`
    }

    terminal.sendText(cmd)
    terminal.show()
  }
}
