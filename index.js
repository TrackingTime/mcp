import cors from "cors";
import * as z from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

/* ==========================
   CONFIG
========================== */
const TT_API_BASE = "https://api.trackingtime.co/api/v4";
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const SERVER_INFO = { name: "trackingtime-v4-mcp", version: "2.0.0" };

/* ==========================
   HELPERS
========================== */
function maskSecret(value) {
  if (typeof value !== "string") return value;
  if (value.length <= 8) return "***";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function sanitizeHeaders(headers = {}) {
  const secretHeaders = new Set(["authorization", "proxy-authorization", "x-api-key", "api-key", "cookie"]);
  const sanitized = {};
  for (const [key, value] of Object.entries(headers)) {
    sanitized[key] = secretHeaders.has(key.toLowerCase()) ? maskSecret(String(value)) : value;
  }
  return sanitized;
}

function getHeaderValue(headers = {}, headerName) {
  const target = headerName.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== target) continue;
    if (Array.isArray(value)) return value.find((item) => typeof item === "string" && item.trim()) ?? null;
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function extractTokenFromAuthorizationHeader(authorizationHeader) {
  if (typeof authorizationHeader !== "string" || !authorizationHeader.trim()) return null;
  const auth = authorizationHeader.trim();
  const spaceIndex = auth.indexOf(" ");
  if (spaceIndex <= 0) return auth;

  const scheme = auth.slice(0, spaceIndex).toLowerCase();
  const credentials = auth.slice(spaceIndex + 1).trim();
  if (!credentials) return null;

  if (scheme === "bearer") return credentials;

  if (scheme === "basic") {
    try {
      const decoded = Buffer.from(credentials, "base64").toString("utf8");
      const colonIndex = decoded.indexOf(":");
      if (colonIndex >= 0) return decoded.slice(colonIndex + 1);
      return decoded;
    } catch {
      return null;
    }
  }

  return credentials;
}

function resolveCredentialFromArgsOrHeaders(args = {}, headers = {}) {
  if (typeof args.app_password === "string" && args.app_password.trim()) {
    return { token: args.app_password.trim(), source: "args.app_password" };
  }
  if (typeof args.api_token === "string" && args.api_token.trim()) {
    return { token: args.api_token.trim(), source: "args.api_token" };
  }

  const authHeaderToken = extractTokenFromAuthorizationHeader(getHeaderValue(headers, "authorization"));
  if (authHeaderToken) {
    return { token: authHeaderToken, source: "headers.authorization" };
  }

  const xApiKey = getHeaderValue(headers, "x-api-key");
  if (xApiKey) {
    return { token: xApiKey, source: "headers.x-api-key" };
  }

  const apiKey = getHeaderValue(headers, "api-key");
  if (apiKey) {
    return { token: apiKey, source: "headers.api-key" };
  }

  return { token: null, source: null };
}

async function ttRequest(method, endpoint, auth, payload = {}) {
  const appPassword = auth.app_password ?? auth.api_token;
  const account_id = auth.account_id;
  const apiBase = auth.api_base ?? TT_API_BASE;
  if (!appPassword) {
    return { isError: true, content: [{ type: "text", text: "Missing credentials: provide app_password or api_token" }] };
  }

  const token = Buffer.from(`API_TOKEN:${appPassword}`).toString("base64");
  const globalEndpoints = ["/me"];
  let url = globalEndpoints.includes(endpoint) ? `${apiBase}${endpoint}` : `${apiBase}/${account_id}${endpoint}`;

  const options = {
    method,
    headers: {
      Authorization: `Basic ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "TrackingTime-MCP/2.0"
    }
  };

  if (method === "GET" && Object.keys(payload).length > 0) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(payload)) {
      if (v != null) params.append(k, v.toString());
    }
    url += `?${params.toString()}`;
  } else if (method !== "GET") {
    options.body = JSON.stringify(payload);
  }

  try {
    const response = await fetch(url, options);
    const body = await response.json();
    if (body.response?.status && body.response?.status !== 200) {
      return { isError: true, content: [{ type: "text", text: `API Error: ${body.response.message}` }] };
    }
    return { content: [{ type: "text", text: JSON.stringify(body.data ?? body) }] };
  } catch (err) {
    return { isError: true, content: [{ type: "text", text: `Network error: ${err.message}` }] };
  }
}

async function ttRequestDetailed(method, endpoint, auth, payload = {}) {
  const appPassword = auth.app_password ?? auth.api_token;
  const account_id = auth.account_id;
  const apiBase = auth.api_base ?? TT_API_BASE;
  if (!appPassword) {
    return { isError: true, error: "Missing credentials: provide app_password or api_token" };
  }

  const token = Buffer.from(`API_TOKEN:${appPassword}`).toString("base64");
  const globalEndpoints = ["/me"];
  let url = globalEndpoints.includes(endpoint) ? `${apiBase}${endpoint}` : `${apiBase}/${account_id}${endpoint}`;

  const options = {
    method,
    headers: {
      Authorization: `Basic ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "TrackingTime-MCP/2.0"
    }
  };

  if (method === "GET" && Object.keys(payload).length > 0) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(payload)) {
      if (v != null) params.append(k, v.toString());
    }
    url += `?${params.toString()}`;
  } else if (method !== "GET") {
    options.body = JSON.stringify(payload);
  }

  try {
    const response = await fetch(url, options);
    const rawText = await response.text();
    let body;
    try {
      body = rawText ? JSON.parse(rawText) : null;
    } catch (parseErr) {
      return {
        isError: true,
        error: `Invalid JSON response: ${parseErr.message}`,
        status: response.status,
        url,
        rawText
      };
    }
    return {
      status: response.status,
      url,
      body
    };
  } catch (err) {
    return { isError: true, error: `Network error: ${err.message}` };
  }
}

