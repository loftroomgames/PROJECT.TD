const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();

const USERS_FILE = path.join(__dirname, 'users.json');
const controlTime = 30;     // [sec]
const espCheckTime = 5000;  // [milisec]


app.use(cors());
app.use(express.json());


// Starile sistemului:
let systemState = {
    servoAngle: 90,
    activeUser: null,  // utilizator in control
    queue: [],
    timeLeft: 0,
    lastCheckIn: 0    // pt. determinare conexiune cu ESP32
};



// Incarcarea utlizatorilor din JSON generat
function getUsers()
{
    if (!fs.existsSync(USERS_FILE)) return [];
    return JSON.parse(fs.readFileSync(USERS_FILE));
}



// Queue manager => 1sec loop
setInterval(() => {
    if (systemState.activeUser) {
        systemState.timeLeft--;
        if (systemState.timeLeft <= 0) {

            if (systemState.queue.length > 0) {
                systemState.activeUser = systemState.queue.shift();
                systemState.timeLeft = controlTime;
            } else {
                systemState.activeUser = null;
                systemState.timeLeft = 0;
            }
			
        }
    } else if (systemState.queue.length > 0) {
        systemState.activeUser = systemState.queue.shift();
        systemState.timeLeft = controlTime;
    }
}, 1000);



// RUTE API ==========================================================================================================
// Inregistrare utilizator
app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
	
	if(!username || !password || !username.trim() || !password.trim()) return res.status(400).json({error: "Câmp gol sau invalid!"});
	
    let users = getUsers();
    if (users.find(u => u.username === username)) return res.status(400).json({ error: "Nume Utilizator Existent!" });
	
    users.push({ username, password });
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    res.json({ success: true });
});



// Logare utilizator
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    let users = getUsers();
	
    const user = users.find(u => u.username === username && u.password === password);
	
    if (!user) return res.status(401).json({ error: "Nume Utilizator sau Parolă invalidă!" });
    res.json({ success: true, username: user.username });
});



// Stergere utilizator
app.post('/api/delete', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password || !username.trim() || !password.trim()) {
        return res.status(400).json({ error: "Câmp gol sau invalid!" });
    }

    let users = getUsers();
    const userIndex = users.findIndex(u => u.username === username && u.password === password);

    if (userIndex === -1) {
        return res.status(401).json({
            error: "Utilizator inexistent sau parolă greșită!"
        });
    }

    users.splice(userIndex, 1);
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    res.json({ success: true, message: "Cont șters cu succes!" });
});



// Ruta pentru butonul "Cere control"
app.post('/api/request-control', (req, res) => {
    const { username } = req.body;
	
    if (systemState.activeUser === username || systemState.queue.includes(username))
	{
        return res.json({ message: "Ești deja în lista de așteptare!" });
    }
	
    systemState.queue.push(username);
    res.json({ success: true });
});



// Trimite date pt. updateStatus()
app.get('/api/status', (req, res) => {
    const isOnline = (Date.now() - systemState.lastCheckIn) < espCheckTime;   // Ultimul GET de la ESP32, pt. verificare conexiune
    
    res.json({
        ...systemState,            // ... = spread operator, despacheteaza systemState
        isConnected: isOnline
    });
});



// Ruta pentru modificarea systemState.servoAngle de catre frontend
app.post('/api/command', (req, res) => {
    const { username, angle } = req.body;
	
    if (systemState.activeUser === username)
	{
        systemState.servoAngle = angle;
        return res.json({ success: true });
    }
	
    res.status(403).json({ error: "Nu ai controlul acum!" });
});



// Ruta pentru ESP32 (citirea unghiului)
app.get('/api/esp/angle', (req, res) => {
    systemState.lastCheckIn = Date.now();
    res.json({ angle: systemState.servoAngle });
});



app.use(express.static(path.join(__dirname, '../frontend')));
app.listen(process.env.PORT || 3000, () => console.log("Server pornit!"));