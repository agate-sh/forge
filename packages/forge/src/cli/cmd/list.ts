import type { Argv } from "yargs"
import { cmd } from "./cmd"
import { getAllAgentsAsync } from "../../acp/agents"
import { EOL } from "os"

export const ListCommand = cmd({
  command: "agents",
  describe: "list all available agents",
  builder: (yargs: Argv) => {
    return yargs
  },
  handler: async (argv) => {
    const agents = await getAllAgentsAsync()

    // List all agents
    for (const agent of agents) {
      process.stdout.write(agent.name)
      process.stdout.write(EOL)
    }
  },
})
