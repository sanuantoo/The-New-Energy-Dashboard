import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import OpenAI from 'openai';

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 3001;
const model = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
const systemPrompt = process.env.CHATBOT_SYSTEM_PROMPT || 'You are Energy Bug, a concise and helpful assistant for energy system monitoring.';

if (!process.env.OPENAI_API_KEY) {
    console.warn('OPENAI_API_KEY is not set. Chat requests will fail until the environment variable is configured.');
}

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

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

    try {
        const response = await openai.responses.create({
            model,
            input: [
                {
                    role: 'system',
                    content: systemPrompt,
                },
                {
                    role: 'user',
                    content: message.trim(),
                },
            ],
        });

        return res.json({
            reply: response.output_text || 'No response received from the assistant.',
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
