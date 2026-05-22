let currentUser = localStorage.getItem('userUsername');
let isConnected = false;
let activeUser = null;

// Probe din sensorul DHT11
let dateDHT11 = [];


// Metode ajutatoare
function $(id) { return document.getElementById(id); }

function openWindow(id)
{
  const target = $(id);
  const welcome = $('welcome-window');
  if (target) target.style.display = 'flex';
  if (welcome) welcome.style.display = 'none';
}

async function closeWindow(id)
{
  if (id === 'control-window') {
    await releaseControl();
  }
  const target = $(id);
  const welcome = $('welcome-window');
  if (target) target.style.display = 'none';
  if (welcome) welcome.style.display = 'flex';
}



// Update Ceas
function updateClock()
{
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const clock = $('clock');
  if (clock) clock.textContent = `${hours}:${minutes}:${seconds}`;
}



// Update UI conexiune ESP32 + gestionare butone
function setConnection(status)
{
  isConnected = !!status;
  const led = $('connection-led');
  const text = $('status-text');
  if (led) led.className = isConnected ? 'indicator-green' : 'indicator-red';
  if (text) text.innerText = isConnected ? 'CONECTAT' : 'DECONECTAT';
  updateControlButton();
}



// Actualizare butonul Control din MAIN MENU
function updateControlButton()
{
  const controlBtn = $('main-control-btn');
  if (!controlBtn) return;

  const allowed = !!currentUser && isConnected && (!activeUser || activeUser === currentUser);
  controlBtn.disabled = !allowed;

  if (!currentUser) {
    controlBtn.textContent = '🕹️ Control Panel';
  } else if (activeUser && activeUser !== currentUser) {
    controlBtn.textContent = `🔒 La control: ${activeUser}`;
  } else {
    controlBtn.textContent = '🕹️ Control Panel';
  }
}



// Cerere pentru control
async function openControl()
{
  if (!currentUser) { alert('Trebuie să te loghezi!'); return; }
  if (!isConnected) { alert('ESP32 nu este conectat.'); return; }

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
    openWindow('control-window');
  } catch (e) {
    console.error(e);
    alert('Eroare de rețea.');
  }
}



// Eliberare de la control
async function releaseControl()
{
  if (!currentUser || activeUser !== currentUser) return;
  try {
    await fetch('/api/control/release', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: currentUser }),
      keepalive: true
    });
  } catch {
    // ignorat
  } finally {
    activeUser = null;
    updateControlButton();
  }
}



// Trimite unghiul la BACKEND
async function sendServoCommand(val)
{
  const angle = parseInt(val, 10);
  const angleLabel = $('angle-val');
  if (angleLabel) { angleLabel.innerText = String(angle); }

  try {
    const res = await fetch('/api/command/servo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: currentUser, angle })
    });
    const data = await res.json();
    if (!res.ok) alert(data.error || 'Comandă respinsă.');
  } catch (e) { console.error(e); }
}



// Trimite comanda de delay la BACKEND
async function sendServoDelayFromInput()
{
  const inputField = $('servoDelayInput');
  if (!inputField) return;

  const delay = parseInt(inputField.value, 10);

  // Validare direct în Frontend
  if (isNaN(delay) || delay < 0 || delay > 100) {
    alert('Eroare: Valoarea delay-ului trebuie să fie un număr între 0 și 100 ms!');
    return;
  }

  try {
    const res = await fetch('/api/command/servo/delay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: currentUser, delay })
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Comandă delay respinsă.');
    }
  } catch (e) { 
    console.error(e); 
    alert('Eroare de rețea la setarea delay-ului.');
  }
}



// Trimite viteza ventilator la backend
async function sendFanSpeedCommand(val)
{
  const speed = parseInt(val, 10);
  const speedLabel = $('fan-speed-val');

  if (speedLabel) { speedLabel.innerText = String(speed); }

  try {
    const res = await fetch('/api/command/fan/speed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: currentUser, speed })
    });
    const data = await res.json();
    if (!res.ok) alert(data.error || 'Comandă viteză respinsă.');
  } catch (e) { console.error(e); }
}



