# 1. 예상질문 작성

| 사용자가 이 포트폴리오에서 궁금해할만한 내용을 정리합니다.

1. 지원자 자체를 파악하는 질문
    이 지원자의 가치관은 어떤가요?
    이 지원자는 어떤 개발자인가요?
    이 지원자의 강점은 무엇인가요?
    이 지원자는 어떤 문제를 중요하게 생각하나요?
    이 지원자는 프로젝트를 통해 어떻게 성장해왔나요?
    이전 프로젝트의 경험이 다음 프로젝트에 어떻게 반영됐나요?
    이 지원자는 어떤 스택을 사용해봤나요?
2. 협업 방식
    이 지원자는 어떻게 협업하나요?
    팀원과 의견이 다를 때 어떻게 해결하나요?
    기술적 갈등을 해결한 경험이 있나요?
    팀이 공통된 기준을 갖도록 만든 경험이 있나요?
    다른 팀원에게 기술을 공유하거나 설명한 경험이 있나요?
    리더 역할을 맡았을 때 어떤 방식으로 팀을 이끌었나요?
3. 기술적 판단
    기술을 선택할 때 어떤 기준으로 판단하나요?
    여러 대안 중 하나를 선택한 사례가 있나요?
    기술적으로 잘못된 판단을 했거나 방향을 바꾼 경험이 있나요?
    요구사항과 기술적 이상 사이에서 어떻게 타협하나요?
    단순히 구현하는 것과 운영 가능한 시스템을 만드는 것의 차이를 어떻게 생각하나요?
4. 문제 해결 / 운영
    예상하지 못한 문제를 해결한 경험이 있나요?
    장애나 실패 상황을 어떻게 다루나요?
    서비스 운영 경험이 있나요?
    보안이나 인프라 측면에서 어떤 문제를 발견하고 개선했나요?
    반복 작업이나 개발 프로세스를 자동화한 경험이 있나요?
    코드 품질을 팀 차원에서 관리한 경험이 있나요?
5. AI / 성장 가능성
    AI를 개발 과정에서 어떻게 활용하나요?
    AI가 만든 결과를 어떻게 검증하나요?
    새로운 기술을 어떻게 학습하고 실제 프로젝트에 적용하나요?
    익숙하지 않은 기술을 맡았던 사례가 있나요?
    입사 후 빠르게 성장할 수 있다고 볼 근거가 있나요?
6. 근거를 요구하는 질문
    그렇게 판단할 수 있는 구체적인 사례가 있나요?
    어느 프로젝트에서 그런 모습을 보였나요?
    실제로 어떤 행동을 했나요?
    그 판단의 결과는 어땠나요?
    비슷한 경험이 다른 프로젝트에도 있나요?

# 2. 키워드 추출

| 질문에서 키워드를 뽑아 정리합니다.

```
기술 스택
가치관
개발 방식
강점
문제의식
성장

협업
갈등 해결
합의
의사소통
기술 공유
문서화
리더십
팀 기준

기술 선택
선택 기준
대안 비교
의사결정
방향 전환
트레이드오프
요구사항
운영 가능성
검증

문제 해결
실패
장애 대응
운영
인프라
보안
자동화
CI/CD
코드 품질
테스트
DevOps
관측성

AI 활용
학습
기술 탐색
적응
실전 적용
피드백 반영

사례
프로젝트
문제
판단
행동
결과
성과
후속 변화
```

# 3. 키워드 관계 정리

| 키워드 간의 관계를 정리합니다.

