const fs = require('node:fs');
const path = require('node:path');
const { addTextbooks } = require('./textbook-additions.cjs');

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
    await addTextbooks(catalog, outputDir, libraryFile, escapeHtml, inputFile);

    for (const [file, page] of Object.entries({ [libraryFile]: catalog.library, ...catalog.books })) {
        const original = file === libraryFile ? library : books[file];
        if (original?.main === page.main) continue;
        const html = original?.html ?? template.replace(titleTag, () =>
            '<title>' + escapeHtml(page.title) + ' | ' + siteTitle + '</title>');
        fs.writeFileSync(path.join(outputDir, file), html.replace(mainTag, () => page.main));
    }
}

buildTextbooks().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
});
