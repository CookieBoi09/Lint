import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {answerBlocks} from '../src/rich-answer.js';
import {validateBytes,encode,decode,MAX_PDF_BYTES} from '../src/pdf/model.js';
test('bullets, numbered lists, and LaTeX remain distinct',()=>{
 const result=answerBlocks('Steps:\n- Apply $F=ma$\n- Solve\n\n3. Substitute\n4. Check units');
 assert.deepEqual(result.filter(b=>b.type==='ul')[0].items,['Apply $F=ma$','Solve']);
 assert.equal(result.find(b=>b.type==='ol').start,3);
 assert.deepEqual(answerBlocks('$$\n- x + y\n$$'),[{type:'text',text:'$$\n- x + y\n$$'}]);
});
test('list parsing never interprets HTML as markup',()=>{assert.equal(answerBlocks('- <img src=x onerror=alert(1)>')[0].items[0],'<img src=x onerror=alert(1)>');});
test('PDF bytes round trip through backup encoding',async()=>{const data=new Uint8Array(await readFile('tests/fixtures/physics.pdf'));validateBytes(data);assert.deepEqual(decode(encode(data)),data);});
test('non-PDF, oversized, and invalid base64 data are rejected',()=>{assert.throws(()=>validateBytes(new TextEncoder().encode('<html>')),/not a PDF/);assert.throws(()=>validateBytes(new Uint8Array(MAX_PDF_BYTES+1)),/20 MB/);assert.throws(()=>decode('not*base64'),/Invalid PDF/);});
