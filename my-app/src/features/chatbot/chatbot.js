import { defaultResources, getChatbotMetricOptions } from '../../data/dashboardMetrics.js';

document.addEventListener('DOMContentLoaded', function () {
    /* HTML structure for chatbot UI injected dynamically into the page */
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
    /* Inject chatbot UI into the DOM */
    document.body.insertAdjacentHTML('beforeend', chatbotHTML);

    // Cache DOM references once to keep all handlers fast and readable.
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
    /* Chat state tracking variables */
    let chatStarted = false;// Tracks whether chat session has started
    let isSending = false;// Prevents duplicate message sending
    let capacityFactorFlow = null; // Stores flow state for analytics interactions
    let highlightedSection = null;// Tracks currently highlighted dashboard section
    let highlightedSectionTimer = null;// Timer for removing highlights

    // Opens/closes the chat panel and resets conversational state on open.
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
    /* Close chatbot window when close button is clicked */
    closeBtn.addEventListener('click', () => {
        chatbotWindow.classList.remove('open');
    });

    // Wire submit actions for button click and Enter key.
    sendBtn.addEventListener('click', sendMessage);

    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    /* Handles sending and processing of user messages in the chatbot */
    async function sendMessage() {
        // Guard against empty submissions and concurrent requests.
        const message = messageInput.value.trim();
        if (message === '' || isSending) return;

        // Special command to close and reset the chat.
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

        /* ----------------------------------------
             CAPACITY FACTOR INTERACTIVE FLOW MODE
          -----------------------------------------*/
        if (capacityFactorFlow && capacityFactorFlow.active) {
            addUserMessage(message);
            messageInput.value = '';
            handleCapacityFactorInput(message);
            return;
        }

        // Allow natural language shortcuts to jump to dashboard sections.
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

        const localReply = generateLocalResponse(message);
        // Simulate delay for realistic chatbot behavior
        setTimeout(() => {
            addBotMessage(localReply);
            setInputState(false);
        }, 350);
    }

    /* ---------------------------------------------------
       GENERATES LOCAL RULE-BASED RESPONSE 
      ----------------------------------------------------*/
    function generateLocalResponse(message) {
        const normalizedMessage = message.trim().toLowerCase();

        if (normalizedMessage.includes('hello') || normalizedMessage.includes('hi')) {
            return 'Hi! I can help explain dashboard metrics and guide you to sections. Pick a component from the list, or ask about demand, renewable generation, grid import, cost, or capacity factor.';
        }

        if (normalizedMessage.includes('help')) {
            return ' I can explain dashboard metrics, help with capacity factor calculations, and navigate to key dashboard sections.';
        }

        if (normalizedMessage.includes('capacity factor')) {
            const capacityFactorOption = metricOptions.find((option) => option.label === 'Capacity Factor');
            if (capacityFactorOption) {
                handleDashboardComponentSelection(capacityFactorOption);
                return 'Opened the Capacity Factor details. You can continue with the calculator prompts above.';
            }
        }

        const directMatch = metricOptions.find((option) => normalizedMessage.includes(option.label.toLowerCase()));
        if (directMatch) {
            handleDashboardComponentSelection(directMatch);
            return `Showing details for ${directMatch.label}.`;
        }

        return ' Please ask about available dashboard components, demand, renewable generation, cost, or capacity factor, and I will assist using local project data.';
    }

    /* ---------------------------------------------------
       CREATES CLICKABLE QUICK ACTION BUTTONS IN CHATBOT
      ----------------------------------------------------*/
    function addMetricOptions() {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', 'bot');

        const content = document.createElement('div');
        content.classList.add('message-content');
        content.textContent = 'Dashboard components';

        const list = document.createElement('div');
        list.classList.add('bot-list');
        // Create a button for each metric option
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

        // Append UI elements to chatbot window
        content.appendChild(list);
        messageDiv.appendChild(content);
        chatbotMessages.appendChild(messageDiv);

        // Scroll to latest message
        scrollToBottom();
    }
    /* ---------------------------------------------
       RENDERS A USER MESSAGE IN CHAT WINDOW
    ----------------------------------------------*/
    function addUserMessage(text) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', 'user');
        messageDiv.innerHTML = `<div class="message-content">${escapeHtml(text)}</div>`;
        chatbotMessages.appendChild(messageDiv);
        scrollToBottom();
    }

    /* ---------------------------------------------
       RENDERS A PLAIN ASSISTANT MESSAGE IN CHAT WINDOW
    ----------------------------------------------*/
    function addBotMessage(text) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', 'bot');
        messageDiv.innerHTML = `<div class="message-content">${escapeHtml(text)}</div>`;
        chatbotMessages.appendChild(messageDiv);
        scrollToBottom();
        return messageDiv;
    }

    /* ---------------------------------------------
       RENDERS BOT MESSAGE WITH CUSTOM HTML CONTENT
    ----------------------------------------------*/
    function addBotRichMessage(html) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', 'bot');
        messageDiv.innerHTML = `<div class="message-content">${html}</div>`;
        chatbotMessages.appendChild(messageDiv);
        scrollToBottom();
        return messageDiv;
    }

    // Creates a detail card explaining a selected metric definition and current value.
    function addMetricDefinitionMessage(option) {
        const safeLabel = escapeHtml(option.label);
        const safeDefinition = escapeHtml(option.definition || option.description);
        const safeValue = escapeHtml(option.value);
        // Render structured metric card
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

    // Handles the selected option action: explain, navigate, or start calculator prompts.
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

    // Matches user input against navigation keywords.
    function findNavigationOption(message) {
        const normalizedMessage = message.trim().toLowerCase();
        const matchedAlias = Object.keys(navigationAliases).find((alias) => normalizedMessage.includes(alias));

        if (!matchedAlias) {
            return null;
        }

        return metricOptions.find((option) => option.label === navigationAliases[matchedAlias]) ?? null;
    }

    // Scrolls to a target section and applies a temporary visual highlight.
    function navigateToDashboardSection(sectionName) {
        const target = document.querySelector(`[data-chatbot-section="${sectionName}"]`);
        if (!target) {
            return;
        }
        // Smooth scroll to section
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        //Reset previous highlight.
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
        // Remove highlight after short duration
        highlightedSectionTimer = window.setTimeout(() => {
            target.classList.remove('chatbot-section-active');
            if (highlightedSection === target) {
                highlightedSection = null;
            }
            highlightedSectionTimer = null;
        }, 1800);
    }

    /* ---------------------------------------------
    START: CAPACITY FACTOR HELP FLOW PROMPT
     ----------------------------------------------*/
    function addCapacityFactorPrompt() {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', 'bot');

        const content = document.createElement('div');
        content.classList.add('message-content');
        content.textContent = 'Do you need to know how to calculate the capacity factor?';

        const list = document.createElement('div');
        list.classList.add('bot-list');
        //Yes button: show explanation.
        const yesButton = document.createElement('button');
        yesButton.type = 'button';
        yesButton.classList.add('bot-list-btn');
        yesButton.textContent = 'Yes';
        yesButton.addEventListener('click', () => {
            addUserMessage('Yes');
            // Explain capacity factor with formula and example
            addBotRichMessage('Capacity Factor = (Actual Energy Output ÷ Maximum Possible Energy Output) × 100<br><br><strong>A Simple Example</strong><br>A power plant with a capacity of 1 Megawatt (MW) runs for 1 hour.<br><br>It could have produced a maximum of: 1 MW × 1 hour = 1 MWh.<br><br>It actually produced 0.5 MWh.<br><br>Its capacity factor is: (0.5 MWh ÷ 1 MWh) × 100 = 50%.');
            addCapacityFactorCalculationChoice();
        });
        //No button: return to metric options.
        const noButton = document.createElement('button');
        noButton.type = 'button';
        noButton.classList.add('bot-list-btn');
        noButton.textContent = 'No';
        noButton.addEventListener('click', () => {
            addUserMessage('No');
            addMetricOptions();
        });
        // Append buttons to UI
        list.appendChild(yesButton);
        list.appendChild(noButton);
        content.appendChild(list);
        messageDiv.appendChild(content);
        chatbotMessages.appendChild(messageDiv);
        scrollToBottom();
    }

    // Offers follow-up actions after explanation or calculation completes.
    function addCapacityFactorCalculationChoice() {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', 'bot');

        const content = document.createElement('div');
        content.classList.add('message-content');
        content.textContent = 'Do you need to perform a calculation or return to Dashboard components?';

        const list = document.createElement('div');
        list.classList.add('bot-list');
        //Option 1:Start calculation flow.
        const performCalculationButton = document.createElement('button');
        performCalculationButton.type = 'button';
        performCalculationButton.classList.add('bot-list-btn');
        performCalculationButton.textContent = 'Perform calculation';
        performCalculationButton.addEventListener('click', () => {
            addUserMessage('Perform calculation');
            startCapacityFactorFlow();
        });
        //Option 2: Return to dashboard components.
        const returnDashboardButton = document.createElement('button');
        returnDashboardButton.type = 'button';
        returnDashboardButton.classList.add('bot-list-btn');
        returnDashboardButton.textContent = 'Return to Dashboard components';
        returnDashboardButton.addEventListener('click', () => {
            addUserMessage('Return to Dashboard components');
            addMetricOptions();
        });
        /* ---------------------------------------------
           INITIALIZES CAPACITY FACTOR CALCULATION FLOW
        ----------------------------------------------*/
        list.appendChild(performCalculationButton);
        list.appendChild(returnDashboardButton);
        content.appendChild(list);
        messageDiv.appendChild(content);
        chatbotMessages.appendChild(messageDiv);
        scrollToBottom();
    }

    // Initializes step state for capacity factor numeric input flow.
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

    // Steps for collecting values and computing final capacity factor.
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
        //Step to compute capacity factor and display results.
        if (capacityFactorFlow.step === 'actualEnergyMwh') {
            const actualEnergyMwh = parseNonNegativeNumber(input);
            if (actualEnergyMwh === null) {
                addBotMessage('Please enter a valid number that is zero or greater for actual energy produced in MWh.');
                return;
            }

            capacityFactorFlow.actualEnergyMwh = actualEnergyMwh;
            // Maximum possible energy output formula
            const maximumPossibleEnergy = capacityFactorFlow.ratedCapacityMw * capacityFactorFlow.durationHours;
            if (maximumPossibleEnergy <= 0) {
                addBotMessage('Unable to calculate because maximum possible energy is zero. Please restart with positive inputs.');
                capacityFactorFlow = null;
                return;
            }
            // Capacity factor formula
            const capacityFactorPercent = (capacityFactorFlow.actualEnergyMwh / maximumPossibleEnergy) * 100;
            addBotRichMessage(
                `<strong>Your Capacity Factor Result</strong><br>` +
                `Formula: (Actual Energy Output ÷ Maximum Possible Energy Output) × 100<br><br>` +
                `Maximum possible energy = ${formatNumber(capacityFactorFlow.ratedCapacityMw)} MW × ${formatNumber(capacityFactorFlow.durationHours)} h = ${formatNumber(maximumPossibleEnergy)} MWh<br>` +
                `Actual energy output = ${formatNumber(capacityFactorFlow.actualEnergyMwh)} MWh<br><br>` +
                `Capacity factor = (${formatNumber(capacityFactorFlow.actualEnergyMwh)} ÷ ${formatNumber(maximumPossibleEnergy)}) × 100 = <strong>${formatNumber(capacityFactorPercent)}%</strong>`
            );
            //Ofers follow-up actions after calculation.
            addCapacityFactorCalculationChoice();

            capacityFactorFlow = null;
        }
    }

    // validation of strict positive / non-negative user inputs.
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
    // Formats numbers to two decimal places and adds thousands separators.
    function formatNumber(value) {
        const rounded = Math.round(value * 100) / 100;
        return rounded.toLocaleString(undefined, { maximumFractionDigits: 2 });
    }

    // Enables/disables input controls while the bot is "thinking".
    function setInputState(disabled) {
        isSending = disabled;
        messageInput.disabled = disabled;
        sendBtn.disabled = disabled;
        messageInput.placeholder = 'Type your message...';
    }

    // Clears current chat content and resets all transient flow state.
    function resetChatSession() {
        chatbotMessages.innerHTML = '';
        messageInput.value = '';
        setInputState(false);
        chatStarted = false;
        capacityFactorFlow = null;
    }

    // Keeps latest message visible in the scrolling chat body.
    function scrollToBottom() {
        chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
    }

    // Escapes user text before HTML insertion to prevent XSS injection.
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
});