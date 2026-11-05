const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const { pages } = JSON.parse(fs.readFileSync(path.join(root,'content/site.json'),'utf8'));
const template = fs.readFileSync(path.join(root,'templates/site.html'),'utf8');
for (const [file, page] of Object.entries(pages)) {
  const prefix = '../'.repeat(file.split('/').length - 1);
  let html = template.replace('{{TITLE}}',page.title).replace('{{MAIN}}',page.main);
  html = html.replace(/\b(href|src)="([^"]+)"/g, (match,attr,url) =>
    /^(?:[a-z]+:|\/\/|#)/i.test(url) ? match : attr+'="'+prefix+url+'"');
  const destination = path.join(root,file);
  fs.mkdirSync(path.dirname(destination),{recursive:true});
  fs.writeFileSync(destination,html.trimEnd()+'\n','utf8');
}
console.log('Built '+Object.keys(pages).length+' care and health pages.');
