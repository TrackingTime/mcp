# TrackingTime MCP Server

The official Model Context Protocol (MCP) server for [TrackingTime](https://trackingtime.co), the time tracking software built for agencies, consultancies, and professional services teams.

Connect Claude, ChatGPT, Cursor, VS Code, Windsurf or any MCP-compatible client to your TrackingTime workspace. Ask about your hours, start and stop timers, log time, and manage projects, tasks and customers in natural language.

- **Remote server, nothing to install:** `https://mcp.trackingtime.co/mcp`
- **Transport:** Streamable HTTP
- **Auth:** OAuth 2.1 (sign in with your TrackingTime account). An App Password via the `X-API-Key` header is also supported for clients without OAuth.

## Features

- **Track time:** start and stop timers, log manual time entries, and edit or delete entries.
- **Report on hours:** query time by user, project, task, customer or date range, including billable vs. non-billable time.
- **Manage projects and tasks:** create, update, archive and assign projects and tasks; add task comments.
- **Customers and services:** look up and manage the customers and services linked to your work.
- **Team data:** list users, groups and schedules, and see who is tracking what.
- **Back office:** timecards, time off, expenses, invoices and saved reports, depending on your plan and permissions.

Every action runs with the permissions of the signed-in TrackingTime user.

### Example prompts

- *"How many hours did the team log last week, by project?"*
- *"Start a timer on the Homepage redesign task."*
- *"Log 2 hours yesterday on Acme Corp > Monthly retainer."*
- *"Which tasks in Website Redesign are over their estimate?"*
- *"What's the billable time for Acme Corp this month?"*

## Connect

### Claude, ChatGPT and other clients with remote MCP support

Add a custom connector with this URL and sign in with TrackingTime when prompted:

```
https://mcp.trackingtime.co/mcp
```

### Clients that need a local bridge (mcp-remote)

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

### Using an App Password instead of OAuth

```json
{
  "mcpServers": {
    "trackingtime": {
      "command": "npx",
      "args": [
        "-y", "mcp-remote", "https://mcp.trackingtime.co/mcp",
        "--header", "X-API-Key:${TRACKINGTIME_APP_PASSWORD}"
      ],
      "env": { "TRACKINGTIME_APP_PASSWORD": "<your app password>" }
    }
  }
}
```

## Endpoints

- `POST /mcp`: MCP over Streamable HTTP
- `GET /health`: health check
- `/.well-known/oauth-authorization-server` and `/.well-known/oauth-protected-resource/mcp`: OAuth discovery

The legacy SSE endpoint (`/sse`) has been retired.

## Links

- Website: [trackingtime.co](https://trackingtime.co)
- MCP Registry: `io.github.TrackingTime/mcp-server`
- Support: support@trackingtime.co

Maintained by the TrackingTime team.