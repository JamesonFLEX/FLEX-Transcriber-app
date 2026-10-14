(()=>{'use strict';window.addEventListener('error',e=>{const d=document.getElementById('videoDiagnostics');if(d){d.hidden=false;d.textContent+='\nJavaScript error: '+e.message+' (line '+e.lineno+')'}});window.addEventListener('unhandledrejection',e=>{const d=document.getElementById('videoDiagnostics');if(d){d.hidden=false;d.textContent+='\nUnhandled error: '+String(e.reason?.message||e.reason)}});const $=id=>document.getElementById(id);let file=null,objectUrl=null,mode='full',segments=[],speakers={},task=null,stopped=false,busy=false,hash='',duration=0,created=null;const dbKey='flex-transcripts-b1';const fmt=s=>{s=Math.max(0,Math.floor(s||0));return [Math.floor(s/3600),Math.floor(s%3600/60),s%60].map(n=>String(n).padStart(2,'0')).join(':')};const parseTime=v=>{const p=v.trim().split(':').map(Number);if(p.some(n=>!Number.isFinite(n)||n<0)||p.length>3||!p.length)return NaN;return p.reduce((a,n)=>a*60+n,0)};const status=(s,p)=>{$('status').textContent=s;if(p!==undefined)$('progressBar').style.width=p+'%'};const size=n=>n>1048576?(n/1048576).toFixed(1)+' MB':(n/1024).toFixed(0)+' KB';function escapeHTML(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}function readRecords(){try{return JSON.parse(localStorage.getItem(dbKey)||'[]')}catch{return []}}function storeRecords(a){localStorage.setItem(dbKey,JSON.stringify(a))}function getRecord(){return {id:created?.id||crypto.randomUUID(),title:$('recordTitle').value.trim()||file?.name||'Video transcript',filename:file?.name||created?.filename||'Unknown',duration:fmt(duration),range:mode==='full'?'Entire video':$('startTime').value+' to '+$('endTime').value,created:created?.created||new Date().toISOString(),sourceDate:$('sourceDate').value,hash,segments:segments.map(x=>({...x})),speakers:{...speakers}}}function render(){const keys=[...new Set(segments.map(x=>x.speaker))];$('segmentCount').textContent=segments.length+' segments';$('speakerPanel').innerHTML=keys.map(k=>'<div class="speaker"><label>'+escapeHTML(k)+'<input data-speaker="'+escapeHTML(k)+'" value="'+escapeHTML(speakers[k]||k)+'" aria-label="Rename '+escapeHTML(k)+'"></label></div>').join('');$('transcriptList').innerHTML=segments.length?segments.map((s,i)=>'<div class="segment"><div class="seghead"><strong>['+fmt(s.start/1000)+'] '+escapeHTML(speakers[s.speaker]||s.speaker)+'</strong><button class="quiet" data-seek="'+s.start+'">▶ Play</button></div><div class="segment-tools"><label>Voice <select data-assign="'+i+'">'+[...new Set([...Object.keys(speakers),'Unassigned','Voice 1','Voice 2','Voice 3','Voice 4','Voice 5'])].map(k=>'<option value="'+escapeHTML(k)+'" '+(s.speaker===k?'selected':'')+'>'+escapeHTML(speakers[k]||k)+'</option>').join('')+'</select></label><button class="quiet" data-split="'+i+'">Split</button><button class="quiet" data-merge="'+i+'">Merge next</button></div><textarea data-seg="'+i+'" aria-label="Edit transcript segment '+(i+1)+'">'+escapeHTML(s.text)+'</textarea></div>').join(''):'<div class="empty">Your speaker-separated transcript will appear here.</div>';$('save').disabled=$('export').disabled=!segments.length}function renderHistory(){const a=readRecords();$('history').innerHTML=a.length?a.map(r=>'<div class="historyitem"><div><strong>'+escapeHTML(r.title)+'</strong><small>'+escapeHTML(new Date(r.created).toLocaleString())+' · '+r.segments.length+' segments</small></div><div class="historybuttons"><button class="quiet" data-load="'+escapeHTML(r.id)+'">Open</button><button class="quiet" data-delete="'+escapeHTML(r.id)+'">Delete</button></div></div>').join(''):'<div class="empty">No records saved yet.</div>'}async function digest(f){if(!crypto.subtle||f.size>150*1024*1024)return '';try{const bytes=await f.arrayBuffer();const b=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('')}catch{return ''}}
let processing=false, selectedFile=null, ffmpegInstance=null, cancelRequested=false, activeAudioURL=null;
const diagnostic=$('videoDiagnostics');
function diag(message){diagnostic.hidden=false;diagnostic.textContent+='\n'+message;diagnostic.scrollTop=diagnostic.scrollHeight}
function setProcessing(flag){processing=flag;['videoFile','driveFile','directVideoFile','chooseGallery','chooseDrive'].forEach(id=>{if($(id))$(id).disabled=flag});$('extractTranscribe').disabled=flag||!selectedFile;$('cancelProcess').disabled=!flag}
function onSelect(e){
 const f=e.target.files?.[0];if(!f)return;
 if(processing){status('Wait for processing to finish before selecting another file.');return}
 selectedFile=f;file=f;created=null;segments=[];speakers={};render();
 $('fileInfo').hidden=false;$('fileInfo').textContent=f.name+' · '+size(f.size)+' · '+(f.type||'unknown type');
 $('recordTitle').value=f.name.replace(/\.[^.]+$/,'');
 diagnostic.textContent='File received: '+f.name+'\nSize: '+size(f.size)+'\nType: '+(f.type||'unknown');
 status('Video selected. Press EXTRACT AUDIO + TRANSCRIBE. No video playback required.',0);
 $('extractTranscribe').disabled=!f.size;
 $('audioResult').hidden=true;
 if(activeAudioURL){URL.revokeObjectURL(activeAudioURL);activeAudioURL=null}
 $('audioPreview').removeAttribute('src');$('audioPreview').load();
 e.target.value='';
}
['videoFile','driveFile','directVideoFile'].forEach(id=>$(id)?.addEventListener('change',onSelect));
$('chooseGallery').onclick=()=>{$('videoFile').value='';$('videoFile').click()};
$('chooseDrive').onclick=()=>{$('driveHelp').hidden=false;$('driveFile').value='';$('driveFile').click()};
$('videoDiagnostics').textContent='B14 audio-first diagnostics ready. Choose a video or audio file.';
// The FFmpeg worker must be created from this page's origin. A blob-hosted module
// imports the vendor worker at its real CDN URL so its relative imports resolve.
async function getFFmpeg(){
 if(ffmpegInstance?.loaded)return ffmpegInstance;
 status('Downloading audio extractor engine (first use may take a minute)…',3);
 const [{FFmpeg},{toBlobURL}]=await Promise.all([
  import('https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.15/dist/esm/index.js'),
  import('https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.2/dist/esm/index.js')
 ]);
 const ff=new FFmpeg();
 ff.on('log',({message})=>{if(/error|invalid|unsupported/i.test(message))diag('FFmpeg: '+message.slice(0,180))});
 const workerText='import "https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.15/dist/esm/worker.js";';
 const workerURL=URL.createObjectURL(new Blob([workerText],{type:'text/javascript'}));
 const base='https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd';
 try{
  await ff.load({classWorkerURL:workerURL,coreURL:await toBlobURL(base+'/ffmpeg-core.js','text/javascript'),wasmURL:await toBlobURL(base+'/ffmpeg-core.wasm','application/wasm')});
 }finally{URL.revokeObjectURL(workerURL)}
 ffmpegInstance=ff;return ff;
}
function wavPCM(bytes){
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if(bytes.length<44||String.fromCharCode(...bytes.slice(0,4))!=='RIFF')throw Error('Audio conversion did not produce a valid WAV');
 let pos=12,channels=1,rate=16000,depth=16,format=1,start=-1,len=0;
 while(pos+8<=bytes.length){const id=String.fromCharCode(...bytes.slice(pos,pos+4));const n=view.getUint32(pos+4,true);if(id==='fmt '){format=view.getUint16(pos+8,true);channels=view.getUint16(pos+10,true);rate=view.getUint32(pos+12,true);depth=view.getUint16(pos+22,true)}if(id==='data'){start=pos+8;len=Math.min(n,bytes.length-start);break}pos+=8+n+(n%2)}
 if(start<0||format!==1||depth!==16||channels!==1||rate!==16000)throw Error('Unexpected WAV encoding. Expected 16 kHz mono 16-bit PCM');
 return {start,len:len-(len%2),view,rate};
}
let recognizer=null;
async function getRecognizer(){
 if(recognizer)return recognizer;
 status('Loading Whisper speech model. First download may take several minutes…',35);
 const {pipeline,env}=await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2');
 env.allowLocalModels=false;env.useBrowserCache=true;
 recognizer=await pipeline('automatic-speech-recognition','Xenova/whisper-tiny.en',{quantized:true,progress_callback:p=>{if(p.status==='progress'&&p.progress!=null)status('Downloading speech model '+Math.round(p.progress)+'%',35)}});
 return recognizer;
}
async function runAudioTranscription(){
 if(!selectedFile||processing)return;
 const input=selectedFile;cancelRequested=false;setProcessing(true);segments=[];speakers={'Unassigned':'Unassigned'};render();
 let ff=null,inputName='',outputName='extracted.wav';
 try{
  if(input.size>260*1024*1024)throw Error('This file is over 260 MB. Browser memory may be insufficient. Make a smaller copy or extract audio on your phone first.');
  ff=await getFFmpeg();if(cancelRequested)throw Error('Canceled');
  status('Reading video into audio extractor. No playback required…',12);
  inputName='input'+(input.name.match(/\.[a-z0-9]+$/i)?.[0]||'.mp4');
  await ff.writeFile(inputName,new Uint8Array(await input.arrayBuffer()));
  if(cancelRequested)throw Error('Canceled');
  status('Extracting speech audio. Video frames are skipped…',18);
  const code=await ff.exec(['-nostdin','-i',inputName,'-map','0:a:0','-vn','-sn','-dn','-ac','1','-ar','16000','-c:a','pcm_s16le','-y',outputName]);
  if(code!==0)throw Error('Audio extraction failed (FFmpeg exit '+code+'). Video may have no audio track or use an unsupported codec.');
  if(cancelRequested)throw Error('Canceled');
  const wav=await ff.readFile(outputName);
  const {start,len,view,rate}=wavPCM(wav);
  if(len<rate*2)throw Error('No usable audio extracted. Check the original recording has sound.');
  const seconds=len/2/rate;duration=seconds;$('endTime').value=fmt(seconds);
  diag('Extracted '+seconds.toFixed(1)+' seconds of 16 kHz mono audio. WAV: '+size(wav.length));
  // Offer a small extracted audio file for review, without altering the original.
  if(activeAudioURL)URL.revokeObjectURL(activeAudioURL);
  activeAudioURL=URL.createObjectURL(new Blob([wav],{type:'audio/wav'}));
  $('audioPreview').src=activeAudioURL;$('audioResult').hidden=false;
  status('Audio extracted. Starting speech recognition…',33);
  const asr=await getRecognizer();
  const totalSamples=len/2,step=rate*15;let completed=0;
  for(let off=0;off<totalSamples;off+=step){
   if(cancelRequested)throw Error('Canceled');
   const end=Math.min(totalSamples,off+step),pcm=new Float32Array(end-off);let peak=0;
   for(let i=0;i<pcm.length;i++){const value=view.getInt16(start+(off+i)*2,true)/32768;pcm[i]=value;peak=Math.max(peak,Math.abs(value))}
   status('Transcribing '+fmt(off/rate)+' / '+fmt(seconds)+'…',Math.round(40+58*end/totalSamples));
   if(peak>.003){
    const output=await asr(pcm,{task:'transcribe',language:'english',return_timestamps:false});
    const words=String(output?.text||'').trim();
    if(words){segments.push({speaker:'Unassigned',start:Math.round(off/rate*1000),end:Math.round(end/rate*1000),text:words});render()}
   }
   completed=end;
   await new Promise(r=>setTimeout(r,0));
  }
  status(segments.length?'Transcription complete. Review every word and assign speakers.':'Audio extracted, but no speech recognized. Check audio preview and diagnostics.',100);
 }catch(err){const msg=String(err?.message||err);diag('ERROR: '+msg);status(msg==='Canceled'?'Processing canceled. Existing transcript sections retained.':'Audio processing failed: '+msg,0)}
 finally{
  if(ff){try{if(inputName)await ff.deleteFile(inputName)}catch{}try{await ff.deleteFile(outputName)}catch{}}
  setProcessing(false);
 }
}
$('extractTranscribe').addEventListener('click',runAudioTranscription);
$('cancelProcess').addEventListener('click',()=>{cancelRequested=true;status('Cancel requested. Waiting for current processing step…');if(ffmpegInstance?.loaded){try{ffmpegInstance.terminate();ffmpegInstance=null}catch{}}});

$('speakerPanel').addEventListener('input',e=>{const k=e.target.dataset.speaker;if(k){speakers[k]=e.target.value;document.querySelectorAll('.seghead strong').forEach((el,i)=>{const s=segments[i];el.textContent='['+fmt(s.start/1000)+'] '+(speakers[s.speaker]||s.speaker)})}});$('transcriptList').addEventListener('input',e=>{const i=e.target.dataset.seg;if(i!==undefined)segments[Number(i)].text=e.target.value;const a=e.target.dataset.assign;if(a!==undefined){segments[Number(a)].speaker=e.target.value||'Speaker unknown';const heading=e.target.closest('.segment')?.querySelector('.seghead strong');if(heading)heading.textContent='['+fmt(segments[Number(a)].start/1000)+'] '+segments[Number(a)].speaker}});$('transcriptList').addEventListener('change',e=>{if(e.target.dataset.assign!==undefined){const i=Number(e.target.dataset.assign);segments[i].speaker=e.target.value;speakers[e.target.value]??=e.target.value;render()}});$('transcriptList').addEventListener('click',e=>{const si=e.target.dataset.split,mi=e.target.dataset.merge;if(si!==undefined){const i=Number(si),v=segments[i];const cut=prompt('Split text after which word? Enter the word number (1 to '+(v.text.trim().split(/\s+/).length-1)+').');const words=v.text.trim().split(/\s+/),n=Number(cut);if(!Number.isInteger(n)||n<1||n>=words.length)return;const mid=Math.round((v.start+v.end)/2);segments.splice(i,1,{...v,end:mid,text:words.slice(0,n).join(' ')},{...v,start:mid,text:words.slice(n).join(' ')});render();return}if(mi!==undefined){const i=Number(mi);if(i>=segments.length-1)return;segments[i].text+=' '+segments[i+1].text;segments[i].end=segments[i+1].end;segments.splice(i+1,1);render();return}const ms=e.target.dataset.seek;if(ms!==undefined&&activeAudioURL){$('audioPreview').currentTime=Number(ms)/1000;$('audioPreview').scrollIntoView({behavior:'smooth',block:'center'});$('audioPreview').play().catch(()=>{})}});$('save').onclick=()=>{try{const r=getRecord(),a=readRecords().filter(x=>x.id!==r.id);a.unshift(r);storeRecords(a.slice(0,40));created=r;renderHistory();status('Record saved on this device. Export a PDF for a separate copy.')}catch(e){status('Save failed. Your browser storage may be full: '+e.message)}};$('export').onclick=()=>{try{FlexPDF.download(getRecord());status('PDF download started.')}catch(e){status('PDF export error: '+e.message)}};$('history').addEventListener('click',e=>{const id=e.target.dataset.load||e.target.dataset.delete;if(!id)return;const a=readRecords();if(e.target.dataset.delete){if(confirm('Delete this saved record?')){storeRecords(a.filter(x=>x.id!==id));renderHistory()}return}const r=a.find(x=>x.id===id);if(!r)return;created=r;segments=r.segments||[];speakers=r.speakers||{};hash=r.hash||'';file=null;duration=0;$('recordTitle').value=r.title||'';$('sourceDate').value=r.sourceDate||'';render();status('Saved record opened. Original audio is not stored; select the source file again to review.');$('transcriptPanel').scrollIntoView({behavior:'smooth'})});$('refresh').onclick=renderHistory;let deferred;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;$('install').hidden=false});$('install').onclick=async()=>{if(!deferred)return;deferred.prompt();await deferred.userChoice;deferred=null;$('install').hidden=true};if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});renderHistory()})();
