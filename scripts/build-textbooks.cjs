const fs = require('node:fs');
const path = require('node:path');
const { applyTextbookList, pruneTextbookPages } = require('./textbook-additions.cjs');

const rootDir = path.join(__dirname, '..');
const outputDir = path.join(rootDir, '_site');
const libraryFile = 'online-textbooks.html';
const mainTag = /<main\b[^>]*>[\s\S]*?<\/main>/;
const titleTag = /<title>[^<]*<\/title>/;
const siteTitle = 'GTCC Institute for Well-Aging and Lifelong Health';

function readPage(file) {
    const html = fs.readFileSync(path.join(rootDir, file), 'utf8');
    const main = mainTag.exec(html)?.[0];
    if (!main) throw new Error(file + '에서 교재 본문을 찾을 수 없습니다.');
    return { html, main };
}

function escapeHtml(text) {
    const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return text.replace(/[&<>"']/g, character => entities[character]);
}

function updateSitemap(books) {
    const sitemapFile = 'sitemap.html';
    const sitemap = fs.readFileSync(path.join(rootDir, sitemapFile), 'utf8');
    const card = /<article class="role-card"><h4>[^<]*<\/h4><p>([^<]*)<\/p><a href="(textbook-[a-z0-9-]+\.html)">교재 보기 ↗<\/a><\/article>\r?\n?/g;
    const oldCards = Array.from(sitemap.matchAll(card));
    const metadata = new Map(oldCards.map(([, description, file]) => [file, description]));
    const oldList = oldCards.map(([html]) => html).join('');
    if (!oldList || !sitemap.includes(oldList)) throw new Error('사이트맵에서 기존 교재 목록을 찾을 수 없습니다.');

    const list = Object.entries(books).map(([file, { main }]) => {
        const label = /<h2>([^<]+)<\/h2>/.exec(main)[1];
        const description = metadata.get(file) || '온라인 교재 상세 정보';
        return '<article class="role-card"><h4>' + label + ' · 온라인 교재</h4><p>' +
            description + '</p><a href="' + file + '">교재 보기 ↗</a></article>\n';
    }).join('');
    fs.writeFileSync(path.join(outputDir, sitemapFile), sitemap.replace(oldList, () => list));
}

async function buildTextbooks() {
    const library = readPage(libraryFile);
    const cardLinks = library.main.matchAll(/<a class="textbook-card-link" href="(textbook-[a-z0-9-]+\.html)"/g);
    const bookFiles = Array.from(cardLinks, ([, file]) => file);
    const books = Object.fromEntries(bookFiles.map(file => [file, readPage(file)]));
    const catalog = {
        library: { main: library.main },
        books: Object.fromEntries(bookFiles.map(file => [file, { main: books[file].main }])),
    };

    const inputFile = path.join(rootDir, 'content', '교재추가.txt');
    const template = books[bookFiles.at(-1)]?.html;
    if (!template || !titleTag.test(template)) throw new Error('상세 페이지 템플릿을 찾을 수 없습니다.');
    await applyTextbookList(catalog, { rootDir: outputDir, catalogFile: libraryFile, escapeHtml, input: inputFile });

    for (const [file, page] of Object.entries({ [libraryFile]: catalog.library, ...catalog.books })) {
        const original = file === libraryFile ? library : books[file];
        if (original?.main === page.main && !page.title) continue;
        let html = original?.html ?? template;
        if (page.title) {
            html = html.replace(titleTag, () => '<title>' + escapeHtml(page.title) + ' | ' + siteTitle + '</title>');
        }
        fs.writeFileSync(path.join(outputDir, file), html.replace(mainTag, () => page.main));
    }
    updateSitemap(catalog.books);
    pruneTextbookPages(outputDir, bookFiles, catalog.books);
}

buildTextbooks().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
});
