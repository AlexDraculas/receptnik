# Деплой на Worker-а

Пълните, разписани стъпка по стъпка инструкции (без терминал, само с мишката)
са във файла **`ИНСТРУКЦИИ-AI-ФУНКЦИИ.md`** в основната папка на проекта
(една папка нагоре от тази). Тръгни оттам.

---

## За по-технически вариант (по избор)

Ако някога предпочетеш команден ред вместо Cloudflare сайта:
```
npm install -g wrangler
wrangler login
wrangler deploy        # от тази папка (worker/)
wrangler secret put ANTHROPIC_API_KEY
wrangler secret put APP_TOKEN
```
Стойността за `APP_TOKEN` трябва да съвпада с `AI_APP_TOKEN` в `js/core/api.js`.
