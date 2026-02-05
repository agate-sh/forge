import type { Agent, RegistryAgent, PlatformKey, BinaryTarget } from "./types"
import { RegistrySchema } from "./types"
import * as Cache from "./cache"

/**
 * CDN URL for the ACP agent registry
 */
const CDN_URL = "https://cdn.agentclientprotocol.com/registry/v1/latest/registry.json"

/**
 * Hardcoded colors for known agents
 */
const COLORS: Record<string, string> = {
  "auggie": "#888888",
  "claude-code-acp": "#da7756",
  "codex-acp": "#6c908e",
  "factory-droid": "#888888",
  "gemini": "#cda9fc",
  "github-copilot": "#6e40c9",
  "mistral-vibe": "#FA520F",
  "opencode": "#ffba88",
  "qwen-code": "#888888",
}

/**
 * Default color for agents without a specific color
 */
const DEFAULT_COLOR = "#888888"

/**
 * Priority order for sorting agents (shown first)
 */
const PRIORITY_ORDER = ["claude-code-acp", "codex-acp", "gemini"]

/**
 * Add colors to registry agents
 */
function addColors(agents: RegistryAgent[]): Agent[] {
  return agents.map((agent) => ({
    ...agent,
    color: COLORS[agent.id] ?? DEFAULT_COLOR,
  }))
}

/**
 * Sort agents with priority agents first, then alphabetically
 */
function sortAgents(agents: Agent[]): Agent[] {
  return [...agents].sort((a, b) => {
    const aIndex = PRIORITY_ORDER.indexOf(a.id)
    const bIndex = PRIORITY_ORDER.indexOf(b.id)

    // If both are priority agents, sort by their priority order
    if (aIndex !== -1 && bIndex !== -1) {
      return aIndex - bIndex
    }

    // If only a is a priority agent, it comes first
    if (aIndex !== -1) return -1

    // If only b is a priority agent, it comes first
    if (bIndex !== -1) return 1

    // Neither are priority agents, sort alphabetically by name
    return a.name.localeCompare(b.name)
  })
}

/**
 * Fetch agents from registry
 *
 * Uses cached data if available and not expired (24h TTL).
 * Falls back to cache on network errors.
 */
export async function getAgents(): Promise<Agent[]> {
  // Try cache first
  const cached = await Cache.get()
  if (cached) {
    return sortAgents(addColors(cached))
  }

  // Fetch from CDN
  try {
    const response = await fetch(CDN_URL)
    if (!response.ok) {
      throw new Error(`Failed to fetch registry: ${response.status} ${response.statusText}`)
    }

    const json = await response.json()
    const data = RegistrySchema.parse(json)

    // Cache the result
    await Cache.set(data.agents, data.version)

    return sortAgents(addColors(data.agents))
  } catch (error) {
    // If fetch fails but we have stale cache, use it
    const staleCache = await Cache.get()
    if (staleCache) {
      return sortAgents(addColors(staleCache))
    }

    throw error
  }
}

/**
 * Get a single agent by name (case-insensitive match on name or id)
 */
export async function getAgent(name: string): Promise<Agent | undefined> {
  const agents = await getAgents()
  const normalizedName = name.toLowerCase()
  return agents.find(
    (a) => a.name.toLowerCase() === normalizedName || a.id.toLowerCase() === normalizedName,
  )
}

/**
 * Get the current platform key for binary distribution
 */
export function getPlatformKey(): PlatformKey {
  const arch = process.arch === "arm64" ? "aarch64" : "x86_64"

  switch (process.platform) {
    case "darwin":
      return `darwin-${arch}` as PlatformKey
    case "linux":
      return `linux-${arch}` as PlatformKey
    case "win32":
      return `windows-${arch}` as PlatformKey
    default:
      return `linux-${arch}` as PlatformKey
  }
}

/**
 * Get the binary target for the current platform
 */
export function getBinaryTarget(agent: Agent): BinaryTarget | undefined {
  const platformKey = getPlatformKey()
  return agent.distribution.binary?.[platformKey]
}

/**
 * Get the command to execute for an agent
 *
 * For npx/uvx: extracts the binary name from the package
 * For binary: uses the cmd from the platform target
 */
export function getCommand(agent: Agent): string {
  if (agent.distribution.npx) {
    // Extract binary name from package: "@scope/pkg@version" → "pkg"
    const pkg = agent.distribution.npx.package
    // Remove version suffix if present
    const pkgWithoutVersion = pkg.split("@").slice(0, -1).join("@") || pkg.split("@")[0]
    // Handle scoped packages: "@scope/pkg" → "pkg"
    const name = pkgWithoutVersion.split("/").pop() ?? pkgWithoutVersion
    return name
  }

  if (agent.distribution.uvx) {
    const pkg = agent.distribution.uvx.package
    return pkg.split("/").pop()?.split("@")[0] ?? pkg
  }

  if (agent.distribution.binary) {
    const target = getBinaryTarget(agent)
    if (target) {
      // Remove leading "./" from command
      return target.cmd.replace(/^\.\//, "")
    }
  }

  return ""
}

/**
 * Get the startup arguments for an agent
 */
export function getArgs(agent: Agent): string[] {
  if (agent.distribution.npx?.args) {
    return agent.distribution.npx.args
  }

  if (agent.distribution.uvx?.args) {
    return agent.distribution.uvx.args
  }

  if (agent.distribution.binary) {
    const target = getBinaryTarget(agent)
    if (target?.args) {
      return target.args
    }
  }

  return []
}

/**
 * Get environment variables for an agent
 */
export function getEnv(agent: Agent): Record<string, string> {
  if (agent.distribution.npx?.env) {
    return agent.distribution.npx.env
  }

  if (agent.distribution.uvx?.env) {
    return agent.distribution.uvx.env
  }

  if (agent.distribution.binary) {
    const target = getBinaryTarget(agent)
    if (target?.env) {
      return target.env
    }
  }

  return {}
}

/**
 * Generate install command for current platform
 */
export function getInstallCommand(agent: Agent): string {
  if (agent.distribution.npx) {
    return `npm install -g ${agent.distribution.npx.package}`
  }

  if (agent.distribution.uvx) {
    return `uv tool install ${agent.distribution.uvx.package}`
  }

  if (agent.distribution.binary) {
    const target = getBinaryTarget(agent)
    if (target) {
      return `# Download from ${target.archive}`
    }
  }

  if (agent.repository) {
    return `# See ${agent.repository}`
  }

  return "# No install command available"
}

/**
 * Clear the registry cache (forces refresh on next getAgents call)
 */
export async function clearCache(): Promise<void> {
  await Cache.clear()
}

// Re-export types
export type { Agent, RegistryAgent, PlatformKey, BinaryTarget } from "./types"
