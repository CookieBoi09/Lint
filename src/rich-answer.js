// Plain text + lists only. Raw HTML is never interpreted; LaTeX uses the existing renderer.
export function answerBlocks(text) {
  const blocks=[];let current=null, display=false;
  for(const line of text.replace(/\r\n?/g,'\n').split('\n')) {
    const marker=!display && line.match(/^\s*(?:([-*+])|(\d+)[.)])\s+(.+)$/);
    if(marker) {
      const type=marker[1]?'ul':'ol';
      if(current?.type!==type){current={type,start:marker[2]?Number(marker[2]):1,items:[]};blocks.push(current);}
      current.items.push(marker[3]);
    } else if(current && current.type!=='text' && /^\s+\S/.test(line)) {
      current.items[current.items.length-1]+='\n'+line.trimStart();
    } else {
      if(current?.type!=='text'){current={type:'text',text:''};blocks.push(current);}
      current.text+=(current.text?'\n':'')+line;
    }
    // Keep display equations intact even if their lines resemble list markers.
    const delimiters=line.match(/\$\$|\\\[|\\\]/g)||[];
    for(const delimiter of delimiters) display=delimiter==='\\['?true:delimiter==='\\]'?false:!display;
  }
  return blocks;
}
function renderAnswer(host,text) {
  host.replaceChildren();host.classList.add('rich-answer');
  for(const block of answerBlocks(text)) {
    if(block.type==='text') {if(!block.text)continue;const p=document.createElement('div');ha(p,block.text);host.append(p);}
    else {const list=document.createElement(block.type);if(block.type==='ol')list.start=block.start;for(const item of block.items){const li=document.createElement('li');ha(li,item);list.append(li);}host.append(list);}
  }
}
function validPDFMeta(pdf) {
  return pdf && typeof pdf.id==='string' && /^[a-f0-9-]{36}$/i.test(pdf.id) && typeof pdf.name==='string' && pdf.name.length>0 && pdf.name.length<=255 && Number.isInteger(pdf.size) && pdf.size>0 && pdf.size<=20*1024*1024;
}
