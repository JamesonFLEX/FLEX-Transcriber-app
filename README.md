FT FlexTranscription B16 — Audio-first experimental build

Install: upload all 12 production files from this ZIP to the root of the GitHub Pages repository. Replace existing files. Do not upload the test media used during development.

Workflow: choose a local video/audio file (Android file picker can expose Google Drive), watch preparation progress, press START TRANSCRIBING, review text and manually assign speaker names, export PDF.

Supported audio: AAC in MP4/MOV/M4A/3GP using a bundled JavaScript MP4 demultiplexer; audio files decoded by Chrome (MP3/WAV etc.) through AudioContext. Other formats/codecs are not guaranteed. The application does not transcode unsupported audio. Video is never played or decoded.

30-minute maximum duration is checked for supported MP4/MOV/M4A AAC files at import and for other browser-decoded audio when transcription starts. Large source files can still exceed phone memory.

Transcription: requires internet to download Transformers.js and Whisper Tiny English model on first use. Model and runtime are not bundled. Voice diarization is not automatic; labels are editable. No guarantee of uninterrupted Android background processing; foreground use recommended. Transcript sections save to localStorage. For evidentiary use verify all words, timestamps, and labels against source.

Tested locally: Node.js syntax checks; MP4/AAC sample table and ADTS extraction with a generated test recording, validated by ffprobe. Chromium browser execution was blocked by the environment's administrator policy. No real-phone end-to-end Whisper run has been verified. Do not treat this build as fully validated for 30-minute videos.
