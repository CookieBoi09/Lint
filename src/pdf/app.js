import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {WorkerMessageHandler} from 'pdfjs-dist/legacy/build/pdf.worker.mjs';
import assets from 'lint-pdf-assets';
import {validateBytes,encode,decode} from './model.js';
// Use a bundled in-process worker for WKWebView file URLs, without network fetches.
globalThis.pdfjsWorker={WorkerMessageHandler};
class OfflineData {
 async fetch({kind,filename}) {const value=assets[`${kind}/${filename}`];if(!value)throw Error('Missing bundled PDF resource');return Uint8Array.from(atob(value),c=>c.charCodeAt(0));}
}
function documentTask(bytes){return getDocument({data:bytes.slice(),BinaryDataFactory:OfflineData,useWorkerFetch:false,disableWorkerRendering:true,isEvalSupported:false,enableXfa:false,verbosity:0});}
let dbPromise;
function database() {return dbPromise??=new Promise((resolve,reject)=>{const r=indexedDB.open('lint.pdf.answers.v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('files');r.onsuccess=()=>resolve(r.result);r.onerror=()=>{dbPromise=null;reject(Error('PDF storage is unavailable. Your card has not been saved.'));};});}
async function storage(mode,action){const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction('files',mode);const r=action(tx.objectStore('files'));tx.oncomplete=()=>resolve(r.result);tx.onabort=tx.onerror=()=>reject(Error('Could not save or read the PDF. Check available storage.'));});}
const get=id=>storage('readonly',s=>s.get(id));
const put=(id,bytes)=>storage('readwrite',s=>s.put(bytes,id));
async function add(file,replacingID){const library=JSON.parse(localStorage.getItem('lint.web.library.v1')||'{"cards":[]}');const used=new Map(library.cards.filter(c=>c.pdf&&c.pdf.id!==replacingID).map(c=>[c.pdf.id,c.pdf.size]));if([...used.values()].reduce((a,b)=>a+b,0)+file.size>60*1024*1024)throw Error('The library supports up to 60 MB of PDF attachments so it can be backed up reliably.');if(file.size>20*1024*1024)throw Error('Choose a PDF no larger than 20 MB.');const bytes=new Uint8Array(await file.arrayBuffer());validateBytes(bytes);const task=documentTask(bytes);try{await task.promise;}catch{throw Error('This PDF is damaged or password-protected. Choose an unlocked PDF.');}finally{await task.destroy();}const meta={id:crypto.randomUUID(),name:file.name.slice(0,255),size:bytes.length};await put(meta.id,bytes);return meta;}
function mount(host,meta) {
 host.replaceChildren();delete host.dataset.ready;host.classList.add('pdf-answer');
 const controls=document.createElement('div');controls.className='pdf-controls';
 const title=document.createElement('span');title.className='pdf-name';title.textContent=meta.name;
 const previous=button('Previous page'),next=button('Next page'),out=button('Zoom out'),inside=button('Zoom in'),fit=button('Fit width');
 const status=document.createElement('span');status.className='pdf-status';status.setAttribute('role','status');
 const viewport=document.createElement('div');viewport.className='pdf-viewport';viewport.tabIndex=0;viewport.setAttribute('aria-label','PDF answer; scroll horizontally and vertically');
 const canvas=document.createElement('canvas');canvas.setAttribute('role','img');viewport.append(canvas);controls.append(title,previous,status,next,out,inside,fit);host.append(controls,viewport);
 let doc,task,render,closed=false,pageNumber=1,zoom=1,fitMode=true,busy=false;
 function button(label){const b=document.createElement('button');b.type='button';b.textContent=label;b.className='outline';return b;}
 function disable(value){busy=value;for(const b of[previous,next,out,inside,fit])b.disabled=value;previous.disabled=value||pageNumber<=1;next.disabled=value||pageNumber>=doc?.numPages;}
 async function draw(){if(closed||!doc||busy)return;disable(true);try{const page=await doc.getPage(pageNumber);if(closed)return;const natural=page.getViewport({scale:1});if(fitMode)zoom=Math.min(2,Math.max(.1,(viewport.clientWidth-24)/natural.width));const view=page.getViewport({scale:zoom});const ratio=Math.min(devicePixelRatio||1,4096/view.width,4096/view.height);canvas.width=Math.max(1,Math.floor(view.width*ratio));canvas.height=Math.max(1,Math.floor(view.height*ratio));canvas.style.width=`${view.width}px`;canvas.style.height=`${view.height}px`;canvas.setAttribute('aria-label',`${meta.name}, page ${pageNumber} of ${doc.numPages}`);render=page.render({canvasContext:canvas.getContext('2d'),viewport:view,transform:[ratio,0,0,ratio,0,0]});await render.promise;if(!closed){status.textContent=`${pageNumber} / ${doc.numPages} · ${Math.round(zoom*100)}%`;host.dataset.ready='true';}page.cleanup();}catch(e){if(!closed)status.textContent='This PDF page could not be rendered.';}finally{if(!closed)disable(false);}}
 previous.onclick=()=>{pageNumber--;viewport.scrollTo(0,0);draw();};next.onclick=()=>{pageNumber++;viewport.scrollTo(0,0);draw();};out.onclick=()=>{fitMode=false;zoom=Math.max(.25,zoom/1.4);draw();};inside.onclick=()=>{fitMode=false;zoom=Math.min(4,zoom*1.4);draw();};fit.onclick=()=>{fitMode=true;viewport.scrollTo(0,0);draw();};
 disable(true);status.textContent='Loading PDF…';
 (async()=>{try{const bytes=await get(meta.id);if(closed)return;if(!bytes)throw Error('PDF missing. Restore a Lint backup that includes this attachment.');task=documentTask(bytes);doc=await task.promise;if(closed){await task.destroy();return;}busy=false;await draw();}catch(e){if(!closed)status.textContent=e.message;}})();
 return ()=>{closed=true;render?.cancel();task?.destroy();};
}
async function exportBackup(library){const result=structuredClone(library);result.pdfFiles={};let total=0;for(const card of library.cards){if(!card.pdf||result.pdfFiles[card.pdf.id])continue;const bytes=await get(card.pdf.id);if(!bytes)throw Error(`PDF missing: ${card.pdf.name}. Restore the original attachment before exporting.`);total+=bytes.length;if(total>60*1024*1024)throw Error('This backup has over 60 MB of PDFs. Export smaller libraries or remove unneeded attachments.');result.pdfFiles[card.pdf.id]=encode(bytes);}return result;}
async function prepareRestore(value){const result=structuredClone(value);const files=value.pdfFiles||{};const needed=new Map();for(const card of value.cards){if(!card.pdf)continue;const data=files[card.pdf.id];if(!data)throw Error(`Backup is missing PDF: ${card.pdf.name}`);const bytes=decode(data);if(bytes.length!==card.pdf.size)throw Error('PDF size does not match its backup metadata.');needed.set(card.pdf.id,bytes);}if([...needed.values()].reduce((total,bytes)=>total+bytes.length,0)>60*1024*1024)throw Error('Backup exceeds the 60 MB PDF attachment limit.');for(const [id,bytes]of needed){const existing=await get(id);if(existing&&!equal(existing,bytes))throw Error('This backup has conflicting PDF identifiers. Your library was not replaced.');}for(const[id,bytes]of needed)await put(id,bytes);delete result.pdfFiles;return result;}
function equal(a,b){return a.length===b.length&&a.every((v,i)=>v===b[i]);}
window.lintPDF={add,mount,exportBackup,prepareRestore};
