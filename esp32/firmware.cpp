// Board: ESP32 Dev Module

#include <WiFi.h>
#include <HTTPClient.h>
#include <ESP32Servo.h>
#include <ArduinoJson.h>



// CONFIGURARE PINI ==================================================================
const int servoPin = 13;
const int ledWifiBlue = 2;   
const int ledServerGreen = 4;

const int SCL = 22;
const int SDA = 23;
const int MCLK = 21;
const int VSYNC = 19;
const int PCLK = 18;

const int D0 = 25;
const int D1 = 33;
const int D2 = 32;
const int D3 = 35;
const int D4 = 34;
const int D5 = 26;
const int D6 = 27;
const int D7 = 14;


// CONFIGURARE RETEA & SERVER ========================================================
const char* ssid = "";
const char* password = "";
const char* angleUrl = "http://192.168.0.62:3000/api/esp/angle";



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
	myServo.write(90);
	//rotateToAngle(90);

	// Init. WiFi
	Serial.print("Conectare WiFi ...");
	WiFi.begin(ssid, password);
}



void loop()
{
	
	// Verificare status WiFi:
	if (WiFi.status() == WL_CONNECTED) {
		wifiLedFeedback("ok");
	} else {
		wifiLedFeedback("search");
		return;
	}


	// Cerere catre Server:
	HTTPClient http;
	http.begin(angleUrl);
	int httpCode = http.GET();

	if (httpCode == 200) {
		// Conexiune Server OK
		digitalWrite(ledServerGreen, HIGH);

		String payload = http.getString(); // citeste datele trimise res.json()
		StaticJsonDocument<200> doc;       // crearea obiectului ArduinoJSON
		deserializeJson(doc, payload);     // citirea JSON-ului text payload ==> structura JSON
		int targetAngle = doc["angle"];    // citeste cheia "angle" converteste in int
		
		myServo.write(targetAngle);
		//rotateToAngle(targetAngle);
	} else {
		// Conexiune Server NOK
		digitalWrite(ledServerGreen, LOW);
		Serial.printf("Eroare Server: %d\n", httpCode);
	}

	http.end();
	delay(500);
}



// NOT USED YET
void rotateToAngle(int targetAngle)
{

	int currentAngle = myServo.read();
	if (currentAngle == targetAngle) return;

	int step = (targetAngle > currentAngle) ? 1 : -1;

	while (currentAngle != targetAngle)
	{
		currentAngle += step;
		myServo.write(currentAngle);
		delay(10);
	}
}



void wifiLedFeedback(const char* mode)
{
  switch(mode)
  {
    case "search":
      digitalWrite(ledWifiBlue, HIGH);
      delay(100);
      digitalWrite(ledWifiBlue, LOW);
      delay(100);
      break;

    case "ok":
      digitalWrite(ledWifiBlue, HIGH);
      break;

    default:
      digitalWrite(ledWifiBlue, LOW);
  }
}