/**
 * AI Agent for Telegram
 * Uses GigaChat API with tools
 */

import pc from "picocolors";
import { config } from "./config";
import { telegramTools } from "./tools/telegram";
import { niaTools } from "./tools/nia";
import { aiifyTools } from "./tools/aiify";
import {
  buildToolDefinitions,
  createChatCompletion,
  type GigaChatMessage,
  type GigaChatToolCall,
} from "./giga_api";
import type { ToolDefinition } from "./tools/tooling";

// Combine all tools
export const tools = {
  ...telegramTools,
  ...niaTools,
  ...aiifyTools,
};

const toolList = Object.values(tools) as ToolDefinition[];
const toolMap = new Map(toolList.map((tool) => [tool.name, tool]));

// System prompt that defines the agent's behavior
export const SYSTEM_PROMPT = `You are a charming AI assistant helping a guy communicate with his girlfriend on Telegram. You have access to tools for:

1. **Telegram** - Reading and sending messages
2. **searchPickupLines** - YOUR MAIN TOOL for pickup lines, dating advice, relationship tips (searches the indexed codebase)
3. **niaSearch** - General search (only if searchPickupLines doesn't help)
4. **AI-ify** - Transforming her messages into clever responses

## Your Personality
- Witty and charming but not cringe
- Supportive wingman energy
- Know when to be romantic vs funny
- Never sound robotic or generic

## How to Help
- When asked to read messages, use getChats first to find the right chat, then getMessages
- When crafting responses, ALWAYS use searchPickupLines FIRST for inspiration
- When sending messages, confirm with the user before sending unless they explicitly said to send
- Match the energy and tone of the conversation

## Important Rules
1. ALWAYS use tools to get real data - don't make up message content
2. **USE searchPickupLines** for ANY relationship/dating/flirting question - it has the indexed pickup lines!
3. Be concise in your explanations
4. If something fails, explain what went wrong clearly
5. Never send a message without user confirmation (unless they said "send it")
6. When sending ANY Telegram message, ALWAYS append "\n\n— Sent by Arlan AI" at the end of the message content

## Response Style
- Keep responses natural and conversational
- DO NOT use markdown formatting (no **, no ##, no bullet points with -)
- Use plain text only since this is a terminal CLI
- Use emojis sparingly for visual cues
- When suggesting messages, put them in quotes like: "hey, how are you?"
- Keep it brief and scannable
- IMPORTANT: All suggested messages to send should be lowercase, never uppercase. Type like a normal person texting, not formal.`;

// Message history for the conversation
let messageHistory: GigaChatMessage[] = [];

function logToolCalls(toolCalls: GigaChatToolCall[]) {
  if (toolCalls.length === 0) return;
  for (const call of toolCalls) {
    let argsPreview = "";
    try {
      const argsObj = JSON.parse(call.function.arguments || "{}");
      argsPreview = Object.entries(argsObj)
        .slice(0, 2)
        .map(([k, v]) =>
          typeof v === "string" ? v.slice(0, 30) : JSON.stringify(v)
        )
        .join(", ");
    } catch {
      argsPreview = call.function.arguments?.slice(0, 40) || "";
    }
    console.log(
      `  ${pc.dim("→")} ${pc.yellow(call.function.name)} ${pc.dim(
        `(${argsPreview})`
      )}`
    );
  }
}

function logToolResults(results: Array<{ name: string; result: unknown }>) {
  if (results.length === 0) return;
  for (const res of results) {
    const result = res.result as Record<string, unknown> | undefined;
    let summary = "";
    if (result && typeof result === "object") {
      if ("results" in result && Array.isArray(result.results)) {
        summary = `${result.results.length} results`;
      } else if ("chats" in result && Array.isArray(result.chats)) {
        summary = `${result.chats.length} chats`;
      } else if ("messages" in result && Array.isArray(result.messages)) {
        summary = `${result.messages.length} messages`;
      } else if ("contacts" in result && Array.isArray(result.contacts)) {
        summary = `${result.contacts.length} contacts`;
      } else if ("success" in result) {
        summary = result.success ? "done" : "failed";
      } else if ("error" in result) {
        summary = `error: ${result.error}`;
      } else if ("status" in result) {
        summary = `status: ${result.status}`;
      }
    }
    if (summary) {
      console.log(`  ${pc.green("✓")} ${pc.dim(summary)}`);
    }
  }
}

async function runToolCall(call: GigaChatToolCall) {
  const tool = toolMap.get(call.function.name);
  if (!tool) {
    return {
      name: call.function.name,
      result: { error: `Unknown tool: ${call.function.name}` },
    };
  }

  let args: unknown = {};
  try {
    args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
  } catch (error: any) {
    return {
      name: tool.name,
      result: { error: `Invalid tool arguments: ${error.message}` },
    };
  }

  try {
    const parsed = tool.schema.parse(args);
    const result = await tool.execute(parsed);
    return { name: tool.name, result };
  } catch (error: any) {
    return {
      name: tool.name,
      result: { error: error.message || "Tool execution failed" },
    };
  }
}

/**
 * Process a user message and stream the response
 */
export async function chat(userMessage: string): Promise<AsyncIterable<string>> {
  // Add user message to history
  messageHistory.push({
    role: "user",
    content: userMessage,
  });

  const toolDefinitions = buildToolDefinitions(toolList);
  const maxToolSteps = 10;

  for (let step = 0; step < maxToolSteps; step += 1) {
    const messages: GigaChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messageHistory,
    ];

    const result = await createChatCompletion(messages, toolDefinitions);

    if (result.toolCalls.length > 0) {
      messageHistory.push({
        role: "assistant",
        content: result.content || "",
        tool_calls: result.toolCalls,
      });

      logToolCalls(result.toolCalls);

      const toolResults = [] as Array<{ name: string; result: unknown }>;
      for (const call of result.toolCalls) {
        const toolResult = await runToolCall(call);
        toolResults.push(toolResult);

        messageHistory.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(toolResult.result ?? {}),
        });
      }

      logToolResults(toolResults);
      continue;
    }

    const finalContent = result.content || "";
    messageHistory.push({
      role: "assistant",
      content: finalContent,
    });

    return (async function* () {
      yield finalContent;
    })();
  }

  throw new Error(
    "Too many tool calls. Try rephrasing your request or reduce tool usage."
  );
}

/**
 * Clear conversation history
 */
export function clearHistory() {
  messageHistory = [];
}

/**
 * Get current message count
 */
export function getHistoryLength(): number {
  return messageHistory.length;
}
