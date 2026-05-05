# TrackingTime MCP Server

The official Model Context Protocol (MCP) server for [TrackingTime](https://trackingtime.co), the time tracking software built for agencies, consultancies, and professional services teams.

Connect any MCP-compatible AI assistant—including Claude Desktop, Claude Code, Cursor, Windsurf, VS Code Copilot, and ChatGPT—to your TrackingTime workspace to query your time tracking data in natural language.

## 🚀 Features

- **Query time entries**: Ask about logged hours by user, project, task, or date range.
- **Retrieve projects and tasks**: List active projects, explore task structures, and check project status.
- **Look up customers**: Query customer records linked to your projects and time data.
- **Get user and team data**: Identify team members and their workspace roles.
- **Run productivity queries**: Ask about billable hours, time worked per person, or team workload.

### Example Prompts

- *"How many hours did the team log last week?"*
- *"Show me all open tasks in the Website Redesign project."*
- *"What's the total billable time logged for Acme Corp this month?"*
- *"List all active projects and their assigned users."*

## 🔌 Client Configuration

This is a remote, read-only server. No local installation is required. You can connect your client using the following configurations (requires your TrackingTime API key).

### For clients using mcp-remote:

```json
{
  "mcpServers": {
    "trackingtime": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://mcp.trackingtime.co/mcp"]
    }
  }
}
```

## 📡 Endpoints
The server exposes the following endpoints for different transport and monitoring needs:

- POST /mcp: JSON-RPC (streamable-http)
- GET /health: Healthcheck


## 🛠 Technical Details

Auth: Basic Auth (App Password)

Maintained by: The TrackingTime team

Support: support@trackingtime.co

Website: [TrackingTime](https://trackingtime.co)