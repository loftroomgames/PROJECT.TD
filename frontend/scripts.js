let isConnected = false;
let currentUser = localStorage.getItem('userEmail');
let wasActive = false;


function updateClock()
{
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    document.getElementById('clock').textContent = `${hours}:${minutes}:${seconds}`;
}


function setConnection(status) {
    isConnected = status;
    const led = document.getElementById('connection-led');
    const text = document.getElementById('status-text');
    

    const guestButton = document.querySelector('button[onclick*="camera-window"]');
    const requestButton = document.getElementById('btn-request');

    if(status) {
        led.className = 'indicator-green';
        text.innerText = 'CONECTAT';
        if(guestButton) guestButton.disabled = false;
    } else {
        led.className = 'indicator-red';
        text.innerText = 'DECONECTAT';
        // Opțional: poți lăsa Guest activ să vadă coada, dar blocăm controlul
        // if(guestButton) guestButton.disabled = true; 
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
    }
}


async function handleAuth(type) {
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-pass').value;
    const res = await fetch(`/api/${type}`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if(data.success) {
        if(type === 'login') {
            localStorage.setItem('userEmail', email);
            currentUser = email;
            updateAuthUI(); // <--- Adăugat
            alert("Logat cu succes!");
            closeWindow('login-window');
        } else alert("Înregistrat!");
    } else alert(data.error);
}


async function requestControl() {
    if(!currentUser) return alert("Trebuie să te loghezi!");
    await fetch('/api/request-control', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ email: currentUser })
    });
}


async function sendServoCommand(val) {
    document.getElementById('angle-val').innerText = val;
    await fetch('/api/command', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ email: currentUser, angle: parseInt(val) })
    });
}


async function updateStatus() {
    const res = await fetch('/api/status');
    const state = await res.json();
    
    setConnection(state.isConnected);

    const info = document.getElementById('queue-info');
    const controlArea = document.getElementById('control-area');
    const btnRequest = document.getElementById('btn-request');

    // LOGICA DE EXPULZARE
    // Dacă am fost activ și acum nu mai sunt (timpul a expirat)
    if (wasActive && state.activeUser !== currentUser) {
        alert("Timpul tău a expirat!");
        closeWindow('camera-window');
        wasActive = false;
        return;
    }

    if (state.activeUser === currentUser) {
        wasActive = true; // Suntem la control
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
}


// Funcție pentru a actualiza interfața în funcție de login
function updateAuthUI() {
    const authStatus = document.getElementById('auth-status');
    const controlBtn = document.getElementById('main-control-btn');
    
    if (currentUser) {
        authStatus.innerText = `Utilizator: ${currentUser}`;
        authStatus.style.color = "#00ff00"; // Verde pentru logat
        controlBtn.disabled = false;
    } else {
        authStatus.innerText = "Oaspete (Logare necesară)";
        authStatus.style.color = "white";
        controlBtn.disabled = true;
    }
}


updateClock();
checkCameraStatus();
setInterval(updateStatus, 1000);
setInterval(updateClock, 1000);
