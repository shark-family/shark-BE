import pymysql
import pandas as pd
from sklearn.ensemble import IsolationForest
from functools import reduce

# DB 연결 정보
conn = pymysql.connect(
    host='localhost',
    user='root',
    password='0000',
    database='mobiusdb',
    charset='utf8'
)

# 분석 대상 센서 정보 (pi → 컬럼 이름 매핑)
sensors = {
    '/Mobius/sharkFamily/ph': 'ph',
    '/Mobius/sharkFamily/do': 'do',
    '/Mobius/sharkFamily/temp': 'temp',
    '/Mobius/sharkFamily/nh4': 'nh4',
    '/Mobius/sharkFamily/salt': 'salt',
    '/Mobius/sharkFamily/turbi': 'turbi'
}

dfs = []

# 각 센서별로 최근 100개 데이터 조회
for pi_value, col_name in sensors.items():
    query = f"""
        SELECT CAST(con AS DECIMAL(5,2)) AS {col_name}, created_at
        FROM cin
        WHERE pi = '{pi_value}' AND con NOT IN ('0', '0.0')
        ORDER BY created_at DESC
        LIMIT 100
    """
    df = pd.read_sql(query, conn)
    dfs.append(df)

conn.close()

# created_at 기준으로 inner join
df_merged = reduce(lambda left, right: pd.merge(left, right, on='created_at', how='inner'), dfs)

if df_merged.empty:
    print("No merged data availabe. Please check the data collection interval or time synchronization.")
    exit()

# 이상치 탐지 (Isolation Forest)
model = IsolationForest(n_estimators=100, contamination=0.05, random_state=42)
model.fit(df_merged[list(sensors.values())])
df_merged['anomaly'] = pd.Series(model.predict(df_merged[list(sensors.values())])).map({1: 0, -1: 1})


# 이상치 출력
anomalies = df_merged[df_merged['anomaly'] == 1]

if anomalies.empty:
    print("No anomaly")
else:
    print("Anomaly detected:")
    print(anomalies)
