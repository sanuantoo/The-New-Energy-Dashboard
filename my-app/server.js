import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 3001;
const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
const systemPrompt = process.env.CHATBOT_SYSTEM_PROMPT || 'You are Energy Bug, a concise and helpful assistant for energy system monitoring.';
const geminiApiKey = process.env.GEMINI_API_KEY;

if (!geminiApiKey) {
    console.warn('GEMINI_API_KEY is not set. Chat requests will fail until the environment variable is configured.');
}

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
});

app.post('/api/chat', async (req, res) => {
    const { message } = req.body ?? {};

    if (typeof message !== 'string' || message.trim() === '') {
        return res.status(400).json({
            reply: 'A message is required.',
        });
    }

    if (!geminiApiKey) {
        return res.status(503).json({
            reply: 'The assistant is not configured yet. Add GEMINI_API_KEY in .env and restart the server.',
        });
    }

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 25000);

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                {
                                    text: `${systemPrompt}\n\nUser: ${message.trim()}`,
                                },
                            ],
                        },
                    ],
                }),
                signal: controller.signal,
            }
        );

        clearTimeout(timeout);

        const payload = await response.json();

        if (!response.ok) {
            const errMessage = payload?.error?.message || 'The assistant is temporarily unavailable.';

            return res.status(response.status).json({
                reply: errMessage,
            });
        }

        const reply = payload?.candidates?.[0]?.content?.parts
            ?.map((part) => part?.text)
            .filter(Boolean)
            .join(' ')
            ?.trim();

        return res.json({
            reply: reply || 'No response received from the assistant.',
        });
    } catch (error) {
        const isAbort = error?.name === 'AbortError';
        console.error('Gemini request failed:', error);

        return res.status(isAbort ? 504 : 500).json({
            reply: isAbort ? 'The assistant request timed out. Please try again.' : 'The assistant is temporarily unavailable.',
        });
    }
});

app.listen(port, () => {
    console.log(`Chat API server running on http://localhost:${port}`);
});
