/**
 * HeartGuard AI — Frontend Chat Logic
 * Handles chat interactions, API calls, patient profile loading, and memory management.
 */

// ─── State ──────────────────────────────────────────────────────────────────────

const API_BASE = '';  // Same origin
let isLoading = false;
let patientData = null;

// ─── DOM Elements ───────────────────────────────────────────────────────────────

const elements = {
    apiKeyModal: document.getElementById('api-key-modal'),
    apiKeyInput: document.getElementById('api-key-input'),
    saveKeyBtn: document.getElementById('save-key-btn'),
    keyError: document.getElementById('key-error'),
    app: document.getElementById('app'),
    chatMessages: document.getElementById('chat-messages'),
    chatInput: document.getElementById('chat-input'),
    sendBtn: document.getElementById('send-btn'),
    quickActions: document.getElementById('quick-actions'),
    clearHistoryBtn: document.getElementById('clear-history-btn'),
    mobileMenuBtn: document.getElementById('mobile-menu-btn'),
    sidebar: document.getElementById('sidebar'),
    sidebarToggle: document.getElementById('sidebar-toggle'),
    statusBadge: document.getElementById('status-badge'),
};

// ─── Initialization ─────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    initApiKeyModal();
    initChatInput();
    initQuickActions();
    initSidebar();
    initClearHistory();
    loadPatientProfile();
    loadChatHistory();
});

// ─── API Key Modal ──────────────────────────────────────────────────────────────

function initApiKeyModal() {
    // Check if key is already set by checking a simple endpoint
    checkApiKeyStatus();

    elements.saveKeyBtn.addEventListener('click', saveApiKey);
    elements.apiKeyInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') saveApiKey();
    });
}

