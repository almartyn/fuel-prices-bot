# Розробка

## Вимоги

- Node.js 24 LTS або новіший (`node -v`). Потрібні вбудовані `fetch`, `node:test` і прапорець `--env-file-if-exists`. Версія зафіксована в `.nvmrc`, тож достатньо `nvm use`.
- npm (йде разом з Node.js).
- Git.

## Встановлення

```bash
npm install
cp .env.example .env
```

## Скрипти `package.json`

```json
{
  "type": "module",
  "engines": { "node": ">=24" },
  "scripts": {
    "start": "node --env-file-if-exists=.env src/index.js",
    "dry-run": "DRY_RUN=true node --env-file-if-exists=.env src/index.js",
    "dry-run:offline": "DRY_RUN=true OFFLINE=true node src/index.js",
    "fixtures:update": "node scripts/update-fixtures.js",
    "test": "node --import ./test/setup.js --test 'test/**/*.test.js' '.cursor/hooks/*.test.mjs'",
    "lint": "eslint .",
    "typecheck": "tsc",
    "check": "npm run lint && npm run typecheck && npm test"
  }
}
```

`--env-file-if-exists` читає `.env`, якщо він є, і не падає без нього — так dry-run працює і в CI.

| Команда | Що робить |
|---|---|
| `npm run dry-run` | Збирає ціни з усіх джерел, порівнює і друкує пост у консоль. Нічого не публікує і не зберігає. Основний режим під час розробки. |
| `SOURCES=okko npm run dry-run` | Те саме, але лише для одного джерела. |
| `npm run dry-run:offline` | Те саме без мережі: відповіді сайтів беруться з `test/fixtures/` за `test/fixtures/manifest.json`. |
| `npm run fixtures:update -- wog` | Завантажити свіжі відповіді сайтів у `test/fixtures/` (без аргументів — усі джерела з маніфесту). |
| `npm start` | Повний запуск: публікація і збереження знімка. |
| `npm test` | Запуск тестів. |
| `npm run typecheck` | Перевірка типів за JSDoc-анотаціями (`tsc` з `checkJs`, без компіляції). |
| `npm run check` | Лінтер, типи і тести разом. Те саме запускає CI (`.github/workflows/ci.yml`) і хук Cursor після кожної відповіді агента. |

Пост друкується в `stdout`, логи — у `stderr`, тож `npm run dry-run > post.txt` зберігає лише текст поста.

## Залежності

Мінімальний набір:

| Пакет | Навіщо |
|---|---|
| `cheerio` | Розбір HTML за CSS-селекторами. Поточним чотирьом джерелам не потрібен (усі віддають JSON), додаємо, лише якщо з'явиться джерело з розбором HTML |
| `playwright` | Лише якщо якесь джерело вимагає виконання JavaScript |
| `eslint`, `@eslint/js`, `globals` (dev) | Перевірка стилю коду |
| `typescript`, `@types/node` (dev) | Перевірка типів JSDoc. Код лишається на JavaScript |

Для HTTP, Telegram, тестів і `.env` вистачає можливостей Node.js.

## Тести

Тести не звертаються до реальних сайтів і Telegram — вони працюють на збережених даних. Це гарантує `test/setup.js`: він підміняє глобальний `fetch` на такий, що завжди кидає помилку. Код, який ходить у мережу, приймає `fetch` параметром, і тест передає підробку. Спільні підробки (джерело, сховище, Telegram, логер, конфіг) — у `test/helpers/fakes.js`.

| Що тестуємо | Як |
|---|---|
| Парсери | Кожен парсер розбирає збережену сторінку з `test/fixtures/<source>.html` (або `.json`), перевіряємо, що повернуто очікувані ціни. Для цього парсер ділимо на дві функції: `fetchPrices()` (завантаження) і `parse(html)` (чистий розбір, який і тестуємо). |
| Нормалізація | Відомі назви → правильні коди; невідома назва → пропускається. |
| Валідація | Ціни поза межами і різкі стрибки відсіюються. |
| Порівняння | Подорожчання, здешевлення, без змін, новий вид пального, перший запуск без `previous`, пропущені дні, середні ціни. |
| Форматер | Готовий текст поста для фіксованого набору даних (порівнюємо з очікуваним рядком — прикладом з [Формату поста](message-format.md)). |
| Увесь ланцюжок | `test/e2e.test.js` проганяє `run()` в режимі dry-run з усіма зареєстрованими джерелами на фікстурах і порівнює пост з еталоном `test/golden/dry-run.txt`. |

Еталон оновлюється командою `UPDATE_GOLDEN=1 npm test`. Після цього обов'язково переглянути `git diff test/golden/`: еталон — це специфікація, і зміна в ньому має бути свідомою.

Коли сайт змінює верстку: `npm run fixtures:update -- <id>`, побачити, що тест падає, виправити парсер, тест знову зелений. Покроково — у скілі `.cursor/skills/fix-broken-parser/`.

## Як додати нове джерело

Агент Cursor робить це за скілами `research-source` (кроки 1–2) і `add-fuel-source` (решта).

1. Дослідити сайт за інструкцією з [Джерела даних](sources.md#як-дослідити-сайт-перед-написанням-парсера).
2. Зберегти відповідь сайту в `test/fixtures/<id>.json` (або `.html`) і додати її URL та файл у `test/fixtures/manifest.json`.
3. Створити `src/sources/<id>.js` за контрактом парсера (зразок — `src/sources/wog.js`).
4. Додати назви пального в словник `FUEL_MAP` у `src/core/fuels.js`.
5. Зареєструвати джерело в `src/sources/index.js`.
6. Написати тест у `test/sources.test.js` і оновити еталон поста (`UPDATE_GOLDEN=1 npm test`).
7. Перевірити: `npm run check`, потім `SOURCES=<id> npm run dry-run`.
8. Оновити таблицю джерел у `docs/sources.md`.

## Стиль коду

- ES-модулі (`import` / `export`), `async` / `await`.
- Чисті функції там, де можливо (`parse`, `normalize`, `validate`, `compare`, `formatPost`): приймають дані, повертають дані, без побічних ефектів. Їх легко тестувати.
- Побічні ефекти (мережа, файли, Telegram) — лише у `sources/*.fetchPrices`, `storage`, `telegram/client` та `index.js`.
- Гроші рахуємо в копійках (цілих числах), у гривні переводимо лише для відображення.

## `.gitignore`

```
node_modules/
.env
.env.*
!.env.example
*.log
```

Папка `data/` **не** ігнорується — вона має бути в репозиторії.
