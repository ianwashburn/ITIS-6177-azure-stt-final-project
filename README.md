ITIS-6177 Azure Speech API Final Project

Base URL

http://134.122.31.214/api/v1/

Description

This project provides a simple REST API for converting speech to text and text to speech using Microsoft Azure Cognitive Services – Speech. The API is hosted on a DigitalOcean droplet and implemented using Node.js and Express.

Features

Speech-to-Text from a .wav audio file

Text-to-Speech from plain text

Azure Speech SDK integration

Versioned API structure (/api/v1)

Tested using Postman

Architecture

Client (Postman) → REST API → DigitalOcean Droplet → Node.js/Express → Azure Cognitive Services Speech

Endpoints

GET /api/v1/health
Returns a simple status message confirming the API is running.

POST /api/v1/transcribe
Uploads a .wav file and returns the transcribed text.
Request type: multipart/form-data
Form field name: audio

POST /api/v1/tts
Accepts plain text and returns an audio file in wav format.
Request type: application/json
Body field: text

Environment Variables (set on the server)

SPEECH_KEY
SPEECH_REGION
PORT

These values are stored on the droplet and not in the repository.

Tech Stack

Node.js
Express
Azure Cognitive Services Speech SDK
DigitalOcean Droplet (CentOS)

Security Notes

Do not commit Azure keys to GitHub.
Keys should only be stored as environment variables on the server.
If a key is exposed, regenerate it immediately in Azure.

Acknowledgements

Microsoft Azure Cognitive Services
Node.js / Express
DigitalOcean