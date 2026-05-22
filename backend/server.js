const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const DATA_FILE = path.join(__dirname, 'backend_data/data.json');
const LOG_DIR = path.join(__dirname, '../frontend/frontend_data');


if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}


// Detecție ESP OFFLINE
const espCheckTime = 5000; // [ms]
let espConnected = false;
let logCounter = 0;

app.use(cors());
app.use(express.json());


function isBlank(v) { return !v || typeof v !== 'string' || !v.trim(); }


// Culori ANSI pt. loguri
const logColors = {
  reset: "\x1b[0m",
  red: "\x1b[38;2;255;85;85m",
  cream: "\x1b[38;2;245;245;220m",
  green: "\x1b[38;2;85;255;85m",
  cyan: "\x1b[36m"
};



// Statusuri System
const systemState = {
  lastCheckIn: 0,
  servoAngle: 90,
  temperature: 0,
  humidity: 0,
  fanStatus: false,
  fanSpeed: 50,
  texts: [" - ", " - ", " - "],
  activeUser: null
};



// LOAD data
function loadData()
{
  if (!fs.existsSync(DATA_FILE)) {
    console.log(`${logColors.green}[SYSTEM]${logColors.reset}: DATA_FILE negăsit. Loading DEFAULT ... ${logColors.reset}`);
    return { users: [ { username: "Administrator", password: "admin#123", isAdmin: true } ], espData: { 
      name: "ESP32 Wroom",
      servoDelay: 150, 
      texts: [" - ", " - ", " - "]
    }}; 
  }

  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

    if (!data.users){ data.users = [{ username: "Administrator", password: "admin#123", isAdmin: true }]; }

    if (!data.espData) {
      data.espData.name = "ESP32 Wroom";
      data.espData.servoDelay = 150;
      data.espData.texts = [" - ", " - ", " - "];
    }

    return data;
  } catch (err) {
    console.log(`${logColors.green}[SYSTEM]${logColors.reset}: Eroare citire DATA_FILE. Loading DEFAULT ... ${logColors.reset}`);
    return { users: [{ username: "Administrator", password: "admin#123", isAdmin: true }], espData: { 
      name: "ESP32 Wroom",
      servoDelay: 150, 
      texts: [" - ", " - ", " - "]
    }}; 
  }
}



// SAVE data
function saveData(data)
{
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}



// RUTE API ===========================================================================
// Înregistrare Utilizator
app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  if (isBlank(username) || isBlank(password)) {
    return res.status(400).json({ success: false, error: 'Câmp gol sau invalid!' });
  }

  const data = loadData();
  if (data.users.find(u => u.username === username)) {
    return res.status(400).json({ success: false, error: 'Nume Utilizator Existent!' });
  }

  data.users.push({ username: username.trim(), password: password.trim(), isAdmin: false });
  saveData(data);

  console.log(`${logColors.cyan}[AUTH]${logColors.reset}: ${username} înregistrat cu SUCCES ...`);
  res.json({ success: true });
});



// Autentificare Utilizator
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (isBlank(username) || isBlank(password)) {
    return res.status(400).json({ success: false, error: 'Câmp gol sau invalid!' });
  }
  
  const data = loadData();
  const user = data.users.find(u => u.username === username && u.password === password);

  if (!user) {
    return res.status(401).json({ success: false, error: 'Nume Utilizator sau Parolă invalidă!' });
  }

  console.log(`${logColors.cyan}[AUTH]${logColors.reset}: ${username} s-a logat cu SUCCES ...`);
  res.json({ success: true, username: user.username });
});



// Șterge Cont Utilizator
app.post('/api/delete', (req, res) => {
  const { username, password } = req.body;
  if (isBlank(username) || isBlank(password)) {
    return res.status(400).json({ success: false, error: 'Câmp gol sau invalid!' });
  }

  const data = loadData();
  const idx = data.users.findIndex(u => u.username === username && u.password === password);

  if (idx === -1) {
    return res.status(401).json({ success: false, error: 'Utilizator inexistent sau parolă greșită!' });
  }

  data.users.splice(idx, 1);
  saveData(data);
  if (systemState.activeUser === username) systemState.activeUser = null;

  console.log(`${logColors.cyan}[AUTH]${logColors.reset}: ${username} a fost șters cu SUCCES ...`);
  res.json({ success: true, message: 'Cont șters cu succes!' });
});



// Verificare ADMIN
app.post('/api/admincheck', (req, res) => {

  const { username } = req.body;
  if (isBlank(username)) {
    return res.status(400).json({ success: false, error: 'Câmp gol sau invalid!' });
  }
  
  const data = loadData();
  const user = data.users.find(u => u.username === username && u.isAdmin === true);

  res.json({ success: true, isAdmin: user ? true : false });
});



// Cerere control
app.post('/api/control/acquire', (req, res) => {
  const { username } = req.body;
  if (isBlank(username)) {
    return res.status(400).json({ success: false, error: 'Utilizator invalid!' });
  }

  if (systemState.activeUser && systemState.activeUser !== username) {
    return res.status(409).json({
      success: false,
      error: `Controlul este folosit de: ${systemState.activeUser}`,
      activeUser: systemState.activeUser
    });
  }

  systemState.activeUser = username;

  console.log(`${logColors.cream}[CONTROL]:${logColors.reset} ${username} a preluat controlul ...`);
  res.json({ success: true, activeUser: systemState.activeUser });
});



