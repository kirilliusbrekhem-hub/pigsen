# PIGSEN: Make your money Smarter

MVP образовательной платформы о бизнесе, стартапах, финансах и AI с ассистентом **$PIG**.

## Запуск

```bash
npm i
cp .env.example .env      # впишите DATABASE_URL, DIRECT_URL и AUTH_SECRET
npm run setup             # создаёт таблицы в Postgres и заливает сиды
npm run dev               # http://localhost:3000
```

Зарегистрируйтесь на `/register`: после онбординга откроется главная.

### $PIG: реальный AI или демо
- Нет ключей: работает встроенный mock-провайдер, ответы помечены как демо.
- `GEMINI_API_KEY` задан: ответы стримятся из Google Gemini (`GEMINI_MODEL`; по умолчанию облегчённая `gemini-3.8-flash-lite`, при ошибке или перегрузке автоматически `gemini-3.8-flash`). Ключ берётся на aistudio.google.com/apikey.
- `ANTHROPIC_API_KEY` задан (и нет ключа Gemini): ответы стримятся из Claude (`ANTHROPIC_MODEL`, по умолчанию `claude-opus-5-5`). Ключ живёт только на сервере.

## Геймификация и инструменты
- **XP и уровни**: +20 XP за урок, +10 за верный ответ в квизе, +15 за разбор идеи (раз в день). Уровни от «Стажёра» до «Магната», 10 бейджей, серия дней подряд.
- **Квиз после урока**: $PIG составляет 4 вопроса по тексту урока; в демо-режиме вопросы собираются по правилам. XP за квиз начисляется один раз на урок.
- **Инструменты** (`/tools`): калькуляторы сложного процента, юнит-экономики и цели накоплений, разбор бизнес-идеи от $PIG с историей.
- **Факт дня** на главной с вопросом для $PIG.

## Стек
Next.js 16 (App Router), React, TypeScript, Prisma + Postgres (Supabase), zod, JWT-сессия в httpOnly cookie (jose + bcrypt).

## Архитектура
- `app/(app)/*`: разделы Главная, $PIG (`/ai`), Обучение, Библиотека, Сохранённое, Поиск, Профиль.
- `app/api/*`: auth, ai/conversations (создать, продолжить, история, удалить, стрим NDJSON), content, saved, lessons, search, recommendations, profile.
- `lib/ai`: `aiService` + сменные провайдеры (`providers/gemini.ts`, `providers/anthropic.ts`, `providers/mock.ts`).
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
`e2e` проходит весь сценарий из 15 шагов, `node scripts/e2e-boom.mjs` проверяет XP, квизы, инструменты и факт дня, плюс auth, защиту API, мобильную (390px) и планшетную (834px) вёрстку.

## Известные ограничения
- Внешние ссылки в сидах не проверены вживую (сеть была закрыта), сомнительные заменены на `null`.
- Rate limiting в памяти процесса: для нескольких инстансов нужен Redis.

## Публикация: Vercel + Supabase
1. **Supabase**: создайте проект, нажмите Connect → ORMs → Prisma и возьмите две строки:
   - `DATABASE_URL` (порт 6543), в конец добавьте `?pgbouncer=true&connection_limit=1`;
   - `DIRECT_URL` (порт 5432).
2. **Таблицы и данные** создаются автоматически при сборке на Vercel (`npm run build` выполняет `prisma db push` и сид, повторный запуск безопасен).
3. **Vercel**: Add New → Project, выберите репозиторий. В Environment Variables добавьте `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET` и, по желанию, `GEMINI_API_KEY` или `ANTHROPIC_API_KEY`. Нажмите Deploy.
