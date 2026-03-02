'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('healthAPI', {
  generateReport: () => ipcRenderer.invoke('generate-report'),
  loadReportFile: (filePath) => ipcRenderer.invoke('load-report-file', filePath),
  openReportDialog: () => ipcRenderer.invoke('open-report-dialog'),
  quitApp: () => ipcRenderer.invoke('quit-app'),
});
