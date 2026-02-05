import { z } from "zod"

/**
 * Platform keys for binary distribution
 */
export type PlatformKey =
  | "darwin-aarch64"
  | "darwin-x86_64"
  | "linux-aarch64"
  | "linux-x86_64"
  | "windows-aarch64"
  | "windows-x86_64"

/**
 * Binary target configuration
 */
export const BinaryTargetSchema = z.object({
  archive: z.string(),
  cmd: z.string(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string(), z.string()).optional(),
})

export type BinaryTarget = z.infer<typeof BinaryTargetSchema>

/**
 * NPX distribution configuration
 */
export const NpxDistributionSchema = z.object({
  package: z.string(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string(), z.string()).optional(),
})

export type NpxDistribution = z.infer<typeof NpxDistributionSchema>

/**
 * UVX distribution configuration
 */
export const UvxDistributionSchema = z.object({
  package: z.string(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string(), z.string()).optional(),
})

export type UvxDistribution = z.infer<typeof UvxDistributionSchema>

/**
 * Distribution configuration for an agent
 */
export const DistributionSchema = z.object({
  npx: NpxDistributionSchema.optional(),
  uvx: UvxDistributionSchema.optional(),
  binary: z.record(z.string(), BinaryTargetSchema).optional(),
})

export type Distribution = z.infer<typeof DistributionSchema>

/**
 * Registry agent schema (from CDN)
 */
export const RegistryAgentSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string(),
  description: z.string(),
  repository: z.string().optional(),
  authors: z.array(z.string()),
  license: z.string(),
  icon: z.string().optional(),
  distribution: DistributionSchema,
})

export type RegistryAgent = z.infer<typeof RegistryAgentSchema>

/**
 * Full registry schema
 */
export const RegistrySchema = z.object({
  version: z.string(),
  agents: z.array(RegistryAgentSchema),
  extensions: z.array(z.unknown()).optional(),
})

export type Registry = z.infer<typeof RegistrySchema>

/**
 * Extended agent type with Forge-specific fields
 */
export interface Agent extends RegistryAgent {
  /** UI color for the agent */
  color?: string
}

/**
 * Cache metadata
 */
export interface CacheMetadata {
  fetchedAt: number
  version: string
}

export interface CacheData {
  metadata: CacheMetadata
  agents: RegistryAgent[]
}
