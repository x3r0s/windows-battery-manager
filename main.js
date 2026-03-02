'use strict';

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const fs = require('fs');
const { parseReport } = require('./src/parser/batteryReportParser');

let mainWindow;
let reportData = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'Windows Battery Manager',
    backgroundColor: '#0f0f1a',
    show: false,
  });

  mainWindow.loadFile('src/renderer/index.html');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
}

// powercfg로 배터리 리포트 생성 후 파싱
ipcMain.handle('generate-report', async () => {
  const outputPath = path.join(os.tmpdir(), 'whm-battery-report.html');

  return new Promise((resolve) => {
    exec(
      `powercfg /batteryreport /output "${outputPath}"`,
      { windowsHide: true },
      (error) => {
        if (error) {
          resolve({ success: false, error: error.message });
          return;
        }

        try {
          const html = fs.readFileSync(outputPath, 'utf-8');
          reportData = parseReport(html);
          if (reportData.batteries.length === 0) {
            resolve({ success: false, noBattery: true });
            return;
          }
          resolve({ success: true, data: reportData });
        } catch (parseErr) {
          resolve({ success: false, error: parseErr.message });
        }
      }
    );
  });
});

// 파일 직접 불러오기 (테스트용)
ipcMain.handle('load-report-file', async (_event, filePath) => {
  try {
    const html = fs.readFileSync(filePath, 'utf-8');
    reportData = parseReport(html);
    return { success: true, data: reportData };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 파일 선택 다이얼로그
ipcMain.handle('open-report-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '배터리 리포트 HTML 파일 선택',
    filters: [{ name: 'HTML 파일', extensions: ['html', 'htm'] }],
    properties: ['openFile'],
  });

  if (result.canceled || !result.filePaths[0]) {
    return { success: false, error: 'cancelled' };
  }

  try {
    const html = fs.readFileSync(result.filePaths[0], 'utf-8');
    reportData = parseReport(html);
    return { success: true, data: reportData };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('quit-app', () => {
  app.quit();
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});
