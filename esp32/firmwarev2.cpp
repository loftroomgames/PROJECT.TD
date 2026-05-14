/*
  ESP32 + OV7670 NO FIFO + Servo + HTTP Server Communication
  Adapted for your wiring and architecture

  Features:
  - OV7670 NO FIFO stable capture
  - WiFi STA mode
  - HTTP polling for servo angle
  - HTTP RAW image upload
  - Servo control
  - WiFi + server status LEDs

  IMPORTANT:
  Install these libraries:
  - OV7670 by bitluni
  - ESP32Servo
  - ArduinoJson
*/

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <ESP32Servo.h>
#include <Wire.h>
#include <OV7670.h>

// ====================== WIFI ======================

const char* ssid = "";
const char* password = "";

const char* serverUrl = "http://192.168.0.62:3000";

// ====================== LEDS ======================

const int ledWifiBlue = 2;
const int ledServerGreen = 4;

// ====================== SERVO ======================

Servo myServo;
const int servoPin = 13;

// ====================== CAMERA PINS ======================

// Your wiring adapted

#define SIOD_GPIO_NUM   23
#define SIOC_GPIO_NUM   22

#define Y9_GPIO_NUM     14
#define Y8_GPIO_NUM     27
#define Y7_GPIO_NUM     26
#define Y6_GPIO_NUM     34
#define Y5_GPIO_NUM     35
#define Y4_GPIO_NUM     32
#define Y3_GPIO_NUM     33
#define Y2_GPIO_NUM     25

#define VSYNC_GPIO_NUM  19
#define HREF_GPIO_NUM   16
#define PCLK_GPIO_NUM   18
#define XCLK_GPIO_NUM   21

// ====================== CAMERA CONFIG ======================

#define MODE QQVGA
#define COLOR RGB565

const camera_config_t cam_conf = {
  .D0 = Y2_GPIO_NUM,
  .D1 = Y3_GPIO_NUM,
  .D2 = Y4_GPIO_NUM,
  .D3 = Y5_GPIO_NUM,
  .D4 = Y6_GPIO_NUM,
  .D5 = Y7_GPIO_NUM,
  .D6 = Y8_GPIO_NUM,
  .D7 = Y9_GPIO_NUM,

  .XCLK = XCLK_GPIO_NUM,
  .PCLK = PCLK_GPIO_NUM,
  .VSYNC = VSYNC_GPIO_NUM,

  .xclk_freq_hz = 10000000,

  .ledc_timer = LEDC_TIMER_0,
  .ledc_channel = LEDC_CHANNEL_0
};

OV7670 cam;

uint16_t* frameBuf = nullptr;

uint16_t frameWidth = 160;
uint16_t frameHeight = 120;

// ==========================================================

void setup() {

  Serial.begin(115200);

  setCpuFrequencyMhz(240);

  pinMode(ledWifiBlue, OUTPUT);
  pinMode(ledServerGreen, OUTPUT);

  digitalWrite(ledWifiBlue, LOW);
  digitalWrite(ledServerGreen, LOW);

  // ====================== I2C ======================

  // IMPORTANT:
  // SIOD = GPIO23
  // SIOC = GPIO22

  Wire.begin(SIOD_GPIO_NUM, SIOC_GPIO_NUM);
  Wire.setClock(400000);

  // ====================== CAMERA ======================

  Serial.println("Initializing OV7670...");

  if (cam.init(&cam_conf, MODE, COLOR) != ESP_OK) {

    Serial.println("OV7670 init FAILED!");

    while (true) {
      delay(1000);
    }
  }

  cam.setPCLK(2, DBLV_CLK_x4);

  cam.vflip(false);

  switch (MODE) {

    case QQVGA:
      frameWidth = 160;
      frameHeight = 120;
      break;

    case QVGA:
      frameWidth = 320;
      frameHeight = 240;
      break;

    case QCIF:
      frameWidth = 176;
      frameHeight = 144;
      break;

    case QQCIF:
      frameWidth = 88;
      frameHeight = 72;
      break;
  }

  Serial.printf(
    "Camera ready: %ux%u RGB565\n",
    frameWidth,
    frameHeight
  );

  // ====================== FRAME BUFFER ======================

  frameBuf = (uint16_t*)malloc(frameWidth * frameHeight * 2);

  if (!frameBuf) {

    Serial.println("Frame buffer allocation FAILED!");

    while (true) {
      delay(1000);
    }
  }

  // ====================== SERVO ======================

  myServo.attach(servoPin);

  myServo.write(90);

  // ====================== WIFI ======================

  WiFi.begin(ssid, password);

  Serial.print("Connecting WiFi");

  while (WiFi.status() != WL_CONNECTED) {

    delay(500);

    Serial.print(".");
  }

  Serial.println();

  Serial.println("WiFi connected!");

  Serial.print("IP: ");

  Serial.println(WiFi.localIP());

  digitalWrite(ledWifiBlue, HIGH);
}

