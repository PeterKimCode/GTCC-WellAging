const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const root = path.join(__dirname, '..');
const script = fs.readFileSync(path.join(root, 'js/site.js'), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
function setup({page = 'contact.html', saved, blockedStorage = false} = {}) {
  const dom = new JSDOM(fs.readFileSync(path.join(root, page), 'utf8'), {
    url: 'http://localhost:4173/' + page, runScripts: 'outside-only'
  });
  const w = dom.window;
  w.matchMedia = () => ({ addEventListener() {} });
  if (saved) w.localStorage.setItem('gtcc_wellaging_language', saved);
  if (blockedStorage) Object.defineProperty(w, 'localStorage', { get() { throw new Error('blocked'); } });
  const calls = [];
  w.fetch = async (...args) => { calls.push(args); return { ok:true, json:async () => ({success:true}) }; };
  w.eval(script);
  return { dom, w, doc:w.document, calls };
}
function submit(c) { c.doc.querySelector('form').dispatchEvent(new c.w.Event('submit', {bubbles:true,cancelable:true})); }
function fill(c) {
  for (const [key,value] of Object.entries({name:'검증 사용자',phone:'010-0000-0000',email:'test@example.com',message:'교육 주제 문의'}))
    c.doc.getElementById(key).value = value;
}
test('empty and invalid email never submit, focus first invalid field', async () => {
  const c=setup();
  try {
    submit(c);
    assert.equal(c.calls.length, 0);
    assert.equal(c.doc.activeElement.id, 'name');
    fill(c); c.doc.getElementById('email').value='invalid';
    submit(c);
    assert.equal(c.calls.length, 0);
    assert.equal(c.doc.activeElement.id, 'email');
    assert.equal(c.doc.getElementById('email').getAttribute('aria-invalid'),'true');
  } finally { c.dom.window.close(); }
});
test('success keeps original API and fields, updates branding, resets form', async () => {
  const c=setup();
  try {
    fill(c); submit(c); await tick();
    assert.equal(c.calls.length,1);
    assert.equal(c.calls[0][0],'https://api.web3forms.com/submit');
    const data=JSON.parse(c.calls[0][1].body);
    assert.equal(data.name,'검증 사용자');
    assert.equal(data.email,'test@example.com');
    assert.equal(data.replyto,data.email);
    assert.match(data.subject,/GTCC Institute for Well-Aging and Lifelong Health/);
    assert.match(data.message,/\n연락처: 010-0000-0000\n/);
    assert.match(data.message,/contact.html/);
    assert.equal(c.doc.querySelector('.form-status').dataset.state,'success');
    assert.equal(c.doc.getElementById('name').value,'');
    assert.equal(c.doc.querySelector('[type=submit]').disabled,false);
  } finally { c.dom.window.close(); }
});
test('duplicate submissions blocked while request is pending', async () => {
  const c=setup(); let finish;
  try {
    c.w.fetch=(...args) => { c.calls.push(args); return new Promise(resolve => {finish=resolve;}); };
    fill(c); submit(c); submit(c);
    assert.equal(c.calls.length,1);
    assert.equal(c.doc.querySelector('[type=submit]').disabled,true);
    finish({ok:true,json:async()=>({success:true})}); await tick();
  } finally { c.dom.window.close(); }
});
for (const mode of ['network','http','service','json','timeout']) {
  test('failure retains values and enables retry: ' + mode, async () => {
    const c=setup();
    try {
      if (mode==='timeout') {
        const originalTimeout=c.w.setTimeout.bind(c.w);
        c.w.setTimeout=(callback,delay,...args)=>originalTimeout(callback,delay===30000 ? 1 : delay,...args);
      }
      c.w.fetch=async (_url, options) => {
        if (mode==='network') throw new Error('offline');
        if (mode==='timeout') {
          return new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new Error('aborted'))));
        }
        return {ok:mode!=='http',json:async()=> {
          if (mode==='json') throw new Error('invalid JSON');
          return {success:mode!=='service'};
        }};
      };
      fill(c); submit(c); await tick();
      if (mode==='timeout') await new Promise(resolve=>setTimeout(resolve,10));
      assert.equal(c.doc.querySelector('.form-status').dataset.state,'error');
      assert.equal(c.doc.getElementById('name').value,'검증 사용자');
      assert.equal(c.doc.querySelector('[type=submit]').disabled,false);
      assert.equal(c.doc.querySelector('form').getAttribute('aria-busy'),'false');
    } finally { c.dom.window.close(); }
  });
}
test('honeypot prevents a network request', () => {
  const c=setup();
  try { fill(c); c.doc.getElementById('botcheck').checked=true; submit(c); assert.equal(c.calls.length,0); }
  finally { c.dom.window.close(); }
});
test('mobile menu opens, Escape closes and restores focus', () => {
  const c=setup({page:'index.html'});
  try {
    const button=c.doc.querySelector('.menu-toggle');
    button.click();
    assert.equal(button.getAttribute('aria-expanded'),'true');
    assert.equal(c.doc.querySelector('#main-nav').classList.contains('is-open'),true);
    c.doc.dispatchEvent(new c.w.KeyboardEvent('keydown',{key:'Escape'}));
    assert.equal(button.getAttribute('aria-expanded'),'false');
    assert.equal(c.doc.activeElement,button);
  } finally { c.dom.window.close(); }
});
test('English request persists language and dispatches translator selection', async () => {
  const c=setup();
  try {
    const combo=c.doc.createElement('select');
    combo.className='goog-te-combo';
    combo.innerHTML='<option value="ko">Korean</option><option value="en">English</option>';
    c.doc.body.append(combo);
    let changes=0; combo.addEventListener('change',()=>changes++);
    c.doc.querySelector('[data-lang-toggle]').click(); await tick();
    assert.equal(combo.value,'en'); assert.equal(changes,1);
    assert.equal(c.w.localStorage.getItem('gtcc_wellaging_language'),'en');
    assert.match(c.doc.querySelector('[data-lang-toggle]').textContent,/KOR/);
    assert.match(c.doc.cookie,/googtrans=\/ko\/en/);
  } finally { c.dom.window.close(); }
});
test('saved English loads translator on next page and failure returns to Korean', async () => {
  const c=setup({page:'about.html',saved:'en'});
  try {
    const external=c.doc.querySelector('script[data-google-translate]');
    assert.ok(external);
    external.dispatchEvent(new c.w.Event('error')); await tick();
    assert.equal(c.w.localStorage.getItem('gtcc_wellaging_language'),'ko');
    assert.match(c.doc.querySelector('[data-lang-toggle]').textContent,/ENG/);
    assert.match(c.doc.querySelector('.translation-status').textContent,/한국어로 계속/);
    assert.ok(c.doc.querySelector('main h1').textContent.includes('연구원 소개'));
    assert.equal(c.doc.querySelector('[data-lang-toggle]').disabled,false);
    c.doc.querySelector('[data-lang-toggle]').click();
    assert.ok(c.doc.querySelector('script[data-google-translate]'));
  } finally { c.dom.window.close(); }
});
test('blocked localStorage does not break Korean menu or form', () => {
  const c=setup({blockedStorage:true});
  try { c.doc.querySelector('.menu-toggle').click(); assert.equal(c.doc.querySelector('.menu-toggle').getAttribute('aria-expanded'),'true'); submit(c); assert.equal(c.calls.length,0); }
  finally { c.dom.window.close(); }
});
