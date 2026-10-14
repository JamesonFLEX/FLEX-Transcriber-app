# FT FlexTranscription B5 | Experimental Voice Detection

Upload all files from this flat ZIP to the root of the existing GitHub Pages repository. Delete old worker.js and wrangler.toml if still present. Firebase and ElevenLabs are not required for this build.

## How to use
1. Open the PWA in Chrome and choose a video from Gallery or use OPEN WITH GOOGLE DRIVE. Drive availability is controlled by Android. If it does not appear, download the video in Drive and import it from Downloads.
2. Tap TRANSCRIBE VIDEO. First use downloads Whisper Tiny English from a third-party model CDN. Allow time and use Wi-Fi.
3. The app analyzes audio for silence and spectral changes, proposes voice sections, and runs local speech recognition on those sections.
4. Use each segment's Voice dropdown to reassign a voice. Rename voices at the top. Use Split and Merge next to fix section boundaries. Review every line against the original recording.
5. Save the record or export PDF.

## Critical limitations
This is **experimental acoustic clustering**, not reliable speaker diarization or speaker identification. The detector uses rough spectral signatures, which can confuse the same speaker across changing acoustics or merge different speakers. Labels are suggestions only, and boundaries/timestamps are approximate. Transcription is English only. Browser video audio decoding may fail for some MP4/MOV files. Large videos may exhaust phone memory. Audio is processed in the browser after the model is downloaded, but model files load from a third-party CDN. The source video is not retained in saved records. Keep the original video independently. Do not present an unreviewed AI draft as a certified or verbatim legal transcript.

## Testing
JavaScript syntax can be checked with `node --check app.js` and `node --check sw.js`. Live phone audio decoding, model downloading, transcription quality, and PWA installation require on-device tests.