async function checkApiKeyStatus() {
    try {
        const res = await fetch(`${API_BASE}/api/patient`);
        if (res.ok) {
            // Backend is running — check if key is set by trying a test chat
            const testRes = await fetch(`${API_BASE}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: 'test' })
            });
            const data = await testRes.json();
            if (!data.error) {
                showApp();
            }
        }
    } catch (e) {
        // Backend not running, show modal anyway
    }
}

async function saveApiKey() {
    const key = elements.apiKeyInput.value.trim();
    if (!key) {
        elements.keyError.textContent = 'Please enter an API key';
        return;
    }

    elements.saveKeyBtn.disabled = true;
    elements.saveKeyBtn.textContent = 'Connecting...';
    elements.keyError.textContent = '';

    try {
        const res = await fetch(`${API_BASE}/api/set-key`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ api_key: key })
        });

        const data = await res.json();

        if (res.ok) {
            showApp();
        } else {
            elements.keyError.textContent = data.error || 'Invalid API key';
        }
    } catch (e) {
        elements.keyError.textContent = 'Failed to connect to server. Is the backend running?';
    } finally {
        elements.saveKeyBtn.disabled = false;
        elements.saveKeyBtn.textContent = 'Connect';
    }
}

function showApp() {
    elements.apiKeyModal.classList.add('hidden');
    elements.app.classList.remove('hidden');
}

// ─── Chat Input ─────────────────────────────────────────────────────────────────

function initChatInput() {
    const input = elements.chatInput;
    const sendBtn = elements.sendBtn;

    // Auto-resize textarea
    input.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 120) + 'px';
        sendBtn.disabled = input.value.trim().length === 0;
    });

    // Send on Enter (Shift+Enter for new line)
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!sendBtn.disabled && !isLoading) {
                sendMessage();
            }
        }
    });

    sendBtn.addEventListener('click', () => {
        if (!isLoading) sendMessage();
    });
}

// ─── Quick Actions ──────────────────────────────────────────────────────────────

function initQuickActions() {
    const buttons = elements.quickActions.querySelectorAll('.quick-btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            const query = btn.dataset.query;
            if (query && !isLoading) {
                elements.chatInput.value = query;
                elements.sendBtn.disabled = false;
                sendMessage();
            }
        });
    });
}

// ─── Sidebar ────────────────────────────────────────────────────────────────────

function initSidebar() {
    // Create overlay for mobile
    const overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    document.body.appendChild(overlay);

    elements.mobileMenuBtn.addEventListener('click', () => {
        elements.sidebar.classList.toggle('open');
        overlay.classList.toggle('active');
    });

    elements.sidebarToggle.addEventListener('click', () => {
        elements.sidebar.classList.remove('open');
        overlay.classList.remove('active');
    });

    overlay.addEventListener('click', () => {
        elements.sidebar.classList.remove('open');
        overlay.classList.remove('active');
    });
}

// ─── Clear History ──────────────────────────────────────────────────────────────

function initClearHistory() {
    elements.clearHistoryBtn.addEventListener('click', async () => {
        if (confirm('Clear all chat history? This cannot be undone.')) {
            try {
                await fetch(`${API_BASE}/api/clear-history`, { method: 'POST' });
                // Reset chat to welcome message
                const welcomeMsg = elements.chatMessages.querySelector('.assistant-message');
                elements.chatMessages.innerHTML = '';
                if (welcomeMsg) elements.chatMessages.appendChild(welcomeMsg);
            } catch (e) {
                console.error('Failed to clear history:', e);
            }
        }
    });
}

// ─── Load Patient Profile ───────────────────────────────────────────────────────

async function loadPatientProfile() {
    try {
        const res = await fetch(`${API_BASE}/api/patient`);
        if (!res.ok) return;

        patientData = await res.json();

        // Update sidebar
        document.getElementById('patient-name').textContent = patientData.name;
        document.getElementById('patient-avatar').textContent = getInitials(patientData.name);
        document.getElementById('patient-subtitle').textContent = `Post-Angioplasty • ${patientData.procedure.date}`;
        document.getElementById('patient-age').textContent = `${patientData.age} yrs, ${patientData.gender}`;
        document.getElementById('patient-blood').textContent = patientData.blood_group;
        document.getElementById('patient-procedure').textContent = '2 Stents (LAD + RCA)';
        document.getElementById('patient-doctor').textContent = patientData.procedure.doctor;

        // Next follow-up
        const today = new Date();
        const nextFollowup = patientData.follow_up_schedule.find(fu => new Date(fu.date) >= today);
        if (nextFollowup) {
            document.getElementById('patient-followup').textContent = formatDate(nextFollowup.date);
        }

        // Allergies
        const allergyTags = document.getElementById('allergy-tags');
        allergyTags.innerHTML = patientData.allergies
            .map(a => `<span class="allergy-tag">⚠️ ${a}</span>`)
            .join('');

        // Emergency contacts
        const contactsDiv = document.getElementById('emergency-contacts');
        contactsDiv.innerHTML = patientData.emergency_contacts
            .map(c => `
                <div class="emergency-contact">
                    <span class="emergency-contact-name">${c.name}</span>
                    <span class="emergency-contact-phone">${c.phone}</span>
                </div>
            `)
            .join('');

    } catch (e) {
        console.error('Failed to load patient profile:', e);
    }
}

// ─── Load Chat History ──────────────────────────────────────────────────────────

async function loadChatHistory() {
    try {
        const res = await fetch(`${API_BASE}/api/history`);
        if (!res.ok) return;

        const data = await res.json();
        const history = data.history || [];

        // Load last 20 messages to avoid overwhelming the UI
        const recent = history.slice(-20);
        recent.forEach(turn => {
            appendMessage('user', turn.query, turn.timestamp);
            appendMessage('assistant', turn.response, turn.timestamp, turn.sources);
        });

    } catch (e) {
        console.error('Failed to load chat history:', e);
    }
}

// ─── Send Message ───────────────────────────────────────────────────────────────

async function sendMessage() {
    const query = elements.chatInput.value.trim();
    if (!query || isLoading) return;

    isLoading = true;
    elements.sendBtn.disabled = true;
    elements.chatInput.value = '';
    elements.chatInput.style.height = 'auto';

    // Add user message
    appendMessage('user', query);

    // Show typing indicator
    const typingEl = showTypingIndicator();

    // Scroll to bottom
    scrollToBottom();

    try {
        const res = await fetch(`${API_BASE}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
        });

        const data = await res.json();

        // Remove typing indicator
        typingEl.remove();

        // Add assistant response
        appendMessage('assistant', data.response, null, data.sources);

    } catch (e) {
        typingEl.remove();
        appendMessage('assistant', '⚠️ Failed to connect to the server. Please make sure the backend is running on port 5000.');
    } finally {
        isLoading = false;
        elements.sendBtn.disabled = elements.chatInput.value.trim().length === 0;
        scrollToBottom();
    }
}

