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
test('template retains seven icon menus, slider, three cards and four institute links',()=>{
 const c=setup();try{
 assert.equal(c.w.document.querySelectorAll('.nav-icons-wrap > *').length,7);
 assert.equal(c.w.document.querySelectorAll('main > .home-sermons iframe').length,8);
 assert.equal(c.w.document.querySelectorAll('.care-info-card').length,4);
 assert.match(c.w.document.querySelector('.hero-title').textContent,/노년의 삶을 연구/);
 assert.ok(c.w.document.querySelector('#slider'));
 assert.equal(c.w.document.querySelectorAll('.bento-section > .bento-box').length,3);
 }finally{c.w.close();}
});
test('required fields block transmission',()=>{
 const c=setup();try{submit(c);assert.equal(c.calls.length,0);assert.equal(c.w.document.activeElement.name,'name');}finally{c.w.close();}
});
test('research institute has director identity and textbooks linked from news',()=>{
 const director=fs.readFileSync(path.join(root,'intro_greeting.html'),'utf8');
 assert.match(director,/이성종 박사/);
 assert.match(director,/부설 연구소장/);
 assert.match(director,/교육철학 명예박사/);
 assert.match(director,/노인학 박사/);
 const profile=new JSDOM(director);
 assert.equal(profile.window.document.querySelector('.director-portrait img').getAttribute('src'),'assets/images/director-seong-jong-lee.png');
 for(const link of profile.window.document.querySelectorAll('.director-section-nav a')) assert.ok(profile.window.document.querySelector(link.getAttribute('href')));
 assert.doesNotMatch(director,/생년월일|학위번호|증명서 번호/);
 profile.window.close();
 const news=new JSDOM(fs.readFileSync(path.join(root,'research_intro.html'),'utf8'));
 assert.ok(news.window.document.querySelector('main a[href="online-textbooks.html"]'));
 news.window.close();
 const textbooks=fs.readFileSync(path.join(root,'online-textbooks.html'),'utf8');
 assert.match(textbooks,/화면 구성을 위한 예시/);
 const library=new JSDOM(textbooks);
 const cards=[...library.window.document.querySelectorAll('.textbook-card')];
 assert.equal(cards.length,8);
 const destinations=cards.map(card=>card.querySelector('.textbook-card-link').getAttribute('href'));
 assert.equal(new Set(destinations).size,8);
 for(const file of destinations) {
   const reader=new JSDOM(fs.readFileSync(path.join(root,file),'utf8'));
   assert.ok(reader.window.document.querySelector('.textbook-back[href="online-textbooks.html"]'));
   for(const link of reader.window.document.querySelectorAll('.textbook-toc a')) assert.ok(reader.window.document.querySelector(link.getAttribute('href')));
   assert.equal(reader.window.document.querySelectorAll('.textbook-chapter').length,3);
   reader.window.close();
 }
 library.window.close();
});
test('mock success retains endpoint, recipient key and new brand',async()=>{
 const c=setup();try{fill(c);submit(c);await tick();assert.equal(c.calls.length,1);
 assert.equal(c.calls[0][0],'https://api.web3forms.com/submit');
 const payload=JSON.parse(c.calls[0][1].body);
 assert.equal(payload.access_key,'f145b96b-77f1-4151-b219-e7d33c39ba66');
 assert.match(payload.subject,/GTCC Institute for Well-Aging and Lifelong Health/);
 assert.match(payload.subject,/아카데미·연구 문의/);
 assert.equal(c.form.querySelector('.consult-status').dataset.state,'success');
 }finally{c.w.close();}
});
test('mock failure retains values and releases button',async()=>{
 const c=setup();try{c.w.fetch=async()=>{throw Error('offline');};fill(c);submit(c);await tick();
 assert.equal(c.form.querySelector('.consult-status').dataset.state,'error');
 assert.equal(c.form.elements.name.value,'검증');assert.equal(c.form.querySelector('[type=submit]').disabled,false);
 }finally{c.w.close();}
});
