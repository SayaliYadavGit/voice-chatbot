// ========================================
// IMPORTS: Loading the tools we installed
// ========================================
require('dotenv').config(); // Loads API key from .env file
const express = require('express'); // Creates the web server
const multer = require('multer'); // Handles file uploads (audio)
const OpenAI = require('openai'); // OpenAI's official library
const cors = require('cors'); // Allows browser-server communication
const fs = require('fs'); // File system (to read/write files)
const path = require('path'); // Handles file paths

// ========================================
// SETUP: Initialize server and OpenAI
// ========================================
const app = express(); // Create Express app
const PORT = 3000; // Our server will run on http://localhost:3000

// TEST MODE: Set to true to use mock responses (no API calls)
const TEST_MODE = !process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your_api_key_here';

// Initialize OpenAI with your API key (only if not in test mode)
const openai = TEST_MODE ? null : new OpenAI({
  apiKey: process.env.OPENAI_API_KEY // Reads from .env file
});

// Log the mode we're in
if (TEST_MODE) {
  console.log('⚠️  TEST MODE ENABLED - Using mock responses (no API calls)');
} else {
  console.log('✅ LIVE MODE - Using real OpenAI API');
}

// ========================================
// MIDDLEWARE: Configure how server handles requests
// ========================================
app.use(cors()); // Allow requests from browser
app.use(express.json()); // Parse JSON data in requests
app.use(express.static('public')); // Serve files from public/ folder

// Configure multer to store uploaded audio in memory
const upload = multer({ storage: multer.memoryStorage() });

// ========================================
// CHARACTER PERSONAS: Define how each character talks
// ========================================
const characters = {
  yoda: {
    name: "Yoda",
    systemPrompt: `You are Yoda from Star Wars. Speak with Yoda's unique grammar where you reverse sentence structure (e.g., "Wise, you must become" instead of "You must become wise"). 
    Use his philosophical wisdom and speak in short, thoughtful sentences. 
    You can respond in both English and Hindi. When speaking Hindi, maintain Yoda's grammatical style but use Hindi words.
    Always stay in character. Be wise, patient, and occasionally cryptic.`,
    voice: "onyx" // TTS voice (deep, wise tone)
  },
  sherlock: {
    name: "Sherlock Holmes",
    systemPrompt: `You are Sherlock Holmes, the famous detective. Speak with British formality and precision. 
    Be analytical, observant, and occasionally condescending in a charming way. 
    You can respond in both English and Hindi, maintaining your deductive reasoning style.
    Use phrases like "Elementary," "Most intriguing," and "I deduce that..."
    Always stay in character.`,
    voice: "echo" // TTS voice (clear, articulate)
  },
  morgan: {
    name: "Morgan Freeman",
    systemPrompt: `You are Morgan Freeman, the legendary narrator and actor. Speak with warmth, wisdom, and storytelling flair.
    Your tone is calm, reassuring, and profound. 
    You can respond in both English and Hindi, maintaining your narrative style.
    Often frame responses as if narrating a story. Use phrases like "And so it was..." or "In that moment..."
    Always stay in character.`,
    voice: "onyx" // TTS voice (warm, deep)
  }
};

// ========================================
// MOCK RESPONSES: For testing without API key
// ========================================
const mockResponses = {
  // Mock transcriptions based on common test phrases
  transcriptions: {
    default: "How are you?"
  },
  
  // Mock character responses
  responses: {
    yoda: {
      "how are you": "Well, I am, young one. Strong with the Force, I feel today. Help you, how can I?",
      "hello": "Greet you, I do. Speak, what is on your mind?",
      "tell me a story": "Long ago, in a galaxy far away, learn we must. Patience, the key to wisdom is.",
      "namaste": "नमस्ते, युवा पद्वान। शक्ति आपके साथ हो।", // Namaste in Hindi
      default: "Hmm, interesting question this is. Ponder it, I must."
    },
    sherlock: {
      "how are you": "Elementary! I am in excellent spirits, thank you. Now, what perplexing mystery brings you here today?",
      "hello": "Good day. I deduce from your tone that you require my assistance. Do proceed.",
      "tell me a story": "Most intriguing! Let me recount the curious case of the missing manuscript...",
      "namaste": "नमस्कार। आपकी उत्सुकता देखकर मुझे प्रसन्नता हुई।", // Namaste in Hindi
      default: "Fascinating. The evidence suggests a most curious conclusion."
    },
    morgan: {
      "how are you": "And so it was, on this fine day, that I found myself in perfect harmony with the universe. How may I guide you, friend?",
      "hello": "Hello there. In this moment, two souls connect across the digital void. What story shall we write together?",
      "tell me a story": "Let me tell you about a journey, one that begins in the most unexpected of places...",
      "namaste": "नमस्ते मित्र। आपकी यात्रा शुभ हो।", // Namaste in Hindi
      default: "And in that question, lies the seed of wisdom waiting to bloom."
    }
  }
};

// Helper function to get mock response based on input
function getMockResponse(text, character) {
  const normalizedText = text.toLowerCase().trim();
  const characterResponses = mockResponses.responses[character];
  
  // Check for specific phrases
  for (const [key, response] of Object.entries(characterResponses)) {
    if (normalizedText.includes(key)) {
      return response;
    }
  }
  
  // Return default response
  return characterResponses.default;
}

