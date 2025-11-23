// ========================================
// GLOBAL VARIABLES
// ========================================
let selectedCharacter = null; // Which character user selected
let mediaRecorder = null; // Handles recording from microphone
let audioChunks = []; // Stores recorded audio data
let isRecording = false; // Track recording state

// ========================================
// DOM ELEMENTS: Get references to HTML elements
// ========================================
const characterCards = document.querySelectorAll('.character-card');
const chatInterface = document.getElementById('chatInterface');
const recordBtn = document.getElementById('recordBtn');
const resetBtn = document.getElementById('resetBtn');
const conversation = document.getElementById('conversation');
const statusDiv = document.getElementById('status');
const characterName = document.getElementById('characterName');
const characterEmoji = document.getElementById('characterEmoji');

// ========================================
// CHARACTER DATA: Map emojis to characters
// ========================================
const characterData = {
    yoda: { emoji: '🧙‍♂️', name: 'Yoda' },
    sherlock: { emoji: '🔍', name: 'Sherlock Holmes' },
    morgan: { emoji: '🎬', name: 'Morgan Freeman' }
};

// ========================================
// EVENT LISTENERS: Setup
// ========================================

// When user clicks a character card
characterCards.forEach(card => {
    card.addEventListener('click', () => {
        selectCharacter(card.dataset.character);
    });
});

// When user clicks record button (mousedown = press, mouseup = release)
recordBtn.addEventListener('mousedown', startRecording);
recordBtn.addEventListener('mouseup', stopRecording);

// Touch support for mobile (touchstart = press, touchend = release)
recordBtn.addEventListener('touchstart', (e) => {
    e.preventDefault(); // Prevent mobile browser default behavior
    startRecording();
});
recordBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    stopRecording();
});

// When user clicks reset to change character
resetBtn.addEventListener('click', resetChat);

// ========================================
// FUNCTION: Select Character
// Purpose: Show chat interface when character is chosen
// ========================================
function selectCharacter(character) {
    selectedCharacter = character;
    
    // Hide character selection, show chat interface
    document.querySelector('.character-selection').style.display = 'none';
    chatInterface.style.display = 'block';
    
    // Update character display
    characterName.textContent = characterData[character].name;
    characterEmoji.textContent = characterData[character].emoji;
    
    // Show greeting message
    addMessage('ai', `Hello! I am ${characterData[character].name}. Speak to me!`);
    updateStatus('Ready to talk! Hold the microphone button to record.');
}

// ========================================
// FUNCTION: Start Recording
// Purpose: Capture audio from user's microphone
// ========================================
async function startRecording() {
    if (isRecording) return; // Prevent double-recording
    
    try {
        // Request microphone access from browser
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // Create MediaRecorder to capture audio
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = []; // Clear previous recording
        
        // When audio data is available, store it
        mediaRecorder.addEventListener('dataavailable', (event) => {
            audioChunks.push(event.data);
        });
        
        // When recording stops, process the audio
        mediaRecorder.addEventListener('stop', processAudio);
        
        // Start recording
        mediaRecorder.start();
        isRecording = true;
        
        // Update UI
        recordBtn.classList.add('recording');
        recordBtn.querySelector('.text').textContent = 'Recording... (Release to stop)';
        updateStatus('🎤 Listening... Speak now!', 'recording');
        
    } catch (error) {
        console.error('❌ Microphone access error:', error);
        updateStatus('⚠️ Could not access microphone. Please allow microphone access.');
    }
}

// ========================================
// FUNCTION: Stop Recording
// Purpose: End recording and trigger processing
// ========================================
function stopRecording() {
    if (!isRecording || !mediaRecorder) return;
    
    // Stop the recorder (this triggers the 'stop' event)
    mediaRecorder.stop();
    isRecording = false;
    
    // Stop all audio tracks (releases microphone)
    mediaRecorder.stream.getTracks().forEach(track => track.stop());
    
    // Update UI
    recordBtn.classList.remove('recording');
    recordBtn.querySelector('.text').textContent = 'Hold to Record';
    updateStatus('⏳ Processing your voice...', 'thinking');
}