```
가치관
├─ RELATED_TO → 개발 방식
├─ RELATED_TO → 문제의식
└─ RELATED_TO → 강점

성장
├─ RELATED_TO → 학습
├─ RELATED_TO → 피드백 반영
└─ RELATED_TO → 후속 변화

기술 스택
└─ RELATED_TO → 프로젝트


협업
├─ HAS_SUBTOPIC → 갈등 해결
├─ HAS_SUBTOPIC → 합의
├─ HAS_SUBTOPIC → 의사소통
├─ HAS_SUBTOPIC → 기술 공유
├─ HAS_SUBTOPIC → 문서화
├─ HAS_SUBTOPIC → 리더십
└─ HAS_SUBTOPIC → 팀 기준

갈등 해결
└─ RELATED_TO → 문제 해결

합의
└─ RELATED_TO → 의사결정

팀 기준
└─ RELATED_TO → 코드 품질


기술 선택
├─ HAS_SUBTOPIC → 선택 기준
├─ HAS_SUBTOPIC → 대안 비교
├─ HAS_SUBTOPIC → 의사결정
├─ HAS_SUBTOPIC → 방향 전환
└─ HAS_SUBTOPIC → 트레이드오프

선택 기준
├─ RELATED_TO → 요구사항
└─ RELATED_TO → 운영 가능성

대안 비교
└─ RELATED_TO → 기술 탐색

의사결정
├─ RELATED_TO → 판단
└─ RELATED_TO → 검증


문제 해결
├─ HAS_SUBTOPIC → 실패
└─ HAS_SUBTOPIC → 장애 대응

운영
├─ HAS_SUBTOPIC → 인프라
├─ HAS_SUBTOPIC → 보안
└─ HAS_SUBTOPIC → 관측성

DevOps
├─ HAS_SUBTOPIC → 자동화
├─ HAS_SUBTOPIC → CI/CD
├─ HAS_SUBTOPIC → 코드 품질
└─ HAS_SUBTOPIC → 테스트

장애 대응
└─ RELATED_TO → 관측성

CI/CD
├─ RELATED_TO → 자동화
├─ RELATED_TO → 테스트
└─ RELATED_TO → 코드 품질

코드 품질
└─ RELATED_TO → 검증


AI 활용
└─ RELATED_TO → 검증

학습
├─ HAS_SUBTOPIC → 기술 탐색
├─ RELATED_TO → 적응
└─ RELATED_TO → 실전 적용

실전 적용
└─ RELATED_TO → 프로젝트

피드백 반영
└─ RELATED_TO → 성장


사례
├─ RELATED_TO → 프로젝트
├─ RELATED_TO → 문제
├─ RELATED_TO → 판단
├─ RELATED_TO → 행동
├─ RELATED_TO → 결과
└─ RELATED_TO → 성과

문제
└─ PRECEDES → 판단

판단
└─ PRECEDES → 행동

행동
└─ PRECEDES → 결과

결과
└─ PRECEDES → 후속 변화

후속 변화
└─ RELATED_TO → 성장
```

# 4. 스키마 설계
```
# Neo4j Schema

## Nodes

### Portfolio
- id
- name

### Project
- id
- name
- slug
- summary
- period
- teamSize
- roles[]
- result
- repositoryVisibility
- order

### Section
- id
- title
- body
- path
- anchor
- order
- searchable

### Keyword
- id
- name

### Technology
- id
- name
- category


## Relationships

(Portfolio)-[:HAS_PROJECT]->(Project)

(Portfolio)-[:HAS_SECTION]->(Section)

(Project)-[:HAS_SECTION]->(Section)

(Project)-[:USES]->(Technology)

(Project)-[:BUILDS_ON]->(Project)

(Section)-[:TAGGED_WITH]->(Keyword)

(Section)-[:USES]->(Technology)

(Section)-[:CONSIDERED]->(Technology)

(Keyword)-[:HAS_SUBTOPIC]->(Keyword)

(Keyword)-[:RELATED_TO]->(Keyword)

(Keyword)-[:PRECEDES]->(Keyword)
```

# 스키마 수정본

| 키워드끼리 연결하는 사전형 그래프에서 질문을 추적할 수 있는 그래프로 개선합니다.

```
# Neo4j Schema

## Nodes

### Portfolio
- id
- name

### Project
- id
- name
- slug
- summary
- period
- teamSize
- roles[]
- result
- repositoryVisibility
- order

### Case
- id
- title
- summary
- problem
- judgment
- action
- result
- learning
- order

### Section
- id
- title
- body
- path
- anchor
- order
- searchable
- embedding

### Competency
- id
- name

### Technology
- id
- name
- category


## Relationships

(Portfolio)-[:HAS_PROJECT]->(Project)

(Portfolio)-[:HAS_SECTION]->(Section)

(Project)-[:HAS_SECTION]->(Section)

(Project)-[:HAS_CASE]->(Case)

(Project)-[:USES]->(Technology)

(Project)-[:BUILDS_ON]->(Project)

(Case)-[:DESCRIBED_IN]->(Section)

(Case)-[:DEMONSTRATES]->(Competency)

(Case)-[:USES]->(Technology)

(Case)-[:CONSIDERED]->(Technology)

(Case)-[:INFLUENCED]->(Case)
```

## Competency

- 협업
- 기술적 판단
- 문제 해결
- 운영
- DevOps
- AI 활용
- 학습 및 성장