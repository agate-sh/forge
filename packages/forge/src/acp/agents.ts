import type { MatchResult } from "../util/match.js"
import { fuzzyMatch } from "../util/match.js"
import {
  getAgents as fetchAgents,
  getAgent as fetchAgent,
  getCommand,
  getArgs,
  getEnv,
  getInstallCommand,
  clearCache,
  type Agent,
} from "./registry/index.js"

export interface InstallCommand {
  method: string // e.g., "npm", "brew", "curl", "cargo", "uv"
  command: string // the actual command to run
  description?: string
}

/**
 * Agent definition interface for backward compatibility
 *
 * Maps registry Agent type to the interface expected by consumers
 */
export interface ACPAgentDefinition {
  name: string
  description: string
  command: string // the binary name to execute (also checked via Bun.which for detection)
  acpStartupArgs: string[]
  installCommands: {
    unix: InstallCommand[] // macOS/Linux
    windows: InstallCommand[]
  }
  uninstallCommands?: {
    unix: InstallCommand[]
    windows: InstallCommand[]
  }
  installGuide?: string
  color?: string // Hex color for UI elements (e.g., prompt border)
  // Legacy fields for backward compatibility with CLI checking
  installMethod?: "npx" | "uvx" | "system" | "skip"
  installCheck?: string
  // Alias for acpStartupArgs for backward compatibility
  args?: string[]
  // Environment variables for subprocess
  env?: Record<string, string>
  // Original registry agent data
  _registryAgent?: Agent
}

/**
 * Cache for agents converted to ACPAgentDefinition
 */
let agentCache: ACPAgentDefinition[] | null = null

/**
 * Convert a registry Agent to ACPAgentDefinition format
 */
function toDefinition(agent: Agent): ACPAgentDefinition {
  const command = getCommand(agent)
  const args = getArgs(agent)
  const env = getEnv(agent)
  const installCmd = getInstallCommand(agent)

  // Determine install method
  let installMethod: "npx" | "uvx" | "system" | "skip" = "system"
  if (agent.distribution.npx) {
    installMethod = "npx"
  } else if (agent.distribution.uvx) {
    installMethod = "uvx"
  }

  // Build install commands
  const unixInstall: InstallCommand[] = []
  const windowsInstall: InstallCommand[] = []

  if (agent.distribution.npx) {
    const npmCmd = {
      method: "npm",
      command: `npm install -g ${agent.distribution.npx.package}`,
      description: "Install via npm (global)",
    }
    unixInstall.push(npmCmd)
    windowsInstall.push(npmCmd)
  }

  if (agent.distribution.uvx) {
    const uvCmd = {
      method: "uv",
      command: `uv tool install ${agent.distribution.uvx.package}`,
      description: "Install via uv tool",
    }
    unixInstall.push(uvCmd)
    windowsInstall.push(uvCmd)
  }

  if (agent.distribution.binary) {
    // For binary distribution, add a generic install note
    if (agent.repository) {
      const binaryCmd = {
        method: "binary",
        command: `# Download from ${agent.repository}`,
        description: "Download pre-built binary",
      }
      unixInstall.push(binaryCmd)
      windowsInstall.push(binaryCmd)
    }
  }

  // Build uninstall commands
  const unixUninstall: InstallCommand[] = []
  const windowsUninstall: InstallCommand[] = []

  if (agent.distribution.npx) {
    // Extract package name without version
    const pkg = agent.distribution.npx.package.split("@").slice(0, -1).join("@") ||
                agent.distribution.npx.package
    const npmCmd = {
      method: "npm",
      command: `npm uninstall -g ${pkg}`,
      description: "Uninstall via npm (global)",
    }
    unixUninstall.push(npmCmd)
    windowsUninstall.push(npmCmd)
  }

  if (agent.distribution.uvx) {
    const uvCmd = {
      method: "uv",
      command: `uv tool uninstall ${agent.distribution.uvx.package.split("@")[0]}`,
      description: "Uninstall via uv tool",
    }
    unixUninstall.push(uvCmd)
    windowsUninstall.push(uvCmd)
  }

  return {
    name: agent.name,
    description: agent.description,
    command,
    acpStartupArgs: args,
    args,
    env: Object.keys(env).length > 0 ? env : undefined,
    installCommands: {
      unix: unixInstall,
      windows: windowsInstall,
    },
    uninstallCommands:
      unixUninstall.length > 0 || windowsUninstall.length > 0
        ? { unix: unixUninstall, windows: windowsUninstall }
        : undefined,
    installGuide: agent.repository,
    color: agent.color,
    installMethod,
    _registryAgent: agent,
  }
}

/**
 * Get all agents from the registry
 *
 * This is async because it may need to fetch from the CDN.
 * Results are cached in memory after first fetch.
 */
export async function getAllAgentsAsync(): Promise<ACPAgentDefinition[]> {
  if (agentCache) {
    return agentCache
  }

  const agents = await fetchAgents()
  agentCache = agents.map(toDefinition)
  return agentCache
}

/**
 * Get all agents synchronously (uses cached data)
 *
 * Returns empty array if cache hasn't been populated yet.
 * Prefer using getAllAgentsAsync() for initial load.
 */
export function getAllAgents(): ACPAgentDefinition[] {
  return agentCache ?? []
}

/**
 * Preload agents into cache
 *
 * Call this during app initialization to ensure agents are available.
 */
export async function preloadAgents(): Promise<void> {
  await getAllAgentsAsync()
}

/**
 * Get a single agent by name
 */
export async function getAgentAsync(name: string): Promise<ACPAgentDefinition | undefined> {
  const agents = await getAllAgentsAsync()
  const normalizedName = name.toLowerCase()
  return agents.find(
    (a) => a.name.toLowerCase() === normalizedName ||
           a._registryAgent?.id.toLowerCase() === normalizedName,
  )
}

/**
 * Get a single agent by name (synchronous, uses cache)
 */
export function getAgent(name: string): ACPAgentDefinition | undefined {
  const agents = getAllAgents()
  const normalizedName = name.toLowerCase()
  return agents.find(
    (a) => a.name.toLowerCase() === normalizedName ||
           a._registryAgent?.id.toLowerCase() === normalizedName,
  )
}

/**
 * Match an agent by fuzzy name matching
 */
export function matchAgent(name: string): MatchResult<ACPAgentDefinition> {
  return fuzzyMatch(name, getAllAgents(), (agent) => agent.name)
}

/**
 * Match an agent by fuzzy name matching (async version)
 */
export async function matchAgentAsync(name: string): Promise<MatchResult<ACPAgentDefinition>> {
  const agents = await getAllAgentsAsync()
  return fuzzyMatch(name, agents, (agent) => agent.name)
}

export function getInstallCommandsForPlatform(
  agent: ACPAgentDefinition,
  platform: NodeJS.Platform = process.platform,
): InstallCommand[] {
  return platform === "win32" ? agent.installCommands.windows : agent.installCommands.unix
}

export function getUninstallCommandsForPlatform(
  agent: ACPAgentDefinition,
  platform: NodeJS.Platform = process.platform,
): InstallCommand[] {
  if (!agent.uninstallCommands) return []
  return platform === "win32" ? agent.uninstallCommands.windows : agent.uninstallCommands.unix
}

/**
 * Clear the agent cache (forces refresh on next call)
 */
export async function clearAgentCache(): Promise<void> {
  agentCache = null
  await clearCache()
}

// No default agent - user must select on first launch
// After selection, their choice is stored in KV as the default for future sessions
export const DEFAULT_AGENT: ACPAgentDefinition | null = null

// Re-export types
export type { Agent as RegistryAgent } from "./registry/index.js"
