document.addEventListener('DOMContentLoaded', function () {
    // Create chatbot HTML elements
    const chatbotHTML = `
        <div class="chatbot-icon" id="chatbotIcon" aria-label="Open chat">
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
            </svg>
        </div>

        <div class="chatbot-window" id="chatbotWindow">
            <div class="chatbot-header">
                <h2>Assistant</h2>
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

    // Initialize chatbot functionality
    const chatbotIcon = document.getElementById('chatbotIcon');
    const chatbotWindow = document.getElementById('chatbotWindow');
    const closeBtn = document.getElementById('closeBtn');
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    const chatbotMessages = document.getElementById('chatbotMessages');

    let chatStarted = false;

    chatbotIcon.addEventListener('click', () => {
        chatbotWindow.classList.toggle('open');

        if (chatbotWindow.classList.contains('open')) {
            messageInput.focus();

            if (!chatStarted) {
                addBotMessage("Hello! 👋 I'm your assistant. How can I help you today?");
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

    function scrollToBottom() {
        chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
});