const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

const stores = {
    'bookk.co.kr': ['부크크', /^\/(?:bookStore|author\/books)\/([a-f0-9]{24})\/?$/i],
    'product.kyobobook.co.kr': ['교보문고', /^\/detail\/S\d+\/?$/],
    'ebook-product.kyobobook.co.kr': ['교보문고 eBook', /^\/dig\/epd\/ebook\/E\d+\/?$/],
    'www.aladin.co.kr': ['알라딘', /^\/shop\/wproduct\.aspx$/i],
    'www.yes24.com': ['예스24', /^\/product\/goods\/\d+\/?$/i],
    'www.ypbooks.co.kr': ['영풍문고', /^\/books\/\d+\/?$/],
    'www.coupang.com': ['쿠팡', /^\/vp\/products\/\d+\/?$/],
};
const imageHosts = new Set([
    'file.bookk.co.kr', 'contents.kyobobook.co.kr', 'image.aladin.co.kr',
    'image.yes24.com', 'img.ypbooks.co.kr', 'cdn.ypbooks.co.kr', 'thumbnail.coupangcdn.com',
]);

function storeProduct(value) {
    const url = new URL(value);
    if (url.hostname === 'm.yes24.com') {
        url.hostname = 'www.yes24.com';
        url.pathname = url.pathname.replace(/^\/goods\/detail\/(\d+)\/?$/i, '/product/goods/$1');
    }
    const store = Object.hasOwn(stores, url.hostname) ? stores[url.hostname] : null;
    const product = store?.[1].exec(url.pathname);
    if (url.protocol !== 'https:' || url.port || url.username || url.password || !product) {
        throw new Error('지원하는 서점의 https 상품 주소를 입력하세요.');
    }
    const itemId = url.searchParams.get('ItemId');
    const options = [...url.searchParams].filter(([key, id]) =>
        ['itemId', 'vendorItemId'].includes(key) && /^\d+$/.test(id));
    url.search = '';
    url.hash = '';
    url.pathname = url.pathname.replace(/\/$/, '');
    if (url.hostname === 'bookk.co.kr') url.pathname = '/bookStore/' + product[1].toLowerCase();
    if (url.hostname === 'www.aladin.co.kr') {
        if (!itemId || !/^\d+$/.test(itemId)) throw new Error('알라딘 상품 주소에 ItemId가 필요합니다.');
        url.pathname = '/shop/wproduct.aspx';
        url.searchParams.set('ItemId', itemId);
    }
    if (url.hostname === 'www.coupang.com') {
        for (const [key, id] of options) url.searchParams.set(key, id);
    }
    const key = url.hostname === 'www.coupang.com' ? url.origin + url.pathname : url.href;
    return { url, key, store: store[0] };
}

function readEntries(raw) {
    const entries = [];
    for (const [index, rawLine] of raw.split(/\r?\n/).entries()) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;
        try {
            const split = line.lastIndexOf('|');
            const title = line.slice(0, split).trim();
            if (split < 0 || !title || title.length > 160) throw new Error('형식: 책 제목 | 서점 상품 주소');
            const product = storeProduct(line.slice(split + 1).trim());
            entries.push({ title, line: index + 1, ...product });
        } catch (error) {
            throw new Error('교재추가.txt ' + (index + 1) + '번째 줄 · ' + error.message);
        }
    }
    return entries;
}

async function download(url, limit) {
    const response = await fetch(url, {
        redirect: 'error',
        signal: AbortSignal.timeout(10000),
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; online textbook catalog)' },
    });
    if (!response.ok) {
        await response.body?.cancel();
        throw new Error('HTTP ' + response.status);
    }
    const reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    try {
        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > limit) throw new Error('파일 크기 제한 초과');
            chunks.push(value);
        }
    } finally {
        await reader.cancel();
    }
    return Buffer.concat(chunks);
}

function decodeEntities(value = '') {
    const named = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' };
    return value.replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, (entity, name) => {
        if (name[0] !== '#') return named[name.toLowerCase()];
        const code = name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : Number(name.slice(1));
        return code <= 0x10ffff ? String.fromCodePoint(code) : entity;
    });
}

