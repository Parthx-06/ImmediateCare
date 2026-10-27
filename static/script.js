/**
 * HeartGuard AI — Frontend Chat Logic & Health Tracker
 * Enhanced with voice dictation, audio read-aloud, pill reminders, and vitals tracking.
 */

// ─── State ──────────────────────────────────────────────────────────────────────

const API_BASE = '';
let isLoading = false;
let patientData = null;
let currentUtterance = null;
let speechRecognition = null;
let isRecording = false;

// ─── DOM Elements ───────────────────────────────────────────────────────────────

const elements = {
    app: document.getElementById('app'),
    chatMessages: document.getElementById('chat-messages'),
    chatInput: document.getElementById('chat-input'),
    sendBtn: document.getElementById('send-btn'),
    voiceBtn: document.getElementById('voice-btn'),
    voiceIndicator: document.getElementById('voice-indicator'),
    quickActions: document.getElementById('quick-actions'),
    clearHistoryBtn: document.getElementById('clear-history-btn'),
    mobileMenuBtn: document.getElementById('mobile-menu-btn'),
    sidebar: document.getElementById('sidebar'),
    sidebarToggle: document.getElementById('sidebar-toggle'),
    statusBadge: document.getElementById('status-badge'),

    // Modals & Buttons
    headerSosBtn: document.getElementById('header-sos-btn'),
    emergencyModal: document.getElementById('emergency-modal'),
    emergencyModalClose: document.getElementById('emergency-modal-close'),

    headerVitalsBtn: document.getElementById('header-vitals-btn'),
    openVitalsBtn: document.getElementById('open-vitals-btn'),
    vitalsModal: document.getElementById('vitals-modal'),
    vitalsModalClose: document.getElementById('vitals-modal-close'),
    vitalsForm: document.getElementById('vitals-form'),
    vitalsFeedback: document.getElementById('vitals-live-feedback'),
    vitalsHistoryBody: document.getElementById('vitals-history-body'),
    clearVitalsBtn: document.getElementById('clear-vitals-btn'),
    miniBp: document.getElementById('mini-bp'),
    miniPulse: document.getElementById('mini-pulse'),

    // Pill Reminder
    pillCheckboxes: document.querySelectorAll('.pill-checkbox'),
    pillProgressBadge: document.getElementById('pill-progress-badge'),
    pillProgressFill: document.getElementById('pill-progress-fill'),

    // Toast Container
    toastContainer: document.getElementById('toast-container')
};

// ─── Initialization ─────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    initChatInput();
    initVoiceInput();
    initQuickActions();
    initSidebar();
    initClearHistory();
    initEmergencyModal();
    initVitalsTracker();
    initPillChecklist();
    loadPatientProfile();
    loadChatHistory();
    checkUrlQueryParams();
});

// ─── URL Query Parameter Handler ────────────────────────────────────────────────

function checkUrlQueryParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const initialQuery = urlParams.get('q');
    if (initialQuery) {
        elements.chatInput.value = initialQuery;
        elements.sendBtn.disabled = false;
        setTimeout(() => {
            sendMessage();
        }, 600);
    }
}

// ─── Chat Input ─────────────────────────────────────────────────────────────────

function initChatInput() {
    const input = elements.chatInput;
    const sendBtn = elements.sendBtn;

    input.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 120) + 'px';
        sendBtn.disabled = input.value.trim().length === 0;
    });

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

// ─── Voice Speech-To-Text ───────────────────────────────────────────────────────

