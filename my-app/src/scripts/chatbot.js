import { defaultResources, getChatbotMetricOptions } from '../dashboardMetrics.js';

document.addEventListener('DOMContentLoaded', function () {
    const chatbotHTML = `
        <div class="chatbot-icon" id="chatbotIcon" aria-label="Open Energy Bug chat">
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" fill="white"/>
                <circle cx="9" cy="10" r="1.2" fill="#333"/>
                <circle cx="15" cy="10" r="1.2" fill="#333"/>
                <path d="M8 14.5c1 1 2.2 1.5 4 1.5s3-.5 4-1.5" fill="none" stroke="#333" stroke-width="1"/>
            </svg>
            <span class="chatbot-icon-label">Energy Bug</span>
        </div>

        <div class="chatbot-window" id="chatbotWindow">
            <div class="chatbot-header">
                <div class="chatbot-header-info">
                    <svg class="chatbot-header-avatar" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="12" cy="12" r="10" fill="white"/>
                        <circle cx="9" cy="10" r="1.2" fill="#667eea"/>
                        <circle cx="15" cy="10" r="1.2" fill="#667eea"/>
                        <path d="M8 14.5c1 1 2.2 1.5 4 1.5s3-.5 4-1.5" fill="none" stroke="#667eea" stroke-width="1"/>
                    </svg>
                    <h2>Energy Bug</h2>
                </div>
                <button class="close-btn" id="closeBtn" aria-label="Close chat">&times;</button>
            </div>

            <div class="chatbot-messages" id="chatbotMessages">
            </div>

            <div class="chatbot-footer">
                <input 
                    type="text" 
                    class="message-input" 
                    id="messageInput" 
                    placeholder="Type your message..." 
                    autocomplete="off"
                >
                <button class="send-btn" id="sendBtn" aria-label="Send message">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="22" y1="2" x2="11" y2="13"></line>
                        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                    </svg>
                </button>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', chatbotHTML);

    const chatbotIcon = document.getElementById('chatbotIcon');
    const chatbotWindow = document.getElementById('chatbotWindow');
    const closeBtn = document.getElementById('closeBtn');
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    const chatbotMessages = document.getElementById('chatbotMessages');
    const metricOptions = getChatbotMetricOptions(defaultResources);
    const navigationAliases = {
        'energy flow diagram': 'Energy Flow Diagram',
        'supply vs demand': 'Supply vs Demand',
        'supply and demand': 'Supply vs Demand',
    };

    let chatStarted = false;
    let isSending = false;
    let capacityFactorFlow = null;
    let highlightedSection = null;
    let highlightedSectionTimer = null;

    chatbotIcon.addEventListener('click', () => {
        chatbotWindow.classList.toggle('open');

        if (chatbotWindow.classList.contains('open')) {
            resetChatSession();
            messageInput.focus();
            addBotMessage("Hello! I'm Energy Bug. Ask me anything about your energy system, monitoring, or alerts.");
            addMetricOptions();
            chatbotMessages.scrollTop = 0;
            chatStarted = true;
        }
    });

    closeBtn.addEventListener('click', () => {
        chatbotWindow.classList.remove('open');
    });

    sendBtn.addEventListener('click', sendMessage);

    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    async function sendMessage() {
        const message = messageInput.value.trim();
        if (message === '' || isSending) return;

        if (message.toLowerCase() === 'exit') {
            addUserMessage(message);
            messageInput.value = '';
            addBotMessage('Goodbye! Closing the chat.');
            setTimeout(() => {
                chatbotWindow.classList.remove('open');
                resetChatSession();
            }, 1000);
            return;
        }

        if (capacityFactorFlow && capacityFactorFlow.active) {
            addUserMessage(message);
            messageInput.value = '';
            handleCapacityFactorInput(message);
            return;
        }

        const navigationOption = findNavigationOption(message);
        if (navigationOption) {
            addUserMessage(message);
            messageInput.value = '';
            handleDashboardComponentSelection(navigationOption);
            return;
        }

        addUserMessage(message);
        messageInput.value = '';
        setInputState(true);

        const thinkingMessage = addBotMessage('Thinking...');

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message })
            });

            const data = await response.json();

            thinkingMessage.remove();

            if (!response.ok) {
                addBotMessage(data.reply || 'The assistant is temporarily unavailable.');
                return;
            }

            addBotMessage(data.reply || 'No response received.');
        } catch {
            thinkingMessage.remove();
            addBotMessage('There was a problem reaching the assistant.');
        } finally {
            setInputState(false);
        }
    }

    function addMetricOptions() {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', 'bot');

        const content = document.createElement('div');
        content.classList.add('message-content');
        content.textContent = 'Dashboard components';

        const list = document.createElement('div');
        list.classList.add('bot-list');

        metricOptions.forEach((option) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.classList.add('bot-list-btn');
            button.textContent = option.label;
            button.addEventListener('click', () => {
                addUserMessage(option.label);
                handleDashboardComponentSelection(option);

            });
            list.appendChild(button);
        });

        content.appendChild(list);
        messageDiv.appendChild(content);
        chatbotMessages.appendChild(messageDiv);
        scrollToBottom();
    }

    function addUserMessage(text) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', 'user');
        messageDiv.innerHTML = `<div class="message-content">${escapeHtml(text)}</div>`;
        chatbotMessages.appendChild(messageDiv);
        scrollToBottom();
    }

    function addBotMessage(text) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', 'bot');
        messageDiv.innerHTML = `<div class="message-content">${escapeHtml(text)}</div>`;
        chatbotMessages.appendChild(messageDiv);
        scrollToBottom();
        return messageDiv;
    }

    function addBotRichMessage(html) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', 'bot');
        messageDiv.innerHTML = `<div class="message-content">${html}</div>`;
        chatbotMessages.appendChild(messageDiv);
        scrollToBottom();
        return messageDiv;
    }

    function addMetricDefinitionMessage(option) {
        const safeLabel = escapeHtml(option.label);
        const safeDefinition = escapeHtml(option.definition || option.description);
        const safeValue = escapeHtml(option.value);

        addBotRichMessage(
            `<div class="metric-detail-card">` +
            `<div class="metric-detail-header">${safeLabel}</div>` +
            `<div class="metric-detail-row">` +
            `<span class="metric-detail-label">Definition</span>` +
            `<p class="metric-detail-text">${safeDefinition}</p>` +
            `</div>` +
            `<div class="metric-detail-row metric-detail-value-row">` +
            `<span class="metric-detail-label">Current value</span>` +
            `<strong class="metric-detail-value">${safeValue}</strong>` +
            `</div>` +
            `</div>`
        );
    }

    function handleDashboardComponentSelection(option) {
        if (option.label === 'Capacity Factor') {
            addMetricDefinitionMessage(option);
            addCapacityFactorPrompt();
            return;
        }

        if (option.navigationTarget) {
            navigateToDashboardSection(option.navigationTarget);
        }

        addMetricDefinitionMessage(option);
    }

    function findNavigationOption(message) {
        const normalizedMessage = message.trim().toLowerCase();
        const matchedAlias = Object.keys(navigationAliases).find((alias) => normalizedMessage.includes(alias));

        if (!matchedAlias) {
            return null;
        }

        return metricOptions.find((option) => option.label === navigationAliases[matchedAlias]) ?? null;
    }

    function navigateToDashboardSection(sectionName) {
        const target = document.querySelector(`[data-chatbot-section="${sectionName}"]`);
        if (!target) {
            return;
        }

        target.scrollIntoView({ behavior: 'smooth', block: 'center' });

        if (highlightedSectionTimer) {
            clearTimeout(highlightedSectionTimer);
            highlightedSectionTimer = null;
        }

        if (highlightedSection && highlightedSection !== target) {
            highlightedSection.classList.remove('chatbot-section-active');
        }

        target.classList.remove('chatbot-section-active');
        void target.offsetWidth;
        target.classList.add('chatbot-section-active');

        highlightedSection = target;
        highlightedSectionTimer = window.setTimeout(() => {
            target.classList.remove('chatbot-section-active');
            if (highlightedSection === target) {
                highlightedSection = null;
            }
            highlightedSectionTimer = null;
        }, 1800);
    }

    function addCapacityFactorPrompt() {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', 'bot');

        const content = document.createElement('div');
        content.classList.add('message-content');
        content.textContent = 'Do you need to know how to calculate the capacity factor?';

        const list = document.createElement('div');
        list.classList.add('bot-list');

        const yesButton = document.createElement('button');
        yesButton.type = 'button';
        yesButton.classList.add('bot-list-btn');
        yesButton.textContent = 'Yes';
        yesButton.addEventListener('click', () => {
            addUserMessage('Yes');
            addBotRichMessage('Capacity Factor = (Actual Energy Output ÷ Maximum Possible Energy Output) × 100<br><br><strong>A Simple Example</strong><br>A power plant with a capacity of 1 Megawatt (MW) runs for 1 hour.<br><br>It could have produced a maximum of: 1 MW × 1 hour = 1 MWh.<br><br>It actually produced 0.5 MWh.<br><br>Its capacity factor is: (0.5 MWh ÷ 1 MWh) × 100 = 50%.');
            addCapacityFactorCalculationChoice();
        });

        const noButton = document.createElement('button');
        noButton.type = 'button';
        noButton.classList.add('bot-list-btn');
        noButton.textContent = 'No';
        noButton.addEventListener('click', () => {
            addUserMessage('No');
            addMetricOptions();
        });

        list.appendChild(yesButton);
        list.appendChild(noButton);
        content.appendChild(list);
        messageDiv.appendChild(content);
        chatbotMessages.appendChild(messageDiv);
        scrollToBottom();
    }

    function addCapacityFactorCalculationChoice() {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', 'bot');

        const content = document.createElement('div');
        content.classList.add('message-content');
        content.textContent = 'Do you need to perform a calculation or return to Dashboard components?';

        const list = document.createElement('div');
        list.classList.add('bot-list');

        const performCalculationButton = document.createElement('button');
        performCalculationButton.type = 'button';
        performCalculationButton.classList.add('bot-list-btn');
        performCalculationButton.textContent = 'Perform calculation';
        performCalculationButton.addEventListener('click', () => {
            addUserMessage('Perform calculation');
            startCapacityFactorFlow();
        });

        const returnDashboardButton = document.createElement('button');
        returnDashboardButton.type = 'button';
        returnDashboardButton.classList.add('bot-list-btn');
        returnDashboardButton.textContent = 'Return to Dashboard components';
        returnDashboardButton.addEventListener('click', () => {
            addUserMessage('Return to Dashboard components');
            addMetricOptions();
        });

        list.appendChild(performCalculationButton);
        list.appendChild(returnDashboardButton);
        content.appendChild(list);
        messageDiv.appendChild(content);
        chatbotMessages.appendChild(messageDiv);
        scrollToBottom();
    }

    function startCapacityFactorFlow() {
        capacityFactorFlow = {
            active: true,
            step: 'ratedCapacityMw',
            ratedCapacityMw: null,
            durationHours: null,
            actualEnergyMwh: null,
        };

        addBotMessage('I can calculate it for you. Enter rated capacity in MW (for example: 1.5).');
    }

    function handleCapacityFactorInput(input) {
        if (!capacityFactorFlow || !capacityFactorFlow.active) {
            return;
        }

        if (capacityFactorFlow.step === 'ratedCapacityMw') {
            const ratedCapacityMw = parsePositiveNumber(input);
            if (ratedCapacityMw === null) {
                addBotMessage('Please enter a valid positive number for rated capacity in MW.');
                return;
            }

            capacityFactorFlow.ratedCapacityMw = ratedCapacityMw;
            capacityFactorFlow.step = 'durationHours';
            addBotMessage('Great. Now enter the duration in hours (for example: 6).');
            return;
        }

        if (capacityFactorFlow.step === 'durationHours') {
            const durationHours = parsePositiveNumber(input);
            if (durationHours === null) {
                addBotMessage('Please enter a valid positive number for duration in hours.');
                return;
            }

            capacityFactorFlow.durationHours = durationHours;
            capacityFactorFlow.step = 'actualEnergyMwh';
            addBotMessage('Perfect. Now enter actual energy produced in MWh (zero or more, for example: 12).');
            return;
        }

        if (capacityFactorFlow.step === 'actualEnergyMwh') {
            const actualEnergyMwh = parseNonNegativeNumber(input);
            if (actualEnergyMwh === null) {
                addBotMessage('Please enter a valid number that is zero or greater for actual energy produced in MWh.');
                return;
            }

            capacityFactorFlow.actualEnergyMwh = actualEnergyMwh;

            const maximumPossibleEnergy = capacityFactorFlow.ratedCapacityMw * capacityFactorFlow.durationHours;
            if (maximumPossibleEnergy <= 0) {
                addBotMessage('Unable to calculate because maximum possible energy is zero. Please restart with positive inputs.');
                capacityFactorFlow = null;
                return;
            }

            const capacityFactorPercent = (capacityFactorFlow.actualEnergyMwh / maximumPossibleEnergy) * 100;
            addBotRichMessage(
                `<strong>Your Capacity Factor Result</strong><br>` +
                `Formula: (Actual Energy Output ÷ Maximum Possible Energy Output) × 100<br><br>` +
                `Maximum possible energy = ${formatNumber(capacityFactorFlow.ratedCapacityMw)} MW × ${formatNumber(capacityFactorFlow.durationHours)} h = ${formatNumber(maximumPossibleEnergy)} MWh<br>` +
                `Actual energy output = ${formatNumber(capacityFactorFlow.actualEnergyMwh)} MWh<br><br>` +
                `Capacity factor = (${formatNumber(capacityFactorFlow.actualEnergyMwh)} ÷ ${formatNumber(maximumPossibleEnergy)}) × 100 = <strong>${formatNumber(capacityFactorPercent)}%</strong>`
            );

            addCapacityFactorCalculationChoice();

            capacityFactorFlow = null;
        }
    }

    function parsePositiveNumber(input) {
        const parsed = Number(input.replace(',', '.'));
        if (!Number.isFinite(parsed) || parsed <= 0) {
            return null;
        }
        return parsed;
    }

    function parseNonNegativeNumber(input) {
        const parsed = Number(input.replace(',', '.'));
        if (!Number.isFinite(parsed) || parsed < 0) {
            return null;
        }
        return parsed;
    }

    function formatNumber(value) {
        const rounded = Math.round(value * 100) / 100;
        return rounded.toLocaleString(undefined, { maximumFractionDigits: 2 });
    }

    function setInputState(disabled) {
        isSending = disabled;
        messageInput.disabled = disabled;
        sendBtn.disabled = disabled;
        messageInput.placeholder = disabled ? 'Waiting for assistant...' : 'Type your message...';
    }

    function resetChatSession() {
        chatbotMessages.innerHTML = '';
        messageInput.value = '';
        setInputState(false);
        chatStarted = false;
        capacityFactorFlow = null;
    }

    function scrollToBottom() {
        chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
});