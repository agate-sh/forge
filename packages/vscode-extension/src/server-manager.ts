import * as vscode from 'vscode'
import * as path from 'path'
import { spawn, type ChildProcess } from 'child_process'
import { DEFAULT_SERVER_PORT } from './constants'

let serverProcess: ChildProcess | null = null

/**
 * Check if the Forge server is running on the specified port
 */
export async function isServerRunning(port: number = DEFAULT_SERVER_PORT): Promise<boolean> {
  try {
    const response = await fetch(`http://localhost:${port}/config`)
    return response.ok
  } catch {
    return false
  }
}

export interface ServerOptions {
  port?: number
  isDevelopment?: boolean
  extensionPath?: string
}

/**
 * Start the Forge server if it's not already running
 */
export async function ensureServerRunning(options: ServerOptions = {}): Promise<boolean> {
  const { port = DEFAULT_SERVER_PORT, isDevelopment = false, extensionPath } = options

  if (await isServerRunning(port)) {
    console.log(`Forge: Server already running on port ${port}`)
    return true
  }

  console.log(`Forge: Starting server on port ${port} (dev mode: ${isDevelopment})`)

  return new Promise((resolve) => {
    let cmd: string
    let args: string[]
    let cwd: string | undefined

    if (isDevelopment && extensionPath) {
      // In dev mode, use bun to run the local forge from the monorepo
      // Extension is at packages/vscode-extension, forge is at packages/forge
      const forgeDir = path.resolve(extensionPath, '..', 'forge')
      const forgeEntry = path.join(forgeDir, 'src', 'index.ts')

      cmd = 'bun'
      args = ['run', '--conditions=browser', forgeEntry, 'serve', '--port', port.toString()]
      cwd = forgeDir

      console.log(`Forge: Using local dev build at ${forgeDir}`)
    } else {
      // In production, use the global forge binary
      cmd = 'forge'
      args = ['serve', '--port', port.toString()]
    }

    console.log(`Forge: Spawning command: ${cmd} ${args.join(' ')}`)
    if (cwd) {
      console.log(`Forge: Working directory: ${cwd}`)
    }

    serverProcess = spawn(cmd, args, {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd,
      env: {
        ...process.env,
        TERM: 'dumb',
      },
    })

    // Capture stdout/stderr for debugging
    let output = ''
    serverProcess.stdout?.on('data', (data) => {
      output += data.toString()
      console.log(`Forge server stdout: ${data.toString().trim()}`)
    })
    serverProcess.stderr?.on('data', (data) => {
      output += data.toString()
      console.error(`Forge server stderr: ${data.toString().trim()}`)
    })

    serverProcess.on('exit', (code, signal) => {
      console.log(`Forge: Server process exited with code ${code}, signal ${signal}`)
      if (output) {
        console.log(`Forge: Server output: ${output}`)
      }
    })

    serverProcess.unref()

    // Give the server a moment to start
    const checkInterval = setInterval(async () => {
      if (await isServerRunning(port)) {
        clearInterval(checkInterval)
        console.log(`Forge: Server started on port ${port}`)
        resolve(true)
      }
    }, 200)

    // Timeout after 10 seconds
    setTimeout(() => {
      clearInterval(checkInterval)
      console.log('Forge: Server failed to start within timeout')
      if (output) {
        console.log(`Forge: Captured output: ${output}`)
      }
      resolve(false)
    }, 10000)

    serverProcess.on('error', (err) => {
      clearInterval(checkInterval)
      console.error('Forge: Failed to spawn server process:', err)
      vscode.window.showErrorMessage(
        `Forge: Failed to start server: ${err.message}`
      )
      resolve(false)
    })
  })
}

/**
 * Stop the server process if we started it
 */
export function stopServer(): void {
  if (serverProcess) {
    serverProcess.kill()
    serverProcess = null
  }
}
