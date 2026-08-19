"""apps/ai-server/app/pipeline/upstage — Gate1/Gate2/Extract/Generate의 Upstage Solar 구현.

상위 `app/pipeline/`의 OpenAI 구현과 **파일명·함수명을 1:1로 미러링**한다
(gate_portfolio.run_gate_portfolio / gate_site.run_gate_site / extract.run_extract /
generate.run_generate). dispatch.py가 같은 시그니처로 두 구현을 바꿔 끼울 수 있게
하려는 것이고, 대응 관계가 파일 트리만으로 드러나게 하려는 것이다.

**프롬프트는 복제하지 않는다.** 실측에서 기존 프롬프트가 Solar에서도 그대로 잘 동작하는
것이 확인됐으므로(Gate1 6모델x3회, Gate2 6모델x4케이스, Extract 6모델x3회 전부 정답),
각 모듈은 OpenAI 쪽 `_SYSTEM_PROMPT`를 import 해서 쓴다. 프롬프트를 두 벌로 두면
한쪽만 고쳐져 두 프로바이더의 판단 기준이 조용히 어긋난다.

Upstage 구현이 OpenAI 구현과 실제로 다른 점은 세 가지뿐이다:
  1) 클라이언트(base_url)와 모델명 — settings.upstage_* 를 쓴다
  2) temperature=0 고정 — 실측에서 확인된 유일한 품질 이슈(기본 temperature에서 Extract의
     competencies/technologies가 흔들림)를 없애는 조치
  3) parsed=None 시 1회 재시도 — 재시도 후에도 실패하면 dispatch.py가 OpenAI로 폴백한다

**Retrieve는 이 패키지에 없다.** 질의 임베딩이 OpenAI 전용이기 때문이다(llm/provider.py
docstring 참고). Retrieve는 LLM 호출이 아닌 코드 단계이므로 프로바이더 개념 자체가 없다.
"""