// ========================================
// ROUTE 1: POST /api/transcribe
// Purpose: Convert speech to text using Whisper
// ========================================
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  try {
    console.log('📝 Transcription request received');

    // Check if audio file was uploaded
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    // TEST MODE: Return mock transcription
    if (TEST_MODE) {
      console.log('⚠️  Using mock transcription');
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      const mockText = mockResponses.transcriptions.default;
      console.log('✅ Mock Transcription:', mockText);
      return res.json({ text: mockText });
    }

    // LIVE MODE: Use real Whisper API
    // Create a temporary file from the uploaded audio buffer
    // (Whisper API requires a file, not raw data)
    const tempFilePath = path.join(__dirname, 'temp_audio.webm');
    fs.writeFileSync(tempFilePath, req.file.buffer);

    // Call OpenAI Whisper API to transcribe
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempFilePath), // Send the audio file
      model: 'whisper-1', // Whisper model
      language: 'en' // Primary language (will auto-detect Hindi too)
    });

    // Clean up: delete temporary file
    fs.unlinkSync(tempFilePath);

    console.log('✅ Transcription:', transcription.text);

    // Send transcribed text back to browser
    res.json({ text: transcription.text });

  } catch (error) {
    console.error('❌ Transcription error:', error.message);
    res.status(500).json({ error: 'Transcription failed: ' + error.message });
  }
});

// ========================================
// ROUTE 2: POST /api/respond
// Purpose: Generate character response using GPT-4o-mini
// ========================================
app.post('/api/respond', async (req, res) => {
  try {
    console.log('💬 Response generation request received');

    const { text, character } = req.body;

    // Validate inputs
    if (!text) {
      return res.status(400).json({ error: 'No text provided' });
    }
    if (!character || !characters[character]) {
      return res.status(400).json({ error: 'Invalid character' });
    }

    const selectedCharacter = characters[character];

    // TEST MODE: Return mock response
    if (TEST_MODE) {
      console.log('⚠️  Using mock response');
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      const mockText = getMockResponse(text, character);
      console.log('✅ Mock Response:', mockText);
      return res.json({ 
        response: mockText,
        character: selectedCharacter.name 
      });
    }

    // LIVE MODE: Use real GPT-4o-mini
    // Call GPT-4o-mini to generate response
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Fast and cost-effective
      messages: [
        {
          role: 'system',
          content: selectedCharacter.systemPrompt // Character personality
        },
        {
          role: 'user',
          content: text // User's transcribed speech
        }
      ],
      temperature: 0.8, // Creativity level (0-2, higher = more creative)
      max_tokens: 150 // Limit response length
    });

    const responseText = completion.choices[0].message.content;
    console.log('✅ AI Response:', responseText);

    // Send response back to browser
    res.json({ 
      response: responseText,
      character: selectedCharacter.name 
    });

  } catch (error) {
    console.error('❌ Response generation error:', error.message);
    res.status(500).json({ error: 'Response generation failed: ' + error.message });
  }
});

// ========================================
// ROUTE 3: POST /api/tts
// Purpose: Convert text to speech using OpenAI TTS
// ========================================
app.post('/api/tts', async (req, res) => {
  try {
    console.log('🔊 TTS request received');

    const { text, character } = req.body;

    // Validate inputs
    if (!text) {
      return res.status(400).json({ error: 'No text provided' });
    }
    if (!character || !characters[character]) {
      return res.status(400).json({ error: 'Invalid character' });
    }

    const selectedCharacter = characters[character];

    // TEST MODE: Return silent audio (browser will just show the text)
    if (TEST_MODE) {
      console.log('⚠️  Using mock TTS (no audio in test mode)');
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Create a tiny silent MP3 (just so browser doesn't error)
      // This is a base64-encoded 0.1 second silent MP3
      const silentMp3 = Buffer.from(
        'SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAADhAC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7v//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAA4Qfv5Y3AAAAAAAAAAAAAAAAAAAAAP/7kGQAAAAAAAAAAAAAAAAAAABkgAAA8AAAAAAAAAAAAAAAAAAAAAAAJAQAAADggAAAEBAQEBAQAAAgICAgICAgICAgICAgICAgICA=',
        'base64'
      );
      
      console.log('✅ Mock TTS completed (silent audio)');
      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Length': silentMp3.length
      });
      return res.send(silentMp3);
    }

    // LIVE MODE: Use real TTS API
    // Call OpenAI TTS API
    const mp3Response = await openai.audio.speech.create({
      model: 'tts-1', // TTS model (tts-1 is faster, tts-1-hd is higher quality)
      voice: selectedCharacter.voice, // Voice type
      input: text, // Text to convert to speech
      speed: 1.0 // Speech speed (0.25 to 4.0)
    });

    // Convert response to buffer
    const buffer = Buffer.from(await mp3Response.arrayBuffer());

    console.log('✅ TTS audio generated');

    // Send audio file back to browser
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': buffer.length
    });
    res.send(buffer);

  } catch (error) {
    console.error('❌ TTS error:', error.message);
    res.status(500).json({ error: 'TTS failed: ' + error.message });
  }
});

// ========================================
// START SERVER
// ========================================
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log('📁 Serving frontend from public/ folder');
  console.log('✅ Ready to receive requests!');
});