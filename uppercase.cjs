const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.tsx') && !file.includes('node_modules')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk('./src/components');
let total = 0;

files.forEach(f => {
  if (f.includes('Login.tsx') || f.includes('Layout.tsx')) return;
  
  let content = fs.readFileSync(f, 'utf8');
  let original = content;
  
  content = content.replace(/onChange=\{\(e\)\s*=>\s*set([A-Za-z0-9_]+)\(\{\s*\.\.\.([A-Za-z0-9_]+),\s*([A-Za-z0-9_]+):\s*e\.target\.value\s*\}\)\}/g, (match, p1, p2, p3) => {
    if(p3.toLowerCase().includes('email') || p3.toLowerCase().includes('password') || p3.toLowerCase().includes('senha')) return match;
    return `onChange={(e) => set${p1}({...${p2}, ${p3}: e.target.value.toUpperCase()})}`;
  });
  
  content = content.replace(/onChange=\{\(e\)\s*=>\s*set([A-Za-z0-9_]+)\(e\.target\.value\)\}/g, (match, p1) => {
    if(p1.toLowerCase().includes('email') || p1.toLowerCase().includes('password') || p1.toLowerCase().includes('senha')) return match;
    return `onChange={(e) => set${p1}(e.target.value.toUpperCase())}`;
  });
  
  content = content.replace(/([a-zA-Z0-9_]+)\[index\]\.([a-zA-Z0-9_]+)\s*=\s*e\.target\.value;/g, (match, obj, prop) => {
    if(prop.toLowerCase().includes('email') || prop.toLowerCase().includes('password') || prop.toLowerCase().includes('senha')) return match;
    return `${obj}[index].${prop} = e.target.value.toUpperCase();`;
  });
  
  if (original !== content) {
    fs.writeFileSync(f, content);
    total++;
  }
});

console.log('Modified', total, 'files.');