// ==========================================================

void loop() {

  // ====================== WIFI CHECK ======================

  if (WiFi.status() != WL_CONNECTED) {

    digitalWrite(ledWifiBlue, LOW);

    reconnectWiFi();

    return;
  }

  digitalWrite(ledWifiBlue, HIGH);

  // ====================== GET SERVO COMMAND ======================

  HTTPClient http;

  String url = String(serverUrl) + "/api/esp/angle";

  http.begin(url);

  int httpCode = http.GET();

  if (httpCode == 200) {

    digitalWrite(ledServerGreen, HIGH);

    String payload = http.getString();

    StaticJsonDocument<256> doc;

    DeserializationError error = deserializeJson(doc, payload);

    if (!error) {

      int targetAngle = doc["angle"];

      const char* cmd = doc["command"];

      // ====================== MOVE SERVO ======================

      myServo.write(targetAngle);

      Serial.print("Servo angle: ");

      Serial.println(targetAngle);

      // ====================== CAPTURE ======================

      if (cmd && String(cmd) == "capture") {

        captureAndSend();
      }

    } else {

      Serial.println("JSON parse error");
    }

  } else {

    digitalWrite(ledServerGreen, LOW);

    Serial.printf(
      "HTTP GET failed: %d\n",
      httpCode
    );
  }

  http.end();

  delay(200);
}

// ==========================================================

void reconnectWiFi() {

  Serial.println("Reconnecting WiFi...");

  WiFi.disconnect();

  WiFi.begin(ssid, password);

  unsigned long startAttempt = millis();

  while (
    WiFi.status() != WL_CONNECTED &&
    millis() - startAttempt < 10000
  ) {

    delay(500);

    Serial.print(".");
  }

  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {

    Serial.println("WiFi reconnected!");

    digitalWrite(ledWifiBlue, HIGH);

  } else {

    Serial.println("WiFi reconnect FAILED");

    digitalWrite(ledWifiBlue, LOW);
  }
}

// ==========================================================

void captureAndSend() {

  Serial.println("Capturing image...");

  // ====================== CAPTURE FRAME ======================

  for (uint16_t y = 0; y < frameHeight; y++) {

    uint16_t* line = cam.getLine(y + 1);

    memcpy(
      frameBuf + (y * frameWidth),
      line,
      frameWidth * 2
    );
  }

  // ====================== SEND TO SERVER ======================

  Serial.println("Sending to SERVER ...");

  HTTPClient http;

  String uploadUrl =
    String(serverUrl) + "/api/esp/upload";

  http.begin(uploadUrl);

  // RAW RGB565

  http.addHeader(
    "Content-Type",
    "application/octet-stream"
  );

  http.addHeader(
    "X-Width",
    String(frameWidth)
  );

  http.addHeader(
    "X-Height",
    String(frameHeight)
  );

  http.addHeader(
    "X-Format",
    "RGB565"
  );

  int responseCode = http.POST(
    (uint8_t*)frameBuf,
    frameWidth * frameHeight * 2
  );

  if (responseCode > 0) {

    Serial.printf(
      "Image uploaded! HTTP: %d\n",
      responseCode
    );

  } else {

    Serial.printf(
      "Upload FAILED: %s\n",
      http.errorToString(responseCode).c_str()
    );
  }

  http.end();
}