// ─── Message Rendering ──────────────────────────────────────────────────────────

function appendMessage(role, content, timestamp = null, sources = null) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}-message`;

    const avatarText = role === 'user'
        ? (patientData ? getInitials(patientData.name) : 'U')
        : '❤️‍🩹';

    const timeText = timestamp
        ? formatTime(timestamp)
        : formatTime(new Date().toISOString());

    // Format content — convert markdown-like formatting
    const formattedContent = formatResponse(content);

    messageDiv.innerHTML = `
        <div class="message-avatar">${avatarText}</div>
        <div class="message-content">
            <div class="message-bubble">${formattedContent}</div>
            ${sources && sources.length > 0 ? renderSources(sources) : ''}
            <span class="message-time">${timeText}</span>
        </div>
    `;

    elements.chatMessages.appendChild(messageDiv);
    scrollToBottom();
}

function renderSources(sources) {
    if (!sources || sources.length === 0) return '';

    const tags = sources.map(s => {
        const priorityClass = s.priority || 'medium';
        const icon = {
            'critical': '🔴',
            'high': '🟠',
            'medium': '🟡',
            'low': '🟢'
        }[priorityClass] || '🟡';

        return `<span class="source-tag ${priorityClass}">${icon} ${s.title || s.category || s.id}</span>`;
    }).join('');

    return `<div class="message-sources">${tags}</div>`;
}

function formatResponse(text) {
    if (!text) return '';

    // Escape HTML
    let html = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // Bold: **text**
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Italic: *text*
    html = html.replace(/(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');

    // Numbered lists
    html = html.replace(/^(\d+)\.\s+(.+)$/gm, '<li>$2</li>');

    // Bullet lists
    html = html.replace(/^[-•]\s+(.+)$/gm, '<li>$1</li>');

    // Wrap consecutive <li> items in <ul>
    html = html.replace(/((<li>.*?<\/li>\n?)+)/g, '<ul>$1</ul>');

    // Paragraphs: split by double newlines
    html = html.replace(/\n\n/g, '</p><p>');
    html = html.replace(/\n/g, '<br>');

    // Wrap in paragraph if not already wrapped
    if (!html.startsWith('<')) {
        html = `<p>${html}</p>`;
    }

    return html;
}

// ─── Typing Indicator ──────────────────────────────────────────────────────────

function showTypingIndicator() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'typing-indicator';
    typingDiv.innerHTML = `
        <div class="message-avatar">❤️‍🩹</div>
        <div class="typing-dots">
            <span></span>
            <span></span>
            <span></span>
        </div>
    `;
    elements.chatMessages.appendChild(typingDiv);
    scrollToBottom();
    return typingDiv;
}

// ─── Utilities ──────────────────────────────────────────────────────────────────

function scrollToBottom() {
    requestAnimationFrame(() => {
        elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
    });
}

function getInitials(name) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
}

function formatTime(isoStr) {
    const date = new Date(isoStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    return date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
    });
}
