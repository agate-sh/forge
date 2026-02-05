import * as vscode from 'vscode'
import { DEFAULT_SERVER_PORT } from './constants'

type EventCallback = (event: { type: string; properties: Record<string, unknown> }) => void

/**
 * Subscribes to the Forge server's global SSE event stream
 */
export class EventSubscriber implements vscode.Disposable {
  private abortController: AbortController | null = null
  private callbacks: EventCallback[] = []
  private reconnectTimeout: NodeJS.Timeout | null = null
  private isDisposed = false

  constructor(private port: number = DEFAULT_SERVER_PORT) {}

  /**
   * Start listening to the SSE stream
   */
  async connect(): Promise<void> {
    if (this.isDisposed) return

    this.abortController = new AbortController()

    try {
      const response = await fetch(`http://localhost:${this.port}/global/event`, {
        signal: this.abortController.signal,
        headers: {
          Accept: 'text/event-stream',
        },
      })

      if (!response.ok || !response.body) {
        throw new Error(`Failed to connect to SSE: ${response.status}`)
      }

      console.log('Forge: Connected to event stream')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (!this.isDisposed) {
        const { done, value } = await reader.read()

        if (done) {
          console.log('Forge: Event stream closed')
          break
        }

        buffer += decoder.decode(value, { stream: true })

        // Parse SSE messages
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              this.emit(data)
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (error) {
      if (this.isDisposed) return

      const err = error as Error
      if (err.name === 'AbortError') {
        return
      }

      console.log('Forge: Event stream error, will reconnect:', err.message)
    }

    // Reconnect after a delay
    if (!this.isDisposed) {
      this.scheduleReconnect()
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
    }
    this.reconnectTimeout = setTimeout(() => {
      console.log('Forge: Reconnecting to event stream...')
      this.connect()
    }, 3000)
  }

  private emit(event: { type: string; properties: Record<string, unknown> }): void {
    for (const callback of this.callbacks) {
      try {
        callback(event)
      } catch (e) {
        console.error('Forge: Event callback error:', e)
      }
    }
  }

  /**
   * Register a callback for events
   */
  onEvent(callback: EventCallback): vscode.Disposable {
    this.callbacks.push(callback)
    return {
      dispose: () => {
        const index = this.callbacks.indexOf(callback)
        if (index >= 0) {
          this.callbacks.splice(index, 1)
        }
      },
    }
  }

  dispose(): void {
    this.isDisposed = true

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
    }

    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }

    this.callbacks = []
  }
}