function initVoiceInput() {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
        if (elements.voiceBtn) {
            elements.voiceBtn.style.display = 'none';
        }
        return;
    }

    speechRecognition = new SpeechRec();
    speechRecognition.continuous = false;
    speechRecognition.interimResults = false;
    speechRecognition.lang = 'en-IN';

    speechRecognition.onstart = () => {
        isRecording = true;
        elements.voiceBtn.classList.add('recording');
        elements.voiceIndicator.classList.remove('hidden');
    };

    speechRecognition.onend = () => {
        isRecording = false;
        elements.voiceBtn.classList.remove('recording');
        elements.voiceIndicator.classList.add('hidden');
    };

    speechRecognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
            elements.chatInput.value = transcript;
            elements.chatInput.style.height = 'auto';
            elements.chatInput.style.height = Math.min(elements.chatInput.scrollHeight, 120) + 'px';
            elements.sendBtn.disabled = false;
            showToast('Voice captured! Tap Send or Edit.');
        }
    };

    speechRecognition.onerror = (e) => {
        console.warn('Speech recognition error:', e.error);
        isRecording = false;
        elements.voiceBtn.classList.remove('recording');
        elements.voiceIndicator.classList.add('hidden');
        showToast('Microphone error: ' + e.error);
    };

    elements.voiceBtn.addEventListener('click', () => {
        if (!speechRecognition) return;
        if (isRecording) {
            speechRecognition.stop();
        } else {
            try {
                speechRecognition.start();
            } catch (err) {
                speechRecognition.stop();
            }
        }
    });
}

// ─── Quick Actions ──────────────────────────────────────────────────────────────

