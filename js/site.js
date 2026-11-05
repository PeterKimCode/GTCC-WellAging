(() => {
    // The receiving email is configured in Web3Forms for this access key.
    const WEB3FORMS_ACCESS_KEY = 'f145b96b-77f1-4151-b219-e7d33c39ba66';
    const consultForm = document.querySelector('[data-consult-form]');
    const langToggle = document.querySelector('[data-lang-toggle]');
    const dropdowns = document.querySelectorAll('.nav-dropdown');
    const STORAGE_KEY = 'gtcc_wellaging_lang';
    const COOKIE_NAME = 'googtrans';
    const COOKIE_DOMAIN = `;domain=${window.location.hostname}`;

    if (consultForm) {
        consultForm.noValidate = true;
        const submitButton = consultForm.querySelector('[type="submit"]');
        const status = document.createElement('p');
        status.className = 'consult-status';
        status.setAttribute('role', 'status');
        status.setAttribute('aria-live', 'polite');
        consultForm.append(status);
        const errors = {};
        const messages = { name: '이름을 입력해주세요.', phone: '연락처를 입력해주세요.', email: '올바른 이메일 주소를 입력해주세요.', message: '문의사항을 입력해주세요.' };
        for (const fieldName of Object.keys(messages)) {
            const field = consultForm.elements[fieldName];
            const error = document.createElement('small');
            error.id = `consult-${fieldName}-error`;
            error.className = 'consult-error';
            field.setAttribute('aria-label', field.placeholder);
            field.setAttribute('aria-describedby', error.id);
            field.after(error);
            errors[fieldName] = error;
        }
        let sending = false;
        consultForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (sending) return;
            status.textContent = '';
            let firstInvalid;
            for (const fieldName of Object.keys(messages)) {
                const field = consultForm.elements[fieldName];
                const invalid = !field.value.trim() || !field.validity.valid;
                errors[fieldName].textContent = invalid ? messages[fieldName] : '';
                field.setAttribute('aria-invalid', String(invalid));
                if (invalid && !firstInvalid) firstInvalid = field;
            }
            if (firstInvalid) { firstInvalid.focus(); return; }
            if (consultForm.elements.botcheck.checked) return;

            const formData = new FormData(consultForm);
            const name = String(formData.get('name') || '').trim();
            const phone = String(formData.get('phone') || '').trim();
            const email = String(formData.get('email') || '').trim();
            const message = String(formData.get('message') || '').trim();

            sending = true;
            const originalButton = submitButton.innerHTML;
            submitButton.disabled = true;
            submitButton.textContent = '전송 중...';
            consultForm.setAttribute('aria-busy', 'true');
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 30000);
            try {
                const response = await fetch('https://api.web3forms.com/submit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                    signal: controller.signal,
                    body: JSON.stringify({
                        access_key: WEB3FORMS_ACCESS_KEY,
                        subject: '[GTCC Institute for Well-Aging and Lifelong Health] 새로운 아카데미·연구 문의 신청',
                        from_name: 'GTCC Institute for Well-Aging and Lifelong Health 아카데미·연구 문의',
                        name, email, replyto: email, botcheck: false,
                        message: `GTCC Institute for Well-Aging and Lifelong Health 아카데미·연구 문의 신청\n\n이름:\n${name}\n\n연락처:\n${phone}\n\n이메일:\n${email}\n\n문의사항:\n${message}\n\n접수 페이지:\nGTCC Institute for Well-Aging and Lifelong Health 홈페이지`
                    })
                });
                const result = await response.json();
                if (!response.ok || result.success !== true) throw new Error('Submission failed');
                status.dataset.state = 'success';
                status.textContent = '아카데미·연구 문의 신청이 정상적으로 접수되었습니다.\n확인 후 빠른 시간 내에 연락드리겠습니다.';
                consultForm.reset();
                window.alert(status.textContent);
            } catch {
                status.dataset.state = 'error';
                status.textContent = '상담 신청을 전송하지 못했습니다.\n잠시 후 다시 시도해주세요.';
                window.alert(status.textContent);
            } finally {
                clearTimeout(timeout);
                sending = false;
                submitButton.disabled = false;
                submitButton.innerHTML = originalButton;
                consultForm.setAttribute('aria-busy', 'false');
            }
        });
    }

    dropdowns.forEach((dropdown) => {
        dropdown.addEventListener('toggle', () => {
            if (!dropdown.open) return;
            dropdowns.forEach((otherDropdown) => {
                if (otherDropdown !== dropdown) {
                    otherDropdown.open = false;
                }
            });
        });
    });

    document.addEventListener('click', (event) => {
        dropdowns.forEach((dropdown) => {
            if (!dropdown.contains(event.target)) {
                dropdown.open = false;
            }
        });
    });

    function setTranslateCookie(value) {
        const cookieValue = `${COOKIE_NAME}=${value};path=/`;
        document.cookie = cookieValue;
        document.cookie = cookieValue + COOKIE_DOMAIN;
    }

    function clearTranslateCookie() {
        document.cookie = `${COOKIE_NAME}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
        document.cookie = `${COOKIE_NAME}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/` + COOKIE_DOMAIN;
    }

    function loadGoogleTranslate() {
        if (window.google && window.google.translate) return;
        if (document.querySelector('script[data-google-translate]')) return;

        window.googleTranslateElementInit = function () {
            new window.google.translate.TranslateElement(
                {
                    pageLanguage: 'ko',
                    includedLanguages: 'en,ko',
                    autoDisplay: false,
                    layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE
                },
                'google_translate_element'
            );
        };

        const script = document.createElement('script');
        script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
        script.async = true;
        script.dataset.googleTranslate = 'true';
        document.head.appendChild(script);
    }

    function waitForTranslateCombo(callback, attempts = 0) {
        const combo = document.querySelector('.goog-te-combo');
        if (combo) {
            callback(combo);
            return;
        }
        if (attempts > 40) return;
        window.setTimeout(() => waitForTranslateCombo(callback, attempts + 1), 250);
    }

    function updateToggleLabel(lang) {
        if (!langToggle) return;
        langToggle.textContent = lang === 'en' ? 'KOR' : 'ENG';
    }

    function applyLanguage(lang) {
        if (lang === 'en') {
            setTranslateCookie('/ko/en');
        } else {
            clearTranslateCookie();
        }

        localStorage.setItem(STORAGE_KEY, lang);
        updateToggleLabel(lang);
        loadGoogleTranslate();

        waitForTranslateCombo((combo) => {
            if (combo.value !== lang) {
                combo.value = lang;
                combo.dispatchEvent(new Event('change'));
            }
        });

        window.setTimeout(() => {
            window.location.reload();
        }, 250);
    }

    const savedLang = localStorage.getItem(STORAGE_KEY) || 'ko';
    updateToggleLabel(savedLang);
    loadGoogleTranslate();

    window.addEventListener('load', () => {
        if (savedLang === 'en') {
            setTranslateCookie('/ko/en');
            waitForTranslateCombo((combo) => {
                if (combo.value !== 'en') {
                    combo.value = 'en';
                    combo.dispatchEvent(new Event('change'));
                }
            });
        } else {
            clearTranslateCookie();
        }
    });

    if (langToggle) {
        langToggle.addEventListener('click', () => {
            const nextLang = (localStorage.getItem(STORAGE_KEY) || 'ko') === 'en' ? 'ko' : 'en';
            applyLanguage(nextLang);
        });
    }
})();
