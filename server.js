'use strict';

const http = require('http');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { execFile, spawn } = require('child_process');

const PORT = Number(process.env.JAUNI_DECK_PORT || 39241);
const PAIR_CODE = String(Math.floor(100000 + Math.random() * 900000));
const PUBLIC = path.join(__dirname, 'public');
const MAX_BODY = 32 * 1024;

const MIME = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'application/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml' };

function addresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const item of list || []) if (item.family === 'IPv4' && !item.internal) out.push(`http://${item.address}:${PORT}`);
  }
  return out;
}

function json(res, status, value) {
  res.writeHead(status, { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store' });
  res.end(JSON.stringify(value));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; if (body.length > MAX_BODY) reject(new Error('요청이 너무 큽니다.')); });
    req.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch { reject(new Error('잘못된 요청입니다.')); } });
    req.on('error', reject);
  });
}

function ps(script) {
  return new Promise((resolve, reject) => execFile('powershell.exe', ['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-Command',script], { windowsHide:true }, e => e ? reject(e) : resolve()));
}
function osa(script) {
  return new Promise((resolve, reject) => execFile('osascript', ['-e', script], e => e ? reject(e) : resolve()));
}

const namedKeys = new Set(['CTRL','ALT','SHIFT','CMD','ENTER','TAB','ESC','SPACE','BACKSPACE','DELETE','INSERT','CAPSLOCK','PRINTSCREEN','SCROLLLOCK','PAUSE','UP','DOWN','LEFT','RIGHT','HOME','END','PAGEUP','PAGEDOWN','COMMA','PERIOD','SLASH','BACKSLASH','LBRACKET','RBRACKET','EQUALS','MINUS','SEMICOLON','APOSTROPHE','GRAVE','NUMLOCK','NUM0','NUM1','NUM2','NUM3','NUM4','NUM5','NUM6','NUM7','NUM8','NUM9','NUMPLUS','NUMMINUS','NUMMULTIPLY','NUMDIVIDE','NUMDECIMAL', ...Array.from({length:24},(_,i)=>`F${i+1}`)]);
const macKey = { CTRL:'control down', ALT:'option down', SHIFT:'shift down', CMD:'command down' };

function parseHotkey(raw) {
  const parts = String(raw || '').toUpperCase().split('+').map(x => x.trim()).filter(Boolean);
  if (!parts.length || parts.length > 5) throw new Error('단축키 형식이 올바르지 않습니다.');
  for (const p of parts) if (!/^[A-Z0-9]$/.test(p) && !namedKeys.has(p)) throw new Error(`지원하지 않는 키: ${p}`);
  return parts;
}

