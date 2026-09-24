# Розгортання: GitHub Actions

## Чому GitHub Actions

- Безкоштовно для публічних репозиторіїв, а для приватних щомісячного ліміту хвилин з великим запасом вистачає (один запуск — близько 1 хвилини).
- Не треба орендувати й обслуговувати сервер.
- Логи кожного запуску зберігаються і доступні у вкладці Actions.
- Дані (знімки цін) зберігаються прямо в репозиторії.

## Workflow

Файл `.github/workflows/daily-post.yml`:

```yaml
name: Daily fuel prices

on:
  schedule:
    - cron: '0 6 * * *'     # 06:00 UTC = 09:00 за Києвом влітку, 08:00 взимку
  workflow_dispatch:         # ручний запуск з вкладки Actions
    inputs:
      dry_run:
        description: 'Лише показати пост, не публікувати'
        type: boolean
        default: false
      force:
        description: 'Опублікувати, навіть якщо сьогодні вже публікували'
        type: boolean
        default: false

permissions:
  contents: write            # щоб закомітити data/

concurrency:
  group: daily-post
  cancel-in-progress: false  # не запускати два пости паралельно

jobs:
  post:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - run: npm ci

      - name: Collect prices and post
        run: node src/index.js
        env:
          TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}
          TELEGRAM_ADMIN_CHAT_ID: ${{ secrets.TELEGRAM_ADMIN_CHAT_ID }}
          TELEGRAM_CHANNEL_ID: ${{ vars.TELEGRAM_CHANNEL_ID }}
          DRY_RUN: ${{ inputs.dry_run || 'false' }}
          FORCE: ${{ inputs.force || 'false' }}

      - name: Commit snapshot
        if: success() && inputs.dry_run != true
        run: |
          git config user.name  "fuel-prices-bot"
          git config user.email "fuel-prices-bot@users.noreply.github.com"
          git add data/
          git diff --staged --quiet || git commit -m "data: prices for $(TZ=Europe/Kyiv date +%F)"
          git push
```

Версії actions (`@v4`) і Node.js варто перевірити на момент реалізації й оновити до актуальних.

## Розклад і часові пояси

- Cron у GitHub Actions працює **лише в UTC**.
- Україна переходить на літній час: влітку UTC+3, взимку UTC+2. Тому `0 6 * * *` означає 09:00 влітку і 08:00 взимку.
- Якщо потрібен стабільно один і той самий київський час, є два варіанти:
  1. Два розклади (`0 6 * * *` і `0 7 * * *`), а скрипт сам перевіряє, чи зараз потрібна київська година, і лишній запуск завершується без дій.
  2. Змиритися з різницею в годину — для щоденного поста зазвичай некритично.
- **Запуски за розкладом можуть запізнюватися** на 5–30 хвилин у години пікового навантаження GitHub. Не ставимо розклад рівно на `:00`, краще, наприклад, `17 6 * * *` — у «круглі» хвилини черга найбільша.

## Захист від повторної публікації

Запуск може статися двічі: ручний перезапуск, два розклади, повтор після збою. Щоб не було двох постів за день, скрипт перевіряє `postedDate` в `data/latest.json`: якщо він дорівнює сьогоднішній київській даті, публікація пропускається. Обійти можна через `FORCE=true`.

## Неактивні репозиторії

GitHub автоматично вимикає scheduled workflows у публічних репозиторіях, де 60 днів не було активності. Щоденні коміти зі знімками цін є активністю, тож у нормальному режимі це не проблема. Але якщо бот довго падає і нічого не комітить, workflow може вимкнутись — тоді його треба ввімкнути вручну у вкладці Actions.

## Playwright (якщо знадобиться)

Якщо якесь джерело потребуватиме headless-браузера, в workflow додається крок перед запуском:

```yaml
      - run: npx playwright install --with-deps chromium
```

Це додає 30–60 секунд до кожного запуску. Кешувати браузер можна через `actions/cache` для папки `~/.cache/ms-playwright`.

## Альтернатива: VPS

Якщо колись знадобиться точний час запуску або важкі обчислення, той самий скрипт без змін запускається на будь-якому сервері через cron:

```cron
17 9 * * * cd /opt/fuel-prices-bot && node --env-file=.env src/index.js >> logs/run.log 2>&1
```

На VPS можна задати `CRON_TZ=Europe/Kyiv`, тоді проблеми літнього часу немає. Єдина відмінність — знімки зберігаються на диску сервера і їх не треба комітити.
