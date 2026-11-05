'use strict';
(() => {
  const menuButton = document.querySelector('.menu-toggle');
  const menu = document.querySelector('#main-nav');
  function closeMenu() {
    if (!menu || !menuButton) return;
    menu.classList.remove('is-open');
    menuButton.setAttribute('aria-expanded', 'false');
  }
  menuButton?.addEventListener('click', () => {
    const open = menuButton.getAttribute('aria-expanded') !== 'true';
    menuButton.setAttribute('aria-expanded', String(open));
    menu.classList.toggle('is-open', open);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menuButton?.getAttribute('aria-expanded') === 'true') {
      closeMenu(); menuButton.focus();
    }
  });
  window.matchMedia('(min-width: 981px)').addEventListener('change', event => {
    if (event.matches) closeMenu();
  });

  const form = document.querySelector('[data-consult-form]');
  if (form) {
    let sending = false;
    const submit = form.querySelector('[type=submit]');
    const status = form.querySelector('.form-status');
    const fields = ['name', 'phone', 'email', 'message'];
    const messages = {
      name: '이름을 입력해 주세요.', phone: '연락처를 입력해 주세요.',
      email: '올바른 이메일 주소를 입력해 주세요.', message: '문의 내용을 입력해 주세요.'
    };
    fields.forEach(name => {
      const input = form.elements[name];
      input.setAttribute('aria-describedby', name + '-error');
      input.addEventListener('input', () => {
        input.removeAttribute('aria-invalid');
        form.querySelector('#' + name + '-error').textContent = '';
      });
    });
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (sending) return;
      status.textContent = '';
      status.removeAttribute('data-state');
      let invalidField;
      for (const name of fields) {
        const input = form.elements[name];
        const valid = !!input.value.trim() && input.validity.valid;
        input.setAttribute('aria-invalid', String(!valid));
        form.querySelector('#' + name + '-error').textContent = valid ? '' : messages[name];
        if (!valid && !invalidField) invalidField = input;
      }
      if (invalidField) { invalidField.focus(); return; }
      if (form.elements.botcheck.checked) return;
      const values = Object.fromEntries(fields.map(name => [name, form.elements[name].value.trim()]));
      const originalLabel = submit.innerHTML;
      sending = true;
      submit.disabled = true;
      submit.textContent = '전송 중…';
      form.setAttribute('aria-busy', 'true');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      try {
        const response = await fetch('https://api.web3forms.com/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            access_key: 'f145b96b-77f1-4151-b219-e7d33c39ba66',
            subject: '[GTCC Institute for Well-Aging and Lifelong Health] 교육·참여 상담 문의',
            from_name: 'GTCC Institute for Well-Aging and Lifelong Health',
            name: values.name, email: values.email, replyto: values.email, botcheck: false,
            message: 'GTCC Institute for Well-Aging and Lifelong Health 교육·참여 상담 문의\n\n이름: ' + values.name +
              '\n연락처: ' + values.phone + '\n이메일: ' + values.email + '\n\n문의사항:\n' + values.message +
              '\n\n접수 페이지: ' + window.location.href
          })
        });
        const result = await response.json();
        if (!response.ok || result.success !== true) throw new Error('Submission failed');
        status.dataset.state = 'success';
        status.textContent = '교육·참여 문의가 정상적으로 접수되었습니다. 남겨주신 연락처로 답변드릴 수 있도록 확인하겠습니다.';
        form.reset();
        fields.forEach(name => form.elements[name].removeAttribute('aria-invalid'));
      } catch {
        status.dataset.state = 'error';
        status.textContent = '문의를 전송하지 못했습니다. 입력 내용은 유지됩니다. 다시 시도하시거나 전화·카카오톡으로 문의해 주세요.';
      } finally {
        clearTimeout(timeout);
        sending = false;
        submit.disabled = false;
        submit.innerHTML = originalLabel;
        form.setAttribute('aria-busy', 'false');
      }
    });
  }

  const toggle = document.querySelector('[data-lang-toggle]');
  const notice = document.querySelector('.translation-status');
  const storageKey = 'gtcc_wellaging_language';
  let language = 'ko';
  try { language = localStorage.getItem(storageKey) === 'en' ? 'en' : 'ko'; } catch {}
  const save = value => { try { localStorage.setItem(storageKey, value); } catch {} };
  function label() {
    if (!toggle) return;
    toggle.innerHTML = (language === 'en' ? 'KOR' : 'ENG') + ' <span aria-hidden="true">↗</span>';
    toggle.setAttribute('aria-label', language === 'en' ? '한국어로 보기' : '영어로 번역');
  }
  function cookie(lang) {
    if (lang === 'en') document.cookie = 'googtrans=/ko/en;path=/;SameSite=Lax';
    else {
      document.cookie = 'googtrans=;Max-Age=0;path=/';
      document.cookie = 'googtrans=;Max-Age=0;path=/;domain=' + location.hostname;
    }
  }
  let translationPromise;
  function failTranslation() {
    language = 'ko'; save('ko'); cookie('ko'); label();
    notice.textContent = '번역 서비스를 불러오지 못했습니다. 한국어로 계속 이용하거나 ENG를 눌러 다시 시도해 주세요.';
  }
  function loadTranslation() {
    if (translationPromise) return translationPromise;
    translationPromise = new Promise((resolve, reject) => {
      let attempts = 0;
      let interval;
      let timeout;
      let script;
      const cleanup = () => { clearInterval(interval); clearTimeout(timeout); };
      const probe = () => {
        const combo = document.querySelector('.goog-te-combo');
        if (combo) { cleanup(); resolve(combo); return true; }
        return false;
      };
      if (probe()) return;
      window.googleTranslateElementInit = () => {
        try {
          new window.google.translate.TranslateElement({
            pageLanguage: 'ko', includedLanguages: 'ko,en', autoDisplay: false
          }, 'google_translate_element');
        } catch (error) { cleanup(); reject(error); }
      };
      script = document.createElement('script');
      script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
      script.async = true;
      script.dataset.googleTranslate = 'true';
      script.onerror = () => { cleanup(); script.remove(); reject(new Error('Translation unavailable')); };
      interval = setInterval(() => { attempts++; probe(); }, 150);
      timeout = setTimeout(() => { cleanup(); script.remove(); reject(new Error('Translation timeout')); }, 12000);
      document.head.append(script);
    }).catch(error => { translationPromise = undefined; throw error; });
    return translationPromise;
  }
  async function translate() {
    notice.textContent = '';
    toggle.disabled = true;
    toggle.setAttribute('aria-busy', 'true');
    cookie('en');
    try {
      const combo = await loadTranslation();
      combo.value = 'en';
      combo.dispatchEvent(new Event('change', { bubbles: true }));
      language = 'en'; save('en'); label();
    } catch { failTranslation(); }
    finally { toggle.disabled = false; toggle.removeAttribute('aria-busy'); }
  }
  label();
  toggle?.addEventListener('click', () => {
    if (language === 'en') { cookie('ko'); save('ko'); window.location.reload(); }
    else translate();
  });
  if (language === 'en' && toggle) translate();
})();
