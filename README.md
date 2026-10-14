FT FlexTranscription B6 | Playback-controlled local transcription

Upload all 11 files to the ROOT of your existing GitHub Pages repository. Replace older files.

1. Select a video from Gallery/Files or the Android file picker (Google Drive if offered).
2. Press START TRANSCRIBING.
3. Press PLAY VIDEO. The browser captures the video element audio during playback, not microphone audio.
4. PAUSE VIDEO pauses audio capture. PLAY / RESUME continues. STOP VIDEO rewinds without stopping transcription.
5. Press STOP TRANSCRIBING at any time. Video continues playing if already playing. The app then runs local Whisper speech-to-text on captured audio.
6. If the video naturally ends, transcription finalizes automatically.
7. Edit transcript, assign speakers manually, save or export PDF.

LIMITATIONS: Whisper Tiny English is downloaded on first use, requiring internet and phone memory. Audio capture uses Web Audio ScriptProcessor, supported in Chrome but deprecated. It has not been tested on your Samsung device. Browser video/audio codec support varies. This build does not implement reliable automatic speaker diarization; speaker assignments are manual. Large captures can exhaust memory. Audio is processed after stopping, not continuously displayed during playback. Timestamp positions are approximate, especially if seeking during recording.

No Firebase, API key, or backend required. Do not use unreviewed AI transcripts as verified legal evidence.
