#include <WiFi.h>
#include <HTTPClient.h>
#include <ESP32Servo.h>
#include <ArduinoJson.h>

// --- CONFIGURARE PINI ---
const int servoPin = 13;
const int ledWifiBlue = 2;   // LED Albastru pentru WiFi
const int ledServerGreen = 4; // LED Verde pentru Server

// --- CONFIGURARE RETEA & SERVER ---
const char* ssid = "";
const char* password = "";
const char* statusUrl = "https://project-td.onrender.com/api/esp/angle";

Servo myServo;

void setup()
{
  Serial.begin(115200);
  
  // Inițializare LED-uri
  pinMode(ledWifiBlue, OUTPUT);
  pinMode(ledServerGreen, OUTPUT);
  
  // Ne asigurăm că sunt stinse la început
  digitalWrite(ledWifiBlue, LOW);
  digitalWrite(ledServerGreen, LOW);

  myServo.attach(servoPin);
  myServo.write(90); // Poziție de start
  
  Serial.print("Conectare WiFi...");
  WiFi.begin(ssid, password);
}

void loop()
{
  // 1. Logică LED WiFi (Albastru)
  if (WiFi.status() == WL_CONNECTED) {
    digitalWrite(ledWifiBlue, HIGH); // WiFi OK
  } else {
    digitalWrite(ledWifiBlue, LOW);  // WiFi picat
    Serial.print(".");
    return; // Nu mergem mai departe dacă nu avem net
  }

  // 2. Cerere către Server
  HTTPClient http;
  http.begin(statusUrl);
  int httpCode = http.GET();

  if (httpCode == 200) {
    digitalWrite(ledServerGreen, HIGH); // Server OK
    
    String payload = http.getString();
    StaticJsonDocument<200> doc;
    deserializeJson(doc, payload);
    
    int targetAngle = doc["angle"];
    moveToAngle(targetAngle);
  } else {
    digitalWrite(ledServerGreen, LOW); // Server inaccesibil sau eroare
    Serial.printf("Eroare Server: %d\n", httpCode);
  }
  
  http.end();
  delay(500); // Verificăm statusul de 2 ori pe secundă
}

void moveToAngle(int targetAngle
{
  int currentAngle = myServo.read();
  if (currentAngle == targetAngle) return;

  int step = (targetAngle > currentAngle) ? 1 : -1;

  while (currentAngle != targetAngle) {
    currentAngle += step;
    myServo.write(currentAngle);
    delay(5); // Viteza pentru mișcare smooth
  }
}