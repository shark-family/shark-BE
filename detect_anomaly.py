import mariadb
import pandas as pd
from sklearn.ensemble import IsolationForest
from datetime import datetime

# DB 연결
try:
    conn = mariadb.connect(
        host='svc.sel4.cloudtype.app',
        port=31873,
        user='root',
        password='',
        database='mobiusdb'
    )
    print("Database connected")
except Exception as e:
    print("Database connection failed:", e)
    exit()

# 센서 목록
sensors = {
    'ph': '/Mobius/kongju003/ph',
    'do': '/Mobius/kongju003/do',
    'temp': '/Mobius/kongju003/temp',
    'nh4': '/Mobius/kongju003/nh4',
    'salt': '/Mobius/kongju003/salt',
    'turbi': '/Mobius/kongju003/turbi'
}

cursor = conn.cursor()
latest_values = {}
latest_times = {}

# 각 센서별 가장 최신값 1개씩 조회
for name, pi in sensors.items():
    query = """
        SELECT CAST(con AS DECIMAL(7,3)) AS val, created_at
        FROM cin
        WHERE pi = ?
        ORDER BY created_at DESC
        LIMIT 1
    """
    cursor.execute(query, (pi,))
    result = cursor.fetchone()
    if result:
        latest_values[name] = float(result[0])
        latest_times[name] = result[1]
    else:
        print(f"Missing data for sensor: {name}")
        conn.close()
        exit()

# 새로운 snapshot 구성
snapshot_time = max(latest_times.values())  # 가장 늦은 시간 기준
snapshot = latest_values
snapshot['created_at'] = snapshot_time

# snapshot_table에 기록 (선택적으로 사용)
insert_snapshot = f"""
    INSERT INTO snapshot_table (ph, do, temp, nh4, salt, turbi, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
"""
cursor.execute(insert_snapshot, (
    snapshot['ph'], snapshot['do'], snapshot['temp'],
    snapshot['nh4'], snapshot['salt'], snapshot['turbi'],
    snapshot['created_at']
))
conn.commit()

# 학습용 snapshot 50개 로드
train_query = """
    SELECT ph, do, temp, nh4, salt, turbi
    FROM snapshot_table
    ORDER BY created_at DESC
    LIMIT 50
"""
df_train = pd.read_sql(train_query, conn)

if len(df_train) < 10:
    print("Not enough training data")
    conn.close()
    exit()

# 모델 학습
model = IsolationForest(n_estimators=100, contamination=0.2, random_state=42)
model.fit(df_train)

# 새 snapshot 예측
X_test = pd.DataFrame([latest_values])
pred = model.predict(X_test)[0]  # -1: 이상치, 1: 정상

if pred == -1:
    print("Anomaly detected!")

    # DB 업데이트
    update_query = "UPDATE cin SET is_abnormal = 1 WHERE pi = ? AND created_at = ?"
    insert_log = "INSERT INTO anomaly_log (pi, sensor_type, value, created_at) VALUES (?, ?, ?, ?)"

    for sensor_name, pi in sensors.items():
        value = latest_values[sensor_name]
        timestamp = latest_times[sensor_name].strftime('%Y-%m-%d %H:%M:%S')

        cursor.execute(update_query, (pi, timestamp))
        cursor.execute(insert_log, (pi, sensor_name, value, timestamp))
        print(f"Logged anomaly: {sensor_name} = {value} at {timestamp}")

    conn.commit()
else:
    print("No anomaly detected")

conn.close()
