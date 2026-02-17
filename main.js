const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const XLSX = require('xlsx');
const fs = require('fs');
const os = require('os');
const { autoUpdater } = require('electron-updater');

// 1. FIREBASE SETUP
const { initializeApp } = require("firebase/app");
const { getAuth, signInWithEmailAndPassword } = require("firebase/auth");
const { getFirestore, collection, addDoc, onSnapshot, doc, getDoc, deleteDoc, serverTimestamp, query, orderBy } = require("firebase/firestore");

const firebaseConfig = {
  apiKey: "AIzaSyAGtU0OVGpsdxharfIg2csrgF8M4d29fAA",
  authDomain: "npsof-96c9c.firebaseapp.com",
  projectId: "npsof-96c9c",
  storageBucket: "npsof-96c9c.firebasestorage.app",
  messagingSenderId: "797996994613",
  appId: "1:797996994613:web:f777ba8098ff8f0f58e17c"
};

const fbApp = initializeApp(firebaseConfig);
const auth = getAuth(fbApp);
const db = getFirestore(fbApp);

// 2. AUTO-UPDATE CONFIGURATION
autoUpdater.autoDownload = true;
autoUpdater.allowPrerelease = false;

function sendStatusToWindow(text) {
    if (mainWindow) {
        mainWindow.webContents.send('update-message', text);
    }
}

autoUpdater.on('update-available', (info) => {
    sendStatusToWindow(`Пронајдена верзија ${info.version}. Превземање...`);
});

autoUpdater.on('update-downloaded', (info) => {
    sendStatusToWindow('Преземено.'); 
    dialog.showMessageBox({
        type: 'info',
        buttons: ['Рестартирај веднаш', 'Подоцна'],
        defaultId: 0,
        title: 'NefroPlus Elite - Нов Апдејт',
        message: `Новата верзија (${info.version}) е подготвена. Дали сакате да ја инсталирате сега?`
    }).then(result => {
        if (result.response === 0) autoUpdater.quitAndInstall();
    });
});

// 3. MAIN WINDOW
let mainWindow;
let subs = {};

function createWindow() {
    mainWindow = new BrowserWindow({ 
        width: 1400, 
        height: 900,
        show: false, // Го чуваме скриен додека не е 100% спремен
        fullscreen: true, 
        alwaysOnTop: true, 
        autoHideMenuBar: true, 
        backgroundColor: '#0f172a', // ОВА МОРА ДА ОСТАНЕ - тоа е бојата на Splash-от
        webPreferences: { 
            preload: path.join(__dirname, 'preload.js'), 
            contextIsolation: true, 
            nodeIntegration: false,
            backgroundThrottling: false 
        } 
    });

    mainWindow.loadFile('index.html');
    
    // КОРИСТИМЕ ready-to-show БЕЗ ОГРОМНИ ПАУЗИ
    mainWindow.once('ready-to-show', () => {
        // Само 200 милисекунди за да бидеме сигурни дека прозорецот е во Fullscreen
        setTimeout(() => {
            mainWindow.show();
            mainWindow.focus();
            
            setTimeout(() => {
                if (mainWindow) {
                    mainWindow.setAlwaysOnTop(false);
                }
            }, 3000);

            autoUpdater.checkForUpdatesAndNotify();
        }, 200); 
    });
}

app.whenReady().then(createWindow);

// --- ОСТАТОКОТ ОД ТВОИТЕ ФУНКЦИИ СЕ ИСТИ ---

function setupListeners() {
    const colls = ["rekanulacije", "komplikacije", "infekcije", "hospitalizacije"];
    colls.forEach(c => {
        if (subs[c]) subs[c]();
        const q = query(collection(db, c), orderBy("timestamp", "desc"));
        subs[c] = onSnapshot(q, (snap) => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            if (mainWindow) mainWindow.webContents.send(`data:${c}`, data);
        });
    });
}

ipcMain.handle('app:get-version', () => {
    return app.getVersion(); 
});

ipcMain.handle('auth:login', async (event, { email, password }) => {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const userDoc = await getDoc(doc(db, "users", userCredential.user.uid));
        if (userDoc.exists()) {
            setupListeners();
            return { success: true, ...userDoc.data() };
        }
        return { success: false };
    } catch (error) { 
        return { success: false, error: error.message }; 
    }
});

ipcMain.handle('data:save', async (e, { coll, data }) => {
    try {
        await addDoc(collection(db, coll), { ...data, timestamp: serverTimestamp() });
        return { success: true };
    } catch (err) { return { success: false }; }
});

ipcMain.handle('data:delete', async (e, { coll, id }) => {
    try {
        await deleteDoc(doc(db, coll, id));
        return { success: true };
    } catch (err) { return { success: false }; }
});

ipcMain.on('export:excel', (e, { data, fileName }) => {
    const mapped = data.map(i => ({
        "ID на Пациент": i.pid,
        "Име и Презиме": i.ime,
        "Датум": i.datum,
        "Центар": i.dc || i.DC,
        "Категорија (V1)": i.v1,
        "Опис (V2)": i.v2,
        "Забелешка (V3)": i.v3 || ""
    }));
    const ws = XLSX.utils.json_to_sheet(mapped);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "NefroPlus Извештај");
    XLSX.writeFile(wb, path.join(os.homedir(), 'Desktop', `${fileName}.xlsx`));
});

ipcMain.on('print-pdf', async () => {
    const pdfPath = path.join(os.homedir(), 'Desktop', 'Izvestaj_2026.pdf');
    const data = await mainWindow.webContents.printToPDF({ printBackground: true, landscape: true });
    fs.writeFileSync(pdfPath, data);
});

ipcMain.on('app:exit', () => app.quit());

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});