// Eliberare control
app.post('/api/control/release', (req, res) => {
  const { username } = req.body;
  if (isBlank(username)) {
    return res.status(400).json({ success: false, error: 'Utilizator invalid!' });
  }

  if (systemState.activeUser !== username) {
    return res.status(403).json({ success: false, error: 'Nu ai controlul acum!' });
  }

  systemState.activeUser = null;

  console.log(`${logColors.cream}[CONTROL]:${logColors.reset} ${username} a pierdut controlul ...`);
  res.json({ success: true });
});



// Achizitie date FRONTEND
app.get('/api/status', (req, res) => {
  res.json({
    servoAngle: systemState.servoAngle,
    activeUser: systemState.activeUser,
    isConnected: espConnected, // Trimite direct starea curentă salvată de server
    temperature: systemState.temperature,
    humidity: systemState.humidity,
    fanStatus: systemState.fanStatus,
    fanSpeed: systemState.fanSpeed,
    texts: systemState.texts
  });
});



// Comandă unghi Servo de la FRONTEND
app.post('/api/command/servo', (req, res) => {
  const { username, angle } = req.body;
  if (systemState.activeUser !== username) {
    return res.status(403).json({ success: false, error: 'Nu ai controlul acum!' });
  }
  const a = Number(angle);
  if (!Number.isFinite(a) || a < 0 || a > 180) {
    return res.status(400).json({ success: false, error: 'Unghi invalid (0..180)!' });
  }
  systemState.servoAngle = Math.round(a);
  res.json({ success: true });
});



// Comandă stare Ventilator
app.post('/api/command/fan', (req, res) => {
  const { username, fanStatus } = req.body;
  if (systemState.activeUser !== username) {
    return res.status(403).json({ success: false, error: 'Nu ai controlul acum!' });
  }

  systemState.fanStatus = !!fanStatus;
  res.json({ success: true });
});



// Comandă modificare viteză ventilator
app.post('/api/command/fan/speed', (req, res) => {
  const { username, speed } = req.body;
  if (systemState.activeUser !== username) {
    return res.status(403).json({ success: false, error: 'Nu ai controlul acum!' });
  }
  const s = Number(speed);
  if (!Number.isFinite(s) || s < 0 || s > 100) {
    return res.status(400).json({ success: false, error: 'Viteză invalidă (0..100)!' });
  }
  systemState.fanSpeed = Math.round(s);
  res.json({ success: true });
});



// Comandă actualizare linii text LCD 2004
app.post('/api/command/lcd', (req, res) => {
  const { username, texts } = req.body;
  if (systemState.activeUser !== username) {
    return res.status(403).json({ success: false, error: 'Nu ai controlul acum!' });
  }

  if (!Array.isArray(texts) || texts.length !== 3) {
    return res.status(400).json({ success: false, error: 'Date text invalide!' });
  }

  systemState.texts = texts.map(t => String(t).substring(0, 20));
  res.json({ success: true });
});



// { ESP32 }: trimite telemetria (DHT11) și citește noile comenzi (Servo, Fan, Texte LCD) 
app.post('/api/esp/sync', (req, res) => {
  systemState.lastCheckIn = Date.now();

  if (!espConnected) {
    espConnected = true;
    console.log(`${logColors.green}[SYSTEM]${logColors.reset}: ESP s-a ${logColors.green}conectat${logColors.reset} ...`);
  }

  const { temperature, humidity } = req.body;
  
  if (temperature !== undefined) systemState.temperature = Number(temperature);
  if (humidity !== undefined) systemState.humidity = Number(humidity);

  res.json({ 
    angle: systemState.servoAngle,
    fanStatus: systemState.fanStatus,
    fanSpeed: systemState.fanSpeed,
    texts: systemState.texts
  });
});



// Trimite datele telemetrie pt. salvarea locala.
app.post('/api/log-telemetry', (req, res) => {
  const { temperature, humidity } = req.body;

  if (logCounter >= 40)  // din 10 in 10 secunde
  {
    logCounter = 0;

    // Generare fisier "azi"
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const fileName = `${year}-${month}-${day}.json`;
    const filePath = path.join(LOG_DIR, fileName);

    let fileData = [];

    // dacă există deja, incarcă in fileData
    if (fs.existsSync(filePath)) {
      try {
        fileData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      } catch (err) {
        fileData = [];
      }
    }

    // updatează fișierul log
    fileData.push({
      timestamp: now.toLocaleTimeString('ro-RO'),
      temperature: Number(temperature),
      humidity: Number(humidity)
    });

    // salvează
    try {
      fs.writeFileSync(filePath, JSON.stringify(fileData, null, 2));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, error: 'Nu s-au putut salva datele.' });
    }

  } else {
    logCounter += 1; 
    res.json({ success: true, saved: false });
  }

});



// Verificare conexiune ESP32
setInterval(() => {
  const isOnline = (Date.now() - systemState.lastCheckIn) < espCheckTime;

  if (!isOnline && espConnected) {
    espConnected = false;
    systemState.activeUser = null;
    console.log(`${logColors.green}[SYSTEM]${logColors.reset}: ESP s-a ${logColors.red}deconectat${logColors.reset} ...`);
  }
}, 5000);



app.use(express.static(path.join(__dirname, '../frontend')));

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`${logColors.green}[SYSTEM]${logColors.reset}: Server pornit pe portul: ${logColors.cyan}${PORT}${logColors.reset}`);
});