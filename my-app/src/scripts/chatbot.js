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

    let chatStarted = false;

    const itemDetails = {
        'Tea': 'qqqq',
        'Coffee': 'aaaa',
        'Chai': 'yyyyy'
    };

    chatbotIcon.addEventListener('click', () => {
        chatbotWindow.classList.toggle('open');

        if (chatbotWindow.classList.contains('open')) {
            messageInput.focus();

            if (!chatStarted) {
                addBotMessage("Hello! 👋 I'm Energy Bug, your assistant. How can I help you today?");
                setTimeout(() => {
                    addBotListMessage("Please select a drink:", ['Tea', 'Coffee', 'Chai']);
                }, 1000);
                chatStarted = true;
            }
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

    function sendMessage() {
        const message = messageInput.value.trim();
        if (message === '') return;

        addUserMessage(message);
        messageInput.value = '';

        setTimeout(() => {
            addBotMessage("Thanks for your message. I'll get back to you soon.");
        }, 500);
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
    }

    function addBotListMessage(prompt, items) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', 'bot');
        const buttonsHTML = items.map(item =>
            `<button class="bot-list-btn" data-item="${escapeHtml(item)}">${escapeHtml(item)}</button>`
        ).join('');
        messageDiv.innerHTML = `<div class="message-content">${escapeHtml(prompt)}<div class="bot-list">${buttonsHTML}</div></div>`;
        chatbotMessages.appendChild(messageDiv);
        messageDiv.querySelectorAll('.bot-list-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const item = btn.dataset.item;
                addUserMessage(item);
                setTimeout(() => {
                    addBotMessage(itemDetails[item] || "Sorry, I don't have details for that.");
                }, 500);
            });
        });
        scrollToBottom();
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