// Board: ESP32 Dev Module
// Librării necesare instalate în Arduino IDE: DHT sensor library, LiquidCrystal_I2C, ArduinoJson

#include <WiFi.h>
#include <HTTPClient.h>
#include <ESP32Servo.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <DHT.h>


// CONFIGURARE PINI ====================================================
const int servoPin = 13;       // COMANDA SERVO
const int fanPin = 12;         // COMANDA VENTILATOR
const int buzzerPin = 15;      // COMANDA BUZZER
const int dhtPin = 27;         // DATE SENSOR DHT11     !! VCC = 3.3V !!

const int ledWifiBlue = 2;   
const int ledServerGreen = 4;

// I2C pt. LCD 2004  !! VCC = 5V !!
const int SDA_PIN = 23;
const int SCL_PIN = 22;

#define DHTTYPE DHT11


// INITIALIZARE COMPONENTE ===========================================================
Servo myServo;
DHT dht(dhtPin, DHTTYPE);
LiquidCrystal_I2C lcd(0x27, 20, 4); // Adresa standard I2C pentru ecrane LCD 2004


// CONFIGURARE REȚEA & SERVER ========================================================
const char* ssid = "";
const char* password = "";
const char* syncUrl = "http://192.168.0.62:3000/api/esp/sync";


String lastLines[3] = {"", "", ""};

void setup()
{
	Serial.begin(115200);

	// CONFIG. OUTPUT
	pinMode(ledWifiBlue, OUTPUT);
	pinMode(ledServerGreen, OUTPUT);
	pinMode(fanPin, OUTPUT);
	pinMode(buzzerPin, OUTPUT);
	
	digitalWrite(ledWifiBlue, LOW);
	digitalWrite(ledServerGreen, LOW);
	digitalWrite(fanPin, LOW);
	digitalWrite(buzzerPin, LOW);

	// START I2C
	Wire.begin(SDA_PIN, SCL_PIN);
	lcd.init();
	lcd.backlight();
	lcd.setCursor(0, 0);
	lcd.print("PROJECT TD");

	dht.begin();
	myServo.attach(servoPin);
	myServo.write(90);

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

	// Citire date DHT11
	float h = dht.readHumidity();
	float t = dht.readTemperature();

	if (isnan(h) || isnan(t))
	{
		Serial.println("Eroare la citirea de pe senzorul DHT11!");
		t = 0;
		h = 0;
	}


	lcd.setCursor(0, 0);
	lcd.printf("T:%2.0fc H:%2.0f%%  Servo:%3d", t, h, myServo.read());

	// Trimitere date și preluare comenzi de pe Server prin HTTP POST JSON
	HTTPClient http;
	http.begin(syncUrl);
	http.addHeader("Content-Type", "application/json");

	// Construim obiectul JSON trimis la Server
	StaticJsonDocument<200> outboundDoc;
	outboundDoc["temperature"] = Math.round(t);
	outboundDoc["humidity"] = Math.round(h);
	String requestPayload;
	serializeJson(outboundDoc, requestPayload);

	int httpCode = http.POST(requestPayload);

	if (httpCode == 200)
	{
		digitalWrite(ledServerGreen, HIGH);

		String inboundPayload = http.getString();
		StaticJsonDocument<512> inboundDoc;
		deserializeJson(inboundDoc, inboundPayload);
		
		// UPDATE SERVO
		int targetAngle = inboundDoc["angle"];
		myServo.write(targetAngle);

		// UPDATE FAN
		bool fanStatus = inboundDoc["fanStatus"];
		digitalWrite(fanPin, fanStatus ? HIGH : LOW);

		// UPDATE LCD
		JsonArray texts = inboundDoc["texts"];
		bool textChanged = false;

		if (!texts.isNull() && texts.size() == 3) {
			for (int i=0; i<3; i++) {
				String currentLineText = texts[i].as<String>();
				
				// Modificare doar daca sa schimat linia
				if (currentLineText != lastLines[i])
				{
					lastLines[i] = currentLineText;
					textChanged = true;
					
					// CLEAR LINE
					lcd.setCursor(0, i + 1);
					lcd.print("                    ");
					lcd.setCursor(0, i + 1);
					lcd.print(currentLineText);
				}
			}
		}

		if (textChanged) { beep(); }

	} else {
		digitalWrite(ledServerGreen, LOW);
		Serial.printf("Eroare Comunicație Server: %d\n", httpCode);
	}

	http.end();
	delay(1000);
}



void wifiLedFeedback(const char* mode)
{
	if (strcmp(mode, "search") == 0) {
		digitalWrite(ledWifiBlue, HIGH);
		delay(100);
		digitalWrite(ledWifiBlue, LOW);
		delay(100);
	} else if (strcmp(mode, "ok") == 0) {
		digitalWrite(ledWifiBlue, HIGH);
	} else {
		digitalWrite(ledWifiBlue, LOW);
	}
}



void beep()
{
	digitalWrite(buzzerPin, HIGH);
	delay(150);
	digitalWrite(buzzerPin, LOW);
}
