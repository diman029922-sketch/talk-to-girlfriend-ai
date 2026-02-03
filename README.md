# Telegram AI Dating Agent

AI‑агент для Telegram, который помогает придумывать остроумные и вовлекающие ответы. В этом варианте используется GigaChat API, семантический поиск Nia и полноценный Telegram bridge на Telethon.

## Что умеет

- **Умные подсказки ответов** на основе контекста переписки
- **500+ пикап‑лайнов** с семантическим поиском через Nia
- **Гайды по общению** (как поддерживать разговор, флирт, идеи для свиданий)
- **Улучшение сообщений** (перефразировать в более романтичный/игривый стиль)
- **Полный доступ к Telegram** (читать, отправлять, управлять чатами)

## Powered by Nia

Агент использует [Nia](https://trynia.ai) как поисковый движок. Nia индексирует:
- 500+ подборок пикап‑лайнов
- гайды по общению
- советы по поддержанию диалога

Вы можете индексировать свой контент в [trynia.ai](https://trynia.ai).

## Архитектура

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   CLI Agent      │────▶│  Telegram API    │────▶│    Telegram      │
│  (TypeScript)    │     │   Bridge (Py)    │     │    Servers       │
└──────────────────┘     └──────────────────┘     └──────────────────┘
         │
         ▼
┌──────────────────┐     ┌──────────────────┐
│    GigaChat      │     │    Nia API       │
│   (chat API)     │     │ (trynia.ai)      │
└──────────────────┘     └──────────────────┘
                         - 500+ пикап‑лайнов
                         - гайды по знакомствам
                         - советы по общению
```

## Быстрый старт

### 1. Получите Telegram API credentials

Получите API‑ключи на [my.telegram.org/apps](https://my.telegram.org/apps).

### 2. Получите доступ к GigaChat

1. Создайте проект в GigaChat (через личный кабинет поставщика).
2. Получите **Authorization key** (для Basic‑авторизации) и **scope**.
3. Сохраните их как `GIGACHAT_AUTH_KEY` и `GIGACHAT_SCOPE`.

### 3. Установка и настройка

```bash
# Клонируем репозиторий
git clone https://github.com/arlanrakh/talk-to-girlfriend-ai.git
cd talk-to-girlfriend-ai

# Устанавливаем Python зависимости
uv sync

# Генерируем Telegram session string
uv run session_string_generator.py

# Конфигурируем окружение
cp .env.example .env
# Отредактируйте .env со своими ключами
```

### 4. Запуск Telegram API Bridge

```bash
python telegram_api.py
```

Это поднимает FastAPI сервер на порту 8765, который связывает TypeScript агент и Telegram.

### 5. Запуск агента

```bash
cd agent
bun install
bun run dev
```

## Примеры использования

```
# Чтение и отправка
> Покажи сообщения от @her_username
> Отправь "я думал о тебе" в @her_username
> Ответь на её последнее сообщение чем‑то остроумным

# Реакции
> Поставь ❤️ на её последнее сообщение
> Отправь 🔥 реакцию на сообщение 123

# Поиск и история
> Найди в нашем чате "ужин"
> Покажи последние 50 сообщений с ней
> Подбери смешной пикап‑лайн про пиццу

# AI‑помощь
> Что мне ответить на её сообщение про кофе?
> Сделай это сообщение более флиртовым: "хочешь встретиться завтра?"
> Поиск советов как поддержать разговор

# Инфо о пользователе
> Она сейчас онлайн?
> Проверь её статус

# Управление сообщениями
> Исправь моё последнее сообщение
> Удали сообщение 456
> Перешли мем @friend
```

### Команды агента

- `/help` — показать справку
- `/clear` — очистить историю
- `/status` — статус подключения
- `/quit` — выход

## Переменные окружения

Создайте `.env` в корне проекта:

```env
# Telegram API (обязательно)
TELEGRAM_API_ID=your_api_id
TELEGRAM_API_HASH=your_api_hash
TELEGRAM_SESSION_STRING=your_session_string

# GigaChat (обязательно для агента)
GIGACHAT_AUTH_KEY=your_gigachat_auth_key
GIGACHAT_SCOPE=GIGACHAT_API_PERS
GIGACHAT_AUTH_URL=https://ngw.devices.sberbank.ru:9443/api/v2/oauth
GIGACHAT_API_BASE=https://gigachat.devices.sberbank.ru/api/v1
GIGACHAT_MODEL=GigaChat

# Nia (обязательно для поиска)
NIA_API_KEY=your_nia_api_key
NIA_CODEBASE_SOURCE=your_pickup_lines_source_uuid
```

## Пример запроса к GigaChat

```json
POST /api/v1/chat/completions
{
  "model": "GigaChat",
  "messages": [
    { "role": "system", "content": "Ты дружелюбный помощник." },
    { "role": "user", "content": "Придумай игривый ответ." }
  ],
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "searchPickupLines",
        "description": "Поиск пикап‑лайнов",
        "parameters": {
          "type": "object",
          "properties": { "query": { "type": "string" } },
          "required": ["query"]
        }
      }
    }
  ]
}
```

### Ожидаемый ответ

```json
{
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "можно начать с: 'я уже скучаю по твоим сообщениям'"
      },
      "finish_reason": "stop"
    }
  ]
}
```

## Альтернатива: использовать как MCP сервер

Вы можете использовать этот проект как MCP сервер без CLI агента.

Добавьте в MCP конфиг вашего клиента (пример для macOS: `~/Library/Application Support/MCP/mcp_config.json`):

```json
{
  "mcpServers": {
    "telegram": {
      "command": "uv",
      "args": ["--directory", "/path/to/telegram-mcp", "run", "main.py"]
    }
  }
}
```

Это откроет доступ к 60+ Telegram инструментам (сообщения, контакты, группы, реакции и т.д.).

## Доступные инструменты

### Agent Tools (20+)

**Основные**
| Tool | Description |
|------|-------------|
| `getChats` | список чатов |
| `getMessages` | чтение сообщений |
| `sendMessage` | отправка сообщения |
| `getChat` | детали чата |
| `searchContacts` | поиск контактов |

**Реакции и ответы**
| Tool | Description |
|------|-------------|
| `sendReaction` | реакция эмодзи |
| `replyToMessage` | ответ на сообщение |

**Правка и удаление**
| Tool | Description |
|------|-------------|
| `editMessage` | изменить сообщение |
| `deleteMessage` | удалить сообщение |

**История и поиск**
| Tool | Description |
|------|-------------|
| `getHistory` | история до 500 сообщений |
| `searchMessages` | поиск в чате |

**Форвард и закреп**
| Tool | Description |
|------|-------------|
| `forwardMessage` | переслать сообщение |
| `pinMessage` | закрепить сообщение |
| `markAsRead` | отметить как прочитанное |

**Инфо о пользователе**
| Tool | Description |
|------|-------------|
| `getUserStatus` | статус онлайн |
| `getUserPhotos` | фото профиля |

**Медиа**
| Tool | Description |
|------|-------------|
| `searchGifs` | поиск GIF |

**Nia Search**
| Tool | Description |
|------|-------------|
| `searchPickupLines` | поиск пикап‑лайнов и советов |
| `niaSearch` | общий поиск |
| `webSearch` | веб‑поиск |

**AI Tools**
| Tool | Description |
|------|-------------|
| `aiifyMessage` | улучшение сообщений |

### MCP Server Tools (60+)
Полный доступ к Telegram API: чаты, группы, администрирование, медиа, реакции.
