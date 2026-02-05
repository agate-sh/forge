import * as fs from "fs/promises"
import * as path from "path"
import * as os from "os"
import { z } from "zod"
import type { RegistryAgent, CacheData, CacheMetadata } from "./types"
import { RegistryAgentSchema } from "./types"

/**
 * Cache TTL: 24 hours
 */
const CACHE_TTL = 24 * 60 * 60 * 1000

/**
 * Cache file location: ~/.cache/forge/acp-registry.json
 */
function getCachePath(): string {
  const cacheDir = process.env.XDG_CACHE_HOME || path.join(os.homedir(), ".cache")
  return path.join(cacheDir, "forge", "acp-registry.json")
}

/**
 * Schema for validating cached data
 */
const CacheDataSchema = z.object({
  metadata: z.object({
    fetchedAt: z.number(),
    version: z.string(),
  }),
  agents: z.array(RegistryAgentSchema),
})

/**
 * Get cached agents if valid and not expired
 */
export async function get(): Promise<RegistryAgent[] | null> {
  try {
    const cachePath = getCachePath()
    const content = await fs.readFile(cachePath, "utf-8")
    const data = CacheDataSchema.parse(JSON.parse(content))

    // Check if cache is expired
    const age = Date.now() - data.metadata.fetchedAt
    if (age > CACHE_TTL) {
      return null
    }

    return data.agents
  } catch {
    // Cache doesn't exist, is invalid, or is corrupted
    return null
  }
}

/**
 * Save agents to cache
 */
export async function set(agents: RegistryAgent[], version: string = "1.0.0"): Promise<void> {
  const cachePath = getCachePath()
  const cacheDir = path.dirname(cachePath)

  // Ensure cache directory exists
  await fs.mkdir(cacheDir, { recursive: true })

  const data: CacheData = {
    metadata: {
      fetchedAt: Date.now(),
      version,
    },
    agents,
  }

  await fs.writeFile(cachePath, JSON.stringify(data, null, 2), "utf-8")
}

/**
 * Clear the cache
 */
export async function clear(): Promise<void> {
  try {
    const cachePath = getCachePath()
    await fs.unlink(cachePath)
  } catch {
    // Ignore if file doesn't exist
  }
}
