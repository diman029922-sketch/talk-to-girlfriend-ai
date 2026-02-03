import { config } from "./config";
import type { ToolDefinition } from "./tools/tooling";

export type GigaChatRole = "system" | "user" | "assistant" | "tool";

export type GigaChatToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type GigaChatMessage = {
  role: GigaChatRole;
  content?: string;
  tool_calls?: GigaChatToolCall[];
  tool_call_id?: string;
};

export type GigaChatToolDefinition = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type GigaChatCompletion = {
  content: string;
  toolCalls: GigaChatToolCall[];
  finishReason?: string;
};

type TokenCache = {
  accessToken: string;
  expiresAt: number;
};

let cachedToken: TokenCache | null = null;

function generateRqUid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeExpiresAt(value?: number): number {
  if (!value) {
    return Date.now() + 55 * 60 * 1000;
  }
  if (value > 10_000_000_000) {
    return value;
  }
  return value * 1000;
}

async function requestAccessToken(): Promise<TokenCache> {
  const authUrl = config.gigaChatAuthUrl;
  const body = new URLSearchParams({
    scope: config.gigaChatScope,
    grant_type: "client_credentials",
  });

  const response = await fetch(authUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${config.gigaChatAuthKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
      RqUID: generateRqUid(),
    },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `GIGACHAT_AUTH_ERROR: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  const data = (await response.json()) as {
    access_token?: string;
    expires_at?: number;
    expires_in?: number;
  };

  if (!data.access_token) {
    throw new Error("GIGACHAT_AUTH_ERROR: Missing access_token in response");
  }

  const expiresAt = normalizeExpiresAt(
    data.expires_at ?? (data.expires_in ? Date.now() + data.expires_in * 1000 : undefined)
  );

  return {
    accessToken: data.access_token,
    expiresAt,
  };
}

async function getAccessToken(forceRefresh = false): Promise<string> {
  const now = Date.now();
  if (!forceRefresh && cachedToken && cachedToken.expiresAt - 30_000 > now) {
    return cachedToken.accessToken;
  }

  cachedToken = await requestAccessToken();
  return cachedToken.accessToken;
}

async function gigaChatFetch(
  endpoint: string,
  options: RequestInit = {},
  retryAuth = true
): Promise<Response> {
  const token = await getAccessToken();
  const response = await fetch(`${config.gigaChatApiBase}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if ((response.status === 401 || response.status === 403) && retryAuth) {
    cachedToken = null;
    await getAccessToken(true);
    return gigaChatFetch(endpoint, options, false);
  }

  return response;
}

function extractToolCalls(message: any): GigaChatToolCall[] {
  if (message?.tool_calls && Array.isArray(message.tool_calls)) {
    return message.tool_calls.map((call: any) => ({
      id: call.id || `call_${Math.random().toString(16).slice(2)}`,
      type: "function",
      function: {
        name: call.function?.name || call.name,
        arguments: call.function?.arguments || call.arguments || "{}",
      },
    }));
  }

  if (message?.function_call) {
    return [
      {
        id: `call_${Math.random().toString(16).slice(2)}`,
        type: "function",
        function: {
          name: message.function_call.name,
          arguments: message.function_call.arguments || "{}",
        },
      },
    ];
  }

  return [];
}

export function buildToolDefinitions(tools: ToolDefinition[]): GigaChatToolDefinition[] {
  return tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

export async function createChatCompletion(
  messages: GigaChatMessage[],
  tools: GigaChatToolDefinition[]
): Promise<GigaChatCompletion> {
  const response = await gigaChatFetch("/chat/completions", {
    method: "POST",
    body: JSON.stringify({
      model: config.gigaChatModel,
      messages,
      tools: tools.length > 0 ? tools : undefined,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 429) {
      throw new Error(`GIGACHAT_RATE_LIMIT: ${errorText}`);
    }
    throw new Error(
      `GIGACHAT_API_ERROR: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  const data = await response.json();
  const choice = data?.choices?.[0];
  const message = choice?.message || {};
  const content = message.content || "";
  const toolCalls = extractToolCalls(message);

  return {
    content,
    toolCalls,
    finishReason: choice?.finish_reason,
  };
}
