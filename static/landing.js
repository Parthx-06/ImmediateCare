/**
 * ImmediateCare — Website Interactive JavaScript
 * Handles navigation, scroll animations, stat counters, and AI chat demo.
 */

document.addEventListener('DOMContentLoaded', () => {
    // ── Navigation ────────────────────────────────────────────────────────
    const nav = document.getElementById('main-nav');
    const hamburger = document.getElementById('hamburger');
    const mobileMenu = document.getElementById('mobile-menu');
    const navLinks = document.querySelectorAll('.nav-link, .mobile-link');

    // Scroll-based nav styling
    const handleNavScroll = () => {
        if (window.scrollY > 50) {
            nav.classList.add('scrolled');
        } else {
            nav.classList.remove('scrolled');
        }
    };
    window.addEventListener('scroll', handleNavScroll, { passive: true });
    handleNavScroll();

    // Hamburger toggle
    hamburger.addEventListener('click', () => {
        hamburger.classList.toggle('open');
        mobileMenu.classList.toggle('open');
        document.body.style.overflow = mobileMenu.classList.contains('open') ? 'hidden' : '';
    });

    // Close mobile menu on link click
    document.querySelectorAll('.mobile-link').forEach(link => {
        link.addEventListener('click', () => {
            hamburger.classList.remove('open');
            mobileMenu.classList.remove('open');
            document.body.style.overflow = '';
        });
    });

    // Active nav link tracking via IntersectionObserver
    const sections = document.querySelectorAll('section[id]');
    const observerOptions = {
        root: null,
        rootMargin: '-40% 0px -60% 0px',
        threshold: 0
    };

    const navObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const id = entry.target.getAttribute('id');
                navLinks.forEach(link => {
                    link.classList.toggle('active', link.getAttribute('data-section') === id);
                });
            }
        });
    }, observerOptions);

    sections.forEach(section => navObserver.observe(section));

    // ── Scroll Reveal ────────────────────────────────────────────────────
    const revealElements = document.querySelectorAll(
        '.about-card, .service-card, .step-card, .doctor-card, .testimonial-card, .info-card, .section-header'
    );

    revealElements.forEach(el => el.classList.add('reveal'));

    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Stagger delay based on sibling index
                const parent = entry.target.parentElement;
                const siblings = Array.from(parent.children).filter(c => c.classList.contains('reveal'));
                const index = siblings.indexOf(entry.target);
                entry.target.style.transitionDelay = `${index * 100}ms`;
                entry.target.classList.add('visible');
                revealObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });

    revealElements.forEach(el => revealObserver.observe(el));

    // ── Stat Counter Animation ───────────────────────────────────────────
    const statNumbers = document.querySelectorAll('.stat-number[data-target]');

    const countUp = (el) => {
        const target = parseInt(el.getAttribute('data-target'));
        const duration = 2000;
        const startTime = performance.now();

        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // Ease out quad
            const eased = 1 - (1 - progress) * (1 - progress);
            el.textContent = Math.floor(eased * target);

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                el.textContent = target;
            }
        };

        requestAnimationFrame(animate);
    };

    const statObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                countUp(entry.target);
                statObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });

    statNumbers.forEach(el => statObserver.observe(el));

    // ── AI Chat Demo ─────────────────────────────────────────────────────
    const chatMessages = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const chatSend = document.getElementById('chat-send');
    const quickBtns = document.querySelectorAll('.quick-btn');
    const quickQuestions = document.getElementById('quick-questions');

    // Demo responses for common questions
    const demoResponses = {
        'can i climb stairs after my angioplasty?': {
            text: '🏠 <strong>Stair Climbing After Angioplasty</strong><br><br>Yes, you can start climbing stairs, but with caution during your early recovery:<br><br>• <strong>Week 1-2:</strong> Climb slowly, one step at a time. Rest if you feel breathless or experience chest discomfort.<br>• <strong>Week 3-4:</strong> Gradually increase to normal pace.<br>• <strong>After 4 weeks:</strong> Resume normal stair usage.<br><br>⚠️ <strong>Stop immediately</strong> if you experience chest pain, severe breathlessness, or dizziness while climbing, and consult your doctor.',
            sources: ['Activity Guidelines', 'Post-Procedure Restrictions']
        },
        'what foods should i avoid after stent placement?': {
            text: '🍽️ <strong>Dietary Guidelines After Stent Placement</strong><br><br>Based on your profile, here are foods to avoid:<br><br>🚫 <strong>Avoid:</strong><br>• Deep-fried foods (samosas, pakoras, puris)<br>• Excessive salt (pickles, processed snacks, papad)<br>• Red meat and organ meats<br>• Full-fat dairy (butter, ghee in excess, paneer)<br>• Sugary drinks and sweets<br><br>✅ <strong>Recommended:</strong><br>• Fresh vegetables, fruits, whole grains<br>• Fish (especially omega-3 rich), lean poultry<br>• Nuts (almonds, walnuts) in moderation<br>• Low-fat curd, buttermilk<br><br>💊 Note: Based on your medication profile, avoid grapefruit as it may interact with your statins.',
            sources: ['Heart-Healthy Diet', 'Medication Interactions']
        },
        'when should i call emergency services?': {
            text: '🚨 <strong>Emergency Warning Signs — CALL 108 IMMEDIATELY</strong><br><br>Seek emergency help if you experience ANY of these symptoms:<br><br>🔴 <strong>CRITICAL (Call 108 NOW):</strong><br>• Severe, crushing chest pain lasting more than 5 minutes<br>• Chest pain spreading to jaw, arm, or back<br>• Sudden severe shortness of breath<br>• Loss of consciousness or fainting<br>• Sudden numbness or weakness on one side<br><br>🟡 <strong>URGENT (Contact your cardiologist):</strong><br>• Mild chest discomfort that comes and goes<br>• Unusual swelling in legs or ankles<br>• Heart palpitations or irregular heartbeat<br>• Fever above 101°F (38.3°C)<br>• Bleeding or swelling at catheter insertion site<br><br>📞 Your cardiologist: <strong>Dr. Srinivas Rao — +91 98765 43210</strong>',
            sources: ['Emergency Protocols', 'Warning Signs', 'Contact Information']
        },
        'what medications do i need to take daily?': {
            text: '💊 <strong>Your Daily Medication Schedule</strong><br><br>Based on your profile, here is your prescribed regimen:<br><br><strong>Morning (with breakfast):</strong><br>• Aspirin 75mg — Blood thinner (lifelong)<br>• Clopidogrel 75mg — Anti-platelet (minimum 12 months)<br>• Atorvastatin 40mg — Cholesterol control<br>• Metoprolol 25mg — Heart rate control<br><br><strong>Evening:</strong><br>• Ramipril 5mg — Blood pressure management<br><br>⚠️ <strong>Critical Reminders:</strong><br>• <strong>NEVER</strong> stop Aspirin or Clopidogrel without consulting Dr. Rao — this could cause stent thrombosis<br>• Take medications at the same time daily<br>• Do NOT take antacids within 2 hours of your medications<br>• Keep a 2-week buffer supply at all times',
            sources: ['Medication Schedule', 'Drug Interactions', 'Critical Warnings']
        }
    };

    // Default fallback response
    const defaultResponse = {
        text: '🤖 Thank you for your question! In a live environment, I would search through your doctor\'s verified instructions to provide a personalized answer.<br><br>This is a <strong>demo mode</strong> — try one of the suggested questions above, or connect to the live backend at <code>http://127.0.0.1:5000</code> for real AI-powered responses based on your medical profile.<br><br>💡 <strong>Tip:</strong> The full AI assistant uses RAG (Retrieval-Augmented Generation) to ensure every answer is grounded in your doctor\'s discharge instructions.',
        sources: ['Demo Mode']
    };

    function addMessage(content, isUser = false) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `chat-message ${isUser ? 'user-message' : 'bot-message'}`;

        const avatarSvg = isUser
            ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'
            : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19.5 12.572l-7.5 7.428-7.5-7.428a5 5 0 1 1 7.5-6.566 5 5 0 1 1 7.5 6.566z"/></svg>';

        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        msgDiv.innerHTML = `
            <div class="message-avatar">${avatarSvg}</div>
            <div class="message-content">
                <p>${content}</p>
                <span class="message-time">${time}</span>
            </div>
        `;

        chatMessages.appendChild(msgDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function addTypingIndicator() {
        const msgDiv = document.createElement('div');
        msgDiv.className = 'chat-message bot-message';
        msgDiv.id = 'typing-indicator';

        msgDiv.innerHTML = `
            <div class="message-avatar">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M19.5 12.572l-7.5 7.428-7.5-7.428a5 5 0 1 1 7.5-6.566 5 5 0 1 1 7.5 6.566z"/>
                </svg>
            </div>
            <div class="message-content">
                <div class="typing-indicator">
                    <span></span><span></span><span></span>
                </div>
            </div>
        `;

        chatMessages.appendChild(msgDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function removeTypingIndicator() {
        const indicator = document.getElementById('typing-indicator');
        if (indicator) indicator.remove();
    }

    function handleQuestion(question) {
        // Add user message
        addMessage(question, true);

        // Hide quick questions after first interaction
        if (quickQuestions) {
            quickQuestions.style.display = 'none';
        }

        // Show typing indicator
        addTypingIndicator();

        // Find response
        const key = question.toLowerCase().trim();
        let response = defaultResponse;

        for (const [pattern, resp] of Object.entries(demoResponses)) {
            if (key.includes(pattern) || pattern.includes(key.substring(0, 20))) {
                response = resp;
                break;
            }
        }

        // Simulate typing delay
        const delay = 1200 + Math.random() * 1000;
        setTimeout(() => {
            removeTypingIndicator();

            let sourceText = '';
            if (response.sources && response.sources.length > 0) {
                sourceText = '<br><br><em style="opacity: 0.6; font-size: 0.75rem;">📋 Sources: ' + response.sources.join(', ') + '</em>';
            }

            addMessage(response.text + sourceText);
        }, delay);
    }

    // Send message
    function sendMessage() {
        const question = chatInput.value.trim();
        if (!question) return;
        chatInput.value = '';
        handleQuestion(question);
    }

    chatSend.addEventListener('click', sendMessage);
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    // Quick question buttons
    quickBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const question = btn.getAttribute('data-question');
            handleQuestion(question);
        });
    });

    // ── Smooth Scroll for Anchor Links ───────────────────────────────────
    document.querySelectorAll('a[href^="#"]').forEach(link => {
        link.addEventListener('click', (e) => {
            const target = document.querySelector(link.getAttribute('href'));
            if (target) {
                e.preventDefault();
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });

    // ── Hero Parallax Effect ─────────────────────────────────────────────
    const heroVideo = document.querySelector('.hero-video');
    if (heroVideo) {
        window.addEventListener('scroll', () => {
            const scrollPos = window.scrollY;
            if (scrollPos < window.innerHeight) {
                heroVideo.style.transform = `scale(${1 + scrollPos * 0.0003}) translateY(${scrollPos * 0.15}px)`;
                heroVideo.style.opacity = Math.max(0.35 - scrollPos * 0.0003, 0.1);
            }
        }, { passive: true });
    }
});
