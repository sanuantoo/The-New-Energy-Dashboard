# Chatbot Module

## Files
- `chatbot.js`
- `chatbot.css`

## Purpose
Frontend-only chatbot for:
- Metric explanations
- Section navigation
- Capacity factor guided calculation

## Core Functions (chatbot.js)

| Function | Description |
|----------|-------------|
| `generateLocalResponse(message)` | Rule-based response generation |
| `addMetricOptions()` | Renders quick-action metric buttons |
| `handleDashboardComponentSelection(option)` | Opens relevant dashboard context |
| `startCapacityFactorFlow()` / `handleCapacityFactorInput(input)` | Runs step-by-step calculator flow |
| `addUserMessage`, `addBotMessage`, `addBotRichMessage` | Message rendering |
| `setInputState`, `resetChatSession` | Input/session control |
| `escapeHtml` | User-text safety |

## Dependency
Uses dashboard data from:
- `dashboardMetrics.js`

## Styling (chatbot.css)
Defines styles for the chat icon, window, message bubbles, input area, and quick-action button.