async function ttRequestForm(endpoint, auth, payload = {}) {
  const appPassword = auth.app_password ?? auth.api_token;
  const account_id = auth.account_id;
  const apiBase = auth.api_base ?? TT_API_BASE;
  if (!appPassword) {
    return { isError: true, content: [{ type: "text", text: "Missing credentials: provide app_password or api_token" }] };
  }

  const token = Buffer.from(`API_TOKEN:${appPassword}`).toString("base64");
  const url = `${apiBase}/${account_id}${endpoint}`;
  const form = new URLSearchParams();

  for (const [key, rawValue] of Object.entries(payload)) {
    if (rawValue === undefined || rawValue === null) continue;
    let value = rawValue;
    if ((key === "users" || key === "custom_fields") && typeof value === "object") {
      value = JSON.stringify(value);
    }
    form.append(key, String(value));
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${token}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "TrackingTime-MCP/2.0"
      },
      body: form.toString()
    });
    const body = await response.json();
    if (body.response?.status && body.response?.status !== 200) {
      return { isError: true, content: [{ type: "text", text: `API Error: ${body.response.message}` }] };
    }
    return { content: [{ type: "text", text: JSON.stringify(body.data ?? body) }] };
  } catch (err) {
    return { isError: true, content: [{ type: "text", text: `Network error: ${err.message}` }] };
  }
}

async function getContext(auth) {
  const res = await ttRequest("GET", "/me", { ...auth, account_id: 0 });
  if (res.isError) throw new Error(res.content[0].text);
  const data = JSON.parse(res.content[0].text);
  return { account_id: data.account_id, user_id: data.id };
}

async function getCallerContext(auth) {
  const res = await ttRequest("GET", "/me", { ...auth, account_id: 0 });
  if (res.isError) throw new Error(res.content[0].text);

  const data = JSON.parse(res.content[0].text);
  const fullName = [data.first_name, data.last_name].filter(Boolean).join(" ").trim();

  return {
    user_id: data.id ?? null,
    account_id: data.account_id ?? null,
    full_name: fullName || null,
    email: data.email ?? null,
    locale: data.locale ?? null,
    timezone: data.timezone ?? null,
    teams: Array.isArray(data.teams)
      ? data.teams.map((team) => ({
          account_id: team?.account_id ?? null,
          company: team?.company ?? null,
          role: team?.role ?? null,
          is_selected: Boolean(team?.is_selected),
          is_default: Boolean(team?.is_default)
        }))
      : []
  };
}