function initQuickActions() {
    const buttons = elements.quickActions.querySelectorAll('.quick-btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            const query = btn.dataset.query;
            if (btn.classList.contains('emergency')) {
                // Also open SOS modal for immediate accessibility
                openModal(elements.emergencyModal);
            }
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
                const welcomeMsg = elements.chatMessages.querySelector('.assistant-message');
                elements.chatMessages.innerHTML = '';
                if (welcomeMsg) elements.chatMessages.appendChild(welcomeMsg);
                showToast('Chat history cleared.');
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

        document.getElementById('patient-name').textContent = patientData.name;
        document.getElementById('patient-avatar').textContent = getInitials(patientData.name);
        document.getElementById('patient-subtitle').textContent = `Post-Angioplasty • ${patientData.procedure.date}`;
        document.getElementById('patient-age').textContent = `${patientData.age} yrs, ${patientData.gender}`;
        document.getElementById('patient-blood').textContent = patientData.blood_group;
        document.getElementById('patient-procedure').textContent = '2 Stents (LAD + RCA)';
        document.getElementById('patient-doctor').textContent = patientData.procedure.doctor;

        const today = new Date().toISOString().split('T')[0];
        const nextFu = patientData.follow_up_schedule.find(f => f.date >= today);
        if (nextFu) {
            document.getElementById('patient-followup').textContent = `${formatDate(nextFu.date)} (${nextFu.type})`;
        } else {
            document.getElementById('patient-followup').textContent = 'Follow-up complete';
        }

        const allergyTagsEl = document.getElementById('allergy-tags');
        allergyTagsEl.innerHTML = patientData.allergies.map(a =>
            `<span class="tag tag-danger">${a}</span>`
        ).join('');

        const emergencyContactsEl = document.getElementById('emergency-contacts');
        emergencyContactsEl.innerHTML = `
            <div class="contact-item">
                <span class="contact-name">${patientData.emergency_contact.relation} (${patientData.emergency_contact.name})</span>
                <a href="tel:${patientData.emergency_contact.phone}" class="contact-phone">📞 ${patientData.emergency_contact.phone}</a>
            </div>
            <div class="contact-item">
                <span class="contact-name">${patientData.procedure.doctor}</span>
                <a href="tel:${patientData.procedure.doctor_phone}" class="contact-phone">📞 ${patientData.procedure.doctor_phone}</a>
            </div>
            <div class="contact-item">
                <span class="contact-name">National Ambulance</span>
                <a href="tel:108" class="contact-phone emergency-phone">🚨 108 (Toll Free)</a>
            </div>
        `;
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

        if (history.length > 0) {
            elements.chatMessages.innerHTML = '';
            history.forEach(turn => {
                appendMessage('user', turn.query, turn.timestamp);
                appendMessage('assistant', turn.response, turn.timestamp, turn.sources);
            });
        }
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

    appendMessage('user', query);

    const typingEl = showTypingIndicator();
    scrollToBottom();

    try {
        const res = await fetch(`${API_BASE}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
        });

        let data;
        const textResponse = await res.text();
        try {
            data = JSON.parse(textResponse);
        } catch (jsonErr) {
            console.error('Non-JSON server response:', textResponse);
            typingEl.remove();
            appendMessage('assistant', `⚠️ Server returned an error (${res.status}). Please check server logs or restart.`);
            return;
        }

        typingEl.remove();

        if (data.error) {
            appendMessage('assistant', data.response || '⚠️ An error occurred while generating the response.');
        } else {
            appendMessage('assistant', data.response, null, data.sources);
        }

    } catch (e) {
        typingEl.remove();
        console.error('Network or Chat Error:', e);
        appendMessage('assistant', `⚠️ Failed to connect to server: ${e.message}`);
    } finally {
        isLoading = false;
        elements.sendBtn.disabled = elements.chatInput.value.trim().length === 0;
        scrollToBottom();
    }
}

// ─── Message Rendering ──────────────────────────────────────────────────────────

function appendMessage(role, content, timestamp = null, sources = null) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}-message fade-in`;

    const avatarText = role === 'user'
        ? (patientData ? getInitials(patientData.name) : 'RK')
        : '❤️‍🩹';

    const timeText = timestamp
        ? formatTime(timestamp)
        : formatTime(new Date().toISOString());

    const formattedContent = formatResponse(content);

    // Build Action Buttons for Assistant
    let actionBar = '';
    if (role === 'assistant') {
        actionBar = `
            <div class="message-action-bar">
                <button class="action-pill-btn tts-btn" title="Read response aloud">
                    <span>🔊</span> Listen
                </button>
                <button class="action-pill-btn copy-btn" title="Copy to clipboard">
                    <span>📋</span> Copy
                </button>
                <button class="action-pill-btn share-wa-btn" title="Share with family on WhatsApp">
                    <span>📲</span> WhatsApp
                </button>
            </div>
        `;
    }

    messageDiv.innerHTML = `
        <div class="message-avatar">${avatarText}</div>
        <div class="message-content">
            <div class="message-bubble">${formattedContent}</div>
            ${sources && sources.length > 0 ? renderSources(sources) : ''}
            ${actionBar}
            <span class="message-time">${timeText}</span>
        </div>
    `;

    // Attach actions
    if (role === 'assistant') {
        const plainText = content.replace(/[#*`_~]/g, '').trim();

        const ttsBtn = messageDiv.querySelector('.tts-btn');
        ttsBtn.addEventListener('click', () => {
            toggleReadAloud(plainText, ttsBtn);
        });

        const copyBtn = messageDiv.querySelector('.copy-btn');
        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(plainText).then(() => {
                showToast('Copied to clipboard!');
            }).catch(() => {
                showToast('Unable to copy');
            });
        });

        const waBtn = messageDiv.querySelector('.share-wa-btn');
        waBtn.addEventListener('click', () => {
            const shareText = `*HeartGuard AI Care Advice (Dr. Srinivas Rao)*:\n\n${plainText}\n\nEmergency Helpline: 108`;
            const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
            window.open(waUrl, '_blank');
        });
    }

    elements.chatMessages.appendChild(messageDiv);
    scrollToBottom();
}

// ─── Text to Speech ─────────────────────────────────────────────────────────────

function toggleReadAloud(text, buttonEl) {
    if (!('speechSynthesis' in window)) {
        showToast('Text-to-speech is not supported on this browser.');
        return;
    }

    if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
        buttonEl.classList.remove('playing');
        buttonEl.innerHTML = '<span>🔊</span> Listen';
        return;
    }

    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.95;
    utter.pitch = 1.0;
    utter.lang = 'en-IN';

    utter.onstart = () => {
        buttonEl.classList.add('playing');
        buttonEl.innerHTML = '<span>⏹️</span> Stop';
    };

    utter.onend = () => {
        buttonEl.classList.remove('playing');
        buttonEl.innerHTML = '<span>🔊</span> Listen';
    };

    utter.onerror = () => {
        buttonEl.classList.remove('playing');
        buttonEl.innerHTML = '<span>🔊</span> Listen';
    };

    currentUtterance = utter;
    window.speechSynthesis.speak(utter);
}

// ─── Source Tags ────────────────────────────────────────────────────────────────

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

// ─── Clean Response Formatting ──────────────────────────────────────────────────

function formatResponse(text) {
    if (!text) return '';

    let html = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // Markdown bold & italic
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');

    // Bullet & Numbered lists
    html = html.replace(/^(\d+)\.\s+(.+)$/gm, '<li>$2</li>');
    html = html.replace(/^[-•]\s+(.+)$/gm, '<li>$1</li>');
    html = html.replace(/((<li>.*?<\/li>\n?)+)/g, '<ul>$1</ul>');

    // Paragraph breaks
    html = html.replace(/\n\n/g, '</p><p>');
    html = html.replace(/\n/g, '<br>');

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

// ─── Pill Checklist Manager ─────────────────────────────────────────────────────

function initPillChecklist() {
    const today = new Date().toISOString().split('T')[0];
    const storageKey = `heartguard_pills_${today}`;
    let savedState = {};

    try {
        savedState = JSON.parse(localStorage.getItem(storageKey) || '{}');
    } catch (e) {
        savedState = {};
    }

    // Apply saved states
    elements.pillCheckboxes.forEach(cb => {
        const pillId = cb.dataset.pill;
        if (savedState[pillId]) {
            cb.checked = true;
            cb.closest('.pill-item').classList.add('taken');
        }

        cb.addEventListener('change', () => {
            savedState[pillId] = cb.checked;
            try {
                localStorage.setItem(storageKey, JSON.stringify(savedState));
            } catch (e) {}

            if (cb.checked) {
                cb.closest('.pill-item').classList.add('taken');
            } else {
                cb.closest('.pill-item').classList.remove('taken');
            }
            updatePillProgress();
        });
    });

    updatePillProgress();
}

function updatePillProgress() {
    const total = elements.pillCheckboxes.length;
    let checkedCount = 0;
    elements.pillCheckboxes.forEach(cb => {
        if (cb.checked) checkedCount++;
    });

    const percent = Math.round((checkedCount / total) * 100);
    elements.pillProgressBadge.textContent = `${checkedCount}/${total}`;
    elements.pillProgressFill.style.width = `${percent}%`;

    if (checkedCount === total && total > 0) {
        showToast('🎉 All pills taken for today! Excellent recovery adherence.');
    }
}

// ─── Vitals Tracker ─────────────────────────────────────────────────────────────

function initVitalsTracker() {
    // Open & Close
    if (elements.headerVitalsBtn) {
        elements.headerVitalsBtn.addEventListener('click', () => openModal(elements.vitalsModal));
    }
    if (elements.openVitalsBtn) {
        elements.openVitalsBtn.addEventListener('click', () => openModal(elements.vitalsModal));
    }
    if (elements.vitalsModalClose) {
        elements.vitalsModalClose.addEventListener('click', () => closeModal(elements.vitalsModal));
    }

    // Close on backdrop
    elements.vitalsModal.addEventListener('click', (e) => {
        if (e.target === elements.vitalsModal) closeModal(elements.vitalsModal);
    });

    // Form submit
    elements.vitalsForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const sys = parseInt(document.getElementById('input-systolic').value, 10);
        const dia = parseInt(document.getElementById('input-diastolic').value, 10);
        const pulse = parseInt(document.getElementById('input-pulse').value, 10);
        const sugar = document.getElementById('input-sugar').value ? parseInt(document.getElementById('input-sugar').value, 10) : null;

        saveVitalEntry({ sys, dia, pulse, sugar });
        elements.vitalsForm.reset();
        showToast('Vitals recorded successfully!');
    });

    // Live Evaluation Feedback
    const evaluateInputs = () => {
        const sys = parseInt(document.getElementById('input-systolic').value, 10);
        const dia = parseInt(document.getElementById('input-diastolic').value, 10);
        const pulse = parseInt(document.getElementById('input-pulse').value, 10);

        if (!sys || !dia || !pulse) {
            elements.vitalsFeedback.classList.add('hidden');
            return;
        }

        elements.vitalsFeedback.classList.remove('hidden');
        elements.vitalsFeedback.className = 'vitals-feedback-card';

        if (pulse < 55) {
            elements.vitalsFeedback.classList.add('vitals-feedback-high');
            elements.vitalsFeedback.innerHTML = `⚠️ Pulse is ${pulse} bpm (below 55). Skip Metoprolol dose and inform Dr. Rao.`;
        } else if (sys >= 140 || dia >= 90) {
            elements.vitalsFeedback.classList.add('vitals-feedback-high');
            elements.vitalsFeedback.innerHTML = `⚠️ Elevated BP (${sys}/${dia} mmHg). Rest quietly for 15 mins and recheck.`;
        } else if (sys <= 130 && dia <= 80) {
            elements.vitalsFeedback.classList.add('vitals-feedback-normal');
            elements.vitalsFeedback.innerHTML = `✅ Perfect cardiac target: BP ${sys}/${dia} mmHg, Pulse ${pulse} bpm.`;
        } else {
            elements.vitalsFeedback.classList.add('vitals-feedback-elevated');
            elements.vitalsFeedback.innerHTML = `🟡 Slightly elevated: BP ${sys}/${dia} mmHg. Keep salt strictly restricted.`;
        }
    };

    ['input-systolic', 'input-diastolic', 'input-pulse'].forEach(id => {
        document.getElementById(id).addEventListener('input', evaluateInputs);
    });

    // Clear vitals
    elements.clearVitalsBtn.addEventListener('click', () => {
        if (confirm('Clear all recorded vitals?')) {
            localStorage.removeItem('heartguard_vitals');
            renderVitalsHistory();
            showToast('Vitals log cleared.');
        }
    });

    renderVitalsHistory();
}

function saveVitalEntry(entry) {
    let list = [];
    try {
        list = JSON.parse(localStorage.getItem('heartguard_vitals') || '[]');
    } catch (e) { list = []; }

    entry.id = Date.now();
    entry.timestamp = new Date().toISOString();
    list.unshift(entry);
    list = list.slice(0, 15); // keep last 15
    localStorage.setItem('heartguard_vitals', JSON.stringify(list));

    renderVitalsHistory();
}

function renderVitalsHistory() {
    let list = [];
    try {
        list = JSON.parse(localStorage.getItem('heartguard_vitals') || '[]');
    } catch (e) { list = []; }

    if (list.length === 0) {
        elements.vitalsHistoryBody.innerHTML = `<tr><td colspan="5" class="empty-state">No readings recorded yet. Log your first reading above!</td></tr>`;
        elements.miniBp.textContent = '-- / --';
        elements.miniPulse.textContent = '-- bpm';
        return;
    }

    // Update Mini Card
    const latest = list[0];
    elements.miniBp.textContent = `${latest.sys}/${latest.dia}`;
    elements.miniPulse.textContent = `${latest.pulse} bpm`;

    elements.vitalsHistoryBody.innerHTML = list.slice(0, 5).map(item => {
        let statusBadge = '<span class="tag tag-low">🟢 Normal</span>';
        if (item.pulse < 55 || item.sys >= 140 || item.dia >= 90) {
            statusBadge = '<span class="tag tag-danger">🔴 Review</span>';
        } else if (item.sys > 130 || item.dia > 80) {
            statusBadge = '<span class="tag tag-medium">🟡 Elevated</span>';
        }

        const dateStr = new Date(item.timestamp).toLocaleDateString('en-IN', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        return `
            <tr>
                <td>${dateStr}</td>
                <td><strong>${item.sys}/${item.dia}</strong></td>
                <td>${item.pulse} bpm</td>
                <td>${item.sugar ? item.sugar + ' mg/dL' : '—'}</td>
                <td>${statusBadge}</td>
            </tr>
        `;
    }).join('');
}

// ─── Emergency SOS Modal ────────────────────────────────────────────────────────

function initEmergencyModal() {
    if (elements.headerSosBtn) {
        elements.headerSosBtn.addEventListener('click', () => openModal(elements.emergencyModal));
    }
    if (elements.emergencyModalClose) {
        elements.emergencyModalClose.addEventListener('click', () => closeModal(elements.emergencyModal));
    }
    elements.emergencyModal.addEventListener('click', (e) => {
        if (e.target === elements.emergencyModal) closeModal(elements.emergencyModal);
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal(elements.emergencyModal);
            closeModal(elements.vitalsModal);
        }
    });
}

function openModal(modalEl) {
    modalEl.classList.remove('hidden');
}

function closeModal(modalEl) {
    modalEl.classList.add('hidden');
}

// ─── Toast Notifications ────────────────────────────────────────────────────────

function showToast(msg) {
    if (!elements.toastContainer) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span>❤️‍🩹</span> <span>${msg}</span>`;

    elements.toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3200);
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
