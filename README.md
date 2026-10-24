# Stychat 1.8.0 для PostgreSQL

Это полный исходный проект Stychat 1.8.0, в который добавлена версия API для PostgreSQL.

## Важно перед запуском

- Архив подготовлен на основе проекта 1.8.0 и набора миграции. Он **не был собран и протестирован в вашей локальной среде**, поэтому сначала проверьте сборку.
- Не удаляйте старую SQLite-базу и резервные копии, пока не убедитесь, что всё работает.
- Не отправляйте в GitHub файлы базы, JSON-экспорт, реальные пароли или секреты.

## 1. Установка

Откройте PowerShell в папке проекта и выполните:

```powershell
npm install
npm install pg -w apps/api
npm install -D @types/pg -w apps/api
```

## 2. Настройка PostgreSQL

Создайте пустую базу PostgreSQL. Скопируйте `.env.example` в `.env` и заполните `DATABASE_URL` и `JWT_SECRET`. Не публикуйте `.env`.

Для локального запуска укажите `CLIENT_ORIGIN=http://localhost:5173`. Для сайта на Vercel укажите `CLIENT_ORIGIN=https://stychat.vercel.app`.

Примените схему из корня проекта:

```powershell
psql "$env:DATABASE_URL" -v ON_ERROR_STOP=1 -f .\apps\api\migrations\001_init.sql
```

Команда требует установленного PostgreSQL `psql` и доступной строки подключения.

## 3. Перенос старых данных (если нужен)

Импортёр ожидает локальный файл `backups/sqlite/stychat-export.json`. Если такого экспорта нет, не запускайте команду, пока не создадите экспорт из старой SQLite-базы. Импорт выполняется только в пустые таблицы.

```powershell
node .\apps\api\scripts\import-sqlite-export.mjs .\backups\sqlite\stychat-export.json
```

Экспорт содержит данные аккаунтов, хеши паролей и переписки. Храните его только локально.

## 4. Сборка и запуск

```powershell
npm run build
npm run dev
```

Проверьте API по адресу `http://localhost:3001/api/health`. Затем проверьте регистрацию, вход, личные сообщения, группы, поиск и отправку файлов.

## 5. Развёртывание

Для API на Render:

- Build Command: `npm install && npm run build -w apps/api`
- Start Command: `npm run start -w apps/api`
- Health Check Path: `/api/health`
- Переменные: `DATABASE_URL`, `JWT_SECRET`, `CLIENT_ORIGIN=https://stychat.vercel.app`, `NODE_ENV=production`

В настройках Vercel установите `VITE_API_URL` равным базовому URL опубликованного API и выполните повторное развёртывание.

**Важно:** загруженные медиафайлы пока хранятся на локальном диске сервера. На Render они могут пропасть после перезапуска/переразмещения. Для постоянного хранения потребуется отдельное хранилище или постоянный диск.
