import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
const library=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('lint.web.library.v1')));
async function editor(page){await page.goto('/');await page.locator('.deck-tile').first().click();await page.locator('[data-add]').click();}
test('math answers render safe bulleted and numbered lists with equations',async({page})=>{
 await editor(page);await page.locator('#front').fill('List the steps');await page.locator('#back').fill('- Apply $F=ma$\n- <img src=x onerror=alert(1)>\n\n1. Substitute\n2. Check units');
 await expect(page.locator('#answer-preview ul li')).toHaveCount(2);await expect(page.locator('#answer-preview ol li')).toHaveCount(2);await expect(page.locator('#answer-preview .katex')).toHaveCount(1);await expect(page.locator('#answer-preview img')).toHaveCount(0);
 await page.locator('#save-card').click();await page.locator('[data-card]').filter({hasText:'List the steps'}).click();await expect(page.locator('#answer-preview ul li')).toHaveCount(2);
});
test('physics PDF answers persist, scroll in both directions, reveal, and restore from backup',async({page})=>{
 await editor(page);await page.locator('#kind').selectOption('physics');await page.locator('#front').fill('Explain Newton’s laws');await page.locator('#answer-pdf').setInputFiles('tests/fixtures/physics.pdf');
 await expect(page.locator('#pdf-preview')).toHaveAttribute('data-ready','true');await expect(page.locator('#pdf-preview .pdf-status')).toContainText('1 / 2');
 await page.getByRole('button',{name:'Zoom in',exact:true}).click();await expect(page.getByRole('button',{name:'Zoom in',exact:true})).toBeEnabled();
 expect(await page.locator('.pdf-viewport').evaluate(el=>el.scrollWidth>el.clientWidth)).toBe(true);
 await page.getByRole('button',{name:'Next page',exact:true}).click();await expect(page.locator('.pdf-status')).toContainText('2 / 2');
 expect(await page.locator('.pdf-viewport').evaluate(el=>el.scrollHeight>el.clientHeight)).toBe(true);
 await page.locator('#save-card').click();let lib=await library(page);const card=lib.cards.find(c=>c.kind==='physics');expect(card.pdf.name).toBe('physics.pdf');expect(card.back).toBe('');
 await page.reload();await page.locator('.deck-tile').first().click();await page.getByRole('button',{name:'Physics',exact:true}).click();await expect(page.locator('[data-card]')).toHaveCount(1);await page.locator('[data-card]').click();await expect(page.locator('#pdf-preview')).toHaveAttribute('data-ready','true');await page.getByRole('button',{name:'Cancel',exact:true}).click();
 // Isolate this card in the practice queue without changing its attachment.
 await page.evaluate(()=>{const k='lint.web.library.v1',v=JSON.parse(localStorage.getItem(k));v.cards=v.cards.filter(c=>c.kind==='physics');localStorage.setItem(k,JSON.stringify(v));});await page.reload();await page.locator('.deck-tile').first().click();await page.getByRole('button',{name:'Restudy deck',exact:true}).click();await expect(page.locator('.pdf-answer')).toHaveCount(0);await page.getByRole('button',{name:'Reveal answer',exact:true}).click();await expect(page.locator('.pdf-answer')).toHaveAttribute('data-ready','true');await page.getByRole('button',{name:'Finish practice',exact:true}).click();await page.getByRole('button',{name:'Back to library',exact:true}).click();
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export backup',exact:false}).first().click();const download=await downloadPromise;const backup=JSON.parse(await readFile(await download.path(),'utf8'));expect(backup.pdfFiles[card.pdf.id]).toBeTruthy();
 await page.evaluate(async()=>{await new Promise((resolve,reject)=>{const r=indexedDB.open('lint.pdf.answers.v1',1);r.onsuccess=()=>{const tx=r.result.transaction('files','readwrite');tx.objectStore('files').clear();tx.oncomplete=resolve;tx.onerror=reject;};});});
 page.on('dialog',dialog=>dialog.accept());
 const chooserPromise=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Restore backup',exact:false}).first().click();const chooser=await chooserPromise;await chooser.setFiles({name:'lint-backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
 await expect(page.locator('#toast')).toContainText('Backup restored');
 await page.reload();await page.locator('.deck-tile').first().click();await page.locator('[data-card]').click();await expect(page.locator('#pdf-preview')).toHaveAttribute('data-ready','true');
});
test('invalid PDF upload preserves the existing answer',async({page})=>{
 await editor(page);await page.locator('#kind').selectOption('physics');await page.locator('#front').fill('Question');await page.locator('#back').fill('Existing answer');await page.locator('#answer-pdf').setInputFiles({name:'fake.pdf',mimeType:'application/pdf',buffer:Buffer.from('<html>not pdf</html>')});await expect(page.locator('#form-error')).toContainText('not a PDF');await expect(page.locator('#back')).toHaveValue('Existing answer');await expect(page.locator('#save-card')).toBeEnabled();
});