/* ==========================
   EXECUTION LOGIC
========================== */
async function executeToolCall(name, args) {
  const { app_password, api_token, account_id, ...params } = args;
  const auth = { app_password, api_token };

  let callerContext = null;
  if (app_password || api_token) {
    try {
      callerContext = await getCallerContext(auth);
    } catch (err) {
      console.error("Error resolving caller context:", err);
    }
  }

  const teams = Array.isArray(callerContext?.teams) ? callerContext.teams : [];
  const hasMultipleWorkspaces = teams.length > 1;
  const workspaceSelectionExemptTools = new Set(["get_me", "list_workspaces"]);
  if (!account_id && hasMultipleWorkspaces && !workspaceSelectionExemptTools.has(name)) {
    const options = teams
      .map((t) => `- account_id=${t.account_id} (${t.company ?? "Unknown"})${t.is_selected ? " [selected]" : ""}`)
      .join("\n");
    return {
      isError: true,
      content: [
        {
          type: "text",
          text:
            "Multiple workspaces were detected for this user. Please choose one and call again with account_id.\n" +
            "Available workspaces:\n" +
            options +
            "\nTip: call list_workspaces to inspect workspace options."
        }
      ]
    };
  }

  let accId = account_id ?? callerContext?.account_id;
  let result;

  switch (name) {
    case "get_me":
      result = await ttRequest("GET", "/me", { ...auth, account_id: 0 });
      break;

    case "list_workspaces":
      result = {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                selected_account_id: callerContext?.account_id ?? null,
                workspaces: teams
              },
              null,
              2
            )
          }
        ]
      };
      break;

    case "get_event":
      result = await ttRequest("GET", `/events/${params.event_id}`, { ...auth, account_id: accId });
      break;

    case "list_events":
      if (typeof params.filter === "string") {
        params.filter = params.filter.toUpperCase();
      }
      if (params.global_company === true) {
        params.filter = "COMPANY";
      }
      delete params.global_company;
      if (params.filter === "COMPANY") {
        delete params.id;
      }
      if ((!params.filter || params.filter === "USER") && !params.id) {
        if (callerContext?.user_id) {
          params.id = callerContext.user_id;
        } else if (app_password || api_token) {
          try {
            const context = await getContext(auth);
            params.id = context.user_id;
            accId = accId ?? context.account_id;
          } catch (err) {
            console.error("Error resolving user context for events_list:", err);
          }
        }
        params.filter = "USER";
      }
      result = await ttRequest("GET", "/events", { ...auth, account_id: accId }, params);
      break;

    case "list_company_events":
      {
        const companyParams = { ...params, filter: "COMPANY" };
        delete companyParams.id;
        result = await ttRequest("GET", "/events", { ...auth, account_id: accId }, companyParams);
      }
      break;

    case "list_users":
      result = await ttRequest("GET", "/users", { ...auth, account_id: accId }, params);
      break;

    case "get_user":
      {
        const { user_id, ...query } = params;
        result = await ttRequest("GET", `/users/${user_id}`, { ...auth, account_id: accId }, query);
      }
      break;

    case "list_user_tasks":
      {
        const { user_id, ...query } = params;
        if (query.filter === undefined || query.filter === null || query.filter === "") {
          delete query.filter;
        }
        console.log("list_user_tasks request:", {
          account_id: accId,
          user_id,
          query,
          endpoint: `/users/${user_id}/assigned_tasks`
        });
        result = await ttRequest("GET", `/users/${user_id}/assigned_tasks`, { ...auth, account_id: accId }, query);
        console.log("list_user_tasks response:", {
          is_error: Boolean(result?.isError),
          preview: result?.content?.[0]?.text?.slice(0, 500)
        });
      }
      break;

    case "list_user_projects":
      {
        const { user_id, ...query } = params;
        result = await ttRequest("GET", `/users/${user_id}/projects`, { ...auth, account_id: accId }, query);
      }
      break;

    case "list_user_trackables":
      {
        const { user_id, ...query } = params;
        result = await ttRequest("GET", `/users/${user_id}/trackables`, { ...auth, account_id: accId }, query);
      }
      break;

    case "list_projects":
      result = await ttRequest("GET", "/projects", { ...auth, account_id: accId }, params);
      break;

    case "list_tasks":
      result = await ttRequest("GET", "/tasks", { ...auth, account_id: accId }, params);
      break;

    case "create_task":
      result = await ttRequestForm("/tasks/add", { ...auth, account_id: accId }, params);
      break;

    case "get_task":
      {
        const { task_id, ...query } = params;
        if (query.include_custom_fields === undefined) {
          query.include_custom_fields = true;
        }
        const detailed = await ttRequestDetailed("GET", `/tasks/${task_id}`, { ...auth, account_id: accId }, query);
        console.log("get_task request:", {
          account_id: accId,
          task_id,
          query,
          endpoint: `/tasks/${task_id}`
        });
        console.log("get_task response:", {
          is_error: Boolean(detailed?.isError),
          status: detailed?.status,
          body_keys: detailed?.body && typeof detailed.body === "object" ? Object.keys(detailed.body) : null,
          data_keys:
            detailed?.body?.data && typeof detailed.body.data === "object" && !Array.isArray(detailed.body.data)
              ? Object.keys(detailed.body.data)
              : null,
          preview: detailed?.body ? JSON.stringify(detailed.body).slice(0, 1000) : detailed?.rawText?.slice(0, 1000)
        });
        if (detailed?.isError) {
          result = { isError: true, content: [{ type: "text", text: detailed.error }] };
        } else if (detailed?.body?.response?.status && detailed.body.response.status !== 200) {
          result = {
            isError: true,
            content: [{ type: "text", text: `API Error: ${detailed.body.response.message}` }]
          };
        } else {
          const body = detailed.body ?? {};
          const mergedTask = body.data && typeof body.data === "object"
            ? {
                ...body.data,
                set_custom_fields: body.set_custom_fields ?? [],
                available_custom_fields: body.available_custom_fields ?? [],
                users_summary: body.users ?? null
              }
            : body;
          result = { content: [{ type: "text", text: JSON.stringify(mergedTask) }] };
        }
      }
      break;

    case "update_task":
      {
        const { task_id, ...query } = params;
        result = await ttRequest("GET", `/tasks/update/${task_id}`, { ...auth, account_id: accId }, query);
      }
      break;

    case "create_customer":
      result = await ttRequestForm("/customers/add", { ...auth, account_id: accId }, params);
      break;

    case "update_customer":
      {
        const { customer_id, ...payload } = params;
        result = await ttRequestForm(`/customers/update/${customer_id}`, { ...auth, account_id: accId }, payload);
      }
      break;

    case "create_project":
      result = await ttRequestForm("/projects/add", { ...auth, account_id: accId }, params);
      break;

    case "update_project":
      {
        const { project_id, ...query } = params;
        result = await ttRequest("GET", `/projects/update/${project_id}`, { ...auth, account_id: accId }, query);
      }
      break;

    case "create_event":
      result = await ttRequestForm("/events/add", { ...auth, account_id: accId }, params);
      break;

    case "update_event":
      {
        const { event_id, ...query } = params;
        result = await ttRequest("GET", `/events/update/${event_id}`, { ...auth, account_id: accId }, query);
      }
      break;

    case "track_task":
      result = await ttRequest("GET", "/tasks/track", { ...auth, account_id: accId }, params);
      break;

    case "stop_task":
      {
        const { task_id, ...query } = params;
        result = await ttRequest("GET", `/tasks/stop/${task_id}`, { ...auth, account_id: accId }, query);
      }
      break;

    case "create_custom_field":
      result = await ttRequestForm("/custom_fields/add", { ...auth, account_id: accId }, params);
      break;

    case "create_enum_option":
      result = await ttRequestForm("/enum_options/add", { ...auth, account_id: accId }, params);
      break;

    case "list_customers":
      result = await ttRequest("GET", "/customers", { ...auth, account_id: accId }, params);
      break;

    default:
      result = { isError: true, content: [{ type: "text", text: `Unknown tool: ${name}` }] };
      break;
  }

  return result;
}

