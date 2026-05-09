let isConnected = false;
let currentUser = localStorage.getItem('userUsername');
let wasActive = false;



// Actualizare ceas din bara
function updateClock()
{
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    document.getElementById('clock').textContent = `${hours}:${minutes}:${seconds}`;
}



// Actualizare grafica pt. conexiunea cu ESP32
function setConnection(status)
{
    isConnected = status;
    const led = document.getElementById('connection-led');
    const text = document.getElementById('status-text');
    const controlButton = document.querySelector('button[onclick*="camera-window"]');

    if(status) {
        led.className = 'indicator-green';
        text.innerText = 'CONECTAT';
        if(controlButton) {
            controlButton.disabled = !currentUser; 
        }
    } else {
        led.className = 'indicator-red';
        text.innerText = 'DECONECTAT';
        if(controlButton) controlButton.disabled = true; 
    }
}



function openWindow(id)
{
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
    updateAuthUI();
    setInterval(updateClock, 1000);
});



// NOT USED YET
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



// Tratare autentificare
async function handleAuth(type) {
    const username = document.getElementById('auth-username').value;
    const password = document.getElementById('auth-pass').value;

    if (type === 'login' && currentUser)
	{
        handleLogoff();
        return;
    }

    const res = await fetch(`/api/${type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });


    const data = await res.json();
    if (!data.success)
	{
        alert(data.error);
        return;
    }


    switch (type) {

        case 'login':
            localStorage.setItem('userUsername', username);
            currentUser = username;
            updateAuthUI();
            closeWindow('login-window');
            break;

        case 'register':
            alert("Înregistrat cu succes!");
            closeWindow('login-window');
            break;

        case 'delete':
            alert("Cont șters cu succes!");
			handleLogoff();
            break;
    }
}



// Tratare log out
function handleLogoff()
{
    localStorage.removeItem('userUsername');
    currentUser = null;
    closeWindow('camera-window');
	closeWindow('login-window');
    updateAuthUI();
}



// Buton "Cere Control"
async function requestControl()
{
    if(!currentUser) return alert("Trebuie să te loghezi!");
	
    await fetch('/api/request-control', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ username: currentUser })
    });
}



// Suprascrie systemState.servoAngle pentru citire
async function sendServoCommand(val)
{
    document.getElementById('angle-val').innerText = val;
	
    await fetch('/api/command', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ username: currentUser, angle: parseInt(val) })
    });
}



// Update interfete conform datelor primite
async function updateStatus()
{
    try {
        const res = await fetch('/api/status');
        const state = await res.json();
        
        // Actualizare status ESP si butonul Control
        setConnection(state.isConnected);

		// KICK: conexiune pierduta cu ESP
        if (!state.isConnected) {
            if (document.getElementById('camera-window').style.display === 'block') {
                alert("Conexiune pierdută [ESP32 Offline]!");
                closeWindow('camera-window');
            }
            wasActive = false;
            return;
        }

        const info = document.getElementById('queue-info');
        const controlArea = document.getElementById('control-area');
        const btnRequest = document.getElementById('btn-request');

		// KICK: timpul a expirat
        if (wasActive && state.activeUser !== currentUser && state.activeUser !== null)
		{
            alert("Timpul tău a expirat!");
            closeWindow('camera-window');
            wasActive = false;
            return;
        }


		// UPDATE: UI Cerere control
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
	
	const loginBtn = document.getElementById('login-btn');
	const registerAccountBtn = document.getElementById('reg-account-btn');
	const deleteAccountBtn = document.getElementById('del-account-btn');
	
	const userField = document.getElementById('auth-username');
	const passField = document.getElementById('auth-pass');

    
    if (currentUser) {
        authStatus.innerText = `🔓: ${currentUser}`;
        authStatus.style.color = "#00ff00";
        controlBtn.disabled = false;
		deleteAccountBtn.disabled = false;
		registerAccountBtn.disabled = true;
		userField.disabled = true;
		passField.disabled = true;
		loginBtn.textContent = "Log out";
        if(logoffBtn) logoffBtn.style.display = "inline-block";
    } else {
        authStatus.innerText = "🔒 Logare necesară";
        authStatus.style.color = "#ff0000";
        controlBtn.disabled = true;
		deleteAccountBtn.disabled = true;
		registerAccountBtn.disabled = false;
		userField.disabled = false;
		passField.disabled = false;
		loginBtn.textContent = "Log in";
        if(logoffBtn) logoffBtn.style.display = "none";
    }
}



updateAuthUI();
setInterval(updateStatus, 1000);
setInterval(updateClock, 1000);