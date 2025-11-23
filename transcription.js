import { readFileSync, createReadStream } from "fs";
import { SpeechConfig, AudioConfig, ConversationTranscriber, AudioInputStream } from "microsoft-cognitiveservices-speech-sdk";
// This example requires environment variables named "ENDPOINT" and "SPEECH_KEY"
const speechConfig = SpeechConfig.fromEndpoint(new URL(process.env.SPEECH_ENDPOINT), process.env.SPEECH_KEY);
function fromFile() {
    const filename = "ian-1.1.wav";
    const audioConfig = AudioConfig.fromWavFileInput(readFileSync(filename));
    const conversationTranscriber = new ConversationTranscriber(speechConfig, audioConfig);
    const pushStream = AudioInputStream.createPushStream();
    createReadStream(filename).on('data', function (chunk) {
        pushStream.write(chunk.slice());
    }).on('end', function () {
        pushStream.close();
    });
    console.log("Transcribing from: " + filename);
    conversationTranscriber.sessionStarted = function (s, e) {
        console.log("SessionStarted event");
        console.log("SessionId:" + e.sessionId);
    };
    conversationTranscriber.sessionStopped = function (s, e) {
        console.log("SessionStopped event");
        console.log("SessionId:" + e.sessionId);
        conversationTranscriber.stopTranscribingAsync();
    };
    conversationTranscriber.canceled = function (s, e) {
        console.log("Canceled event");
        console.log(e.errorDetails);
        conversationTranscriber.stopTranscribingAsync();
    };
    conversationTranscriber.transcribed = function (s, e) {
        console.log("TRANSCRIBED: Text=" + e.result.text + " Speaker ID=" + e.result.speakerId);
    };
    // Start conversation transcription
    conversationTranscriber.startTranscribingAsync(function () { }, function (err) {
        console.trace("err - starting transcription: " + err);
    });
}
fromFile();