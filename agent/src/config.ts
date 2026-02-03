/**
 * Configuration for the Telegram AI Agent
 * Loads environment from parent directory's .env file
 */

import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// Load .env from parent directory (telegram-mcp root)
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../..", ".env");

try {
  const content = await Bun.file(envPath).text();
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const [key, ...valueParts] = trimmed.split("=");
    if (key && valueParts.length > 0) {
      const value = valueParts.join("=").trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }
} catch (e) {
  console.error(`Warning: Could not load .env from ${envPath}`);
}

export const config = {
  // Telegram HTTP Bridge
  telegramApiUrl: process.env.TELEGRAM_API_URL || "http://localhost:8765",

  // Nia API
  niaApiKey: process.env.NIA_API_KEY || "",
  niaApiBase: "https://apigcp.trynia.ai/v2",
  niaCodebaseSource: process.env.NIA_CODEBASE_SOURCE || "",

  // GigaChat API
  gigaChatAuthKey: process.env.GIGACHAT_AUTH_KEY || "",
  gigaChatScope: process.env.GIGACHAT_SCOPE || "GIGACHAT_API_PERS",
  gigaChatAuthUrl:
    process.env.GIGACHAT_AUTH_URL || "https://ngw.devices.sberbank.ru:9443/api/v2/oauth",
  gigaChatApiBase:
    process.env.GIGACHAT_API_BASE || "https://gigachat.devices.sberbank.ru/api/v1",
  gigaChatModel: process.env.GIGACHAT_MODEL || "GigaChat",
} as const;

export function validateConfig() {
  const missing: string[] = [];

  if (!config.gigaChatAuthKey) {
    missing.push("GIGACHAT_AUTH_KEY");
  }
  if (!config.gigaChatScope) {
    missing.push("GIGACHAT_SCOPE");
  }
  if (!config.niaApiKey) {
    missing.push("NIA_API_KEY");
  }

  if (missing.length > 0) {
    console.error(`❌ Missing required environment variables: ${missing.join(", ")}`);
    console.error("   Make sure your .env file in the project root has the keys");
    process.exit(1);
  }
}
