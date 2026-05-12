const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');



const app = express();
const USERS_FILE = path.join(__dirname, 'users.json');

// ESP online detection
const espCheckTime = 5000; // [ms]

app.use(cors());
app.use(express.json());

// System state
const systemState = {
  servoAngle: 90,
  activeUser: null,      // user currently in control
  lastCheckIn: 0         // updated when ESP polls
};

function readUsers() {
  if (!fs.existsSync(USERS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function isBlank(v) {
  return !v || typeof v !== 'string' || !v.trim();
}

// ========================= API ROUTES =========================

// Register
app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  if (isBlank(username) || isBlank(password)) {
    return res.status(400).json({ success: false, error: 'Câmp gol sau invalid!' });
  }

  const users = readUsers();
  if (users.find(u => u.username === username)) {
    return res.status(400).json({ success: false, error: 'Nume Utilizator Existent!' });
  }

  users.push({ username: username.trim(), password: password.trim() });
  writeUsers(users);
  res.json({ success: true });
});

// Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (isBlank(username) || isBlank(password)) {
    return res.status(400).json({ success: false, error: 'Câmp gol sau invalid!' });
  }

  const users = readUsers();
  const user = users.find(u => u.username === username && u.password === password);
  if (!user) {
    return res.status(401).json({ success: false, error: 'Nume Utilizator sau Parolă invalidă!' });
  }

  res.json({ success: true, username: user.username });
});

// Delete account
app.post('/api/delete', (req, res) => {
  const { username, password } = req.body;
  if (isBlank(username) || isBlank(password)) {
    return res.status(400).json({ success: false, error: 'Câmp gol sau invalid!' });
  }

  const users = readUsers();
  const idx = users.findIndex(u => u.username === username && u.password === password);
  if (idx === -1) {
    return res.status(401).json({ success: false, error: 'Utilizator inexistent sau parolă greșită!' });
  }

  users.splice(idx, 1);
  writeUsers(users);

  // If the deleted user had control, release it.
  if (systemState.activeUser === username) systemState.activeUser = null;

  res.json({ success: true, message: 'Cont șters cu succes!' });
});



// Acquire control when opening the control window
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
  res.json({ success: true, activeUser: systemState.activeUser });
});

// Release control when leaving the control window
app.post('/api/control/release', (req, res) => {
  const { username } = req.body;
  if (isBlank(username)) {
    return res.status(400).json({ success: false, error: 'Utilizator invalid!' });
  }

  if (systemState.activeUser !== username) {
    return res.status(403).json({ success: false, error: 'Nu ai controlul acum!' });
  }

  systemState.activeUser = null;
  res.json({ success: true });
});

// Frontend polls status
app.get('/api/status', (req, res) => {
  const isOnline = (Date.now() - systemState.lastCheckIn) < espCheckTime;
  res.json({
    servoAngle: systemState.servoAngle,
    activeUser: systemState.activeUser,
    isConnected: isOnline
  });
});

// Frontend sends servo angle (only activeUser)
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

// ESP32 polls for the current angle (also updates lastCheckIn)
app.get('/api/esp/angle', (req, res) => {
  systemState.lastCheckIn = Date.now();
  res.json({ angle: systemState.servoAngle });
});

// Static frontend
app.use(express.static(path.join(__dirname, '../frontend')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server pornit pe portul ${PORT}!`));
