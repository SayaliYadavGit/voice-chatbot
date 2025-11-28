// ========================================
// CHARACTER DATA
// ========================================
const characterData = {
    harry: {
        name: "Harry Potter",
        emoji: "⚡",
        description: "The Boy Who Lived"
    },
    srk: {
        name: "Shah Rukh Khan",
        emoji: "🎬",
        description: "Bollywood King"
    },
    po: {
        name: "Kung Fu Panda",
        emoji: "🐼",
        description: "Dragon Warrior"
    }
};

// ========================================
// GLOBAL VARIABLES
// ========================================
let selectedCharacter = null;
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;

// ========================================
// DOM ELEMENTS
// ========================================
const characterCards = document.querySelectorAll('.character-card');
const chatInterface = document.getElementById('chatInterface');
const conversation = document.getElementById('conversation');
const status = document.getElementById('status');
const recordBtn = document.getElementById('recordBtn');
const resetBtn = document.getElementById('resetBtn');
const characterEmoji = document.getElementById('characterEmoji');
const characterName = document.getElementById('characterName');

// ========================================
// CHARACTER SELECTION
// ========================================
characterCards.forEach(card => {
    card.addEventListener('click', () => {
        const character = card.dataset.character;
        selectCharacter(character);
    });
});

function selectCharacter(character) {
    selectedCharacter = character;
    const charData = characterData[character];
    
    // Update UI
    characterEmoji.textContent = charData.emoji;
    characterName.textContent = charData.name;
    
    // Hide character selection, show chat
    document.querySelector('.character-selection').style.display = 'none';
    chatInterface.style.display = 'block';
    
    // Add welcome message
    addMessage('system', `You're now talking to ${charData.name}! ${charData.emoji}`);
    
    console.log('Character selected:', charData.name);
}

// ========================================
// RECORDING FUNCTIONALITY
// ========================================
recordBtn.addEventListener('mousedown', startRecording);
recordBtn.addEventListener('mouseup', stopRecording);
recordBtn.addEventListener('touchstart', startRecording);
recordBtn.addEventListener('touchend', stopRecording);

async function startRecording() {
    if (isRecording) return;
    
    try {
        // Request microphone access
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // Create MediaRecorder
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        
        // Collect audio data
        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };
        
        // Handle recording stop
        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            await processAudio(audioBlob);
            
            // Stop all tracks to release microphone
            stream.getTracks().forEach(track => track.stop());
        };
        
        // Start recording
        mediaRecorder.start();
        isRecording = true;
        
        // Update UI
        recordBtn.classList.add('recording');
        updateStatus('🎤 Recording... Release to send', 'recording');
        
        console.log('Recording started');
        
    } catch (error) {
        console.error('Microphone access error:', error);
        updateStatus('❌ Microphone access denied', 'error');
    }
}

function stopRecording() {
    if (!isRecording || !mediaRecorder) return;
    
    mediaRecorder.stop();
    isRecording = false;
    
    // Update UI
    recordBtn.classList.remove('recording');
    updateStatus('⏳ Processing your message...', 'processing');
    
    console.log('Recording stopped');
}

// ========================================
// AUDIO PROCESSING PIPELINE
// ========================================
async function processAudio(audioBlob) {
    try {
        // Step 1: Transcribe audio to text
        updateStatus('🎯 Converting speech to text...', 'processing');
        const transcription = await transcribeAudio(audioBlob);
        
        if (!transcription) {
            throw new Error('Transcription failed');
        }
        
        console.log('Transcription:', transcription);
        addMessage('user', transcription);
        
        // Step 2: Generate character response
        updateStatus('💭 Thinking...', 'processing');
        const response = await getCharacterResponse(transcription);
        
        if (!response) {
            throw new Error('Response generation failed');
        }
        
        console.log('Response:', response);
        addMessage('character', response);
        
        // Step 3: Convert response to speech
        updateStatus('🔊 Generating voice...', 'processing');
        await speakResponse(response);
        
        // Done!
        updateStatus('✅ Ready! Hold the button to speak again', 'ready');
        
    } catch (error) {
        console.error('Processing error:', error);
        updateStatus('❌ Something went wrong. Try again!', 'error');
    }
}

// ========================================
// API CALLS
// ========================================
async function transcribeAudio(audioBlob) {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'audio.webm');
    
    const response = await fetch('http://localhost:3000/api/transcribe', {
        method: 'POST',
        body: formData
    });
    
    if (!response.ok) {
        throw new Error('Transcription request failed');
    }
    
    const data = await response.json();
    return data.text;
}

async function getCharacterResponse(text) {
    const response = await fetch('http://localhost:3000/api/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            text: text,
            character: selectedCharacter
        })
    });
    
    if (!response.ok) {
        throw new Error('Response generation failed');
    }
    
    const data = await response.json();
    return data.response;
}

async function speakResponse(text) {
    const response = await fetch('http://localhost:3000/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            text: text,
            character: selectedCharacter
        })
    });
    
    if (!response.ok) {
        throw new Error('TTS request failed');
    }
    
    // Convert response to audio blob
    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    
    // Play audio
    const audio = new Audio(audioUrl);
    await audio.play();
    
    // Wait for audio to finish
    await new Promise(resolve => {
        audio.onended = resolve;
    });
}

// ========================================
// UI HELPERS
// ========================================
function addMessage(type, text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    
    if (type === 'character') {
        const charData = characterData[selectedCharacter];
        messageDiv.innerHTML = `
            <span class="message-emoji">${charData.emoji}</span>
            <span class="message-text">${text}</span>
        `;
    } else if (type === 'user') {
        messageDiv.innerHTML = `
            <span class="message-text">${text}</span>
            <span class="message-emoji">👤</span>
        `;
    } else {
        messageDiv.innerHTML = `<span class="message-text">${text}</span>`;
    }
    
    conversation.appendChild(messageDiv);
    conversation.scrollTop = conversation.scrollHeight;
}

function updateStatus(message, type = 'ready') {
    status.textContent = message;
    status.className = `status ${type}`;
}

// ========================================
// RESET FUNCTIONALITY
// ========================================
resetBtn.addEventListener('click', () => {
    // Clear conversation
    conversation.innerHTML = '';
    
    // Reset character
    selectedCharacter = null;
    
    // Show character selection
    document.querySelector('.character-selection').style.display = 'block';
    chatInterface.style.display = 'none';
    
    updateStatus('Ready to talk! Click the microphone button.', 'ready');
});

// ========================================
// INITIALIZATION
// ========================================
console.log('Voice AI Chatbot loaded!');
console.log('Available characters:', Object.keys(characterData));