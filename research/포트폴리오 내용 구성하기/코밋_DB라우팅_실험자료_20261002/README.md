# Komit DB 라우팅 실험 자료 — 2026-10-02

[검증 보고서](../01_포폴재료_코밋_DB라우팅_실험보고서.md)의 원본, 재현 코드와 그림이다.

## 파일 구성

| 위치 | 내용 |
|---|---|
| `raw/environment-evidence.json` | 배포 이미지·DB 설정·데이터 규모·라우팅 클래스 해시 |
| `raw/jdbc-summary.json`, `raw/jdbc-samples.json` | 현재 DB 혼합 부하, 쓰기 직후 조회, 개별 트랜잭션 |
| `raw/pool-recreation-*.json` | 새 풀의 물리 연결 20개와 조회별 실제 연결 |
| `raw/lab-delay-results.json` | 기준 측정 및 지연 재현 20회, 쓰기 완료·조회·재개 후 검증 |
| `raw/lab-manifest.json`, `raw/lab-state-*.json` | 시험용 DB 설정·동기 복제·Service 엔드포인트 |
| `raw/api-*.json` | 실제 API의 예열·측정·개별 HTTP 결과·중단 사유 |
| `raw/http-hpa-*.json`, `raw/logging-*.json` | 임시 설정 전후 비교 |
| `raw/cleanup-verification.json` | 시험 DB·스키마·접속 파일 삭제 및 설정 복원 확인 |
| `raw/SHA256.json` | 원본 결과 파일별 SHA-256 |
| `analysis.json` | 원본을 대조해 산출한 집계 |
| `figures/*.png`, `figures/*.svg` | 보고서 그림과 벡터 원본 |
| `scripts/` | 검증기·HTTP 도구·시험 DB·지연 제어·정리·그림 생성 코드 |

`jdbc-samples.json`에는 본 측정 외에 예열과 정합성 시험의 배경 부하가 포함된다. 본 측정 18,000건은 `phase=jdbc-mixed-1/2/3`으로 선택한다. `pool-recreation-samples.json`은 회차마다 읽기 900건·쓰기 100건이다.

`logging-*`는 예비 계측 기록이다. 해당 SQL 로그 수집 결과는 요청 분배의 정량 근거로 사용하지 않았다. 보고서의 분배 비율은 DB 주소·역할·PID를 직접 반환한 조회 기록에서 계산했다.

## 재현 순서

실험 스크립트는 서버의 `/tmp/komit-db-routing-20261002`와 연결된 `/exp`를 사용한다. 기존 서비스의 코드는 수정하지 않고, 현재 배포 이미지에서 검증 대상 클래스를 가져온다.

1. `inspect_app.py`로 현재 앱 JAR과 라이브러리를 추출한다. 배포 이미지와 `DataSourceRoutingConfig` 해시를 기존 자료와 비교한다.
2. `setup_lab.py`로 별도 시험용 DB를 만들고, 현재·시험용 DB의 접속 정보를 임시 파일로 준비한다. 접속 정보는 출력하거나 이 폴더에 보관하지 않는다.
3. JDK 21 컨테이너에서 `RoutingHarness.java`와 `PoolProbe.java`를 컴파일한다. 클래스 경로는 `/exp`, `/exp/extracted/BOOT-INF/classes`, `/exp/extracted/BOOT-INF/lib/*`이다.
4. `RoutingHarness live`로 현재 DB의 별도 시험 스키마에서 혼합 부하·쓰고 읽기·외부 쓰기 트랜잭션의 조회를 측정한다. 컨테이너는 host network, CPU 1 core·메모리 512 MiB, JVM `-Xms64m -Xmx192m` 조건이다.
5. `lab_driver.py`로 시험 DB에서만 재생 지연을 재현한다. 이 스크립트가 `RoutingHarness lab`을 실행하고, `finally`에서 재생을 다시 시작한다.
6. `PoolProbe`로 풀 재생성을 세 번 측정한다. 이번 실행은 HTTP 예열 구간에 수행됐으며 본 HTTP 측정 시작 전에 종료됐다.
7. `http_measured.py`로 앱을 5 Pod로 고정하고 예열 후 부하를 측정한다. 오류·지연·재시작 중단 기준을 지키고 HPA 설정을 복원한다. 이번 실행은 50 RPS 첫 회차에서 중단됐다.
8. `cleanup.py`로 시험용 DB·접속 파일을 제거하고 기존 설정을 확인한다. 네임스페이스 삭제는 비동기이므로 삭제가 끝난 뒤 완료 확인을 다시 수행할 수 있다.

실제 API 데이터의 개발자 수가 달라지면 `http_measured.py`의 응답 검증 조건도 해당 데이터에 맞춰야 한다. 이 실험의 성공 응답은 개발자 15건을 확인한 결과다.

그림은 Python의 Matplotlib으로 원본 자료에서 생성했다. `scripts/plot_results.py`는 `analysis.json`과 `raw/lab-delay-results.json`을 읽는다. 개별 결과 파일에는 비밀번호·토큰·서비스 사용자 응답 본문을 보관하지 않았다.
