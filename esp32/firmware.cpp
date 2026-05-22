// Board: ESP32 Dev Module WROOM 30pin

#include <WiFiMulti.h>
#include <HTTPClient.h>
#include <ESP32Servo.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <LCD-I2C.h>
#include <DHT.h>


// CONFIGURARE PINI ====================================================
const int servoPin = 19;       // COMANDA SERVO
const int fanPin = 17;         // COMANDA VENTILATOR
const int buzzerPin = 16;      // COMANDA BUZZER
const int dhtPin = 5;          // DATE SENSOR DHT11     !! VCC = 3.3V !!
#define DHTTYPE DHT11


const int ledWifiBlue = 2;
const int ledServerGreen = 4;
const int ledDataYellow = 21;

// I2C pt. LCD 2004  !! VCC = 5V !!
const int SDA_PIN = 23;
const int SCL_PIN = 22;


bool WIFI_OK = false;
bool SERVER_OK = false;



// INITIALIZARE COMPONENTE ===========================================================
Servo myServo;
int currentServoAngle = 90;

DHT dht(dhtPin, DHTTYPE);
LCD_I2C lcd(0x27, 20, 4);


// CONFIGURARE REȚEA & SERVER ========================================================
WiFiMulti wifiMulti;

const char* ssidHome = "";
const char* passwordHome = "";
const char* urlHome = "http://192.168.0.62:3000/api/esp/sync";

const char* ssidHotspot = "";
const char* passwordHotspot = "";
const char* urlHotspot = "http://10.194.216.84:3000/api/esp/sync";

String currentSyncUrl = "";
String lastLines[3] = {"", "", ""};



void setup()
{
	Serial.begin(115200);

	// CONFIG. OUTPUT
	pinMode(ledWifiBlue, OUTPUT);
	pinMode(ledServerGreen, OUTPUT);
	pinMode(ledDataYellow, OUTPUT);
	pinMode(fanPin, OUTPUT);
	pinMode(buzzerPin, OUTPUT);
	
	digitalWrite(ledWifiBlue, LOW);
	digitalWrite(ledServerGreen, LOW);
	digitalWrite(ledDataYellow, LOW);
	digitalWrite(fanPin, LOW);
	digitalWrite(buzzerPin, LOW);


	// Initializare LCD 2004
  Wire.begin(SDA_PIN, SCL_PIN);
  lcd.begin(&Wire);
  lcd.backlight();
  lcd.display();
  lcd.clear();
  systemPrint("Initializare...");
  delay(7000);

  // Initializare Sensore Temp./Umid.
  systemPrint("Init. DHT11");
  delay(1000);
	dht.begin();

  // Initializare Servo
  systemPrint("Init. Servo");
  delay(1000);
	myServo.attach(servoPin);
	myServo.write(currentServoAngle);


  // Initializare Wi-Fi
  systemPrint("Init. Wi-Fi");
  delay(1000);

	wifiMulti.addAP(ssidHome, passwordHome);
  wifiMulti.addAP(ssidHotspot, passwordHotspot);
}



void loop()
{
	// Verificare status WiFi:
  if (wifiMulti.run() == WL_CONNECTED) {

    if(!WIFI_OK) { 
			WIFI_OK = true; 
			beep(1); // feedback sonor Wi-Fi OK

			if (WiFi.SSID() == String(ssidHome)) {
        currentSyncUrl = urlHome;
        systemPrint("Conn. HOME");
      } else if (WiFi.SSID() == String(ssidHotspot)) {
        currentSyncUrl = urlHotspot;
        systemPrint("Conn. MOBIL");
      }

			delay(500);
		}

		wifiLedFeedback("ok"); // feedback led Server OK

	} else {

    if(WIFI_OK) { WIFI_OK = false; currentSyncUrl = ""; digitalWrite(ledServerGreen, LOW); SERVER_OK = false; }
    systemPrint("Cautare ...");
		wifiLedFeedback("search");
		return;

	}

	// Citire date DHT11
	float h = dht.readHumidity();
	float t = dht.readTemperature();

	if (isnan(h) || isnan(t))
	{
		systemPrint("Err: DHT11");
		t = 0;
		h = 0;
	}

	lcd.home();
	lcd.printf("T:%2.0fC H:%2.0f%%  S:%3d  ", t, h, currentServoAngle);


	// Trimitere date și preluare comenzi de pe Server prin HTTP POST JSON
	HTTPClient http;
	http.begin(currentSyncUrl);
	http.addHeader("Content-Type", "application/json");


	StaticJsonDocument<200> outboundDoc;
	outboundDoc["temperature"] = t;
	outboundDoc["humidity"] = h;
	String requestPayload;
	serializeJson(outboundDoc, requestPayload);

	dataLedFeedback(); // feedback led Data sent
	int httpCode = http.POST(requestPayload);

	if (httpCode == 200)
	{
		dataLedFeedback();  // feedback led Data recieved OK
    if(!SERVER_OK) { SERVER_OK = true; beep(2); } // feedback sonor Server OK
		digitalWrite(ledServerGreen, HIGH);  // feedback led Server OK

		String inboundPayload = http.getString();
		StaticJsonDocument<512> inboundDoc;
		deserializeJson(inboundDoc, inboundPayload);
		
		// UPDATE SERVO
		int targetAngle = inboundDoc["angle"];
    if(targetAngle != currentServoAngle)
    {
      rotateToAngle(targetAngle);
    }

		// UPDATE FAN
		bool fanStatus = inboundDoc["fanStatus"];
    int fanSpeed = inboundDoc["fanSpeed"];

    if (fanStatus) {
      int dutyCycle = map(fanSpeed, 0, 100, 0, 255);
      analogWrite(fanPin, dutyCycle);
    } else {
      analogWrite(fanPin, 0);
    }

		// UPDATE LCD
		JsonArray texts = inboundDoc["texts"];
		bool textChanged = false;

		if (!texts.isNull() && texts.size() == 3)
    {
			for (int i=0; i<3; i++)
      {
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

		if (textChanged) { beep(1); }

	} else {
    if(SERVER_OK) { SERVER_OK = false; }
		digitalWrite(ledServerGreen, LOW);
		
    String s = String("Server:") + httpCode;
    systemPrint(s);
	}

	http.end();
	delay(500);
}



void rotateToAngle(int targetAngle)
{
  if (currentServoAngle == targetAngle) return;

  int step = (targetAngle > currentServoAngle) ? 1 : -1;

  systemPrint("Pozitionare ...");
  
  while (currentServoAngle != targetAngle)
  {
    currentServoAngle += step;
    myServo.write(currentServoAngle);
    delay(15);
  }
  
}



void beep(int count)
{
  for(int i=0; i<count; i++)
  {
    digitalWrite(buzzerPin, HIGH);
    delay(100);
    digitalWrite(buzzerPin, LOW);
		delay(100);
  }
}



void systemPrint(String text)
{
  lcd.home();
  lcd.print("                    ");
  lcd.home();
  lcd.print("[i]: ");
  lcd.print(text);
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



void dataLedFeedback()
{
	digitalWrite(ledDataYellow, HIGH);
	delay(25);
	digitalWrite(ledDataYellow, LOW);
}


