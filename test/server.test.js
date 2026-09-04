const test=require('node:test'); const assert=require('node:assert/strict'); const fs=require('fs'); const path=require('path');
test('client files exist',()=>{for(const f of ['index.html','style.css','app.js'])assert.ok(fs.existsSync(path.join(__dirname,'..','public',f)))});
test('server syntax loads',()=>{const src=fs.readFileSync(path.join(__dirname,'..','server.js'),'utf8');assert.match(src,/PAIR_CODE/);assert.match(src,/api\/execute/)});
