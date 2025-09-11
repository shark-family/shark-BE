// ===== ORP + Wi-Fi + MQTT (Arduino UNO R4 WiFi) =====
// Board: Arduino UNO R4 WiFi
// Monitor: 115200 baud

#include <WiFiS3.h>
#include <ArduinoMqttClient.h>
#include <WiFiUdp.h>
#include <NTPClient.h>
#include <time.h>
#include "DFRobot_EC10.h"
#include <EEPROM.h>


// ---- ORP 센서 ----
#define VOLTAGE   5.00
#define OFFSET    0
#define ArrayLenth 40
#define orpPin    A0

// ---- pH 센서 ----
#define phPin     A1  


// ---- DO 센서 ----
#define doPin     A2
#define VREF 5000
#define ADC_RES 1024
#define TWO_POINT_CALIBRATION 0
#define READ_TEMP (25)   // 현재 수온, 보정용
#define CAL1_V (1600)    // 보정 전압 (25도 기준)
#define CAL1_T (25)
#define CAL2_V (1300)    // 2점 보정용 (15도)
#define CAL2_T (15)

const uint16_t DO_Table[41] = {
  14460, 14220, 13820, 13440, 13090, 12740, 12420, 12110, 11810, 11530,
  11260, 11010, 10770, 10530, 10300, 10080, 9860, 9660, 9460, 9270,
  9080, 8900, 8730, 8570, 8410, 8250, 8110, 7960, 7820, 7690,
  7560, 7430, 7300, 7180, 7070, 6950, 6840, 6730, 6630, 6530, 6410
};

// ---- TDS 센서 ----
#define tdsPin   A3
#define VREF_TDS 5.0
#define SCOUNT   30
int tdsBuffer[SCOUNT];
int tdsBufferTemp[SCOUNT];
int tdsIndex = 0;

// ---- EC 센서 ----
#define ecPin A4
float ecVoltage, ecValue;
float ecTemp = 25;   // 기본 온도
DFRobot_EC10 ec;

// ---- Wi-Fi ----
const char ssid[] = "yeah";
const char pass[] = "choi0113";

// ---- MQTT (공용 브로커) ----
const char broker[] = "5.196.78.28";   // test.mosquitto.org IP
int        port     = 1883;
const char topic[]  = "yein/unoR4wifi/telemetry";

WiFiClient wifiClient;
MqttClient mqttClient(wifiClient);

double orpValue;
int orpArray[ArrayLenth];
int orpArrayIndex = 0;

// ---- NTP ----
WiFiUDP ntpUDP;
NTPClient timeClient(ntpUDP, "pool.ntp.org", 9*3600); // UTC+9 (한국 시간)


// ---------- ORP 평균 계산 ----------
double avergearray(int* arr, int number){
  if (number <= 0) return 0;
  long amount=0;
  if (number < 5) {
    for (int i=0; i<number; i++) amount += arr[i];
    return (double)amount/number;
  }
  int minV, maxV;
  if (arr[0] < arr[1]) { minV=arr[0]; maxV=arr[1]; }
  else { minV=arr[1]; maxV=arr[0]; }
  for (int i=2; i<number; i++){
    if (arr[i] < minV) { amount += minV; minV = arr[i]; }
    else if (arr[i] > maxV) { amount += maxV; maxV = arr[i]; }
    else { amount += arr[i]; }
  }
  return (double)amount/(number-2);
}

// ---------- TDS Median Filter ----------
int getMedianNum(int bArray[], int iFilterLen) {
  int bTab[iFilterLen];
  for (byte i = 0; i<iFilterLen; i++) bTab[i] = bArray[i];
  for (int j=0; j<iFilterLen-1; j++) {
    for (int i=0; i<iFilterLen-j-1; i++) {
      if (bTab[i] > bTab[i+1]) {
        int bTemp = bTab[i];
        bTab[i] = bTab[i+1];
        bTab[i+1] = bTemp;
      }
    }
  }
  if ((iFilterLen & 1) > 0)
    return bTab[(iFilterLen-1)/2];
  else
    return (bTab[iFilterLen/2] + bTab[iFilterLen/2-1]) / 2;
}

// ---------- ISO8601 시간 포맷 ----------
String getISO8601Time() {
  timeClient.update();
  unsigned long epoch = timeClient.getEpochTime();

  // epoch을 time_t로 변환
  time_t raw = (time_t)(epoch + 9 * 3600);  // UTC+9 적용
  struct tm t;
  gmtime_r(&raw, &t);  // 안전하게 변환

  char buf[30];
  sprintf(buf, "%04d-%02d-%02dT%02d:%02d:%02d+09:00",
          t.tm_year + 1900,
          t.tm_mon + 1,
          t.tm_mday,
          t.tm_hour,
          t.tm_min,
          t.tm_sec);
  return String(buf);
}

