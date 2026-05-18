# 🕹️ Stație IoT [v2.5]

Proiect realizat pentru materia **Transmisia Datelor (TD)** în cadrul **Universității Tehnice din Cluj-Napoca (UTCN)**, Centrul Universitar Satu Mare, secția Automatică și Informatică Aplicată.

Acest proiect reprezintă un sistem IoT complet de tip **Client-Server** distribuit pe 3 niveluri (Hardware ESP32, Backend Node.js, Frontend Web), ce permite monitorizarea climatică în timp real și controlul orientării unui flux de aer printr-un actuator servo.

---

## 🛠️ Arhitectura Sistemului

Proiectul este împărțit în trei componente:
1. **Backend (Server):** Construit în Node.js cu Express. Gestionează autentificarea, managementul concurențial al controlului fizic, starea globală a sistemului și persistența datelor într-un fișier local text JSON.
2. **Frontend (Client Web):** Interfață scrisă în HTML, CSS3 și JavaScript nativ. Dispune de un grafic live de tip osciloscop randat pe un element `HTML5 Canvas` cu un istoric continuu de 64 de puncte.
3. **Hardware (Client ESP32):** Firmware scris în C++ (Arduino framework) pentru microcontrolerul ESP32. Acesta realizează achiziția de date de la senzorul DHT11, controlează un ecran LCD 2004 prin I2C, un buzzer activ pentru alerte și două actuatoare (un servo-motor și un ventilator comandat prin tranzistor în regim PWM).

---

## 📋 9 Caracteristici Specifice ale Produsului IoT

Conform cerințelor din barem, stația IoT este tratată ca o entitate (produs) definită prin exact 10 caracteristici unice stocate și transmise prin obiectele structurate JSON:

1. **`id`**: Identificatorul unic al dispozitivului în rețea (ex: `ESP32`).
2. **`productName`**: Numele/Titlul comercial al stației de control (ex: `IoT Unit`).
3. **`firmwareVersion`**: Versiunea curentă de software rulată pe microcontroler (ex: `v2.5`).
4. **`temperature`**: Valoarea curentă a temperaturii ambientale citită de senzorul DHT11 (°C).
5. **`humidity`**: Valoarea curentă a umidității relative a aerului citită de senzorul DHT11 (%).
6. **`servoAngle`**: Poziția unghiulară curentă a brațului de orientare (0° - 180°).
7. **`fanStatus`**: Starea logică de funcționare a ventilatorului (True = Pornit / False = Oprit).
8. **`fanSpeed`**: Viteza de rotație a ventilatorului controlată prin turație PWM (0% - 100%).
9. **`activeUser`**: Operatorul autentificat care deține în prezent dreptul exclusiv de control.

---

## 💾 Persistența Datelor & Sistemul CRUD

* **Persistența:** Toate datele legate de conturile utilizatorilor (utilizator, parolă, drepturi de admin) sunt salvate local pe server în fișierul text `/backend_data/data.json`.
* **Operațiile CRUD pe Backend:**
  * **CREATE:** Înregistrarea unui cont nou de utilizator cu validare de unicitate (`POST /api/register`).
  * **READ:** Obținerea stării complete a produsului și a telemetriei hardware (`GET /api/status`).
  * **UPDATE:** Modificarea configurărilor administrative ale produsului (`POST /api/product/update`) sau trimiterea de comenzi directe către actuatoare.
  * **DELETE:** Ștergerea definitivă a unui cont de utilizator din baza de date JSON (`POST /api/delete`).

---

## 🔌 Conectare Hardware (Pinout ESP32)

Configurația pinilor utilizată în firmware-ul plăcuței de dezvoltare ESP32 WROOM (30 de pini):

| Componentă Hardware | Tip Pin | Pin ESP32 | Note Tehnice |
| :--- | :--- | :--- | :--- |
| **Servo Motor** | Ieșire PWM | **GPIO 19** | Control unghiular orientare flux de aer |
| **Tranzistor Ventilator** | Ieșire PWM | **GPIO 17** | Comandă viteză prin turație (analogWrite) |
| **Buzzer/Beeper** | Ieșire Digitală | **GPIO 16** | Alerte sonore la recepție date noi |
| **Senzor DHT11** | Intrare Digitală | **GPIO 5** | Alimentat strict la 3.3V |
| **LCD 2004 - SDA** | I2C Data | **GPIO 23** | Remapat software prin `Wire.begin(23, 22)` |
| **LCD 2004 - SCL** | I2C Clock | **GPIO 22** | Alimentare modul I2C la pinul VIN (5V) |
| **LED Status WiFi** | Ieșire Digitală | **GPIO 2** | LED Albastru |
| **LED Status Server** | Ieșire Digitală | **GPIO 4** | LED Verde |

---