async function hotkey(value) {
  const parts = parseHotkey(value);
  if (process.platform === 'win32') {
    const fixed={CTRL:0x11,ALT:0x12,SHIFT:0x10,CMD:0x5B,ENTER:0x0D,TAB:0x09,ESC:0x1B,SPACE:0x20,BACKSPACE:0x08,DELETE:0x2E,INSERT:0x2D,CAPSLOCK:0x14,PRINTSCREEN:0x2C,SCROLLLOCK:0x91,PAUSE:0x13,UP:0x26,DOWN:0x28,LEFT:0x25,RIGHT:0x27,HOME:0x24,END:0x23,PAGEUP:0x21,PAGEDOWN:0x22,COMMA:0xBC,PERIOD:0xBE,SLASH:0xBF,BACKSLASH:0xDC,LBRACKET:0xDB,RBRACKET:0xDD,EQUALS:0xBB,MINUS:0xBD,SEMICOLON:0xBA,APOSTROPHE:0xDE,GRAVE:0xC0,NUMLOCK:0x90,NUM0:0x60,NUM1:0x61,NUM2:0x62,NUM3:0x63,NUM4:0x64,NUM5:0x65,NUM6:0x66,NUM7:0x67,NUM8:0x68,NUM9:0x69,NUMMULTIPLY:0x6A,NUMPLUS:0x6B,NUMMINUS:0x6D,NUMDECIMAL:0x6E,NUMDIVIDE:0x6F};
    const codes=parts.map(p=>fixed[p] ?? (/^F([1-9]|1[0-9]|2[0-4])$/.test(p)?0x6F+Number(p.slice(1)):/^[A-Z]$/.test(p)?p.charCodeAt(0):0x30+Number(p)));
    const downs=codes.map(k=>`[K]::keybd_event(${k},0,0,0)`).join(';');
    const ups=[...codes].reverse().map(k=>`[K]::keybd_event(${k},0,2,0)`).join(';');
    return ps(`Add-Type -TypeDefinition 'using System.Runtime.InteropServices; public class K{[DllImport("user32.dll")]public static extern void keybd_event(byte b,byte s,uint f,int e);}'; ${downs}; Start-Sleep -Milliseconds 35; ${ups}`);
  }
  if (process.platform === 'darwin') {
    const modifiers = parts.filter(p => macKey[p]).map(p => macKey[p]);
    const key = parts.find(p => !macKey[p]);
    const macCodes={ENTER:36,TAB:48,ESC:53,SPACE:49,BACKSPACE:51,DELETE:117,INSERT:114,CAPSLOCK:57,LEFT:123,RIGHT:124,DOWN:125,UP:126,HOME:115,END:119,PAGEUP:116,PAGEDOWN:121,F1:122,F2:120,F3:99,F4:118,F5:96,F6:97,F7:98,F8:100,F9:101,F10:109,F11:103,F12:111,F13:105,F14:107,F15:113,F16:106,F17:64,F18:79,F19:80,F20:90,NUM0:82,NUM1:83,NUM2:84,NUM3:85,NUM4:86,NUM5:87,NUM6:88,NUM7:89,NUM8:91,NUM9:92,NUMDECIMAL:65,NUMMULTIPLY:67,NUMPLUS:69,NUMDIVIDE:75,NUMMINUS:78};
    const printable={COMMA:',',PERIOD:'.',SLASH:'/',BACKSLASH:'\\',LBRACKET:'[',RBRACKET:']',EQUALS:'=',MINUS:'-',SEMICOLON:';',APOSTROPHE:"'",GRAVE:'`'};
    const k = key.length === 1 || printable[key] ? `keystroke "${printable[key]||key.toLowerCase()}"` : `key code ${macCodes[key]}`;
    return osa(`tell application "System Events" to ${k}${modifiers.length ? ` using {${modifiers.join(', ')}}` : ''}`);
  }
  throw new Error('Windows와 macOS에서만 사용할 수 있습니다.');
}

async function typeText(value) {
  const text = String(value || '').slice(0, 5000);
  if (process.platform === 'win32') {
    const encoded = Buffer.from(text, 'utf16le').toString('base64');
    await ps(`$b=[Convert]::FromBase64String('${encoded}'); $t=[Text.Encoding]::Unicode.GetString($b); Set-Clipboard -Value $t; Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^v')`);
  } else if (process.platform === 'darwin') {
    await new Promise((resolve, reject) => { const p=spawn('pbcopy'); p.on('error',reject); p.on('close',c=>c?reject(new Error('복사 실패')):resolve()); p.stdin.end(text); });
    await osa('tell application "System Events" to keystroke "v" using command down');
  } else throw new Error('Windows와 macOS에서만 사용할 수 있습니다.');
}

async function launch(value) {
  const app = String(value || '').toLowerCase();
  const mac = { chrome:'Google Chrome', photoshop:'Adobe Photoshop', finder:'Finder', calculator:'Calculator', notes:'Notes' };
  if (process.platform === 'win32') {
    const simple = { explorer:'explorer.exe', calculator:'calc.exe', notepad:'notepad.exe' };
    if (simple[app]) return ps(`Start-Process '${simple[app]}'`);
    if (app === 'chrome') return ps(`$k=Get-Item 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe' -ErrorAction SilentlyContinue; $p=if($k){$k.GetValue('')}; if(!$p){$k=Get-Item 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe' -ErrorAction SilentlyContinue; $p=if($k){$k.GetValue('')}}; if(!$p){$p=\"$env:ProgramFiles\\Google\\Chrome\\Application\\chrome.exe\"}; if(!(Test-Path $p)){throw 'Chrome installation not found'}; Start-Process $p`);
    if (app === 'photoshop') return ps(`$k=Get-Item 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\Photoshop.exe' -ErrorAction SilentlyContinue; $p=if($k){$k.GetValue('')}; if(!$p){$p=Get-ChildItem \"$env:ProgramFiles\\Adobe\" -Filter Photoshop.exe -Recurse -ErrorAction SilentlyContinue | Sort-Object FullName -Descending | Select-Object -First 1 -ExpandProperty FullName}; if(!$p -or !(Test-Path $p)){throw 'Photoshop installation not found'}; Start-Process $p`);
  }
  if (process.platform === 'darwin' && mac[app]) return new Promise((resolve, reject) => execFile('open', ['-a', mac[app]], e => e ? reject(e) : resolve()));
  throw new Error('지원 목록에 없는 프로그램입니다.');
}

