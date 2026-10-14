(()=>{'use strict';window.addEventListener('error',e=>{const d=document.getElementById('videoDiagnostics');if(d){d.hidden=false;d.textContent+='\nJavaScript error: '+e.message+' (line '+e.lineno+')'}});window.addEventListener('unhandledrejection',e=>{const d=document.getElementById('videoDiagnostics');if(d){d.hidden=false;d.textContent+='\nUnhandled error: '+String(e.reason?.message||e.reason)}});const $=id=>document.getElementById(id);let file=null,objectUrl=null,mode='full',segments=[],speakers={},task=null,stopped=false,busy=false,hash='',duration=0,created=null;const dbKey='flex-transcripts-b1';const fmt=s=>{s=Math.max(0,Math.floor(s||0));return [Math.floor(s/3600),Math.floor(s%3600/60),s%60].map(n=>String(n).padStart(2,'0')).join(':')};const parseTime=v=>{const p=v.trim().split(':').map(Number);if(p.some(n=>!Number.isFinite(n)||n<0)||p.length>3||!p.length)return NaN;return p.reduce((a,n)=>a*60+n,0)};const status=(s,p)=>{$('status').textContent=s;if(p!==undefined)$('progressBar').style.width=p+'%'};const setBusy=v=>{busy=v;$('transcribe').disabled=v||!file;$('stop').disabled=!v;$('videoFile').disabled=v};const size=n=>n>1048576?(n/1048576).toFixed(1)+' MB':(n/1024).toFixed(0)+' KB';function escapeHTML(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}function readRecords(){try{return JSON.parse(localStorage.getItem(dbKey)||'[]')}catch{return []}}function storeRecords(a){localStorage.setItem(dbKey,JSON.stringify(a))}function getRecord(){return {id:created?.id||crypto.randomUUID(),title:$('recordTitle').value.trim()||file?.name||'Video transcript',filename:file?.name||created?.filename||'Unknown',duration:fmt(duration),range:mode==='full'?'Entire video':$('startTime').value+' to '+$('endTime').value,created:created?.created||new Date().toISOString(),sourceDate:$('sourceDate').value,hash,segments:segments.map(x=>({...x})),speakers:{...speakers}}}function render(){const keys=[...new Set(segments.map(x=>x.speaker))];$('segmentCount').textContent=segments.length+' segments';$('speakerPanel').innerHTML=keys.map(k=>'<div class="speaker"><label>'+escapeHTML(k)+'<input data-speaker="'+escapeHTML(k)+'" value="'+escapeHTML(speakers[k]||k)+'" aria-label="Rename '+escapeHTML(k)+'"></label></div>').join('');$('transcriptList').innerHTML=segments.length?segments.map((s,i)=>'<div class="segment"><div class="seghead"><strong>['+fmt(s.start/1000)+'] '+escapeHTML(speakers[s.speaker]||s.speaker)+'</strong><button class="quiet" data-seek="'+s.start+'">▶ Play</button></div><div class="segment-tools"><label>Voice <select data-assign="'+i+'">'+[...new Set([...Object.keys(speakers),'Unassigned','Voice 1','Voice 2','Voice 3','Voice 4','Voice 5'])].map(k=>'<option value="'+escapeHTML(k)+'" '+(s.speaker===k?'selected':'')+'>'+escapeHTML(speakers[k]||k)+'</option>').join('')+'</select></label><button class="quiet" data-split="'+i+'">Split</button><button class="quiet" data-merge="'+i+'">Merge next</button></div><textarea data-seg="'+i+'" aria-label="Edit transcript segment '+(i+1)+'">'+escapeHTML(s.text)+'</textarea></div>').join(''):'<div class="empty">Your speaker-separated transcript will appear here.</div>';$('save').disabled=$('export').disabled=!segments.length}function renderHistory(){const a=readRecords();$('history').innerHTML=a.length?a.map(r=>'<div class="historyitem"><div><strong>'+escapeHTML(r.title)+'</strong><small>'+escapeHTML(new Date(r.created).toLocaleString())+' · '+r.segments.length+' segments</small></div><div class="historybuttons"><button class="quiet" data-load="'+escapeHTML(r.id)+'">Open</button><button class="quiet" data-delete="'+escapeHTML(r.id)+'">Delete</button></div></div>').join(''):'<div class="empty">No records saved yet.</div>'}async function digest(f){if(!crypto.subtle||f.size>150*1024*1024)return '';try{const bytes=await f.arrayBuffer();const b=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('')}catch{return ''}}let loadToken=0,loadTimer=null;let ffmpegInstance=null,conversionRunning=false,conversionAbort=false;const conversionBox=$('conversionBox');const conversionProgress=$('conversionProgress');function showConversion(message){conversionBox.hidden=false;$('conversionNote').textContent=message;$('convertVideo').disabled=false;}function hideConversion(){conversionBox.hidden=true;conversionProgress.textContent='';}
function loadingUI(message,active=true){const box=$('videoLoading');if(!box)return;box.hidden=!active;$('videoLoadingText').textContent=message;box.classList.toggle('is-loading',active)}
function playerReady(){const v=$('player');return v.readyState>=1&&(Number.isFinite(v.duration)&&v.duration>0||v.seekable.length>0)}
async function onVideoChosen(e){
 const selected=e.target.files?.[0];const diagnostic=document.getElementById('videoDiagnostics');if(diagnostic){diagnostic.hidden=false;diagnostic.textContent='File picker change event received.';}if(!selected){$('videoDiagnostics').textContent='No file returned by Android file picker.';return;}
 if(armed||finishing){status('Stop transcription before changing the video.');return}
 const token=++loadToken;clearTimeout(loadTimer);hideConversion();
 const oldUrl=objectUrl;const v=$('player');v.pause();
 file=selected;created=null;segments=[];speakers={};hash='';duration=0;render();
 $('fileInfo').hidden=false;$('fileInfo').textContent=selected.name+' · '+size(selected.size)+' · '+(selected.type||'unknown media type');
 $('recordTitle').value=selected.name.replace(/\.[^.]+$/,'');
 const log=$('videoDiagnostics');log.hidden=false;log.textContent='Selected file. Size: '+size(selected.size)+'. MIME: '+(selected.type||'not provided')+'.';
 const note=t=>{log.textContent+='\n'+t;};
 loadingUI('Loading selected video…');status('Reading video file…',4);
 playbackButtons();$('playVideo').disabled=true;$('transcribe').disabled=true;
 if(!selected.size){loadingUI('The selected file is empty or Drive has not downloaded it.');$('videoLoading').classList.remove('is-loading');status('File is empty. Download it to your phone and select the local copy.',0);return}
 if(selected.type&&!selected.type.startsWith('video/')&&!/\.(mp4|mov|m4v|webm|3gp|mkv|avi)$/i.test(selected.name)){loadingUI('This is not a recognized video file.');$('videoLoading').classList.remove('is-loading');status('Choose a video file.',0);return}
 let settled=false;let newUrl;
 const cleanup=()=>{v.removeEventListener('loadedmetadata',ready);v.removeEventListener('canplay',ready);v.removeEventListener('error',bad);v.removeEventListener('progress',progress);v.removeEventListener('waiting',waiting);clearTimeout(loadTimer)};
 const ready=()=>{if(token!==loadToken||settled||!playerReady())return;settled=true;cleanup();duration=v.duration;$('endTime').value=fmt(duration);loadingUI('',false);status('Video ready ('+fmt(duration)+'). If playback stutters, tap OPTIMIZE VIDEO FOR SPEECH before transcribing.',100);if(!selected.name.includes('-speech-optimized'))showConversion('Optional: make a much lighter 240p / 12 fps copy while preserving speech audio at AAC 128 kbps. Recommended if playback pauses or stutters.');note('Ready. Duration: '+fmt(duration)+'. Video: '+v.videoWidth+'×'+v.videoHeight+'.');playbackButtons();if(oldUrl&&oldUrl!==newUrl)URL.revokeObjectURL(oldUrl)};
 const bad=()=>{if(token!==loadToken||settled)return;settled=true;cleanup();const code=v.error?.code||0;const reasons={1:'loading aborted',2:'network or Drive stream error',3:'video decoding error',4:'format or codec not supported'};note('MEDIA ERROR '+code+': '+(reasons[code]||'unknown')+'. '+(v.error?.message||''));loadingUI('Could not open this video. Try a downloaded MP4 (H.264 video, AAC audio).');$('videoLoading').classList.remove('is-loading');status('Video load failed: '+(reasons[code]||'unknown error')+'. See diagnostics below.',0);$('playVideo').disabled=true;$('transcribe').disabled=true;if(oldUrl&&oldUrl!==newUrl)URL.revokeObjectURL(oldUrl)};
 const progress=()=>{if(token!==loadToken||settled)return;if(playerReady())ready();else status('Video data received. Reading metadata…',35)};
 const waiting=()=>{if(token!==loadToken||settled)return;loadingUI('Waiting for video data from Android / Drive…');note('Waiting for more video data.')};
 v.addEventListener('loadedmetadata',ready);v.addEventListener('canplay',ready);v.addEventListener('error',bad);v.addEventListener('progress',progress);v.addEventListener('waiting',waiting);
 try{
  newUrl=URL.createObjectURL(selected);objectUrl=newUrl;
  v.hidden=false;v.style.display='block';v.preload='auto';v.src=newUrl;v.load();
  note('Object URL assigned. Loading metadata… readyState='+v.readyState+', networkState='+v.networkState);
  if(playerReady())ready();
 }catch(err){note('File opening exception: '+err.message);bad();return}
 loadTimer=setTimeout(()=>{if(token!==loadToken||settled)return;if(playerReady()){ready();return}note('Still loading after 45 seconds. readyState='+v.readyState+', networkState='+v.networkState+', error='+String(v.error?.message||'none')+'.');loadingUI('Still loading. If this is a Drive file, download it to your phone first.');$('videoLoading').classList.remove('is-loading');status('Video has not become ready. Try a local Downloads copy. See diagnostics.',0)},45000);
 e.target.value='';
}
async function convertSelectedVideo(){
 if(!file||conversionRunning)return;
 const original=file;
 if(original.size>300*1024*1024){showConversion('This file is over 300 MB. Mobile conversion is likely to run out of memory. Use a phone video converter to make a 240p H.264/AAC copy.');return;}
 conversionRunning=true;conversionAbort=false;$('convertVideo').disabled=true;$('cancelConvert').hidden=false;
 const report=m=>{conversionProgress.textContent=m;$('videoDiagnostics').textContent+='\n'+m;};
 try{
  report('Loading video converter. First download may be about 30 MB…');
  const [{FFmpeg},{toBlobURL}]=await Promise.all([
   import('https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.15/dist/esm/index.js'),
   import('https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.2/dist/esm/index.js')
  ]);
  if(!ffmpegInstance){ffmpegInstance=new FFmpeg();ffmpegInstance.on('progress',({progress})=>{if(conversionRunning)conversionProgress.textContent='Converting video: '+Math.min(99,Math.max(0,Math.round(progress*100)))+'%';});}
  const base='https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd';
  if(!ffmpegInstance.loaded){await ffmpegInstance.load({coreURL:await toBlobURL(base+'/ffmpeg-core.js','text/javascript'),wasmURL:await toBlobURL(base+'/ffmpeg-core.wasm','application/wasm')});}
  if(conversionAbort)throw Error('Conversion canceled');
  report('Copying video into converter memory…');
  const inputName='source'+(original.name.match(/\.[a-z0-9]+$/i)?.[0]||'.mp4');
  await ffmpegInstance.writeFile(inputName,new Uint8Array(await original.arrayBuffer()));
  if(conversionAbort)throw Error('Conversion canceled');
  report('Optimizing for speech: 240p video at 12 fps, AAC audio at 128 kbps. Do not close this tab…');
  const exit=await ffmpegInstance.exec(['-i',inputName,'-vf','fps=12,scale=426:240:force_original_aspect_ratio=decrease:force_divisible_by=2','-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p','-c:a','aac','-b:a','128k','-movflags','+faststart','-y','compatible.mp4']);
  if(exit!==0)throw Error('Converter exited with code '+exit);
  const data=await ffmpegInstance.readFile('compatible.mp4');
  if(!data?.length)throw Error('Converter produced an empty file');
  const converted=new File([data],original.name.replace(/\.[^.]+$/,'')+'-compatible.mp4',{type:'video/mp4'});
  report('Converted '+size(converted.size)+'. Loading compatible video…');
  hideConversion();
  await onVideoChosen({target:{files:[converted],value:''}});
  try{await ffmpegInstance.deleteFile(inputName);await ffmpegInstance.deleteFile('compatible.mp4')}catch{}
 }catch(err){report('Conversion failed: '+(err?.message||err)+'. For large HEVC recordings, use an external converter to H.264/AAC.');$('convertVideo').disabled=false;}
 finally{conversionRunning=false;$('cancelConvert').hidden=true;}
}
$('convertVideo').addEventListener('click',convertSelectedVideo);
$('cancelConvert').addEventListener('click',async()=>{conversionAbort=true;conversionProgress.textContent='Canceling…';try{ffmpegInstance?.terminate();ffmpegInstance=null;}catch{}});
$('videoDiagnostics').hidden=false; $('videoDiagnostics').textContent='B13 ready. Select a file. If nothing changes, try the visible direct file selector.'; $('videoFile').addEventListener('change',onVideoChosen);$('directVideoFile')?.addEventListener('change',onVideoChosen);$('driveFile').addEventListener('change',onVideoChosen);$('chooseGallery').onclick=()=>{$('videoDiagnostics').textContent='Opening Gallery / Files picker…';$('videoFile').value='';$('videoFile').click()};$('chooseDrive').onclick=()=>{$('driveHelp').hidden=false;$('videoDiagnostics').textContent='Opening Android document picker…';$('driveFile').value='';$('driveFile').click()};$('player').addEventListener('loadedmetadata',()=>{duration=Number.isFinite($('player').duration)?$('player').duration:0;$('endTime').value=fmt(duration)});function setMode(m){mode=m;$('rangeArea').hidden=m==='full';$('fullMode').classList.toggle('selected',m==='full');$('sectionMode').classList.toggle('selected',m==='section')}$('fullMode').onclick=()=>setMode('full');$('sectionMode').onclick=()=>setMode('section');$('setStart').onclick=()=>{$('startTime').value=fmt($('player').currentTime)};$('setEnd').onclick=()=>{$('endTime').value=fmt($('player').currentTime)};// B6: capture the actual video element's audio during user-controlled playback.
// No microphone permission and no decodeAudioData(MP4) required.
let audioCtx=null,mediaSource=null,processor=null,silentGain=null;
let armed=false,finishing=false,captured=[],frameCount=0,firstSampleRate=0;
let pendingAudio=null,chunkStart=null,lastVideoTime=null;
function playbackButtons(){
 $('playVideo').disabled=!file||!playerReady();
 $('pauseVideo').disabled=!file||$('player').paused;
 $('stopVideo').disabled=!file;
 $('transcribe').disabled=!file||!playerReady()||armed||finishing;
 $('stop').disabled=!armed;
 $('videoFile').disabled=armed||finishing; if($('directVideoFile'))$('directVideoFile').disabled=armed||finishing;
 $('driveFile').disabled=armed||finishing;
}
async function setupCapture(){
 if(audioCtx)return;
 const Ctx=window.AudioContext||window.webkitAudioContext;
 if(!Ctx)throw Error('Web Audio is not supported in this browser');
 audioCtx=new Ctx();firstSampleRate=audioCtx.sampleRate;
 mediaSource=audioCtx.createMediaElementSource($('player'));
 processor=audioCtx.createScriptProcessor(4096,2,1);
 silentGain=audioCtx.createGain();silentGain.gain.value=0;
 mediaSource.connect(audioCtx.destination);
 mediaSource.connect(processor);processor.connect(silentGain);silentGain.connect(audioCtx.destination);
 processor.onaudioprocess=e=>{
  if(!armed||$('player').paused||$('player').ended)return;
  const input=e.inputBuffer;const left=input.getChannelData(0),right=input.numberOfChannels>1?input.getChannelData(1):left;
  const data=new Float32Array(left.length);let energy=0;
  for(let i=0;i<data.length;i++){data[i]=(left[i]+right[i])*.5;energy+=data[i]*data[i]}
  const at=$('player').currentTime;
  if(chunkStart===null)chunkStart=Math.max(0,at-data.length/firstSampleRate);
  // Keep timing anchors for seeking during capture.
  if(lastVideoTime!==null&&(at<lastVideoTime-.5||at-lastVideoTime>2)){
   if(captured.length)captured[captured.length-1].endTime=lastVideoTime;
   chunkStart=Math.max(0,at-data.length/firstSampleRate);
  }
  captured.push({pcm:data,startTime:chunkStart,endTime:at,energy});
  lastVideoTime=at;frameCount+=data.length;
  if(captured.length%110===0)status('Capturing video audio · '+Math.round(frameCount/firstSampleRate)+' seconds collected. Press STOP TRANSCRIBING whenever ready.',Math.min(85,5+Math.round(frameCount/firstSampleRate/2)));
 };
}
function resample(data,from,to=16000){
 if(from===to)return data;
 const count=Math.max(1,Math.floor(data.length*to/from));const out=new Float32Array(count);
 for(let i=0;i<count;i++){const p=i*from/to,lo=Math.floor(p),hi=Math.min(data.length-1,lo+1),mix=p-lo;out[i]=data[lo]*(1-mix)+data[hi]*mix}
 return out;
}
function chunksFromCapture(){
 // Build <= 12-second chunks; preserve source-video timestamps when available.
 const result=[];let pieces=[],samples=0,begin=null,last=null;
 const flush=()=>{if(!samples)return;const raw=new Float32Array(samples);let pos=0;for(const part of pieces){raw.set(part,pos);pos+=part.length}result.push({audio:resample(raw,firstSampleRate),start:begin,end:last});pieces=[];samples=0;begin=null;last=null};
 for(const frame of captured){
  if(begin!==null&&(frame.startTime<last-0.5||frame.endTime-last>2))flush();
  if(begin===null)begin=frame.startTime;
  pieces.push(frame.pcm);samples+=frame.pcm.length;last=frame.endTime;
  if(samples>=firstSampleRate*10)flush();
 }
 flush();return result;
}
let recognizer=null;
async function loadModel(){
 if(recognizer)return recognizer;
 status('Downloading Whisper Tiny English model. First use may take several minutes…',8);
 const {pipeline,env}=await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2');
 env.allowLocalModels=false;env.useBrowserCache=true;
 recognizer=await pipeline('automatic-speech-recognition','Xenova/whisper-tiny.en',{
  quantized:true,progress_callback:p=>{if(p.status==='progress'&&p.progress!=null)status('Downloading speech model: '+Math.round(p.progress)+'%',8)}
 });return recognizer;
}
async function finishTranscription(){
 if(finishing)return;armed=false;finishing=true;playbackButtons();
 const blocks=chunksFromCapture();captured=[];frameCount=0;chunkStart=null;lastVideoTime=null;
 if(!blocks.length){finishing=false;status('No video audio was captured. Play the video after START TRANSCRIBING. Check that it has an audio track.',0);playbackButtons();return}
 try{
  status('Captured '+blocks.length+' audio sections. Loading local transcription model…',10);
  const asr=await loadModel();let count=0;
  for(const block of blocks){
   status('Transcribing audio section '+(count+1)+' of '+blocks.length+'…',Math.round(15+80*count/blocks.length));
   const peak=block.audio.reduce((m,v)=>Math.max(m,Math.abs(v)),0);
   if(peak>.001){
    const output=await asr(block.audio,{task:'transcribe',language:'english',return_timestamps:false});
    const text=(output?.text||'').trim();
    if(text){segments.push({speaker:'Unassigned',start:Math.round(block.start*1000),end:Math.round(block.end*1000),text});render()}
   }
   count++;
  }
  status(segments.length?'Transcription complete. Review text and assign speakers.':'No speech recognized in captured audio. Check that the video is audible and try again.',100);
 }catch(err){status('Transcription error: '+(err?.message||err)+'. Captured audio could not be transcribed.',0)}
 finally{finishing=false;playbackButtons()}
}
$('transcribe').onclick=async()=>{
 if(!file||!playerReady()||armed||finishing)return;
 try{
  await setupCapture();await audioCtx.resume();
  captured=[];frameCount=0;chunkStart=null;lastVideoTime=null;segments=[];speakers={'Unassigned':'Unassigned'};render();
  armed=true;playbackButtons();
  status($('player').paused?'Transcription armed. Press PLAY VIDEO to capture speech.':'Capturing video audio now. Press STOP TRANSCRIBING to finish.',0);
 }catch(err){status('Audio capture setup failed: '+(err?.message||err)+'. Try Chrome on Android.',0);armed=false;playbackButtons()}
};
$('stop').onclick=()=>{if(armed)finishTranscription()};
$('playVideo').onclick=async()=>{try{if(audioCtx&&audioCtx.state==='suspended')await audioCtx.resume();await $('player').play()}catch(err){status('Video playback failed: '+err.message)}playbackButtons()};
$('pauseVideo').onclick=()=>{$('player').pause();playbackButtons();if(armed)status('Video paused. Audio capture paused. Resume playback or stop transcribing.')};
$('stopVideo').onclick=()=>{$('player').pause();$('player').currentTime=0;playbackButtons();if(armed)status('Video stopped. Transcription is still armed. Press STOP TRANSCRIBING to process captured audio.')};
$('player').addEventListener('play',()=>{if(audioCtx&&audioCtx.state==='suspended')audioCtx.resume().catch(()=>{});playbackButtons();if(armed)status('Capturing audio as the video plays…')});
$('player').addEventListener('pause',()=>{playbackButtons();if(armed&&!$('player').ended)status('Video paused. Transcription remains armed.')});
$('player').addEventListener('ended',()=>{playbackButtons();if(armed)finishTranscription()});
$('speakerPanel').addEventListener('input',e=>{const k=e.target.dataset.speaker;if(k){speakers[k]=e.target.value;document.querySelectorAll('.seghead strong').forEach((el,i)=>{const s=segments[i];el.textContent='['+fmt(s.start/1000)+'] '+(speakers[s.speaker]||s.speaker)})}});$('transcriptList').addEventListener('input',e=>{const i=e.target.dataset.seg;if(i!==undefined)segments[Number(i)].text=e.target.value;const a=e.target.dataset.assign;if(a!==undefined){segments[Number(a)].speaker=e.target.value||'Speaker unknown';const heading=e.target.closest('.segment')?.querySelector('.seghead strong');if(heading)heading.textContent='['+fmt(segments[Number(a)].start/1000)+'] '+segments[Number(a)].speaker}});$('transcriptList').addEventListener('change',e=>{if(e.target.dataset.assign!==undefined){const i=Number(e.target.dataset.assign);segments[i].speaker=e.target.value;speakers[e.target.value]??=e.target.value;render()}});$('transcriptList').addEventListener('click',e=>{const si=e.target.dataset.split,mi=e.target.dataset.merge;if(si!==undefined){const i=Number(si),v=segments[i];const cut=prompt('Split text after which word? Enter the word number (1 to '+(v.text.trim().split(/\s+/).length-1)+').');const words=v.text.trim().split(/\s+/),n=Number(cut);if(!Number.isInteger(n)||n<1||n>=words.length)return;const mid=Math.round((v.start+v.end)/2);segments.splice(i,1,{...v,end:mid,text:words.slice(0,n).join(' ')},{...v,start:mid,text:words.slice(n).join(' ')});render();return}if(mi!==undefined){const i=Number(mi);if(i>=segments.length-1)return;segments[i].text+=' '+segments[i+1].text;segments[i].end=segments[i+1].end;segments.splice(i+1,1);render();return}const ms=e.target.dataset.seek;if(ms!==undefined&&file){$('player').currentTime=Number(ms)/1000;$('player').scrollIntoView({behavior:'smooth',block:'center'});$('player').play().catch(()=>{})}});$('save').onclick=()=>{try{const r=getRecord(),a=readRecords().filter(x=>x.id!==r.id);a.unshift(r);storeRecords(a.slice(0,40));created=r;renderHistory();status('Record saved on this device. Export a PDF for a separate copy.')}catch(e){status('Save failed. Your browser storage may be full: '+e.message)}};$('export').onclick=()=>{try{FlexPDF.download(getRecord());status('PDF download started.')}catch(e){status('PDF export error: '+e.message)}};$('history').addEventListener('click',e=>{const id=e.target.dataset.load||e.target.dataset.delete;if(!id)return;const a=readRecords();if(e.target.dataset.delete){if(confirm('Delete this saved record?')){storeRecords(a.filter(x=>x.id!==id));renderHistory()}return}const r=a.find(x=>x.id===id);if(!r)return;created=r;segments=r.segments||[];speakers=r.speakers||{};hash=r.hash||'';file=null;duration=0;$('recordTitle').value=r.title||'';$('sourceDate').value=r.sourceDate||'';playbackButtons();render();status('Saved record opened. Original video is not stored; select it again to play sections.');$('transcriptPanel').scrollIntoView({behavior:'smooth'})});$('refresh').onclick=renderHistory;let deferred;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;$('install').hidden=false});$('install').onclick=async()=>{if(!deferred)return;deferred.prompt();await deferred.userChoice;deferred=null;$('install').hidden=true};if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});renderHistory()})();