// ========================================
// FUNCTION: Process Audio
// Purpose: Send audio through the 3-step pipeline
// Step 1: Transcribe (audio → text)
// Step 2: Generate response (text → AI text)
// Step 3: Text-to-speech (AI text → audio)
// ========================================
async function processAudio() {
    try {
        // Create audio blob from recorded chunks
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        
        // === STEP 1: TRANSCRIBE ===
        updateStatus('📝 Transcribing your speech...', 'thinking');
        const transcription = await transcribeAudio(audioBlob);
        
        if (!transcription) {
            updateStatus('⚠️ Could not transcribe audio. Please try again.');
            return;
        }
        
        // Show user's transcribed message
        addMessage('user', transcription);
        
        // === STEP 2: GENERATE RESPONSE ===
        updateStatus('🤔 Thinking...', 'thinking');
        const response = await generateResponse(transcription);
        
        if (!response) {
            updateStatus('⚠️ Could not generate response. Please try again.');
            return;
        }
        
        // Show AI's text response
        addMessage('ai', response);
        
        // === STEP 3: TEXT-TO-SPEECH ===
        updateStatus('🔊 Speaking...', 'speaking');
        await textToSpeech(response);
        
        // Ready for next interaction
        updateStatus('✅ Ready! Hold the button to speak again.');
        
    } catch (error) {
        console.error('❌ Processing error:', error);
        updateStatus('⚠️ Something went wrong. Please try again.');
    }
}

// ========================================
// API CALL 1: Transcribe Audio
// Purpose: Send audio to backend → Whisper API
// ========================================
async function transcribeAudio(audioBlob) {
    try {
        // Create form data (needed for file upload)
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');
        
        // Send to backend
        const response = await fetch('http://localhost:3000/api/transcribe', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error('Transcription failed');
        }
        
        const data = await response.json();
        console.log('✅ Transcription:', data.text);
        return data.text;
        
    } catch (error) {
        console.error('❌ Transcription error:', error);
        return null;
    }
}

// ========================================
// API CALL 2: Generate AI Response
// Purpose: Send text to backend → GPT-4o-mini
// ========================================
async function generateResponse(text) {
    try {
        const response = await fetch('http://localhost:3000/api/respond', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: text,
                character: selectedCharacter
            })
        });
        
        if (!response.ok) {
            throw new Error('Response generation failed');
        }
        
        const data = await response.json();
        console.log('✅ AI Response:', data.response);
        return data.response;
        
    } catch (error) {
        console.error('❌ Response generation error:', error);
        return null;
    }
}

// ========================================
// API CALL 3: Text to Speech
// Purpose: Send text to backend → TTS API → Play audio
// ========================================
async function textToSpeech(text) {
    try {
        const response = await fetch('http://localhost:3000/api/tts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: text,
                character: selectedCharacter
            })
        });
        
        if (!response.ok) {
            throw new Error('TTS failed');
        }
        
        // Get audio data as blob
        const audioBlob = await response.blob();
        
        // Create audio URL and play it
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        
        // Wait for audio to finish playing
        await audio.play();
        
        // Clean up URL after playing
        audio.addEventListener('ended', () => {
            URL.revokeObjectURL(audioUrl);
        });
        
        console.log('✅ Audio played');
        
    } catch (error) {
        console.error('❌ TTS error:', error);
    }
}

// ========================================
// UI HELPER: Add Message to Conversation
// ========================================
function addMessage(type, text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    
    const label = type === 'user' ? 'You' : characterData[selectedCharacter].name;
    
    messageDiv.innerHTML = `
        <div class="label">${label}</div>
        <div class="text">${text}</div>
    `;
    
    conversation.appendChild(messageDiv);
    
    // Auto-scroll to bottom
    conversation.scrollTop = conversation.scrollHeight;
}

// ========================================
// UI HELPER: Update Status Message
// ========================================
function updateStatus(message, className = '') {
    statusDiv.textContent = message;
    statusDiv.className = 'status ' + className;
}

// ========================================
// FUNCTION: Reset Chat
// Purpose: Go back to character selection
// ========================================
function resetChat() {
    selectedCharacter = null;
    conversation.innerHTML = '';
    chatInterface.style.display = 'none';
    document.querySelector('.character-selection').style.display = 'block';
}