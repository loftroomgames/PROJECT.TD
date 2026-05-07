const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const app = express();

app.use(cors());
app.use(express.json());

const USERS_FILE = path.join(__dirname, 'users.json');

// Starea sistemului
let systemState = {
    servoAngle: 90,
    activeUser: null, // Email-ul celui care controlează acum
    queue: [],        // Lista de email-uri care așteaptă
    timeLeft: 0
};

// Încărcare utilizatori din JSON
function getUsers() {
    if (!fs.existsSync(USERS_FILE)) return [];
    return JSON.parse(fs.readFileSync(USERS_FILE));
}

// Logică Coadă (Queue) - Se execută la fiecare secundă
setInterval(() => {
    if (systemState.activeUser) {
        systemState.timeLeft--;
        if (systemState.timeLeft <= 0) {
            // Timpul a expirat, trecem la următorul
            if (systemState.queue.length > 0) {
                systemState.activeUser = systemState.queue.shift();
                systemState.timeLeft = 30;
            } else {
                systemState.activeUser = null;
                systemState.timeLeft = 0;
            }
        }
    } else if (systemState.queue.length > 0) {
        // Nu e nimeni la control, dar cineva așteaptă
        systemState.activeUser = systemState.queue.shift();
        systemState.timeLeft = 30;
    }
}, 1000);

// --- RUTE API ---

app.post('/api/register', (req, res) => {
    const { email, password } = req.body;
    let users = getUsers();
    if (users.find(u => u.email === email)) return res.status(400).json({ error: "Utilizator existent" });
    users.push({ email, password });
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    res.json({ success: true });
});

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    let users = getUsers();
    const user = users.find(u => u.email === email && u.password === password);
    if (!user) return res.status(401).json({ error: "Date invalide" });
    res.json({ success: true, email: user.email });
});

app.post('/api/request-control', (req, res) => {
    const { email } = req.body;
    if (systemState.activeUser === email || systemState.queue.includes(email)) {
        return res.json({ message: "Ești deja în listă" });
    }
    systemState.queue.push(email);
    res.json({ success: true });
});

app.get('/api/status', (req, res) => {
    res.json(systemState);
});

app.post('/api/command', (req, res) => {
    const { email, angle } = req.body;
    if (systemState.activeUser === email) {
        systemState.servoAngle = angle;
        return res.json({ success: true });
    }
    res.status(403).json({ error: "Nu ai controlul acum" });
});

// Rută specială pentru ESP32 (doar citește unghiul)
app.get('/api/esp/angle', (req, res) => {
    res.json({ angle: systemState.servoAngle });
});

app.use(express.static(path.join(__dirname, '../frontend')));
app.listen(process.env.PORT || 3000, () => console.log("Server pornit!"));