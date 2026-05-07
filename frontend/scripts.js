let isConnected = false;
let currentUser = localStorage.getItem('userUsername');
let wasActive = false;


function updateClock()
{
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    document.getElementById('clock').textContent = `${hours}:${minutes}:${seconds}`;
}


function setConnection(status)
{
    isConnected = status;
    const led = document.getElementById('connection-led');
    const text = document.getElementById('status-text');
    

    const controlButton = document.querySelector('button[onclick*="camera-window"]');
    const requestButton = document.getElementById('btn-request');

    if(status) {
        led.className = 'indicator-green';
        text.innerText = 'CONECTAT';
        if(controlButton) controlButton.disabled = false;
    } else {
        led.className = 'indicator-red';
        text.innerText = 'DECONECTAT';
        if(controlButton) controlButton.disabled = true; 
    }
}


function openWindow(id)
{
    //if(!isConnected) return;
    document.getElementById(id).style.display = 'block';
    document.getElementById("welcome-window").style.display = 'none';
}


function closeWindow(id)
{
    document.getElementById(id).style.display = 'none';
    document.getElementById("welcome-window").style.display = 'flex';
}



document.addEventListener('DOMContentLoaded', () => {
    updateClock();
    updateAuthUI(); // <--- Verificăm starea la pornire
    setInterval(updateClock, 1000);
});


async function checkCameraStatus() {
    try {
        const response = await fetch('/api/status');
        if (!response.ok) throw new Error("Server negăsit");
        
        const data = await response.json();
        console.log("Date primite de la server:", data);
        
        setConnection(data.isConnected);
    } catch (error) {
        console.error("Eroare la Fetch:", error);
        setConnection(false);

        alert("S-a pierdut conexiunea cu ESP32!");
        closeWindow('camera-window');
        closeWindow('login-window');
    }
}


async function handleAuth(type)
{
    const username = document.getElementById('auth-username').value;
    const password = document.getElementById('auth-pass').value;

    const res = await fetch(`/api/${type}`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    if(data.success) {
        if(type === 'login') {
            localStorage.setItem('userUsername', username);
            currentUser = username;
            updateAuthUI();
            alert("Logat cu succes!");
            closeWindow('login-window');
        } else alert("Înregistrat!");
    } else alert(data.error);
}


function handleLogoff()
{
    localStorage.removeItem('userUsername');
    currentUser = null;
    updateAuthUI();
    closeWindow('camera-window');
    alert("Te-ai delogat!");
}


async function requestControl()
{
    if(!currentUser) return alert("Trebuie să te loghezi!");
    await fetch('/api/request-control', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ username: currentUser })
    });
}



async function sendServoCommand(val)
{
    document.getElementById('angle-val').innerText = val;
    await fetch('/api/command', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ username: currentUser, angle: parseInt(val) }) 
    });
}


async function updateStatus() {
    try {
        const res = await fetch('/api/status');
        const state = await res.json();
        
        // Actualizăm LED-ul și butonul de pe ecranul principal
        setConnection(state.isConnected);

        // --- LOGICA DE KICK-OUT (Dacă se pierde ESP-ul) ---
        if (!state.isConnected) {
            if (document.getElementById('camera-window').style.display === 'block') {
                alert("Conexiune pierdută (ESP32 Offline)!");
                closeWindow('camera-window');
            }
            wasActive = false;
            return; // Oprim execuția restului funcției dacă nu avem conexiune
        }

        const info = document.getElementById('queue-info');
        const controlArea = document.getElementById('control-area');
        const btnRequest = document.getElementById('btn-request');

        // --- LOGICA DE KICK-OUT (Dacă expiră timpul) ---
        if (wasActive && state.activeUser !== currentUser) {
            alert("Timpul tău a expirat!");
            closeWindow('camera-window');
            wasActive = false;
            return;
        }

        // Gestionare interfață Control
        if (state.activeUser === currentUser) {
            wasActive = true;
            info.innerText = "EȘTI LA CONTROL!";
            controlArea.style.display = 'block';
            btnRequest.style.display = 'none';
            document.getElementById('timer-display').innerText = `Timp rămas: ${state.timeLeft}s`;
        } else {
            wasActive = false;
            controlArea.style.display = 'none';
            btnRequest.style.display = 'block';
            if(state.activeUser) {
                info.innerText = `La control: ${state.activeUser}. În coadă: ${state.queue.length}`;
            } else {
                info.innerText = "Sistem liber. Cere controlul!";
            }
        }
    } catch (e) {
        setConnection(false);
    }
}



function updateAuthUI()
{
    const authStatus = document.getElementById('auth-status');
    const controlBtn = document.getElementById('main-control-btn');
    const logoffBtn = document.getElementById('logoff-btn');
    
    if (currentUser) {
        authStatus.innerText = `Utilizator: ${currentUser}`;
        authStatus.style.color = "#00ff00";
        controlBtn.disabled = false;
        if(logoffBtn) logoffBtn.style.display = "inline-block"; // Arată Logoff
    } else {
        authStatus.innerText = "Logare necesară";
        authStatus.style.color = "red";
        controlBtn.disabled = true;
        if(logoffBtn) logoffBtn.style.display = "none"; // Ascunde Logoff
    }
}



updateAuthUI();
setInterval(updateStatus, 1000);
setInterval(updateClock, 1000);
