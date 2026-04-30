let isConnected = false;


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
    const buttons = document.querySelectorAll('.control-button');

    if(status) {
        led.className = 'indicator-green';
        text.innerText = 'CONECTAT';
        buttons.forEach(b => b.disabled = false);
    } else {
        led.className = 'indicator-red';
        text.innerText = 'DECONECTAT';
        buttons.forEach(b => b.disabled = true);
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




setInterval(updateClock, 1000);
updateClock();