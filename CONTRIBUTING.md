# Contributing to Forge

We want to make it easy for you to contribute to Forge. Here are the most common type of changes that get merged:

- Bug fixes
- New ACP agent integrations
- Improvements to agent management
- Support for new ACP features
- Fixes for environment-specific quirks
- Missing standard behavior
- Documentation improvements

However, any UI or core product feature must go through a design review with the core team before implementation.

If you are unsure if a PR would be accepted, feel free to ask a maintainer or look for issues with any of the following labels:

- [`help wanted`](https://github.com/forge-agents/forge/issues?q=is%3Aissue%20state%3Aopen%20label%3Ahelp-wanted)
- [`good first issue`](https://github.com/forge-agents/forge/issues?q=is%3Aissue%20state%3Aopen%20label%3A%22good%20first%20issue%22)
- [`bug`](https://github.com/forge-agents/forge/issues?q=is%3Aissue%20state%3Aopen%20label%3Abug)
- [`perf`](https://github.com/forge-agents/forge/issues?q=is%3Aopen%20is%3Aissue%20label%3A%22perf%22)

> [!NOTE]
> PRs that ignore these guardrails will likely be closed.

Want to take on an issue? Leave a comment and a maintainer may assign it to you unless it is something we are already working on.

## Developing Forge

- Requirements: Bun 1.3.3+
- Install dependencies and start the dev server from the repo root:

  ```bash
  bun install
  bun run dev
  ```

- Core pieces:
  - `packages/forge`: Forge core business logic & TUI
  - `packages/forge/src/cli/cmd/tui/`: The TUI code, written in Solid.js with [OpenTUI](https://github.com/sst/opentui)
  - `packages/forge/src/acp/`: ACP client implementation
  - `packages/forge/src/acp/agents/`: Agent definitions (TOML files)

### Setting up a Debugger

Bun debugging is currently rough around the edges. We hope this guide helps you get set up and avoid some pain points.

The most reliable way to debug Forge is to run it manually in a terminal via `bun run --inspect=<url> dev ...` and attach
your debugger via that URL. Other methods can result in breakpoints being mapped incorrectly, at least in VSCode (YMMV).

Caveats:

- `*.tsx` files won't have their breakpoints correctly mapped. This seems due to Bun currently not supporting source maps on code transformed
  via `BunPlugin`s (currently necessary due to our dependency on `@opentui/solid`). Currently, the best you can do in terms of debugging `*.tsx`
  files is writing a `debugger;` statement. Debugging facilities like stepping won't work, but at least you will be informed if a specific code
  is triggered.
- If you want to run the Forge TUI and have breakpoints triggered in the server code, you might need to run `bun dev spawn` instead of
  the usual `bun dev`. This is because `bun dev` runs the server in a worker thread and breakpoints might not work there.

Other tips and tricks:

- You might want to use `--inspect-wait` or `--inspect-brk` instead of `--inspect`, depending on your workflow
- Specifying `--inspect=ws://localhost:6499/` on every invocation can be tiresome, you may want to `export BUN_OPTIONS=--inspect=ws://localhost:6499/` instead

#### VSCode Setup

If you use VSCode, you can use our example configurations [.vscode/settings.example.json](.vscode/settings.example.json) and [.vscode/launch.example.json](.vscode/launch.example.json).

Some debug methods that can be problematic:

- Debug configurations with `"request": "launch"` can have breakpoints incorrectly mapped and thus unusable
- The same problem arises when running Forge in the VSCode `JavaScript Debug Terminal`

With that said, you may want to try these methods, as they might work for you.

## Pull Request Expectations

- Try to keep pull requests small and focused.
- Link relevant issue(s) in the description
- Explain the issue and why your change fixes it
- Avoid having verbose LLM generated PR descriptions
- Before adding new functions or functionality, ensure that such behavior doesn't already exist elsewhere in the codebase.

### Style Preferences

These are not strictly enforced, they are just general guidelines:

- **Functions:** Keep logic within a single function unless breaking it out adds clear reuse or composition benefits.
- **Destructuring:** Do not do unnecessary destructuring of variables.
- **Control flow:** Avoid `else` statements.
- **Error handling:** Prefer `.catch(...)` instead of `try`/`catch` when possible.
- **Types:** Reach for precise types and avoid `any`.
- **Variables:** Stick to immutable patterns and avoid `let`.
- **Naming:** Choose concise single-word identifiers when they remain descriptive.
- **Runtime APIs:** Use Bun helpers such as `Bun.file()` when they fit the use case.

## Adding a New Agent

To add a new agent to Forge, create a TOML file in `packages/forge/src/acp/agents/` with the agent's configuration.

### TOML File Structure

Create a new file named `<agent-name>.toml` (use kebab-case, e.g., `my-agent.toml`) with the following structure:

```toml
# Required fields
name = "Agent Name"                    # Display name for the agent
description = "Brief description"       # Short description of the agent
command = "agent-command"              # Binary/command name to execute
args = ["--acp"]                       # Arguments to pass when starting the agent

# Optional fields
install_guide = "https://example.com"  # URL to installation documentation
color = "#da7756"                      # Hex color for UI elements (e.g., prompt border)
default = true                         # Whether this is the default agent (only one should be true)
install_method = "system"              # One of: "npx", "uvx", "system", "skip"
install_check = "which agent-command"  # Command to check if agent is installed (for system agents)

# Install commands (optional but recommended)
[[install_commands.unix]]
method = "npm"
command = "npm install -g @example/agent"
description = "Install via npm (global)"

[[install_commands.unix]]
method = "brew"
command = "brew install agent"
description = "Install via Homebrew"

[[install_commands.windows]]
method = "npm"
command = "npm install -g @example/agent"
description = "Install via npm (global)"

# Uninstall commands (optional)
[[uninstall_commands.unix]]
method = "npm"
command = "npm uninstall -g @example/agent"
description = "Uninstall via npm (global)"

[[uninstall_commands.windows]]
method = "npm"
command = "npm uninstall -g @example/agent"
description = "Uninstall via npm (global)"
```

### Field Descriptions

**Required Fields:**
- `name`: The display name shown in the agent list
- `description`: A brief description of what the agent does
- `command`: The binary/executable name (e.g., `claude-code-acp`, `gemini`)
- `args`: Array of arguments passed when starting the agent (usually `["--acp"]` or `["acp"]`)

**Optional Fields:**
- `install_guide`: URL to the agent's installation documentation
- `color`: Hex color code for UI theming (e.g., `"#da7756"`)
- `default`: Boolean indicating if this is the default agent (only one agent should have this set to `true`)
- `install_method`: How Forge should check if the agent is installed:
  - `"npx"`: Check via npx (for npm packages run with npx)
  - `"uvx"`: Check via uvx (for Python packages run with uvx)
  - `"system"`: Check using the `install_check` command
  - `"skip"`: Skip installation checking (for agents that aren't installable)
- `install_check`: Shell command to check if the agent is installed (only used when `install_method = "system"`)

**Install/Uninstall Commands:**
- `install_commands`: Array of installation methods for Unix (macOS/Linux) and Windows
- `uninstall_commands`: Array of uninstallation methods (optional)
- Each command has:
  - `method`: Installation method identifier (e.g., `"npm"`, `"brew"`, `"cargo"`, `"uv"`, `"curl"`, `"powershell"`)
  - `command`: The actual command to run
  - `description`: Human-readable description shown to users

### Examples

**Simple agent with npm installation:**
```toml
name = "My Agent"
description = "A simple agent example"
command = "my-agent"
args = ["--acp"]
install_guide = "https://github.com/example/my-agent"

[[install_commands.unix]]
method = "npm"
command = "npm install -g @example/my-agent"
description = "Install via npm (global)"

[[install_commands.windows]]
method = "npm"
command = "npm install -g @example/my-agent"
description = "Install via npm (global)"
```

**Agent with multiple installation methods:**
```toml
name = "Multi Install Agent"
description = "Agent with multiple install options"
command = "multi-agent"
args = ["acp"]
install_guide = "https://example.com/agent"

[[install_commands.unix]]
method = "brew"
command = "brew install multi-agent"
description = "Install via Homebrew"

[[install_commands.unix]]
method = "npm"
command = "npm install -g @example/multi-agent"
description = "Install via npm (global)"

[[install_commands.windows]]
method = "npm"
command = "npm install -g @example/multi-agent"
description = "Install via npm (global)"
```

**Agent that skips installation checking:**
```toml
name = "Uninstallable Agent"
description = "Agent that can't be checked for installation"
install_method = "skip"
command = "uninstallable-agent"
args = ["--acp"]
install_guide = "https://example.com/agent"
```

After adding the TOML file, the agent will automatically appear in `forge agents` and be available for use. Agents are loaded at runtime, so no rebuild is required.

## Feature Requests

For net-new functionality, start with a design conversation. Open an issue describing the problem, your proposed approach (optional), and why it belongs in Forge. The core team will help decide whether it should move forward; please wait for that approval instead of opening a feature PR directly.
