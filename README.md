# TrackingTime MCP Server - Time Tracking for AI Agents

The official Model Context Protocol (MCP) server for [TrackingTime](https://trackingtime.co/), the time tracking software that runs as the operational back office for agencies, professional services, and every company that sells hours.

Connect Claude, ChatGPT, Gemini, Cursor, VS Code, Windsurf, or any MCP-compatible client to your TrackingTime workspace. Log hours, start and stop timers, check timesheets, approve time off, and send invoices — in plain language, from the assistant you already use.

- **Remote server, nothing to install:** `https://mcp.trackingtime.co/mcp`
- **Transport:** Streamable HTTP
- **Auth:** OAuth 2.1 — sign in with your TrackingTime account. An App Password via the `X-API-Key` header is also supported for clients without OAuth.
- **Plans:** available on every TrackingTime plan, including the Free Plan.
- **Docs:** [TrackingTime MCP Server for AI assistants](https://support.trackingtime.co/en/articles/13738626-trackingtime-mcp-server-for-ai-assistants)

## What is the TrackingTime MCP server?

The TrackingTime MCP server lets AI assistants and custom AI agents read and write your TrackingTime data. It exposes time tracking, projects, tasks, customers, timesheets, Time Cards, time off, expenses, retainers, and invoicing through the open Model Context Protocol. Every action runs with the permissions of the signed-in user, so the assistant only sees and changes what that person can see and change in TrackingTime.

## Features

### Time tracking
- Start and stop timers on any task.
- Log manual time entries, one at a time or in batch.
- Edit, move, or delete time entries, and restore deleted ones.
- Add notes and custom field values to entries.
- Create repeating time entries.
- Mark entries as billed or not billed, and lock a user's entries for a period.

### Timesheets and reporting
- Query hours by user, project, task, customer, or date range.
- Split billable and non-billable time.
- Get totals and statistics for any filter.
- Run advanced searches across projects, tasks, and entries.

### Projects, tasks, and customers
- Create, update, duplicate, archive, and restore projects.
- Create and update tasks, subtasks, and task lists; assign people, estimates, and due dates.
- Add and read task comments, and review task history.
- Filter and search projects, and follow or unfollow them.
- Create and manage customers.
- Create and manage custom fields and their options.

### Team and users
- List users, user groups, and project members.
- Invite users and update roles and permissions.
- Manage work schedules and assign people to them.
- Set billing rates and costs per user.

### Time Cards and attendance
- Generate and read Time Cards.
- Review and save Time Card days.

### Time off and holidays
- Request, update, and cancel time off.
- Check time-off balances and calculate request amounts.
- Manage time-off policies, policy rules, and assigned users.
- Add balance adjustments and review time-off logs.
- Create and manage public holidays.

### Retainers, expenses, and invoicing
- Check retainer balance and the current retainer cycle; update cycles.
- Log, update, and delete expenses by category.
- Create invoices, add line items, export, and send them.
- Mark invoices as paid or void.

Feature availability follows your TrackingTime plan and user role. For example, Time Cards, time off, invoicing, expenses, and retainers require the Pro Plan or higher, and time-off accrual requires the Business Plan.

## Example prompts

- "How many hours did the team log last week, by project?"
- "Start a timer on the Homepage redesign task."
- "Log 2 hours yesterday on Acme Corp › Monthly retainer."
- "Which tasks in Website Redesign are over their estimate?"
- "What's the billable time for Acme Corp this month?"
- "How much is left on the Acme retainer this cycle?"
- "Who is off next week?"
- "How many vacation days does Laura have left?"
- "Create an invoice for Acme Corp with last month's unbilled hours."
- "Add a subtask 'Review copy' to the Landing page task and assign it to me."

## Connect your client

**Claude (claude.ai, Claude Desktop, Claude Code)** — add a custom connector with the URL `https://mcp.trackingtime.co/mcp` and sign in with TrackingTime.

**ChatGPT** — add TrackingTime as a connector using the same URL and sign in with TrackingTime.

**Other clients with remote MCP support** — add a custom connector with this URL and sign in with TrackingTime when prompted:

```
https://mcp.trackingtime.co/mcp
```

**Cursor** — add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "trackingtime": {
      "url": "https://mcp.trackingtime.co/mcp"
    }
  }
}
```

**VS Code** — add to `.vscode/mcp.json`:

```json
{
  "servers": {
    "trackingtime": {
      "type": "http",
      "url": "https://mcp.trackingtime.co/mcp"
    }
  }
}
```

**Windsurf** — add to `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "trackingtime": {
      "serverUrl": "https://mcp.trackingtime.co/mcp"
    }
  }
}
```

**Clients that need a local bridge (mcp-remote)** — for clients that only support local (stdio) servers:

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

**Clients without OAuth (App Password)** — create an App Password in TrackingTime and send it in the `X-API-Key` header. For example, with `mcp-remote`:

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

## FAQ

**Is the TrackingTime MCP server free?**
Yes. It is available on every plan, including the Free Plan for unlimited users. The tools you can use depend on the features in your plan.

**Do I need to install anything?**
No. It is a remote server. Add the URL to your MCP client and sign in.

**Which AI assistants work with TrackingTime?**
Any MCP-compatible client, including Claude, ChatGPT, Gemini, Cursor, VS Code, and Windsurf. You can also build your own AI agents on top of it.

**Can the assistant see data I don't have access to?**
No. Every action runs with the signed-in user's TrackingTime permissions.

**Does TrackingTime monitor my screen or keystrokes?**
No. TrackingTime does not take screenshots, log keystrokes, or track GPS. No surveillance.

**Can I log time with Claude or ChatGPT?**
Yes. Ask the assistant to start a timer, stop it, or log hours on a project or task, and the entry lands in your TrackingTime timesheet.

**Can I manage time off and invoices from an AI assistant?**
Yes, on plans that include those features. You can request time off, check balances, create invoices, and mark them as paid.

## About TrackingTime

TrackingTime is the time tracking software that runs as the operational back office for agencies, professional services, and every company that sells hours. It is built first for creative, digital, and marketing agencies, and for consultancies and professional firms — legal, accounting, software, and architecture.

The same time record drives the rest of the operation. Projects, timesheets, approvals, retainers, expenses, invoicing, time off, Time Cards, payroll, and client reporting all run from one workspace. Teams spend less time chasing hours and rebuilding reports, and more time on client work.

### What makes TrackingTime different

- **Real retainers — No workarounds.** Pace tracking, rollover, burn alerts, and rates by person or task.
- **Time off with configurable policies — No workarounds.** Multi-country rules, accrual, unlimited leave types, and approval workflows.
- **No surveillance.** No screenshots, no keystroke logging, no GPS.
- **No pricing puzzles.** One plan per stage. No surprises at renewal.

### Where your team tracks time

- Web app, AutoTrack desktop apps for Mac and Windows, and mobile apps for iOS and Android.
- Browser extensions for Chrome, Firefox, Safari, and Edge that add the timer to 50+ tools — Asana, Jira, ClickUp, Trello, GitHub, Notion, Gmail, and more.
- Microsoft 365: Teams, Planner, Outlook, Azure DevOps, Excel, Word, PowerPoint, and Power BI.
- Open API, Zapier, Make, n8n, and this MCP server for AI assistants and custom AI agents.

Trusted by 15,000+ teams. Rated 4.7/5 on G2 from 117 verified reviews.

- Website: [trackingtime.co](https://trackingtime.co/)
- Integrations: [trackingtime.co/integrations](https://trackingtime.co/integrations)
- Support: [support.trackingtime.co](https://support.trackingtime.co/) · support@trackingtime.co
- MCP Registry: `io.github.TrackingTime/mcp-server`

Maintained by the TrackingTime team.

**Keywords:** time tracking MCP, timesheet MCP server, time tracker for Claude, time tracking for ChatGPT, MCP server for agencies, time off MCP, invoicing MCP, Model Context Protocol time tracking.
