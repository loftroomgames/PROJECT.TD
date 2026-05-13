const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();

const DATA_FILE = path.join(__dirname, 'backend_data/data.json');


// Detectie ESP OFFLINE
const espCheckTime = 5000; // [ms]

app.use(cors());
app.use(express.json());


// System state
const systemState = {
  servoAngle: 90,
  servoDelay: 150,
  activeUser: null,
  lastCheckIn: 0,
  useFlash: false,
  liveImage: false,
  espCommand: "none",
  espDebugCommand: "none",
  lastImage: null
};



function loadData()
{
  if (!fs.existsSync(DATA_FILE)) {
    return { users: [], espData: { servoDelay: 150, userFlash: false } }; 
    }

    try {

      const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      if(!data.users){ data.users = []; }
      return data;

    } catch (err) {
        return { users: [], espData: {} };
  }
}



function saveData(data)
{
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}



function isBlank(v)
{
  return !v || typeof v !== 'string' || !v.trim();
}



// RUTE API ===========================================================================
// Inregistrare Utilizator
app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  if (isBlank(username) || isBlank(password)) {
    return res.status(400).json({ success: false, error: 'Câmp gol sau invalid!' });
  }

  const data = loadData();

  if (data.users.find(u => u.username === username)) {
    return res.status(400).json({ success: false, error: 'Nume Utilizator Existent!' });
  }

  data.users.push({ username: username.trim(), password: password.trim() });
  saveData(data);

  console.log(`Utilizator inregistrat: ${username}`);
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
  
  console.log(`${username} autentificat!`);
  res.json({ success: true, username: user.username });
});



// Sterge Cont Utilizator
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

  if (systemState.activeUser === username) systemState.activeUser = null;  // elibereaza daca acesta a fost activ;

  console.log(`Utilizator sters: ${username}`);
  res.json({ success: true, message: 'Cont șters cu succes!' });
});



// Cerere control asupra camerei
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



// Eliberare control la părăsirea ferestrei
app.post('/api/control/release', (req, res) => {
  const { username } = req.body;
  if (isBlank(username)) {
    return res.status(400).json({ success: false, error: 'Utilizator invalid!' });
  }

  if (systemState.activeUser !== username) {
    return res.status(403).json({ success: false, error: 'Nu ai controlul acum!' });
  }

  systemState.activeUser = null;

  console.log(`Utilizatorul ${username} a fost elibarat de la control!`);
  res.json({ success: true });
});



// Frontend polls status
app.get('/api/status', (req, res) => {
  const isOnline = (Date.now() - systemState.lastCheckIn) < espCheckTime;  // verificare comunicare ESP

  res.json({
    servoAngle: systemState.servoAngle,
    activeUser: systemState.activeUser,
    isConnected: isOnline
  });
});



// Primire unghi servo de la frontend
app.post('/api/command', (req, res) => {
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



// ESP citeste ultimul unghi scris + update lastCheck in
app.get('/api/esp/angle', (req, res) => {
  systemState.lastCheckIn = Date.now();
  
  res.json({ 
    angle: systemState.servoAngle,
    command: systemState.espCommand 
  });
});



// Rută nouă: Comandă de Shot de la Frontend
app.post('/api/command/shot', (req, res) => {
  if (systemState.activeUser !== req.body.username) {
    return res.status(403).json({ success: false, error: 'Nu ai controlul!' });
  }
  systemState.espCommand = "capture"; // Setăm flag-ul pentru ESP32
  res.json({ success: true });
});



// Rută nouă: ESP32 trimite imaginea (Binary POST)
app.post('/api/esp/upload', express.raw({ type: 'image/jpeg', limit: '100kb' }), (req, res) => {
  systemState.lastImage = req.body; // Salvăm buffer-ul imaginii
  systemState.espCommand = "none";  // Resetăm comanda
  console.log("Imagine primită de la ESP32");
  res.send("OK");
});



// Rută nouă: Frontend-ul cere ultima imagine
app.get('/api/camera/last', (req, res) => {
  if (!systemState.lastImage) return res.status(404).send("No image");
  res.set('Content-Type', 'image/jpeg');
  res.send(systemState.lastImage);
});



app.use(express.static(path.join(__dirname, '../frontend')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server pornit pe portul ${PORT}!`));