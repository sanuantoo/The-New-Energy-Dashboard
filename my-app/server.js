import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import OpenAI from 'openai';

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 3001;
const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const systemPrompt = process.env.CHATBOT_SYSTEM_PROMPT || 'You are a helpful assistant. Answer any question the user asks clearly and accurately.';
const openaiApiKey = process.env.OPENAI_API_KEY;

if (!openaiApiKey) {
    console.warn('OPENAI_API_KEY is not set. Chat requests will fail until the environment variable is configured.');
}

const openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;

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

    if (!openai) {
        return res.status(503).json({
            reply: 'The assistant is not configured yet. Add OPENAI_API_KEY in .env and restart the server.',
        });
    }

    try {
        const completion = await openai.chat.completions.create({
            model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: message.trim() },
            ],
        });

        const reply = completion.choices[0]?.message?.content?.trim();

        return res.json({
            reply: reply || 'No response received from the assistant.',
        });
    } catch (error) {
        console.error('OpenAI request failed:', error);

        return res.status(500).json({
            reply: 'The assistant is temporarily unavailable.',
        });
    }
});

app.listen(port, () => {
    console.log(`Chat API server running on http://localhost:${port}`);
});