// Trimite stare ventilator la backend
async function sendFanCommand(status) {
  try {
    const res = await fetch('/api/command/fan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: currentUser, fanStatus: status })
    });
    const data = await res.json();
    if (!res.ok) alert(data.error || 'Comandă ventilator respinsă.');
  } catch (e) { console.error(e); }
}



// Trimitere liniile text la backend pt. LCD 2004
async function updateLcdText()
{
  const l1 = $('lcd-line-1')?.value || '.';
  const l2 = $('lcd-line-2')?.value || '.';
  const l3 = $('lcd-line-3')?.value || '.';

  try {
    const res = await fetch('/api/command/lcd', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: currentUser, texts: [l1, l2, l3] })
    });
    const data = await res.json();
    if (res.ok && data.success) {
    } else {
      alert(data.error || 'Eroare la actualizarea textului.');
    }
  } catch (e) { console.error(e); }
}

async function clearLcdText()
{
  // Golește casetele de text din interfață
  if ($('lcd-line-1')) $('lcd-line-1').value = '';
  if ($('lcd-line-2')) $('lcd-line-2').value = '';
  if ($('lcd-line-3')) $('lcd-line-3').value = '';

  // Trimite comanda de golire direct la backend pentru a sincroniza ESP32
  try {
    const res = await fetch('/api/command/lcd', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: currentUser, texts: ["", "", ""] })
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Eroare la ștergerea textului de pe LCD.');
    }
  } catch (e) { 
    console.error(e); 
  }
}



// Achizitie status & actualizare grafic
// Înlocuiește complet funcția updateStatus() cu aceasta:
async function updateStatus()
{
  try {
    const res = await fetch('/api/status');
    const state = await res.json();

    activeUser = state.activeUser;
    setConnection(state.isConnected);

    if (state.isConnected) {
      if ($('val-temp')) $('val-temp').innerText = state.temperature;
      if ($('val-hum')) $('val-hum').innerText = state.humidity;

      if ($('fanToggle') && document.activeElement !== $('fanToggle')) {
        $('fanToggle').checked = state.fanStatus;
      }

      if ($('fanSpeedSlider') && document.activeElement !== $('fanSpeedSlider')) {
        $('fanSpeedSlider').value = state.fanSpeed;
        if ($('fan-speed-val')) $('fan-speed-val').innerText = state.fanSpeed;
      }

      if ($('servoDelayInput') && document.activeElement !== $('servoDelayInput')) {
        $('servoDelayInput').value = state.servoDelay;
      }

      if ($('fanLabel')) {
        if (state.fanSpeed >= 90 && !state.fanStatus) {
          $('fanLabel').innerText = "⚠️ Pornire Ventilator [Risc suprasolicitare sistem!]";
        } else {
          $('fanLabel').innerText = "Ⓜ️ Pornire Ventilator"; 
        }
      }
      
      pushTelemetryData(state.temperature, state.humidity);
      drawLiveChart();

      if ($('saveToggle') && $('saveToggle').checked) {
        saveTelemetryToFile(state.temperature, state.humidity);
      }

    } else {
      if ($('control-window') && $('control-window').style.display === 'flex') {
        alert('Conexiunea cu ESP32 a fost pierdută!');
        await closeWindow('control-window');
      }
    }
  } catch {
    activeUser = null;
    setConnection(false);
    
    if ($('control-window') && $('control-window').style.display === 'flex') {
      alert('Eroare de rețea!');
      await closeWindow('control-window');
    }
  }
}



// Salveaza telemetria local
async function saveTelemetryToFile(temperature, humidity)
{
  try {
    await fetch('/api/log-telemetry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ temperature, humidity })
    });
  } catch (e) {
    console.error('Eroare la transmiterea logurilor:', e);
  }
}



