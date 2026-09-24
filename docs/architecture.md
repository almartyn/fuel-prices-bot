# Архітектура

## Принципи

- **Один запуск — одна задача.** Скрипт не працює постійно: він запускається, робить усю роботу і завершується. Сервер не потрібен.
- **Кожне джерело ізольоване.** Парсер кожної мережі АЗС — окремий модуль. Якщо один сайт змінив верстку або недоступний, решта продовжує працювати.
- **Єдиний формат даних.** Усі парсери повертають дані однакової структури, тож решта коду не знає, звідки прийшли ціни.
- **Спершу перевірка, потім публікація.** Підозрілі дані не потрапляють у канал.

## Потік даних

```
┌──────────────┐
│  Планувальник│  GitHub Actions, cron раз на день
└──────┬───────┘
       ▼
┌──────────────┐     ┌─────────────────────────────┐
│   Збирач     │────▶│ Парсери: okko, wog, upg,    │
│  (collect)   │◀────│ socar (паралельно)          │
└──────┬───────┘     └─────────────────────────────┘
       ▼
┌──────────────┐
│ Нормалізація │  назви пального → єдині коди (a95, diesel, …)
│ і валідація  │  відсіювання неадекватних значень
└──────┬───────┘
       ▼
┌──────────────┐     ┌──────────────────┐
│  Порівняння  │◀────│ data/latest.json │  попередній знімок
└──────┬───────┘     └──────────────────┘
       ▼
┌──────────────┐
│  Форматер    │  текст поста в HTML-розмітці Telegram
└──────┬───────┘
       ▼
┌──────────────┐
│  Telegram    │  sendMessage у канал
└──────┬───────┘
       ▼
┌──────────────┐
│  Збереження  │  новий знімок → data/latest.json і data/history/
└──────────────┘  коміт у репозиторій
```

Порядок важливий: знімок зберігається **після** успішної публікації. Якщо публікація не вдалася, при повторному запуску порівняння буде з тим самим попереднім днем, і пост вийде коректним.

## Модулі

| Модуль | Відповідальність |
|---|---|
| `src/index.js` | Точка входу. Керує послідовністю кроків, обробляє режим `DRY_RUN`. |
| `src/config.js` | Читає змінні середовища, перевіряє, що обов'язкові задані. |
| `src/sources/*.js` | Парсер для кожної мережі. Експортує `id`, `name`, `url` і функцію `fetchPrices()`. |
| `src/sources/index.js` | Реєстр усіх джерел. |
| `src/core/collect.js` | Запускає всі парсери паралельно, збирає результати й помилки. |
| `src/core/normalize.js` | Перетворює назви пального з сайтів на єдині коди. |
| `src/core/validate.js` | Перевіряє ціни на адекватність. |
| `src/core/compare.js` | Рахує різницю з попереднім знімком. |
| `src/storage/jsonStore.js` | Читання і запис `data/latest.json` та файлів історії. |
| `src/telegram/formatter.js` | Будує текст поста з результатів порівняння. |
| `src/telegram/client.js` | Надсилає повідомлення через Bot API. |
| `src/utils/http.js` | `fetch` з таймаутом, повторами і заголовками. |
| `src/utils/logger.js` | Простий логер з рівнями `info` / `warn` / `error`. |

## Структура папок

```
fuel-prices-bot/
├── .github/
│   └── workflows/
│       └── daily-post.yml       # розклад і запуск
├── data/
│   ├── latest.json              # останній успішний знімок
│   └── history/
│       └── 2026-09-23.json      # архів по днях
├── docs/                        # ця документація
├── src/
│   ├── index.js
│   ├── config.js
│   ├── core/
│   │   ├── collect.js
│   │   ├── normalize.js
│   │   ├── validate.js
│   │   └── compare.js
│   ├── sources/
│   │   ├── index.js
│   │   ├── okko.js
│   │   ├── wog.js
│   │   ├── upg.js
│   │   └── socar.js
│   ├── storage/
│   │   └── jsonStore.js
│   ├── telegram/
│   │   ├── client.js
│   │   └── formatter.js
│   └── utils/
│       ├── http.js
│       └── logger.js
├── test/
│   ├── fixtures/                # збережені HTML-сторінки для тестів парсерів
│   │   ├── okko.html
│   │   └── ...
│   ├── sources.test.js
│   ├── compare.test.js
│   └── formatter.test.js
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

## Основні кроки `index.js` (псевдокод)

```js
const config = loadConfig();
const previous = await store.readLatest();          // може бути null при першому запуску

if (!config.force && previous?.postedDate === today()) {
  log.info('Сьогодні вже публікували, пропускаю');
  return;
}

const { results, errors } = await collectAll(sources);
const snapshot = validate(normalize(results));

if (snapshot.stations.length === 0) {
  await notifyAdmin('Жодне джерело не повернуло цін', errors);
  process.exit(1);
}

const diff = compare(previous, snapshot);
const text = formatPost(diff, errors);

if (config.dryRun) {
  console.log(text);
  return;
}

await telegram.sendMessage(config.channelId, text);
await store.save({ ...snapshot, postedDate: today() });

if (errors.length) await notifyAdmin('Частина джерел не спрацювала', errors);
```
