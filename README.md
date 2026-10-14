# FLEX Video Transcriber | Build B3

Installable GitHub Pages PWA for Gallery / Google Drive video transcription, speaker diarization, transcript editing, local history, and PDF download.

## Deploy the interface

1. Create a **public GitHub repository** named `flex-video-transcriber`.
2. Upload `index.html`, `style.css`, `app.js`, `pdf.js`, `sw.js`, `icon-192.png, icon-512.png, ft-logo.png, social-preview.jpg`, and `manifest.webmanifest` to the **root** of the repository. Upload `backend/` and `README.md` too if you want the source code there.
3. GitHub repository **Settings → Pages → Deploy from a branch → main → /(root) → Save**.
4. Visit `https://YOUR-USERNAME.github.io/flex-video-transcriber/` in Chrome on Android. From Chrome menu, choose **Install app** or **Add to Home screen** (the install prompt depends on browser eligibility).

## Enable actual AI transcription (required)

The PWA cannot transcribe video by itself. It uses AssemblyAI through a private Cloudflare Worker backend. GitHub Pages only serves the app files.

1. Create an AssemblyAI account and API key. AI processing may incur charges.
2. Create a Cloudflare account and Worker. Deploy `backend/worker.js` as the Worker code, or use Wrangler from the `backend/` folder (`npx wrangler deploy`).
3. In Cloudflare Worker **Settings → Variables and Secrets**, set:
   - Secret `ASSEMBLYAI_API_KEY` = your AssemblyAI API key. **Never add this key to GitHub.**
   - Text variable `ALLOWED_ORIGIN` = `https://YOUR-USERNAME.github.io` (no path, no trailing slash).
4. Note your Worker HTTPS URL, e.g. `https://flex-video-transcriber-api.YOUR-SUBDOMAIN.workers.dev`.
5. Open the installed app → **Transcription service settings** → paste the Worker URL → **Save settings**.
6. Select a video, choose entire video or section, and tap **TRANSCRIBE VIDEO**.

## Supported workflows

- **Samsung Gallery:** Choose video with `Choose a video` / Android Files picker.
- **Google Drive:** Use Android Files picker with Drive provider if present, or download the video from Drive first. Direct access to the Drive video player overlay is not supported by PWAs.
- **Section mode:** Enter `MM:SS` or `HH:MM:SS` start/end, or use video playback time buttons. The original file is still uploaded; transcription is restricted to the chosen time window.
- **Stop:** Cancels this browser's active request or polling. It **does not guarantee server-side job cancellation or delete uploaded data**.
- **PDF:** Works without an external JavaScript library, including offline for previously saved records. PDF export supports Western Latin text; unsupported Unicode characters may appear as `?`.

## Privacy and limitations

- Videos are uploaded to the transcription provider. Review the provider's retention/privacy policies before uploading confidential or legally sensitive files.
- Transcripts and speaker names are stored locally in the browser's `localStorage`. Video files are **not** retained locally by the app. Clearing site data deletes saved records.
- LocalStorage has limited capacity; export important records promptly. The app retains at most 40 records.
- Speaker diarization identifies distinct voice clusters, **not people's identities**. Rename speakers only after reviewing the recording.
- AI text and timestamps can be wrong, particularly with overlap/noise. Verify against the original recording before legal use. This is **not a certified transcript**.
- SHA-256 is calculated locally for files up to 150 MB; for larger files, no hash is included to avoid excessive mobile memory use.
- Large videos may exceed Cloudflare Worker upload limits for your plan. If upload fails, trim or compress the video externally, or use a backend with larger uploads. Some formats may not be supported by the provider.
- An installable PWA **cannot display a system-wide floating overlay** over Gallery or Google Drive.
- This initial build is a functional starter, not a tested production deployment. It requires user-supplied cloud credentials and an end-to-end Android test.

## Versioning

Update `CACHE` in `sw.js` when publishing a new build to ensure new files are fetched.


BUILD 2: Dedicated OPEN WITH GOOGLE DRIVE button launches the Android document picker with unrestricted file filtering. Android controls which providers appear. If Google Drive is absent from the picker, download the video using the Drive app and choose it from Downloads.


## Build B3 branding
- New metallic FT logo is used in the header and landing section.
- PNG icons at 192 and 512 pixels are used by the Android install manifest.
- `social-preview.jpg` (1200x630) is used in Open Graph and Twitter preview metadata.
- The HTML now loads `pdf.js` before `app.js`, correcting a missing script reference that prevented PDF exports.
- All files are flat in the ZIP. Deploy Worker separately.
- Social link previews require a public absolute og:image URL for best reliability. After you know your GitHub Pages URL, replace `content="social-preview.jpg"` in `index.html` with your full HTTPS URL to the preview image, then redeploy. Some messaging services do not generate previews for GitHub Pages.
