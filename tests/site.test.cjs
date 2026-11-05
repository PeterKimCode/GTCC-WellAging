const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const root=path.join(__dirname,'..');
function setup() {
  const dom=new JSDOM(fs.readFileSync(path.join(root,'index.html'),'utf8'),{url:'http://localhost:4173',runScripts:'outside-only'});
  const w=dom.window;w.alert=()=>{};
  const calls=[];w.fetch=async(...args)=>{calls.push(args);return {ok:true,json:async()=>({success:true})};};
  w.eval(fs.readFileSync(path.join(root,'js/site.js'),'utf8'));
  return {w,form:w.document.querySelector('[data-consult-form]'),calls};
}
function fill(c) {for(const [name,value] of Object.entries({name:'검증',phone:'010-0000-0000',email:'test@example.com',message:'테스트'})) c.form.elements[name].value=value;}
function submit(c) {c.form.dispatchEvent(new c.w.Event('submit',{cancelable:true}));}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('template retains seven icon menus, slider, three cards and four care links',()=>{
 const c=setup();try{
 assert.equal(c.w.document.querySelectorAll('.nav-icons-wrap > *').length,7);
 assert.equal(c.w.document.querySelectorAll('iframe').length,0);
 assert.equal(c.w.document.querySelectorAll('.care-info-card').length,4);
 assert.match(c.w.document.querySelector('.hero-title').textContent,/존중과 돌봄/);
 assert.ok(c.w.document.querySelector('#slider'));
 assert.equal(c.w.document.querySelectorAll('.bento-section > .bento-box').length,3);
 }finally{c.w.close();}
});
test('required fields block transmission',()=>{
 const c=setup();try{submit(c);assert.equal(c.calls.length,0);assert.equal(c.w.document.activeElement.name,'name');}finally{c.w.close();}
});
test('mock success retains endpoint, recipient key and new brand',async()=>{
 const c=setup();try{fill(c);submit(c);await tick();assert.equal(c.calls.length,1);
 assert.equal(c.calls[0][0],'https://api.web3forms.com/submit');
 const payload=JSON.parse(c.calls[0][1].body);
 assert.equal(payload.access_key,'f145b96b-77f1-4151-b219-e7d33c39ba66');
 assert.match(payload.subject,/GTCC Institute for Well-Aging and Lifelong Health/);
 assert.match(payload.subject,/돌봄·건강관리 상담/);
 assert.equal(c.form.querySelector('.consult-status').dataset.state,'success');
 }finally{c.w.close();}
});
test('mock failure retains values and releases button',async()=>{
 const c=setup();try{c.w.fetch=async()=>{throw Error('offline');};fill(c);submit(c);await tick();
 assert.equal(c.form.querySelector('.consult-status').dataset.state,'error');
 assert.equal(c.form.elements.name.value,'검증');assert.equal(c.form.querySelector('[type=submit]').disabled,false);
 }finally{c.w.close();}
});
