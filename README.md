# PIGSEN: Make your money Smarter

MVP образовательной платформы о бизнесе, стартапах, финансах и AI с ассистентом **$PIG**.

## Запуск

```bash
npm i
cp .env.example .env      # задайте AUTH_SECRET (openssl rand -base64 32)
npm run setup             # создаёт SQLite-базу и заливает сиды
npm run dev               # http://localhost:3000
```

Зарегистрируйтесь на `/register`: после онбординга откроется главная.

### $PIG: реальный AI или демо
- `ANTHROPIC_API_KEY` пустой: работает встроенный mock-провайдер, ответы помечены как демо.
- Ключ задан: ответы стримятся из Claude (`ANTHROPIC_MODEL`, по умолчанию `claude-opus-5-5`). Ключ живёт только на сервере.

## Стек
Next.js 16 (App Router), React, TypeScript, Prisma + SQLite, zod, JWT-сессия в httpOnly cookie (jose + bcrypt).

## Архитектура
- `app/(app)/*`: разделы Главная, $PIG (`/ai`), Обучение, Библиотека, Сохранённое, Поиск, Профиль.
- `app/api/*`: auth, ai/conversations (создать, продолжить, история, удалить, стрим NDJSON), content, saved, lessons, search, recommendations, profile.
- `lib/ai`: `aiService` + сменные провайдеры (`providers/anthropic.ts`, `providers/mock.ts`).
- `lib/recommendations`: rule-engine за интерфейсом `RecommendationEngine`, легко заменить на ML.
- `lib/search`: поиск по нормализованному тексту по всем материалам, курсам и урокам.
- `proxy.ts`: проверка сессии, 401 для API, редирект для страниц, проверка Origin на изменяющих запросах.
- Безопасность: zod-валидация на сервере, rate limiting (in-memory), markdown без HTML, секреты только в `.env`.
- `prisma/schema.prisma`, `prisma/seed.ts`: 9 категорий, 23 материала, 4 курса, 14 уроков.

## Проверки
```bash
npm run lint && npm run typecheck && npm run build
npm start -- -p 3100
CHROMIUM_PATH=/path/to/chromium BASE_URL=http://localhost:3100 npm run e2e
```
`e2e` проходит весь сценарий из 15 шагов, плюс auth, защиту API, мобильную (390px) и планшетную (834px) вёрстку.

## Известные ограничения
- Внешние ссылки в сидах не проверены вживую (сеть была закрыта), сомнительные заменены на `null`.
- Rate limiting в памяти процесса: для нескольких инстансов нужен Redis.
- Для продакшена смените provider на Postgres в `schema.prisma`.