/* ==========================
   MCP SERVER FACTORY
========================== */
const authSchemaFields = {
  app_password: z.string().optional().describe("TrackingTime app password"),
  api_token: z.string().optional().describe("Alias of app_password")
};

const accountSchemaFields = {
  account_id: z.number().optional().describe("TrackingTime workspace/account ID. Required when the user belongs to multiple workspaces.")
};

function createServer() {
  const server = new McpServer(SERVER_INFO, { capabilities: { logging: {} } });

  const registerTool = (name, description, inputSchema) => {
    server.registerTool(name, { description, inputSchema }, async (args, extra) => {
      const requestHeaders = extra?.requestInfo?.headers ?? {};
      const credential = resolveCredentialFromArgsOrHeaders(args, requestHeaders);
      const toolArgs = { ...args };

      if (!toolArgs.app_password && !toolArgs.api_token && credential.token) {
        toolArgs.app_password = credential.token;
      }

      console.log("tools/call payload:", {
        tool: name,
        args_keys: Object.keys(toolArgs),
        credential_source: credential.source,
        has_app_password: typeof toolArgs.app_password === "string" && toolArgs.app_password.length > 0,
        has_api_token: typeof toolArgs.api_token === "string" && toolArgs.api_token.length > 0,
        app_password_preview: toolArgs.app_password ? maskSecret(toolArgs.app_password) : undefined,
        api_token_preview: toolArgs.api_token ? maskSecret(toolArgs.api_token) : undefined
      });

      return executeToolCall(name, toolArgs);
    });
  };

  registerTool(
    "get_me",
    "Returns the authenticated user's profile from /me (user_id, account_id and identity fields). Use this first to discover account context before calling list/get tools. Limitations: read-only; requires valid credentials via app_password/api_token or X-API-Key; does not return full account-wide analytics.",
    z.object({
      ...authSchemaFields
    }).passthrough()
  );

  registerTool(
    "list_workspaces",
    "Lists available workspaces/accounts for the authenticated user, including account_id and selected workspace flag. Use this when multiple workspaces exist and you need to choose account_id before other tools.",
    z.object({
      ...authSchemaFields
    }).passthrough()
  );

  registerTool(
    "list_events",
    "Lists time events from /events for a date range. Supports filters by USER, PROJECT, CUSTOMER, TASK, or COMPANY, plus pagination and sort order. If filter/id are missing, it defaults to USER and auto-resolves the caller user_id. For global account-level events, set filter=COMPANY (or use list_company_events). Limitations: from and to are required; results are paginated; only returns data accessible to the authenticated account.",
    z.object({
      ...authSchemaFields,
      ...accountSchemaFields,
      filter: z.enum(["USER", "PROJECT", "CUSTOMER", "TASK", "COMPANY"]).optional(),
      global_company: z.boolean().optional(),
      id: z.number().optional(),
      from: z.string(),
      to: z.string(),
      page: z.number().optional(),
      page_size: z.number().optional(),
      order: z.enum(["asc", "desc"]).optional(),
      include_custom_fields: z.boolean().optional()
    }).passthrough()
  );

  registerTool(
    "list_company_events",
    "Lists company-level events from /events using filter=COMPANY. Use this for global metrics (for example, total hours by user in a period) without iterating user-by-user. Requires from/to and does not require id.",
    z.object({
      ...authSchemaFields,
      ...accountSchemaFields,
      from: z.string(),
      to: z.string(),
      page: z.number().optional(),
      page_size: z.number().optional(),
      order: z.enum(["asc", "desc"]).optional(),
      include_custom_fields: z.boolean().optional()
    }).passthrough()
  );

  registerTool(
    "get_event",
    "Fetches one time event by event_id from /events/{id}. Use when you already have an event identifier and need full event detail. Limitations: requires a valid event_id in the same accessible account context; read-only.",
    z.object({
      ...authSchemaFields,
      ...accountSchemaFields,
      event_id: z.number()
    }).passthrough()
  );

  registerTool(
    "list_users",
    "Lists account users from /users. Supports filters and optional billing/team/employee expansion. Use this to discover users before calling user-specific tools. Limitations: read-only; visibility depends on role permissions (typically admin/project manager for full account listing).",
    z.object({
      ...authSchemaFields,
      ...accountSchemaFields,
      filter: z.enum(["ALL", "ACTIVE", "ARCHIVED"]).optional(),
      include_billing: z.boolean().optional(),
      include_custom_fields: z.boolean().optional()
    }).passthrough()
  );

  registerTool(
    "get_user",
    "Gets a single user from /users/:id. Use when you already have a user id and need detailed profile data. Limitations: read-only; access to other users depends on role permissions.",
    z.object({
      ...authSchemaFields,
      ...accountSchemaFields,
      user_id: z.number(),
      include_custom_fields: z.boolean().optional()
    }).passthrough()
  );

  registerTool(
    "list_user_tasks",
    "Lists tasks assigned to a user from /users/:id/assigned_tasks, grouped by project. By default (without filter) this endpoint returns the user's active assigned tasks. Use filter only when you explicitly need another subset (ALL, ARCHIVED, TRACKING). If filter is not provided, it is not sent to the API. Limitations: read-only; visibility depends on account permissions.",
    z.object({
      ...authSchemaFields,
      ...accountSchemaFields,
      user_id: z.number(),
      filter: z.enum(["ALL", "ACTIVE", "ARCHIVED", "TRACKING"]).optional(),
      page: z.number().optional(),
      page_size: z.number().optional(),
      sort_by: z.enum(["id", "name", "priority", "project", "customer", "due_date", "closed_date"]).optional(),
      order: z.enum(["ASC", "DESC", "asc", "desc"]).optional(),
      include_billing: z.boolean().optional()
    }).passthrough()
  );

  registerTool(
    "list_user_projects",
    "Lists projects assigned to a user from /users/:user_id/projects. Use to scope project context for a specific person. Limitations: read-only; returns only projects visible in the authenticated account context.",
    z.object({
      ...authSchemaFields,
      ...accountSchemaFields,
      user_id: z.number()
    }).passthrough()
  );

  registerTool(
    "list_user_trackables",
    "Lists user trackables from /users/:id/trackables (projects and tasks grouped by project). Supports favorite-only mode and project/task filtering options. Limitations: read-only; payload size can grow on large accounts.",
    z.object({
      ...authSchemaFields,
      ...accountSchemaFields,
      user_id: z.number(),
      only_favorites: z.boolean().optional(),
      include_tasks: z.boolean().optional(),
      project_id: z.number().optional()
    }).passthrough()
  );

  registerTool(
    "list_projects",
    "Lists projects from /projects with optional status filter (ALL, ACTIVE, ARCHIVED). Use for project discovery before task/event queries. Limitations: read-only listing; filter values are restricted to ALL/ACTIVE/ARCHIVED.",
    z.object({
      ...authSchemaFields,
      ...accountSchemaFields,
      filter: z.enum(["ALL", "ACTIVE", "ARCHIVED"]).optional()
    }).passthrough()
  );

  registerTool(
    "list_tasks",
    "Lists tasks from /tasks, optionally scoped by project_id and status filter (ALL, ACTIVE, ARCHIVED). Use after selecting a project to narrow task context. Limitations: read-only; project_id must exist in the same account context when provided.",
    z.object({
      ...authSchemaFields,
      ...accountSchemaFields,
      project_id: z.number().optional(),
      filter: z.enum(["ALL", "ACTIVE", "ARCHIVED"]).optional()
    }).passthrough()
  );

  registerTool(
    "create_task",
    "Creates a new task using POST /tasks/add. Supports assigning users, linking to a project, custom fields and billable flag. Limitations: write operation; requires permissions to create tasks in the target account/project.",
    z.object({
      ...authSchemaFields,
      ...accountSchemaFields,
      name: z.string(),
      description: z.string().optional(),
      users: z.union([z.array(z.object({ id: z.number() })), z.string()]).optional(),
      type: z.enum(["PERSONAL", "EVERYONE"]).optional(),
      project_id: z.number().optional(),
      project_name: z.string().optional(),
      custom_fields: z.union([z.array(z.object({ id: z.number(), value: z.union([z.string(), z.number(), z.boolean()]) })), z.string()]).optional(),
      is_billable: z.boolean().optional()
    }).passthrough()
  );

  registerTool(
    "get_task",
    "Gets a specific task from /tasks/:task_id. By default this tool requests include_custom_fields=true so task custom fields are returned unless explicitly disabled. Use when you need full task details by id. Limitations: read-only; task must belong to the authenticated account context.",
    z.object({
      ...authSchemaFields,
      ...accountSchemaFields,
      task_id: z.number(),
      include_custom_fields: z.boolean().optional()
    }).passthrough()
  );

  registerTool(
    "update_task",
    "Updates an existing task using /tasks/update/:task_id. Supports changing description, due date, project/service linkage, assignees, billing fields and custom fields. Limitations: write operation; task must exist in the target account, and permissions depend on role.",
    z.object({
      ...authSchemaFields,
      ...accountSchemaFields,
      task_id: z.number(),
      id: z.number().optional(),
      due_date: z.string().optional(),
      list_id: z.union([z.number(), z.string()]).optional(),
      list_position: z.union([z.number(), z.string()]).optional(),
      project_id: z.union([z.number(), z.string()]).optional(),
      project_name: z.string().optional(),
      service_id: z.union([z.number(), z.string()]).optional(),
      service_name: z.string().optional(),
      estimated_time: z.union([z.number(), z.string()]).optional(),
      is_billable: z.boolean().optional(),
      hourly_rate: z.union([z.number(), z.string()]).optional(),
      users: z.union([z.array(z.object({ id: z.number() })), z.string()]).optional(),
      type: z.string().optional(),
      custom_fields: z.union([
        z.array(z.object({ id: z.number(), value: z.union([z.string(), z.number(), z.boolean()]), cf_index: z.number().optional() })),
        z.string()
      ]).optional(),
      description: z.string().optional()
    }).passthrough()
  );

  registerTool(
    "create_customer",
    "Creates a new customer using POST /customers/add. Supports adding custom field values during creation. Limitations: write operation; requires permissions in the target account.",
    z.object({
      ...authSchemaFields,
      ...accountSchemaFields,
      name: z.string(),
      custom_fields: z.union([
        z.array(z.object({ id: z.number(), value: z.union([z.string(), z.number(), z.boolean()]) })),
        z.string()
      ]).optional()
    }).passthrough()
  );

  registerTool(
    "update_customer",
    "Updates an existing customer using /customers/update/:customer_id. Supports renaming the customer and updating custom field values. Limitations: write operation; customer must exist in the target account.",
    z.object({
      ...authSchemaFields,
      ...accountSchemaFields,
      customer_id: z.number(),
      name: z.string().optional(),
      custom_fields: z.union([
        z.array(z.object({ id: z.number(), value: z.union([z.string(), z.number(), z.boolean()]), cf_index: z.number().optional() })),
        z.string()
      ]).optional()
    }).passthrough()
  );

  registerTool(
    "create_project",
    "Creates a new project using POST /projects/add. Supports linking a customer, custom fields, public visibility and estimated time. Limitations: write operation; requires permissions to create projects in the target account.",
    z.object({
      ...authSchemaFields,
      ...accountSchemaFields,
      name: z.string(),
      is_public: z.boolean().optional(),
      default_view: z.string().optional(),
      custom_fields: z.union([
        z.array(z.object({ id: z.number(), value: z.union([z.string(), z.number(), z.boolean()]) })),
        z.string()
      ]).optional(),
      customer_id: z.number().optional(),
      customer_name: z.string().optional(),
      estimated_time: z.union([z.number(), z.string()]).optional()
    }).passthrough()
  );

  registerTool(
    "update_project",
    "Updates an existing project using /projects/update/:project_id. Supports core project fields, billing fields, customer/service linkage, notes and custom fields. Limitations: write operation; project must exist in the target account.",
    z.object({
      ...authSchemaFields,
      ...accountSchemaFields,
      project_id: z.number(),
      name: z.string().optional(),
      color: z.string().optional(),
      delivery_date: z.string().optional(),
      customer_id: z.union([z.number(), z.string()]).optional(),
      customer_name: z.string().optional(),
      service_id: z.union([z.number(), z.string()]).optional(),
      service_name: z.string().optional(),
      notes: z.string().optional(),
      estimated_time: z.union([z.number(), z.string()]).optional(),
      hourly_rate: z.union([z.number(), z.string()]).optional(),
      is_billable: z.boolean().optional(),
      fixed_rate: z.union([z.number(), z.string()]).optional(),
      retainer_closing_day: z.union([z.number(), z.string()]).optional(),
      default_view: z.string().optional(),
      custom_fields: z.union([
        z.array(z.object({ id: z.number(), value: z.union([z.string(), z.number(), z.boolean()]), cf_index: z.number().optional() })),
        z.string()
      ]).optional()
    }).passthrough()
  );

  registerTool(
    "create_event",
    "Creates a new time event using POST /events/add. Supports linking to a task or project, optional notes, repeating configuration and custom fields. Limitations: write operation; start, end and timezone are required.",
    z.object({
      ...authSchemaFields,
      ...accountSchemaFields,
      start: z.string(),
      end: z.string(),
      duration: z.number().optional(),
      timezone: z.string(),
      user_id: z.number().optional(),
      notes: z.string().optional(),
      event_type: z.enum(["WORK", "NOT_LOGGED"]).optional(),
      task_id: z.number().optional(),
      task_name: z.string().optional(),
      project_id: z.number().optional(),
      project_name: z.string().optional(),
      repeat: z.enum(["EVERY_DAY", "EVERY_WEEK", "EVERY_MONTH", "EVERY_YEAR", "CUSTOM"]).optional(),
      repeat_every: z.number().optional(),
      end_repeat: z.string().optional(),
      frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]).optional(),
      custom_fields: z.union([
        z.array(z.object({ id: z.number(), value: z.union([z.string(), z.number(), z.boolean()]) })),
        z.string()
      ]).optional()
    }).passthrough()
  );

  registerTool(
    "update_event",
    "Updates an existing time event using /events/update/:event_id. Supports changing task/project linkage, start/end timestamps, notes, user and custom fields. Limitations: write operation; event must exist in the target account.",
    z.object({
      ...authSchemaFields,
      ...accountSchemaFields,
      event_id: z.number(),
      task_id: z.union([z.number(), z.string()]).optional(),
      task_name: z.string().optional(),
      project_id: z.union([z.number(), z.string()]).optional(),
      project_name: z.string().optional(),
      start: z.string().optional(),
      end: z.string().optional(),
      notes: z.string().optional(),
      user_id: z.union([z.number(), z.string()]).optional(),
      event_type: z.string().optional(),
      is_billed: z.boolean().optional(),
      include_custom_fields: z.boolean().optional(),
      custom_fields: z.union([
        z.array(z.object({ id: z.number(), value: z.union([z.string(), z.number(), z.boolean()]), cf_index: z.number().optional() })),
        z.string()
      ]).optional()
    }).passthrough()
  );

  registerTool(
    "track_task",
    "Starts tracking time using /tasks/track. Supports tracking an existing task or creating/tracking by task and project names. Limitations: write operation; task/project resolution depends on the provided identifiers.",
    z.object({
      ...authSchemaFields,
      ...accountSchemaFields,
      task_id: z.union([z.number(), z.string()]).optional(),
      task_name: z.string().optional(),
      project_id: z.union([z.number(), z.string()]).optional(),
      project_name: z.string().optional(),
      service: z.string().optional(),
      service_project_id: z.string().optional(),
      service_task_id: z.string().optional(),
      date: z.string().optional(),
      timezone: z.string().optional(),
      return_task: z.boolean().optional(),
      stop_running_task: z.boolean().optional(),
      notes: z.string().optional(),
      tags: z.union([
        z.array(z.object({ n: z.string().optional(), c: z.string().optional(), v: z.string().optional(), t: z.string().optional() })),
        z.string()
      ]).optional()
    }).passthrough()
  );

  registerTool(
    "stop_task",
    "Stops tracking a running task using /tasks/stop/:task_id. Supports optional stop date and returning the updated task. Limitations: write operation; the task must be currently trackable in the target account.",
    z.object({
      ...authSchemaFields,
      ...accountSchemaFields,
      task_id: z.number(),
      date: z.string().optional(),
      return_task: z.boolean().optional()
    }).passthrough()
  );

  registerTool(
    "create_custom_field",
    "Creates a new custom field using POST /custom_fields/add. Supports task, project, event, user and customer custom fields. Limitations: write operation; value_type and filter_object_class are required.",
    z.object({
      ...authSchemaFields,
      ...accountSchemaFields,
      name: z.string(),
      color: z.string().optional(),
      notes: z.string().optional(),
      value_type: z.enum(["boolean", "currency", "date", "enum", "number", "text", "checkbox"]),
      filter_object_class: z.enum(["event", "task", "project", "user", "customer"]),
      cf_index: z.number().optional()
    }).passthrough()
  );

  registerTool(
    "create_enum_option",
    "Creates a new enum option for an existing custom field using POST /enum_options/add. Limitations: write operation; requires an existing enum custom field id.",
    z.object({
      ...authSchemaFields,
      ...accountSchemaFields,
      name: z.string(),
      index: z.number().optional(),
      custom_field: z.number(),
      color: z.string().optional(),
      enabled: z.boolean().optional(),
      notes: z.string().optional()
    }).passthrough()
  );

  registerTool(
    "list_customers",
    "Lists customers from /customers with optional status filter (ALL, ACTIVE, ARCHIVED). Use to map customer entities before querying related projects/events. Limitations: read-only listing; filter values are restricted to ALL/ACTIVE/ARCHIVED.",
    z.object({
      ...authSchemaFields,
      ...accountSchemaFields,
      filter: z.enum(["ALL", "ACTIVE", "ARCHIVED"]).optional()
    }).passthrough()
  );

  return server;
}

/* ==========================
   EXPRESS APP
========================== */
const app = createMcpExpressApp({ host: HOST });
app.use(cors());

app.all("/mcp", async (req, res) => {
  console.log(`=== ${req.method} /mcp ===`);
  console.log(`${req.method} /mcp headers:`, sanitizeHeaders(req.headers));

  const server = createServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on("close", () => {
    void transport.close();
    void server.close();
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("Error handling MCP request:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null
      });
    }
  }
});

app.all("/sse", (req, res) => {
  res.status(410).json({
    error: "Legacy SSE endpoint is deprecated. Use /mcp (streamable-http)."
  });
});

app.get("/health", (_, res) => res.send("OK"));

app.listen(PORT, () => {
  console.log(`MCP Server (official SDK) listening on ${HOST}:${PORT}`);
});