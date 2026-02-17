const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  login: (email, password) => ipcRenderer.invoke('auth:login', { email, password }),
  saveData: (coll, data) => ipcRenderer.invoke('data:save', { coll, data }),
  deleteData: (coll, id) => ipcRenderer.invoke('data:delete', { coll, id }),
  exportToExcel: (data, fileName) => ipcRenderer.send('export:excel', { data, fileName }),
  printPDF: () => ipcRenderer.send('print-pdf'),
  exitApp: () => ipcRenderer.send('app:exit'),
  
  // --- НОВО ЗА GITHUB АЖУРИРАЊЕ ---
  // Ова ќе ја влече верзијата од package.json
  getVersion: () => ipcRenderer.invoke('app:get-version'),
  // Ова ќе не извести ако се најде апдејт
  onUpdateMessage: (cb) => ipcRenderer.on('update-message', (e, msg) => cb(msg)),
  // -------------------------------

  onRekanulacije: (cb) => ipcRenderer.on('data:rekanulacije', (e, d) => cb(d)),
  onKomplikacije: (cb) => ipcRenderer.on('data:komplikacije', (e, d) => cb(d)),
  onInfekcije: (cb) => ipcRenderer.on('data:infekcije', (e, d) => cb(d)),
  onHospitalizacije: (cb) => ipcRenderer.on('data:hospitalizacije', (e, d) => cb(d))
});