async function media(value) {
  const action = String(value || '');
  if (process.platform === 'win32') {
    const vk = { previous:0xB1, next:0xB0, playpause:0xB3, volumeup:0xAF, volumedown:0xAE, mute:0xAD }[action];
    if (!vk) throw new Error('지원하지 않는 미디어 명령입니다.');
    return ps(`Add-Type -TypeDefinition 'using System.Runtime.InteropServices; public class K{[DllImport("user32.dll")]public static extern void keybd_event(byte b,byte s,uint f,int e);}'; [K]::keybd_event(${vk},0,0,0); [K]::keybd_event(${vk},0,2,0)`);
  }
  if (process.platform === 'darwin') {
    const code = { volumeup:72, volumedown:73, mute:74, playpause:16, next:17, previous:18 }[action];
    if (!code) throw new Error('지원하지 않는 미디어 명령입니다.');
    return osa(`tell application "System Events" to key code ${code}`);
  }
  throw new Error('Windows와 macOS에서만 사용할 수 있습니다.');
}

async function execute(action) {
  if (!action || typeof action !== 'object') throw new Error('동작이 없습니다.');
  if (action.type === 'hotkey') return hotkey(action.value);
  if (action.type === 'text') return typeText(action.value);
  if (action.type === 'launch') return launch(action.value);
  if (action.type === 'media') return media(action.value);
  throw new Error('지원하지 않는 동작입니다.');
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/api/status') return json(res, 200, { ok:true, computer:os.hostname(), platform:process.platform });
  if (req.method === 'POST' && req.url === '/api/execute') {
    try {
      const body = await readBody(req);
      if (String(body.code || '') !== PAIR_CODE) return json(res, 401, { ok:false, error:'연결번호가 맞지 않습니다.' });
      await execute(body.action);
      return json(res, 200, { ok:true });
    } catch (e) { return json(res, 400, { ok:false, error:e.message || '실행하지 못했습니다.' }); }
  }
  if (req.method !== 'GET') return json(res, 405, { ok:false });
  // Electron opens the desktop page with query parameters. Resolve the
  // pathname first so `/?desktop=1...` still serves index.html.
  const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
  const raw = pathname === '/' ? '/index.html' : pathname;
  const file = path.normalize(path.join(PUBLIC, raw));
  if (!file.startsWith(PUBLIC)) return json(res, 403, { ok:false });
  fs.readFile(file, (e, data) => { if (e) return json(res, 404, { ok:false }); res.writeHead(200, { 'Content-Type':MIME[path.extname(file)] || 'application/octet-stream' }); res.end(data); });
});

function startServer() {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(PORT, '0.0.0.0', () => {
      server.removeListener('error', reject);
      console.log('\n  자우니덱 연결 프로그램이 실행되었습니다.');
      console.log(`  연결번호: ${PAIR_CODE}`);
      for (const url of addresses()) console.log(`  휴대폰/태블릿 주소: ${url}`);
      console.log('  종료하려면 이 창에서 Ctrl+C를 누르세요.\n');
      resolve({ server, pairCode: PAIR_CODE, urls: addresses(), port: PORT });
    });
  });
}

if (require.main === module) startServer().catch(e => { console.error(e); process.exitCode = 1; });
module.exports = { startServer };