// ---------- DO 계산 ----------
int16_t readDO(uint32_t voltage_mv, uint8_t temperature_c) {
#if TWO_POINT_CALIBRATION == 0
  uint16_t V_saturation = (uint32_t)CAL1_V + (uint32_t)35 * temperature_c - (uint32_t)CAL1_T * 35;
  return (voltage_mv * DO_Table[temperature_c] / V_saturation);
#else
  uint16_t V_saturation = (int16_t)((int8_t)temperature_c - CAL2_T) *
                          ((uint16_t)CAL1_V - CAL2_V) / ((uint8_t)CAL1_T - CAL2_T) + CAL2_V;
  return (voltage_mv * DO_Table[temperature_c] / V_saturation);
#endif
}



void setup() {
  Serial.begin(115200);
  delay(1000);

  // ---- Wi-Fi 연결 ----
  Serial.print("Connecting to WiFi...");
  while (WiFi.begin(ssid, pass) != WL_CONNECTED) {
    Serial.print(".");
    delay(1000);
  }
  Serial.println(" Connected!");
  Serial.print("IP: "); Serial.println(WiFi.localIP());
  Serial.print("RSSI: "); Serial.println(WiFi.RSSI());

  // DHCP가 늦게 잡히는 경우 대비
  while (WiFi.localIP() == INADDR_NONE) {
    Serial.println("Waiting for IP address...");
    delay(1000);
  }

  // ---- NTP 동기화 ----
  timeClient.begin();
  while(!timeClient.update()) {
    timeClient.forceUpdate();
  }
  Serial.print("Time synced: ");
  Serial.println(timeClient.getFormattedTime());

  // ---- MQTT 연결 ----
  Serial.print("Connecting to MQTT broker...");
  if (!mqttClient.connect(broker, port)) {
    Serial.print(" failed, error = ");
    Serial.println(mqttClient.connectError());
    while (1); // 멈춤
  }
  Serial.println(" connected!");
}

void loop() {
  static unsigned long orpTimer   = millis();
   static unsigned long tdsTimer   = millis();
  static unsigned long printTimer = millis();
  static unsigned long pubTimer   = millis();

  // ORP 샘플링 (20ms)
  if (millis() - orpTimer >= 20) {
    orpTimer = millis();
    orpArray[orpArrayIndex++] = analogRead(orpPin);
    if (orpArrayIndex == ArrayLenth) orpArrayIndex = 0;

    double adcAvg = avergearray(orpArray, ArrayLenth);
    double v_mV   = (adcAvg * VOLTAGE * 1000.0) / 1024.0;
    orpValue = ((30.0 * VOLTAGE * 1000.0) - (75.0 * v_mV)) / 75.0 - OFFSET;
  }

  // pH 측정
  int phRaw = analogRead(phPin);
  double phVoltage = phRaw * (5.0 / 1024.0);
  double phValue = 3.5 * phVoltage;  // 센서 보정 필요

  // DO 측정
  int doRaw = analogRead(doPin);
  uint16_t doVoltage = (uint32_t)VREF * doRaw / ADC_RES;
  int doValue = readDO(doVoltage, READ_TEMP);

   // TDS 측정 (40ms 간격)
  if (millis() - tdsTimer > 40U) {
    tdsTimer = millis();
    tdsBuffer[tdsIndex] = analogRead(tdsPin);
    tdsIndex++;
    if (tdsIndex == SCOUNT) tdsIndex = 0;
  }
  float averageVoltage = getMedianNum(tdsBuffer, SCOUNT) * (float)VREF_TDS / 1024.0;
  float compensationCoefficient = 1.0 + 0.02 * (READ_TEMP - 25.0);
  float compensationVolatge = averageVoltage / compensationCoefficient;
  float tdsValue = (133.42*compensationVolatge*compensationVolatge*compensationVolatge
                  - 255.86*compensationVolatge*compensationVolatge
                  + 857.39*compensationVolatge) * 0.5;


  // 시리얼 출력 (0.8s)
  if (millis() - printTimer >= 800) {
    printTimer = millis();
    Serial.print("ORP: ");
    Serial.print("ORP: "); Serial.print((int)orpValue); Serial.print(" mV | ");
    Serial.print("pH: "); Serial.println(phValue,2);
    Serial.print("DO: "); Serial.print(doValue); Serial.println(" ug/L");
  }

  // MQTT 발행 (3s)
  if (millis() - pubTimer >= 3000) {
    pubTimer = millis();
     String ts = getISO8601Time(); // ISO8601 비슷하게 생성 (epoch + HH:MM:SS)

    String payload = String("{\"deviceId\":\"uno-r4\",\"ts\":\"") +
                     ts +
                     String("\",\"orp_mV\":") + String((int)orpValue) +
                     String(",\"ph\":") + String(phValue,2) +
                     String(",\"tds\":") + String(tdsValue,0) +
                     String(",\"do\":") + String(doValue) +
                     String("}");
    mqttClient.beginMessage(topic);
    mqttClient.print(payload);
    mqttClient.endMessage();

    Serial.print("[PUB] "); Serial.println(payload);
  }
}
