import mariadb
import pandas as pd
from sklearn.ensemble import IsolationForest
from datetime import datetime

# DB 연결
conn = mariadb.connect(
    host='svc.sel4.cloudtype.app',
    port=31873,
    user='root',
    password='0000',
    database='mobiusdb'
)
cursor = conn.cursor()
print("Database connected")

# 센서 목록
sensors = {
    'ph': '/Mobius/sharkFamily/ph',
    'do': '/Mobius/sharkFamily/do',
    'temp': '/Mobius/sharkFamily/temp',
    'nh4': '/Mobius/sharkFamily/nh4',
    'salt': '/Mobius/sharkFamily/salt',
    'turbi': '/Mobius/sharkFamily/turbi'
}

latest_values = {}
latest_times = {}

# 최신 센서값 1개씩 가져오기
for name, pi in sensors.items():
    cursor.execute("""
        SELECT CAST(con AS DECIMAL(7,3)) AS val, created_at
        FROM cin
        WHERE pi = ?
        ORDER BY created_at DESC
        LIMIT 1
    """, (pi,))
    result = cursor.fetchone()
    if result:
        latest_values[name] = float(result[0])
        latest_times[name] = result[1]
    else:
        print(f"No data for sensor: {name}")
        conn.close()
        exit()

snapshot_time = max(latest_times.values())
snapshot = latest_values.copy()
snapshot['created_at'] = datetime.now()

# snapshot_time은 실제 센서 생성시간 기준
snapshot_time = max(latest_times.values())
snapshot = latest_values.copy()
snapshot['created_at'] = snapshot_time  # ← 수정함: datetime.now() ➝ 센서에서 온 시간 기준

# ✅ 중복된 snapshot_time이 있는지 검사
cursor.execute("SELECT COUNT(*) FROM snapshot_table WHERE created_at = ?", (snapshot_time,))
if cursor.fetchone()[0] > 0:
    print(f"Snapshot already exists at {snapshot_time} skipping insert.")
else:
    cursor.execute("""
        INSERT INTO snapshot_table (ph, do, temp, nh4, salt, turbi, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (
        snapshot['ph'], snapshot['do'], snapshot['temp'],
        snapshot['nh4'], snapshot['salt'], snapshot['turbi'],
        snapshot['created_at']
    ))
    conn.commit()
    print(f"New snapshot saved at {snapshot_time}")


# 최근 50개 snapshot 불러오기
df = pd.read_sql("SELECT * FROM snapshot_table ORDER BY created_at DESC LIMIT 50", conn)

if len(df) < 10:
    print("Not enough data to train model.")
    conn.close()
    exit()

X_train = df.iloc[1:][sensors.keys()]  # 가장 마지막 row는 테스트용
X_test = df.iloc[0:1][sensors.keys()]

# 모델 학습
model = IsolationForest(n_estimators=100, contamination=0.2, random_state=42)
model.fit(X_train)

# 이상치 판별
pred = model.predict(X_test)[0]

# 센서별로 개별 이상치 탐지
for sensor_name, pi in sensors.items():
    # 최근 50개 중 해당 센서 값만 추출
    series = df[sensor_name].values.reshape(-1, 1)

    # 모델 학습 (최근값은 테스트용)
    model = IsolationForest(n_estimators=100, contamination=0.1, random_state=42)
    model.fit(series[1:])  # 최근값 제외하고 학습
    pred = model.predict(series[0:1])[0]

    if pred == -1:
        value = latest_values[sensor_name]
        created_at_str = latest_times[sensor_name].strftime('%Y-%m-%d %H:%M:%S')

        # ✅ 이상치만 업데이트 및 로그 기록
        cursor.execute("UPDATE cin SET is_abnormal = 1 WHERE pi = ? AND created_at = ?", (pi, created_at_str))
        cursor.execute("INSERT INTO anomaly_log (pi, sensor_type, value, created_at) VALUES (?, ?, ?, ?)",
                       (pi, sensor_name, value, created_at_str))
        print(f"Logged: {sensor_name} = {value} at {created_at_str}")

        conn.commit()

    else:
        print("Snapshot is normal.")

conn.close()
