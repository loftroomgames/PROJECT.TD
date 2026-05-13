let currentUser = localStorage.getItem('userUsername');
let isConnected = false;
let activeUser = null;

function $(id) { return document.getElementById(id); }



// Update Ceas
function updateClock() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const clock = $('clock');
  if (clock) clock.textContent = `${hours}:${minutes}:${seconds}`;
}



// Update ESP connection UI + button availability
function setConnection(status)
{
  isConnected = !!status;

  const led = $('connection-led');
  const text = $('status-text');
  if (led) led.className = isConnected ? 'indicator-green' : 'indicator-red';
  if (text) text.innerText = isConnected ? 'CONECTAT' : 'DECONECTAT';

  updateControlButton();
}



function updateControlButton()
{
  const controlBtn = $('main-control-btn');
  if (!controlBtn) return;

  // Enabled when:
  // - logged in
  // - ESP connected
  // - nobody is in control OR you are already the active user
  const allowed = !!currentUser && isConnected && (!activeUser || activeUser === currentUser);
  controlBtn.disabled = !allowed;

  // Optional: show who is in control on the button label
  if (!currentUser) {
    controlBtn.textContent = '🕹️ Control';
  } else if (activeUser && activeUser !== currentUser) {
    controlBtn.textContent = `🔒 La control: ${activeUser}`;
  } else {
    controlBtn.textContent = '🕹️ Control';
  }
}



// Window helpers (use classes; keep compatibility with your existing HTML)
function openWindow(id)
{
  const target = $(id);
  const welcome = $('welcome-window');
  if (target) target.style.display = 'flex';
  if (welcome) welcome.style.display = 'none';
}



async function closeWindow(id)
{
  // If leaving the control window, release control.
  if (id === 'camera-window') {
    await releaseControl();
  }

  const target = $(id);
  const welcome = $('welcome-window');
  if (target) target.style.display = 'none';
  if (welcome) welcome.style.display = 'flex';
}



// Acquire control when trying to open the control window
async function openControl()
{
  if (!currentUser) {
    alert('Trebuie să te loghezi!');
    return;
  }
  if (!isConnected) {
    alert('ESP32 nu este conectat.');
    return;
  }

  try {
    const res = await fetch('/api/control/acquire', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: currentUser })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      activeUser = data.activeUser || activeUser;
      updateControlButton();
      alert(data.error || 'Nu poți prelua controlul acum!');
      return;
    }

    activeUser = data.activeUser;
    updateControlButton();
    openWindow('camera-window');
  } catch (e) {
    console.error(e);
    alert('Eroare de rețea.');
  }
}



async function releaseControl()
{
  if (!currentUser) return;
  if (activeUser !== currentUser) return;

  try {
    await fetch('/api/control/release', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: currentUser }),
      keepalive: true
    });
  } catch {
    //
  } finally {
    activeUser = null;
    updateControlButton();
  }
}



// Trimite unghiul la backend
async function sendServoCommand(val)
{
  const angle = parseInt(val, 10);
  const angleLabel = $('angle-val');

  if (angleLabel) angleLabel.innerText = String(angle);

  try {
    const res = await fetch('/api/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: currentUser, angle })
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Comandă respinsă.');
    }
  } catch (e) {
    console.error(e);
  }
}



// Poll status (updates connection + activeUser)
async function updateStatus()
{
  try {
    const res = await fetch('/api/status');
    const state = await res.json();

    activeUser = state.activeUser;
    setConnection(state.isConnected);
  } catch {
    activeUser = null;
    setConnection(false);
  }
}



// Update UI autentificare
function updateAuthUI()
{
  const authStatus = $('auth-status');

  const loginBtn = $('login-btn');
  const registerBtn = $('reg-account-btn');
  const deleteBtn = $('del-account-btn');
  const userField = $('auth-username');
  const passField = $('auth-pass');

  if (currentUser) {
    if (authStatus) {
      authStatus.innerText = `🔓: ${currentUser}`;
      authStatus.style.color = '#00ff00';
    }

    if (deleteBtn) deleteBtn.disabled = false;
    if (registerBtn) registerBtn.disabled = true;
    if (userField) userField.disabled = true;
    if (passField) passField.disabled = true;
    if (loginBtn) loginBtn.textContent = 'Log out';
  } else {
    if (authStatus) {
      authStatus.innerText = '🔒 Logare necesară';
      authStatus.style.color = '#ff0000';
    }

    if (deleteBtn) deleteBtn.disabled = true;
    if (registerBtn) registerBtn.disabled = false;
    if (userField) userField.disabled = false;
    if (passField) passField.disabled = false;
    if (loginBtn) loginBtn.textContent = 'Login';
  }

  updateControlButton();
}



// Tratare autentificari
async function handleAuth(type)
{
  const username = $('auth-username')?.value?.trim() ?? '';
  const password = $('auth-pass')?.value ?? '';


  if (type === 'login' && currentUser) {
    await handleLogoff();
    return;
  }

  if (!username || (!password && type !== 'delete')) {
    alert('Completează utilizatorul și parola.');
    return;
  }

  try {
    const res = await fetch(`/api/${type}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      alert(data.error || 'Eroare.');
      return;
    }

    if (type === 'login') {
      localStorage.setItem('userUsername', username);
      currentUser = username;
      updateAuthUI();
      closeWindow('login-window');
    } else if (type === 'register') {
      alert('Înregistrat cu succes!');
      closeWindow('login-window');
    } else if (type === 'delete') {
      alert('Cont șters cu succes!');
      await handleLogoff();
    }
  } catch (e) {
    console.error(e);
    alert('Eroare de rețea.');
  }
}



async function handleLogoff()
{
  // If user had control, release it.
  await releaseControl();

  localStorage.removeItem('userUsername');
  currentUser = null;
  updateAuthUI();

  await closeWindow('camera-window');
  await closeWindow('login-window');
}



// Eliberare control la ichiderea ferestrei
window.addEventListener('beforeunload', () => {
  if (currentUser && activeUser === currentUser) {
    navigator.sendBeacon?.('/api/control/release', new Blob([
      JSON.stringify({ username: currentUser })
    ], { type: 'application/json' }));
  }
});



async function takeShot()
{
  try {
    const res = await fetch('/api/command/shot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: currentUser })
    });
    
    if (res.ok) {
        alert("Comandă trimisă! Așteaptă procesarea...");
        // Pornim un mic delay apoi reîmprospătăm imaginea
        setTimeout(refreshImage, 2000); 
    }
  } catch (e) { console.error(e); }
}



function refreshImage()
{
    const img = $('last-shot');
    const placeholder = $('no-signal');
    
    // Adăugăm un timestamp la URL pentru a evita cache-ul browserului
    img.src = '/api/camera/last?t=' + Date.now();
    img.style.display = 'block';
    if (placeholder) placeholder.style.display = 'none';
}



document.addEventListener('DOMContentLoaded', () => {
  updateClock();
  updateAuthUI();
  updateStatus();

  setInterval(updateClock, 1000);
  setInterval(updateStatus, 1000);
});
