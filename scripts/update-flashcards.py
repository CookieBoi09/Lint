"""Apply guarded UI patches and insert readable review source into the recovered bundle.
The original dependency bundle is retained; no minified dependency code is changed.
Run this script when editing src/review.js or src/comparison.js.
"""
from pathlib import Path
p=Path('site/app.js')
s=p.read_text()
def replace(old,new):
 global s
 if new in s:return
 if s.count(old)!=1:raise RuntimeError(f'Unexpected bundle structure: {old[:90]}')
 s=s.replace(old,new,1)
replace('it.querySelectorAll("[data-add]")', 'it.querySelectorAll("[data-restudy]").forEach(i=>i.onclick=()=>xA(i.dataset.restudy,true)),it.querySelectorAll("[data-add]")')
replace('<button class="outline" data-add="${Pe(r.id)}">+ Add card</button>', '<button class="outline" data-restudy="${Pe(r.id)}" ${e.length?"":"disabled"} title="Practice every card without changing review dates">Restudy deck</button><button class="outline" data-add="${Pe(r.id)}">+ Add card</button>')
replace('["math","coding"].includes(s.kind)', '["math","physics","coding"].includes(s.kind)')
replace('typeof s.back!="string"||!s.back.trim()||', 'typeof s.back!="string"||(!s.back.trim()&&!s.pdf)||(s.pdf!==undefined&&(s.kind==="coding"||!validPDFMeta(s.pdf)))||')
replace('["all","math","coding"].map', '["all","math","physics","coding"].map')
replace('t==="math"?"Math":"Code"', 't==="math"?"Math":t==="physics"?"Physics":"Code"')
replace('n.kind==="math"?"Math":Pe(n.language)', 'n.kind==="math"?"Math":n.kind==="physics"?"Physics":Pe(n.language)')
replace('o.kind==="math"?ha(l,o.front)', 'o.kind!=="coding"?ha(l,o.front)')
replace('math:"\\u0192",coding:', 'math:"\\u0192",physics:"⚛",coding:')
start=s.find('/* LINT_EDITOR_START */')
if start<0:start=s.index('function Cg(')
end=s.index('/* LINT_REVIEW_START */',start)
s=s[:start]+'/* LINT_EDITOR_START */\n'+Path('src/editor.js').read_text()+'\n/* LINT_EDITOR_END */\n'+s[end:]
start=s.find('/* LINT_REVIEW_START */')
if start<0:start=s.index('function xA(')
end=s.index('function wA(',start)
source=Path('src/rich-answer.js').read_text().replace('export function ', 'function ')+'\n'+Path('src/comparison.js').read_text().replace('export function ', 'function ')+ '\n'+Path('src/review.js').read_text()
s=s[:start]+'/* LINT_REVIEW_START */\n'+source+'\n/* LINT_REVIEW_END */\n'+s[end:]
start=s.index('function wA(')
end=s.index('window.addEventListener("storage"',start)
s=s[:start]+Path('src/backups.js').read_text()+'\n'+s[end:]
p.write_text(s)
