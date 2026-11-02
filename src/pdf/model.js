export const MAX_PDF_BYTES=20*1024*1024;
export function validateBytes(bytes) {
 if(!(bytes instanceof Uint8Array)||!bytes.length||bytes.length>MAX_PDF_BYTES)throw new Error('Choose a PDF no larger than 20 MB.');
 if(new TextDecoder().decode(bytes.subarray(0,5))!=='%PDF-')throw new Error('This file is not a PDF.');
}
export function encode(bytes){let result='';for(let i=0;i<bytes.length;i+=32768)result+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(result);}
export function decode(text){if(typeof text!=='string'||text.length>Math.ceil(MAX_PDF_BYTES/3)*4||!/^[A-Za-z0-9+/]*={0,2}$/.test(text))throw new Error('Invalid PDF backup data.');const value=Uint8Array.from(atob(text),c=>c.charCodeAt(0));validateBytes(value);return value;}
