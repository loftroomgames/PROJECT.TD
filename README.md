##  PROJECT.TransmisiaDatelor - Siket Jozsef Attila
## 📌 Descriere

Acest proiect reprezintă o platformă web pentru **controlul la distanță al unui servo motor conectat la un ESP32**, utilizând un server Node.js ca element central de comunicare între utilizatori și dispozitivul embedded.

Aplicația permite **autentificarea și înregistrarea utilizatorilor**, implementând un sistem de **coadă (queue)** care asigură acces exclusiv la control pentru un singur utilizator la un moment dat. Controlul este limitat în timp (30 de secunde), după care este transferat automat următorului utilizator din coadă sau eliberat dacă nu există cereri active.

ESP32 rulează un firmware dedicat care:
- se conectează la o rețea WiFi,
- verifică periodic starea serverului,
- preia comenzile sub formă de date JSON,
- și poziționează servo‑ul în timp real.
Statusul conexiunii WiFi și al serverului este semnalizat prin LED‑uri dedicate.

Interfața web oferă un panou de control, cu indicatori pentru:
- starea conexiunii ESP32,
- utilizatorul aflat la control,
- timpul rămas,
- și poziția curentă a servo‑ului.

🔮 **Dezvoltări viitoare:**  
În versiunile următoare ale proiectului este planificată **integrarea unei camere OV7670**, care va permite **captură de imagini** direct de pe dispozitivul ESP32, extinzând aplicația cu funcționalități de monitorizare vizuală.