function readMetadata(html) {
    const metadata = new Map();
    for (const [tag] of html.matchAll(/<meta\b(?:[^"'<>]|"[^"]*"|'[^']*')*>/gi)) {
        const attributes = new Map([...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)]
            .map(([, name, double, single]) => [name.toLowerCase(), double ?? single]));
        const key = attributes.get('property') || attributes.get('name');
        if (key && !metadata.has(key)) metadata.set(key, decodeEntities(attributes.get('content')));
    }
    return metadata;
}

function retailMetadata(html, host) {
    const meta = readMetadata(html);
    const props = html.replace(/\\"/g, '"');
    const field = key => new RegExp('"' + key + '"\\s*:\\s*"([^"]*)"').exec(props)?.[1];
    const hidden = key => new RegExp('<input[^>]*value="([^"]*)"[^>]*id="' + key + '"').exec(html)?.[1];
    const [, productAuthor, productPublisher] = (meta.get('og:title') || '').split(' | ');
    let publisher = field('sharePublisher') || hidden('pbcmName');
    if (host === 'www.yes24.com') publisher = productPublisher?.replace(/ - 예스24$/, '');
    if (host === 'www.aladin.co.kr') {
        for (const [, block] of html.matchAll(/<script type="application\/ld\+json">\s*([\s\S]*?)<\/script>/gi)) {
            try {
                const data = JSON.parse(block);
                if (data['@type'] === 'Book' && data.publisher?.name) publisher = data.publisher.name;
            } catch {
                // Some retailer pages contain a neighboring structured-data block with invalid JSON.
            }
        }
    }
    if (host === 'www.ypbooks.co.kr' && meta.get('og:title')?.startsWith('영풍문고')) return {};
    const author = field('shareAuthor') || hidden('autrNm') || meta.get('author') ||
        (host === 'www.aladin.co.kr' || host === 'www.yes24.com' ? productAuthor : '');
    return {
        author: author?.replace(/ 저(?:\(AI활용\))?$/, ''),
        publisher,
        isbn: meta.get('books:isbn') || field('isbn') || hidden('stdBksIdnfNum'),
        description: meta.get('og:description'),
        cover: meta.get('og:image'),
    };
}

async function fetchBook(product) {
    const { url } = product;
    if (url.hostname !== 'bookk.co.kr') {
        const html = (await download(url, 4 * 1024 * 1024)).toString('utf8');
        return retailMetadata(html, url.hostname);
    }
    const id = url.pathname.split('/').pop();
    const response = await download('https://api.bookk.co.kr/bookStores/products/' + id, 2 * 1024 * 1024);
    const book = JSON.parse(response).product.content;
    return {
        author: book.author,
        publisher: book.publisher,
        isbn: book.isbn,
        description: book.subTitle || book.detail,
        cover: book.thumbnail?.path && 'https://file.bookk.co.kr' + book.thumbnail.path,
        date: book.publishedAt && new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' })
            .format(new Date(book.publishedAt)),
    };
}

async function saveCover(value, slug, rootDir) {
    if (!value) return '';
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.port || url.username || url.password || !imageHosts.has(url.hostname)) {
        return '';
    }
    const image = await download(url, 2 * 1024 * 1024);
    let extension;
    if (image.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) extension = 'jpg';
    if (image.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) extension = 'png';
    if (image.toString('ascii', 0, 4) === 'RIFF' && image.toString('ascii', 8, 12) === 'WEBP') extension = 'webp';
    if (!extension) return '';
    const cover = 'assets/images/book-added-' + slug + '.' + extension;
    fs.writeFileSync(path.join(rootDir, cover), image);
    return cover;
}

function excerpt(description = '') {
    const text = String(description || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    const words = text.split(' ');
    const preview = words.slice(0, 24).join(' ').slice(0, 155);
    return preview.length < text.length ? preview.trimEnd() + '…' : preview;
}

function navigation(previous, following, catalogFile) {
    return '<nav class="textbook-page-nav" aria-label="교재 간 이동">' +
        (previous ? '<a href="' + previous + '">← 이전 교재</a>' : '<span></span>') +
        '<a href="' + catalogFile + '">교재 목록</a>' +
        (following ? '<a href="' + following + '">다음 교재 →</a>' : '<span></span>') + '</nav>';
}

function renderBook(book, escape, nav, catalogFile) {
    const { file, title } = book;
    const label = escape(title);
    const summary = book.description ? '<p class="textbook-subtitle">' + escape(book.description) + '</p>' : '';
    const meta = [
        book.publisher && '출판사: ' + escape(book.publisher),
        book.author && '저자: ' + escape(book.author),
    ].filter(Boolean);
    const details = [...meta, book.date && '발행일: ' + escape(book.date), book.isbn && 'ISBN: ' + book.isbn]
        .filter(Boolean);
    const image = book.cover
        ? '<img src="' + escape(book.cover) + '" alt="' + label + ' 표지" width="119" height="172" loading="lazy">'
        : '<span class="textbook-cover-placeholder" aria-label="표지 이미지 미제공" role="img"><i class="ph-light ph-books" aria-hidden="true"></i></span>';
    const card = [
        '<article class="textbook-card">',
        '    <a class="textbook-card-image" href="' + file + '" aria-label="' + label + ' 교재 보기">' + image + '</a>',
        '    <div class="textbook-card-content">',
        '        <span class="textbook-tag">추천 교재</span>',
        '        <h3><a href="' + file + '">' + label + '</a></h3>',
        summary && '        ' + summary,
        meta.length && '        <p class="textbook-meta">' + meta.join('<br>') + '</p>',
        '        <a class="textbook-card-link" href="' + file + '">교재 보기 <span aria-hidden="true">→</span></a>',
        '    </div>',
        '</article>',
    ].filter(Boolean).join('\n');
    const main = [
        '<main class="fade-in">',
        '<div class="page-header"><h2>' + label + '</h2></div>',
        '<article class="container page-content-area shadow-sm textbook-reader">',
        '    <a class="textbook-back" href="' + catalogFile + '">← 온라인 교재실</a>',
        '    <div class="textbook-overview">',
        '        <div class="textbook-detail-cover">' + image + '</div>',
        '        <div>',
        '            <span class="textbook-tag">추천 교재</span>',
        '            <h3>' + label + '</h3>',
        summary && '            ' + summary.replace('textbook-subtitle', 'textbook-lead'),
        details.length && '            <p class="textbook-meta">' + details.join('<br>') + '</p>',
        '            <a class="textbook-card-link" href="' + escape(book.url.href) + '" target="_blank" rel="noopener noreferrer">' +
            escape(book.store) + '에서 도서 보기 <span aria-hidden="true">↗</span></a>',
        '        </div>',
        '    </div>',
        '    ' + nav,
        '</article></main>',
    ].filter(Boolean).join('\n');
    return { card, page: { title: title + ' · 온라인 교재', main } };
}

const cardHeading = /(<h3><a href="[^"]+">)([^<]+)(<\/a><\/h3>)/;
const pageNavigation = /<nav class="textbook-page-nav"[\s\S]*?<\/nav>/;
const bookstoreLink = /(class="textbook-card-link" href=")(https:[^"]+)(")/;

function savedBooks(catalog) {
    const books = new Map();
    for (const [card] of catalog.library.main.matchAll(/<article class="textbook-card">[\s\S]*?<\/article>/g)) {
        const file = /class="textbook-card-link" href="(textbook-[a-z0-9-]+\.html)"/.exec(card)?.[1];
        const page = catalog.books[file];
        const link = bookstoreLink.exec(page?.main)?.[2];
        const label = cardHeading.exec(card)?.[2];
        if (!link || !label || !pageNavigation.test(page.main)) {
            throw new Error('기존 교재 정보를 읽을 수 없습니다: ' + (file || '파일명 누락'));
        }
        const key = storeProduct(decodeEntities(link)).key;
        const isbn = /ISBN:\s*(\d{13})/.exec(page.main)?.[1];
        books.set(key, { file, card, page, isbn, title: decodeEntities(label) });
    }
    return books;
}

function renderSaved(book, { title, url }, escape, nav) {
    let { card, page: { main, title: pageTitle } } = book;
    if (title !== book.title) {
        const label = escape(title);
        const replaceLabel = (match, start, oldLabel, end) => start + label + end;
        const imageLabels = /((?:alt|aria-label)=")([^"]+)( (?:표지|교재 보기)")/g;
        card = card.replace(cardHeading, replaceLabel).replace(imageLabels, replaceLabel);
        main = main.replace(/(<h2>)([^<]+)(<\/h2>)/, replaceLabel)
            .replace(/(<h3>)([^<]+)(<\/h3>)/, replaceLabel)
            .replace(imageLabels, replaceLabel);
        pageTitle = title + ' · 온라인 교재';
    }
    main = main.replace(pageNavigation, () => nav)
        .replace(bookstoreLink, (match, start, oldLink, end) => start + escape(url.href) + end);
    return { card, page: { title: pageTitle, main } };
}

async function applyTextbookList(catalog, { rootDir, catalogFile, escapeHtml, input, assetPrefix = '' }) {
    const entries = readEntries(fs.readFileSync(input, 'utf8'));
    const baseline = savedBooks(catalog);
    const urls = new Set();
    const isbns = new Set();
    const books = [];
    for (const entry of entries) {
        if (urls.has(entry.key)) {
            console.warn('교재추가.txt ' + entry.line + '번째 줄 · 이미 등록된 상품 주소입니다.');
            continue;
        }
        urls.add(entry.key);
        const saved = baseline.get(entry.key);
        const metadata = saved ?? await fetchBook(entry).catch(error => {
            console.warn('교재추가.txt ' + entry.line + '번째 줄 · 서점 정보 조회 실패 (' + error.message + ')');
            return {};
        });
        const isbn = /^\d{13}$/.test(metadata.isbn) ? String(metadata.isbn) : '';
        if (isbn && isbns.has(isbn)) {
            console.warn('교재추가.txt ' + entry.line + '번째 줄 · 이미 등록된 ISBN입니다.');
            continue;
        }
        if (isbn) isbns.add(isbn);
        if (saved) {
            books.push({ ...entry, file: saved.file, saved });
            continue;
        }
        const slug = createHash('sha256').update(entry.key).digest('hex').slice(0, 16);
        const cover = await saveCover(metadata.cover, slug, rootDir).catch(error => {
            console.warn('교재추가.txt ' + entry.line + '번째 줄 · 표지 조회 실패 (' + error.message + ')');
            return '';
        });
        books.push({
            ...entry, isbn, cover: cover && assetPrefix + cover, file: 'textbook-added-' + slug + '.html',
            author: String(metadata.author || '').trim().slice(0, 160),
            publisher: String(metadata.publisher || '').trim().slice(0, 120),
            description: excerpt(metadata.description),
            date: metadata.date,
        });
    }
    catalog.books = {};
    const cards = books.map((book, index) => {
        const nav = navigation(books[index - 1]?.file, books[index + 1]?.file, catalogFile);
        const { card, page } = book.saved
            ? renderSaved(book.saved, book, escapeHtml, nav)
            : renderBook(book, escapeHtml, nav, catalogFile);
        catalog.books[book.file] = page;
        return card;
    });
    const grid = /(<div class="textbook-grid">)[\s\S]*?(<\/div><div class="textbook-library-bottom">)/;
    if (!grid.test(catalog.library.main)) throw new Error('교재 목록을 찾을 수 없습니다.');
    const items = cards.length ? cards.join('\n') : '<p>등록된 교재가 없습니다.</p>';
    catalog.library.main = catalog.library.main.replace(grid, (match, open, close) => open + '\n' + items + '\n' + close);
    console.log('온라인 교재 총 ' + books.length + '권');
}

function pruneTextbookPages(outputDir, originalFiles, books) {
    const originals = new Set(originalFiles);
    for (const file of fs.readdirSync(outputDir)) {
        const generated = originals.has(file) || /^textbook-added-[a-f0-9]{16}\.html$/.test(file);
        if (generated && !Object.hasOwn(books, file)) fs.rmSync(path.join(outputDir, file), { force: true });
    }
}

module.exports = { applyTextbookList, pruneTextbookPages };
