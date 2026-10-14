FT FlexTranscription B15 | Rebuilt Audio-First Edition

Upload every file in this ZIP to the root of your GitHub Pages repository.
Files are flat (no subdirectories). Wait for Actions to finish and confirm BUILD B15.

Workflow: Choose video/audio using the native Android picker > Start Transcribing > audio extraction > Whisper transcription > edit speaker labels and transcript > PDF.

Audio extraction uses FFmpeg.wasm single-threaded UMD runtime and core from jsDelivr. First-time downloads require internet. The FFmpeg runtime and Whisper model are loaded on demand. Native audio decoding is tried first for small files.

IMPORTANT LIMITATIONS:
- Android may suspend or terminate JavaScript in background or when phone locks. Continuous processing while away cannot be guaranteed by a GitHub Pages browser-only app. Finished sections are checkpointed in localStorage and can be reviewed later, but an interrupted job does not resume automatically.
- Large videos (100+ MB) can exceed Android browser memory. For dependable background jobs and large-file support, a server-side processing service with durable jobs is necessary.
- Whisper Tiny English may make errors and does not identify speakers automatically. Speaker labels are manual.
- CDN and WASM compatibility cannot be verified here on your phone. The diagnostics panel reports errors.
- Uploaded source stays in browser memory; app does not upload files to an app server. Libraries and model assets are fetched from external CDNs.
