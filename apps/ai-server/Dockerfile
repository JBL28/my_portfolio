# syntax=docker/dockerfile:1
# apps/ai-server(FastAPI) 배포 이미지 — 02_구현계획.md 1장 7번(배포), 01_설계.md 0장/1장
# ("AI 서버·Neo4j 배포 위치: 직접 운영 홈서버(Docker)").
#
# 빌드 컨텍스트는 **저장소 루트**다(deploy/docker-compose.yml의 context: .. 참고) —
# app/config.py가 "이 파일 위치 기준 상위 경로"로 저장소 루트의 data/를 계산하고
# (graph/project_hints.py·technology_aliases.py가 런타임에 읽는다), scripts/load_graph.py
# 재적재도 같은 경로를 쓰므로, 이미지 안에서도 동일한 상대 구조
# (/srv/apps/ai-server + /srv/data)를 유지해야 한다.

FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /srv/apps/ai-server
COPY apps/ai-server /srv/apps/ai-server
COPY data /srv/data

# pyproject.toml의 [tool.setuptools.packages.find]가 app/ 패키지를 포함하므로
# pip install . 로 의존성과 애플리케이션을 함께 설치한다.
RUN pip install .

RUN useradd --create-home appuser
USER appuser

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
