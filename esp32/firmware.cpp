#include <WiFi.h>
#include <HTTPClient.h>
#include <ESP32Servo.h>
#include <ArduinoJson.h>



// CONFIGURARE PINI ==================================================================
const int servoPin = 13;
const int ledWifiBlue = 2;   
const int ledServerGreen = 4;



// CONFIGURARE RETEA & SERVER ========================================================
const char* ssid = "";
const char* password = "";
const char* statusUrl = "https://project-td.onrender.com/api/esp/angle";



// CONFIGURARE COMPONENTE ============================================================
Servo myServo;



void setup()
{
	Serial.begin(115200); // Comunicare Serial pt. DEBUG

	// Init. Led-uri
	pinMode(ledWifiBlue, OUTPUT);
	pinMode(ledServerGreen, OUTPUT);
	digitalWrite(ledWifiBlue, LOW);
	digitalWrite(ledServerGreen, LOW);

	// Init. Servo
	myServo.attach(servoPin);
	moveToAngle(90);

	// Init. WiFi
	Serial.print("Conectare WiFi ...");
	WiFi.begin(ssid, password);
}



void loop()
{
	
	// Verificare status WiFi:
	if (WiFi.status() == WL_CONNECTED) {
		// WiFi OK
		digitalWrite(ledWifiBlue, HIGH);
	} else {
		// WiFi NOK
		digitalWrite(ledWifiBlue, LOW);
		Serial.print(".");
		return;
	}


	// Cerere catre Server:
	HTTPClient http;
	http.begin(statusUrl);
	int httpCode = http.GET();

	if (httpCode == 200) {
		// Conexiune Server OK
		digitalWrite(ledServerGreen, HIGH);

		String payload = http.getString(); // citeste datele trimise res.json()
		StaticJsonDocument<200> doc;       // crearea obiectului ArduinoJSON
		deserializeJson(doc, payload);     // citirea JSON-ului text payload ==> structura JSON
		int targetAngle = doc["angle"];    // citeste cheia "angle" converteste in int
		
		moveToAngle(targetAngle);
	} else {
		// Conexiune Server NOK
		digitalWrite(ledServerGreen, LOW);
		Serial.printf("Eroare Server: %d\n", httpCode);
	}

	http.end();
	delay(500);
}



void moveToAngle(int targetAngle)
{

	int currentAngle = myServo.read();
	if (currentAngle == targetAngle) return;

	int step = (targetAngle > currentAngle) ? 1 : -1;

	while (currentAngle != targetAngle)
	{
		currentAngle += step;
		myServo.write(currentAngle);
		delay(5);
	}
}