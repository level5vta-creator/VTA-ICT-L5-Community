document.addEventListener('DOMContentLoaded', () => {
  const chatMessages = document.getElementById('chatMessages');
  const messageInput = document.getElementById('messageInput');
  const sendButton = document.getElementById('sendButton');
  const quickButtons = document.querySelectorAll('.quick-btn');

  // ── Backend endpoint (Netlify function) ──────────────────────────────
  const API_URL = '/.netlify/functions/ai';

  // ── Initial greeting ──────────────────────────────────────────────────
  addMessage(
  'ai',
  'Hi! I\'m EJ.Ai 👋\n\nYour AI study assistant created by EJ.\n\nAsk me anything about:\n\n💻 Programming\n🗄 Databases\n🌐 Networking\n📚 ICT study materials\n\nType your question below to get started 🚀'
 );

  // Ensure welcome message is visible at top on mobile (reset any stale scroll)
  chatMessages.scrollTop = 0;

  // ── Quick-action buttons ──────────────────────────────────────────────
  const prompts = {
    explain: 'Explain code:\nPaste your code here →',
    fix: 'Fix programming error:\nPaste your code and error here →',
    summarize: 'Summarize notes:\nPaste your text or notes →',
    roadmap: 'Learning roadmap:\nWhat topic do you want to learn?'
  };

  quickButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.prompt;
      if (prompts[key]) {
        messageInput.value = prompts[key];
        messageInput.focus();
        messageInput.setSelectionRange(messageInput.value.length, messageInput.value.length);
      }
    });
  });

  // ── Event listeners ───────────────────────────────────────────────────
  sendButton.addEventListener('click', handleSend);

  messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  // ── Core send flow ────────────────────────────────────────────────────
  async function handleSend() {
    const text = messageInput.value.trim();
    if (!text) return;

    // 1. Clear input & add user bubble
    messageInput.value = '';
    addMessage('user', text);

    // 2. Scroll to bottom
    scrollToBottom();

    // 3. Show loading indicator
    const loadingId = addLoadingMessage();

    try {
      // 4. Call Netlify function → OpenRouter → AI
      const reply = await sendMessage(text);

      // 5. Remove loading, display AI reply
      removeLoadingMessage(loadingId);
      addMessage('ai', reply);
    } catch (err) {
      console.error('Chat error:', err);
      removeLoadingMessage(loadingId);
      addMessage('error', '⚠ EJ.Ai is currently busy helping other students. Please try again in a few seconds.');
    }

    // 7. Scroll to bottom again
    scrollToBottom();
  }

  // ── API call ──────────────────────────────────────────────────────────
  async function sendMessage(message) {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    return data.reply || '⚠ Sorry, I encountered an error. Please try again later.';
  }

  // ── DOM helpers ───────────────────────────────────────────────────────
  function addMessage(role, content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;

    const bubble = document.createElement('div');
    bubble.className = 'bubble';

    // Preserve newlines while keeping XSS-safe text rendering
    bubble.style.whiteSpace = 'pre-wrap';
    bubble.textContent = content;

    messageDiv.appendChild(bubble);
    chatMessages.appendChild(messageDiv);
    return messageDiv;
  }

  function addLoadingMessage() {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message ai loading';
    messageDiv.id = 'loading-' + Date.now();

    const bubble = document.createElement('div');
    bubble.className = 'bubble';

    // Animated dots
    bubble.innerHTML = 'Thinking<span class="dots"><span>.</span><span>.</span><span>.</span></span>';

    messageDiv.appendChild(bubble);
    chatMessages.appendChild(messageDiv);
    scrollToBottom();
    return messageDiv.id;
  }

  function removeLoadingMessage(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
  }

  function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
});
