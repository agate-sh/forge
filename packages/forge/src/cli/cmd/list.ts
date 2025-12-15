import type { Argv } from "yargs"
import { cmd } from "./cmd"
import { getAllAgents } from "../../acp/agents"
import { EOL } from "os"

export const ListCommand = cmd({
  command: "agents",
  describe: "list all available agents",
  builder: (yargs: Argv) => {
    return yargs.option("check", {
      alias: "c",
      type: "boolean",
      describe: "check which agents are installed on the system",
      default: false,
    })
  },
  handler: async (argv) => {
    const agents = getAllAgents()

    // List all agents
    for (const agent of agents) {
      process.stdout.write(agent.name)
      process.stdout.write(EOL)
    } else {
      // Simple list mode (original behavior)
      for (const agent of agents) {
        process.stdout.write(agent.name)
        process.stdout.write(EOL)
      }
    }
  },
})