// Incarca punctele citite din sensor DHT11 in vector
function pushTelemetryData(temp, hum)
{
  dateDHT11.push({ temp, hum });

  if (dateDHT11.length > 64) {
    dateDHT11.shift(); 
  }
}



// GRAFIC Temperatura / Umiditate
function drawLiveChart()
{
  // FUNDAL
  const canvas = $('live-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, w, h);

  // GRID
  ctx.strokeStyle = '#333333';
  ctx.lineWidth = 1;
  for (let i = 20; i < w; i += 40) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, h); ctx.stroke();
  }
  for (let j = 20; j < h; j += 20) {
    ctx.beginPath(); ctx.moveTo(0, j); ctx.lineTo(w, j); ctx.stroke();
  }

  if (dateDHT11.length < 2) {
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px "Cascadia Code", monospace';
    ctx.fillText("Se colectează date minime pentru generare grafic...", 20, h / 2);
    return;
  }

  const stepX = w / (dateDHT11.length - 1 || 1);

  function getY(val, min, max)
  {
    let v = Math.max(min, Math.min(max, val));
    let procent = (v - min) / (max - min);
    return h - 15 - (procent * (h - 30));
  }

  // Linie TEMPERATURA
  ctx.strokeStyle = '#ff0000';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < dateDHT11.length; i++) {
    let x = i * stepX;
    let y = getY(dateDHT11[i].temp, 10, 30);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Linie UMIDITATE
  ctx.strokeStyle = '#00ff00';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < dateDHT11.length; i++) {
    let x = i * stepX;
    let y = getY(dateDHT11[i].hum, 50, 100); // <-- Pasăm min: 20, max: 85
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Legenda grafic
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(5, 5, 260, 25);
  ctx.font = '11px "Cascadia Code", Arial';
  ctx.fillStyle = '#ff0000';
  ctx.fillText("■ Temp (10-30°C)", 10, 22);
  ctx.fillStyle = '#00ff00';
  ctx.fillText("■ Umiditate (50-100%)", 130, 22);
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
  const fanToggle = $('fanToggle');

  if (currentUser) {
    if (authStatus) { authStatus.innerText = `🔓: ${currentUser}`; authStatus.style.color = '#00ff00'; }
    if (registerBtn) registerBtn.disabled = true;
    if (userField) userField.disabled = true;
    if (passField) passField.disabled = true;
    if (loginBtn) loginBtn.textContent = 'Log out';
    if (deleteBtn) deleteBtn.disabled = (currentUser === "Administrator") ? true : false;
  } else {
    if (authStatus) { authStatus.innerText = '🔒 Logare necesară'; authStatus.style.color = '#ff0000'; }
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

  if (type === 'login' && currentUser) { await handleLogoff(); return; }
  if (!username || (!password && type !== 'delete')) { alert('Completează utilizatorul și parola.'); return; }

  try {
    const res = await fetch(`/api/${type}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    if (!res.ok || !data.success) { alert(data.error || 'Eroare.'); return; }

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
  } catch (e) { console.error(e); alert('Eroare de rețea.'); }
}



async function handleLogoff()
{
  await releaseControl();
  localStorage.removeItem('userUsername');
  currentUser = null;
  updateAuthUI();
  await closeWindow('control-window');
  await closeWindow('login-window');
}


async function isAdmin(username)
{
  const res = await fetch(`/api/admincheck`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username })
  });

  const result = await res.json();
  if (!res.ok || !result.success) { alert(result.error || 'Eroare.'); return; }

  return result.isAdmin;
}



window.addEventListener('beforeunload', () => {
  if (currentUser && activeUser === currentUser) {
    navigator.sendBeacon?.('/api/control/release', new Blob([
      JSON.stringify({ username: currentUser })
    ], { type: 'application/json' }));
  }
});


document.addEventListener('DOMContentLoaded', () => {
  localStorage.removeItem('userUsername');
  currentUser = null;

  updateClock();
  updateAuthUI();
  updateStatus();
  setInterval(updateClock, 1000);
  setInterval(updateStatus, 250);
});