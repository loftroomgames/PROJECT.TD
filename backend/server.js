const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const DATA_FILE = path.join(__dirname, 'backend_data/data.json');

// Detecție ESP OFFLINE
const espCheckTime = 5000; // [ms]

app.use(cors());
app.use(express.json());


function isBlank(v) { return !v || typeof v !== 'string' || !v.trim(); }


// Statusuri System
const systemState = {
  lastCheckIn: 0,
  servoAngle: 90,
  temperature: 0,
  humidity: 0,
  fanStatus: false,
  texts: [" - ", " - ", " - "],
  activeUser: null
};


// LOAD data
function loadData()
{
  if (!fs.existsSync(DATA_FILE)) {
    return { users: [], espData: { servoDelay: 150, texts: [" - ", " - ", " - "]} }; 
  }

  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    if (!data.users){ data.users = []; }

    return data;
  } catch (err) {
    return { users: [], espData: {} };
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

  console.log(`Utilizator înregistrat cu SUCCES: ${username}`);
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

  console.log(`${username} autentificat cu SUCCES!`);
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

  console.log(`Utilizator șters cu SUCCES: ${username}`);
  res.json({ success: true, message: 'Cont șters cu succes!' });
});



// Verificare ADMIN
app.post('/api/admincheck', (req, res) => {
  console.log('Checking ADMIN ... ');
  
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

  console.log(`${username} a primit controlul`);
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

  console.log(`Utilizatorul ${username} a fost eliberat de la control!`);
  res.json({ success: true });
});



// Achizitie date FRONTEND
app.get('/api/status', (req, res) => {
  const isOnline = (Date.now() - systemState.lastCheckIn) < espCheckTime;
  res.json({
    servoAngle: systemState.servoAngle,
    activeUser: systemState.activeUser,
    isConnected: isOnline,
    temperature: systemState.temperature,
    humidity: systemState.humidity,
    fanStatus: systemState.fanStatus,
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



// Comandă actualizare linii text LCD 2004
app.post('/api/command/lcd', (req, res) => {
  const { username, texts } = req.body;
  if (systemState.activeUser !== username) {
    return res.status(403).json({ success: false, error: 'Nu ai controlul acum!' });
  }

  if (!Array.isArray(texts) || texts.length !== 3) {
    return res.status(400).json({ success: false, error: 'Date text invalide!' });
  }

  systemState.texts = texts.map(t => String(t).substring(0, 17));
  res.json({ success: true });
});



// ESP32 trimite telemetria (DHT11) și citește noile comenzi (Servo, Fan, Texte LCD)
app.post('/api/esp/sync', (req, res) => {
  systemState.lastCheckIn = Date.now();
  const { temperature, humidity } = req.body;
  
  if (temperature !== undefined) systemState.temperature = Number(temperature);
  if (humidity !== undefined) systemState.humidity = Number(humidity);

  res.json({ 
    angle: systemState.servoAngle,
    fanStatus: systemState.fanStatus,
    texts: systemState.texts
  });
});


app.use(express.static(path.join(__dirname, '../frontend')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server pornit pe portul ${PORT}!`));