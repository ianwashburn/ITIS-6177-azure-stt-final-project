// server.js
const express = require("express");
const multer = require("multer");
const fs = require("fs");
const sdk = require("microsoft-cognitiveservices-speech-sdk");

const app = express();
const upload = multer({ dest: "uploads/" }); // temporary folder
app.use(express.json()); // so we can read JSON bodies for /tts

app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Speech API</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 40px auto;
            line-height: 1.6;
          }
          code {
            background: #f4f4f4;
            padding: 2px 6px;
            border-radius: 4px;
          }
        </style>
      </head>
      <body>
        <h1>Welcome to the Speech API</h1>
        <p>
          This API provides speech-to-text and text-to-speech functionality
          using Microsoft Azure Cognitive Services.
        </p>

        <h2>Available Endpoints</h2>
        <ul>
          <li><code>GET /api/v1/health</code> – Check API status</li>
          <li><code>POST /api/v1/transcribe</code> – Upload a WAV file and receive transcribed text</li>
          <li><code>POST /api/v1/tts</code> – Submit text and receive synthesized speech</li>
        </ul>

        <h2>Getting Started</h2>
        <p>
          This API is intended to be accessed via tools like Postman, curl,
          or application code. Please refer to the project documentation
          for request formats and examples.
        </p>

        <p>
          If you see this page, the API is running correctly.
        </p>
      </body>
    </html>
  `);
});

// Health check
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Speech API is running" });
});

// ---- Continuous transcription helper ---- //
function transcribeWavFile(filePath, speechKey, speechRegion) {
  return new Promise((resolve, reject) => {
    const speechConfig = sdk.SpeechConfig.fromSubscription(speechKey, speechRegion);

    // Node.js API: pass a Buffer into fromWavFileInput
    const audioBuffer = fs.readFileSync(filePath);
    const audioConfig = sdk.AudioConfig.fromWavFileInput(audioBuffer);

    const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

    let allText = "";

    recognizer.recognizing = (s, e) => {
      // Interim results if you want them:
      // console.log("RECOGNIZING:", e.result?.text);
    };

    recognizer.recognized = (s, e) => {
      if (e.result && e.result.reason === sdk.ResultReason.RecognizedSpeech && e.result.text) {
        allText += e.result.text + " ";
      }
    };

    recognizer.canceled = (s, e) => {
      // Log details, but don't auto-fail the whole transcription
      console.error("Recognition canceled. Reason:", e.reason);
      if (e.errorDetails) {
        console.error("Error details:", e.errorDetails);
      }
      // We let sessionStopped handle resolve(), so no reject() here.
    };

    recognizer.sessionStopped = () => {
      recognizer.stopContinuousRecognitionAsync(() => {
        recognizer.close();
        resolve(allText.trim());
      });
    };

    recognizer.startContinuousRecognitionAsync(err => {
      if (err) {
        console.error("Error starting continuous recognition:", err);
        recognizer.close();
        reject(err);
      }
    });
  });
}

function synthesizeToWavBuffer(text, speechKey, speechRegion) {
  return new Promise((resolve, reject) => {
    const speechConfig = sdk.SpeechConfig.fromSubscription(speechKey, speechRegion);

    // Optional: ensure we get WAV back (usually default, but this makes it explicit)
    speechConfig.speechSynthesisOutputFormat =
      sdk.SpeechSynthesisOutputFormat.Riff16Khz16BitMonoPcm;

    // No audioConfig -> audioData returned in result
    const synthesizer = new sdk.SpeechSynthesizer(speechConfig, null);

    synthesizer.speakTextAsync(
      text,
      result => {
        if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
          console.log("TTS synthesis completed.");
          const audioData = result.audioData; // Uint8Array
          synthesizer.close();
          resolve(Buffer.from(audioData));   // Node Buffer
        } else {
          const details = result.errorDetails || result.reason;
          console.error("TTS synthesis failed:", details);
          synthesizer.close();
          reject(new Error(details));
        }
      },
      err => {
        console.error("TTS error:", err);
        synthesizer.close();
        reject(err);
      }
    );
  });
}

// Health check
app.get("/api/v1/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Speech API is running",
    timestamp: new Date().toISOString()
  });
});

// ---- POST /transcribe ---- //
app.post("/api/v1/transcribe", upload.single("audio"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      error: "No audio file uploaded. Must be form-data with key 'audio'."
    });
  }

  // Validate file type
  const originalName = req.file.originalname.toLowerCase();
  const mime = req.file.mimetype;

  const isWavExtension = originalName.endsWith(".wav");
  const isWavMime =
    mime === "audio/wav" ||
    mime === "audio/x-wav" ||
    mime === "audio/wave";

  if (!isWavExtension || !isWavMime) {
    // Delete temp file
    fs.unlink(req.file.path, () => {});
    return res.status(400).json({
      error: "Invalid file format. Only .wav audio files are accepted."
    });
  }

  const audioPath = req.file.path;
  const speechKey = process.env.SPEECH_KEY;
  const speechRegion = process.env.SPEECH_REGION;

  if (!speechKey || !speechRegion) {
    fs.unlink(audioPath, () => {});
    return res.status(500).json({
      error: "Missing SPEECH_KEY or SPEECH_REGION in environment."
    });
  }

  try {
    console.log("Transcribing file:", audioPath);

    const text = await transcribeWavFile(audioPath, speechKey, speechRegion);

    // Remove temp file after processing
    fs.unlink(audioPath, () => {});

    return res.json({
      text,
      lengthCharacters: text.length
    });

  } catch (err) {
    console.error("Transcription error:", err);
    fs.unlink(audioPath, () => {});

    return res.status(500).json({
      error: "Transcription failed",
      details: err.message
    });
  }
});

// POST /tts
// Body: JSON { "text": "Hello world" }
app.post("/api/v1/tts", async (req, res) => {
  const { text } = req.body;

  if (!text || typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ error: "Request body must be JSON with a non-empty 'text' field." });
  }

  const speechKey = process.env.SPEECH_KEY;
  const speechRegion = process.env.SPEECH_REGION;

  if (!speechKey || !speechRegion) {
    return res.status(500).json({ error: "Missing SPEECH_KEY or SPEECH_REGION in environment." });
  }

  try {
    console.log("Synthesizing TTS for text:", text);
    const audioBuffer = await synthesizeToWavBuffer(text, speechKey, speechRegion);

    res.set({
      "Content-Type": "audio/wav",
      "Content-Length": audioBuffer.length,
      "Content-Disposition": 'attachment; filename="speech.wav"'
    });

    res.send(audioBuffer);
  } catch (err) {
    console.error("TTS synthesis failed:", err);
    res.status(500).json({
      error: "TTS synthesis failed",
      details: err.message || String(err)
    });
  }
});

// Start API
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API server running at http://localhost:${PORT}`);
});
