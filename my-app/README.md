# Energy System Monitor

This project uses a Vite React frontend plus a small Express backend for the chatbot. The browser sends requests to `/api/chat`, and the backend calls OpenAI with a server-side API key.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file in the project root:

```env
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4.1-mini
CHATBOT_SYSTEM_PROMPT=You are Energy Bug, a concise and helpful assistant for energy system monitoring.
PORT=3001
```

3. Start the frontend and backend together:

```bash
npm run dev
```

The Vite dev server proxies `/api/*` requests to the Express server on port `3001`.

## Chatbot API

The backend endpoint accepts:

```json
{
  "message": "How much power is being used right now?"
}
```

And responds with:

```json
{
  "reply": "...assistant response..."
}
```

## Security

- Keep `OPENAI_API_KEY` only in `.env` on the server.
- Do not expose the OpenAI key in frontend code or client-side Vite env variables.
