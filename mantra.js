let count = 0;
let target = 108;
let listening = false;
let recognition;
let language = 'hi-IN';
let keyword = '';
let startedAt = null;
let timerInterval = null;

const alarm = document.getElementById("alarmSound");

const els = {
    count: document.getElementById("count"),
    target: document.getElementById("target"),
    transcript: document.getElementById("transcript"),
    startBtn: document.getElementById("startBtn"),
    stopBtn: document.getElementById("stopBtn"),
    resetBtn: document.getElementById("resetBtn"),
    setTargetBtn: document.getElementById("setTargetBtn"),
    targetInput: document.getElementById("targetInput"),
    languageSelect: document.getElementById("languageSelect"),
    keywordInput: document.getElementById("keywordInput"),
    progressBar: document.getElementById("progressBar"),
    timer: document.getElementById("timer"),
    cpm: document.getElementById("cpm"),
    support: document.getElementById("supportMsg"),
    incBtn: document.getElementById("incBtn"),
    decBtn: document.getElementById("decBtn"),
    beepToggle: document.getElementById("beepToggle"),
    autoRestartToggle: document.getElementById("autoRestartToggle"),
};

// Load saved state
try {
    const saved = JSON.parse(localStorage.getItem('mantra-state') || '{}');
    if (typeof saved.count === 'number') count = saved.count;
    if (typeof saved.target === 'number') target = saved.target;
    if (typeof saved.language === 'string') language = saved.language;
    if (typeof saved.keyword === 'string') keyword = saved.keyword;
    if (typeof saved.beep === 'boolean') els.beepToggle.checked = saved.beep;
    if (typeof saved.autoRestart === 'boolean') els.autoRestartToggle.checked = saved.autoRestart;
} catch {}
els.count.textContent = count;
els.target.textContent = target;
if (els.languageSelect) els.languageSelect.value = language;
if (els.keywordInput) els.keywordInput.value = keyword;
updateProgress();
updateMetrics();

function persist() {
    localStorage.setItem('mantra-state', JSON.stringify({
        count, target, language, keyword,
        beep: els.beepToggle?.checked ?? true,
        autoRestart: els.autoRestartToggle?.checked ?? true,
    }));
}

els.setTargetBtn.addEventListener("click", () => {
    const val = parseInt(els.targetInput.value);
    if (!isNaN(val) && val > 0) {
        target = val;
        els.target.textContent = target;
        persist();
        updateProgress();
    }
});

els.languageSelect.addEventListener('change', () => {
    language = els.languageSelect.value;
    persist();
    if (listening) {
        stopListening();
        startListening();
    }
});

els.keywordInput.addEventListener('input', () => {
    keyword = (els.keywordInput.value || '').trim().toLowerCase();
    persist();
});

els.startBtn.addEventListener("click", startListening);
els.stopBtn.addEventListener("click", stopListening);
els.resetBtn.addEventListener("click", resetCount);
els.incBtn.addEventListener('click', () => increment(1));
els.decBtn.addEventListener('click', () => increment(-1));

function increment(delta) {
    count = Math.max(0, count + delta);
    els.count.textContent = count;
    updateProgress();
    updateMetrics();
    persist();
    if (count >= target) onTargetReached();
}

function startTimer() {
    startedAt = Date.now();
    clearInterval(timerInterval);
    timerInterval = setInterval(updateMetrics, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
}

function updateMetrics() {
    if (!startedAt) {
        els.timer.textContent = '00:00';
        els.cpm.textContent = `${count} cpm`;
        return;
    }
    const elapsedSec = Math.max(1, Math.floor((Date.now() - startedAt) / 1000));
    const mins = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
    const secs = String(elapsedSec % 60).padStart(2, '0');
    els.timer.textContent = `${mins}:${secs}`;
    const cpmVal = Math.round((count / elapsedSec) * 60);
    els.cpm.textContent = `${cpmVal} cpm`;
}

function updateProgress() {
    const pct = target > 0 ? Math.min(100, Math.round((count / target) * 100)) : 0;
    if (els.progressBar) els.progressBar.style.width = `${pct}%`;
}

function onTargetReached() {
    if (els.beepToggle?.checked) {
        try { alarm.currentTime = 0; alarm.play(); } catch {}
    }
    // Delay alert to let alarm play first
    setTimeout(() => {
        alert(`🎯 Target ${target} complete!`);
    }, 500);
    stopListening();
}

function startListening() {
    window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!window.SpeechRecognition) {
        els.support.textContent = 'Speech Recognition not supported in this browser.';
        return;
    }
    
    // Check if already listening
    if (listening) return;
    
    recognition = new SpeechRecognition();
    recognition.lang = language;
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = function(event) {
        const result = event.results[event.results.length - 1];
        const isFinal = result.isFinal;
        const transcript = result[0].transcript.trim();
        // els.transcript.textContent = transcript; // Commented out - transcript display disabled

        // Count only on final results; optionally gate by keyword
        if (isFinal) {
            const normalized = transcript.toLowerCase();
            const pass = !keyword || normalized.includes(keyword);
            if (pass && normalized.length > 1) {
                increment(1);
            }
        }
    };

    recognition.onerror = function(event) {
        console.error("Speech recognition error:", event.error);
        
        // Handle specific errors
        if (event.error === 'not-allowed') {
            els.support.textContent = 'Microphone permission denied. Please allow microphone access and try again.';
            stopListening();
        } else if (event.error === 'no-speech') {
            // Ignore no-speech errors, they're common
        } else if (event.error === 'network') {
            els.support.textContent = 'Network error. Please check your connection.';
            stopListening();
        } else {
            els.support.textContent = `Error: ${event.error}. Please try again.`;
            stopListening();
        }
    };

    recognition.onend = () => {
        // Only restart if we're still supposed to be listening and auto-restart is enabled
        if (listening && (els.autoRestartToggle?.checked ?? true)) {
            // Small delay to prevent rapid restarts
            setTimeout(() => {
                if (listening) {
                    try {
                        recognition.start();
                    } catch (e) {
                        console.error("Failed to restart recognition:", e);
                        stopListening();
                    }
                }
            }, 100);
        }
    };

    listening = true;
    els.startBtn.disabled = true;
    els.stopBtn.disabled = false;
    startTimer();
    
    try {
        recognition.start();
        els.support.textContent = 'Listening... Speak now!';
    } catch (e) {
        console.error("Failed to start recognition:", e);
        els.support.textContent = 'Failed to start microphone. Please refresh and try again.';
        stopListening();
    }
}

function stopListening() {
    listening = false;
    els.startBtn.disabled = false;
    els.stopBtn.disabled = true;
    
    if (recognition) {
        try {
            recognition.stop();
        } catch (e) {
            console.error("Error stopping recognition:", e);
        }
    }
    
    stopTimer();
    els.support.textContent = 'Stopped. Click Start to begin again.';
}

function resetCount() {
    count = 0;
    els.count.textContent = count;
    // els.transcript.textContent = "Your speech will appear here..."; // Commented out - transcript display disabled
    startedAt = null;
    updateProgress();
    updateMetrics();
    persist();
}
