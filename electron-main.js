'use strict';

const { app, BrowserWindow, dialog, Menu, shell } = require('electron');
const path = require('path');
const { startServer } = require('./server');

let mainWindow;

function updateNotes(info) {
  const notes = Array.isArray(info.releaseNotes) ? info.releaseNotes.map(x => x.note).join('\n') : String(info.releaseNotes || '기능 개선과 오류 수정이 포함되어 있습니다.');
  return `현재 버전: ${app.getVersion()}\n새 버전: ${info.version}\n\n${notes}`;
}

async function setupUpdater() {
  if (!app.isPackaged) return;
  try {
    const { autoUpdater } = require('electron-updater');
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;
    autoUpdater.on('update-available', async info => {
      const answer = await dialog.showMessageBox(mainWindow, {
        type: 'info', title: '자우니덱 업데이트', message: '새로운 업데이트가 있습니다.',
        detail: updateNotes(info), buttons: ['업데이트', '나중에'], defaultId: 0, cancelId: 1
      });
      if (answer.response === 0) autoUpdater.downloadUpdate();
    });
    autoUpdater.on('update-downloaded', async () => {
      const answer = await dialog.showMessageBox(mainWindow, {
        type: 'info', title: '업데이트 준비 완료', message: '업데이트 다운로드가 완료되었습니다.',
        detail: '지금 재시작하면 새 버전이 설치됩니다.', buttons: ['재시작하여 설치', '나중에'], defaultId: 0, cancelId: 1
      });
      if (answer.response === 0) autoUpdater.quitAndInstall(false, true);
    });
    autoUpdater.on('error', e => console.error('update error:', e.message));
    setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 2500);
  } catch (e) { console.error('updater unavailable:', e.message); }
}

async function createWindow() {
  const connection = await startServer();
  mainWindow = new BrowserWindow({
    width: 980, height: 760, minWidth: 720, minHeight: 560,
    title: '자우니덱', backgroundColor: '#f6f3fb', autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true }
  });
  const params = new URLSearchParams({ desktop: '1', code: connection.pairCode, urls: connection.urls.join('|') });
  await mainWindow.loadURL(`http://127.0.0.1:${connection.port}/?${params}`);
  mainWindow.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  await setupUpdater();
}

app.whenReady().then(() => { Menu.setApplicationMenu(null); return createWindow(); }).catch(e => dialog.showErrorBox('자우니덱 실행 오류', e.message));
app.on('window-all-closed', () => app.quit());
