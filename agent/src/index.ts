#!/usr/bin/env bun
/**
 * Telegram AI Agent CLI
 * Interactive chatbox for communicating via Telegram with AI assistance
 */

import * as p from "@clack/prompts";
import pc from "picocolors";
import { chat, clearHistory, getHistoryLength } from "./agent";
import { config, validateConfig } from "./config";

// ASCII art banner
const BANNER = `
${pc.cyan("╔════════════════════════════════════════════╗")}
${pc.cyan("║")}  ${pc.bold(pc.magenta("🤖 Telegram AI Agent"))}                     ${pc.cyan("║")}
${pc.cyan("║")}  ${pc.dim("Твой AI-напарник для Telegram")}             ${pc.cyan("║")}
${pc.cyan("╚════════════════════════════════════════════╝")}
`;

// Help text
const HELP_TEXT = `
${pc.bold("Команды:")}
  ${pc.yellow("/help")}     - Показать эту справку
  ${pc.yellow("/clear")}    - Очистить историю диалога
  ${pc.yellow("/status")}   - Проверить статус подключения
  ${pc.yellow("/quit")}     - Выйти из агента

${pc.bold("Примеры запросов:")}
  ${pc.dim("• Покажи мои последние чаты")}
  ${pc.dim("• Прочитай последние 5 сообщений от @username")}
  ${pc.dim("• Что мне ответить на её сообщение про кофе?")}
  ${pc.dim("• Отправь 'доброе утро, красотка ☀️' в @username")}
  ${pc.dim("• Сделай AI-версию её сообщения 'я скучаю' в флиртовом стиле")}
`;

async function checkTelegramConnection(): Promise<boolean> {
  try {
    const response = await fetch(`${config.telegramApiUrl}/health`);
    if (response.ok) {
      const data = await response.json();
      return data.connected === true;
    }
    return false;
  } catch {
    return false;
  }
}

async function main() {
  console.clear();
  console.log(BANNER);

  // Validate configuration
  validateConfig();

  p.intro(pc.bgCyan(pc.black(" Добро пожаловать в Telegram AI Agent ")));

  // Check Telegram connection
  const connectionSpinner = p.spinner();
  connectionSpinner.start("Проверяю подключение к Telegram...");

  const isConnected = await checkTelegramConnection();

  if (isConnected) {
    connectionSpinner.stop(pc.green("✓ Telegram подключен"));
  } else {
    connectionSpinner.stop(pc.yellow("⚠ Telegram API не подключен"));
    p.note(
      `Сначала запусти Telegram API bridge:\n${pc.cyan("python telegram_api.py")}`,
      "Требуется настройка"
    );
  }

  // Show config status
  const configStatus = [
    `Модель: ${pc.cyan(config.gigaChatModel)}`,
    `Telegram API: ${pc.cyan(config.telegramApiUrl)}`,
    `Источник Nia: ${config.niaCodebaseSource ? pc.green("✓ Настроен") : pc.yellow("Не задан")}`,
  ].join("\n");

  p.note(configStatus, "Конфигурация");

  console.log(HELP_TEXT);

  // Main chat loop
  while (true) {
    const input = await p.text({
      message: pc.cyan("You"),
      placeholder: "Введите сообщение или /help для команд...",
    });

    // Handle cancellation (Ctrl+C)
    if (p.isCancel(input)) {
      p.outro(pc.dim("Пока! 👋"));
      process.exit(0);
    }

    const message = (input as string).trim();

    if (!message) continue;

    // Handle commands
    if (message.startsWith("/")) {
      const command = message.toLowerCase();

      switch (command) {
        case "/help":
          console.log(HELP_TEXT);
          continue;

        case "/clear":
          clearHistory();
          p.log.success("История диалога очищена");
          continue;

        case "/status":
          const connected = await checkTelegramConnection();
          p.log.info(
            connected
              ? pc.green("Telegram: Подключен ✓")
              : pc.red("Telegram: Не подключен ✗")
          );
          p.log.info(`Сообщений в истории: ${getHistoryLength()}`);
          continue;

        case "/quit":
        case "/exit":
        case "/q":
          p.outro(pc.dim("Пока! 👋"));
          process.exit(0);

        default:
          p.log.warn(`Неизвестная команда: ${command}. Введите /help для списка команд.`);
          continue;
      }
    }

    // Process with AI agent
    const spinner = p.spinner();
    spinner.start(pc.dim("Думаю..."));

    try {
      const stream = await chat(message);
      spinner.stop(pc.magenta("Агент"));

      // Stream the response
      let response = "";
      process.stdout.write(pc.dim("  "));

      for await (const chunk of stream) {
        process.stdout.write(chunk);
        response += chunk;
      }

      console.log("\n");
    } catch (error: any) {
      spinner.stop(pc.red("Error"));

      if (error.message?.includes("Telegram API")) {
        p.log.error(
          `Ошибка Telegram API. Убедитесь, что bridge запущен:\n${pc.cyan("python telegram_api.py")}`
        );
      } else if (error.message?.includes("GIGACHAT")) {
        p.log.error("Ошибка GigaChat. Проверьте GIGACHAT_AUTH_KEY и GIGACHAT_SCOPE.");
      } else {
        p.log.error(error.message || "Произошла непредвиденная ошибка");
      }
    }
  }
}

// Run
main().catch((error) => {
  console.error(pc.red("Критическая ошибка:"), error);
  process.exit(1);
});
