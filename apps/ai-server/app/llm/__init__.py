"""apps/ai-server/app/llm — LLM 프로바이더(Upstage / OpenAI) 선택과 클라이언트 관리.

pipeline/ 은 "01_설계.md 2장의 각 단계"를 구현하는 곳이고, 어떤 프로바이더로 그 단계를
실행할지는 단계가 아니라 인프라 관심사다. graph/client.py가 Neo4j driver 싱글턴을
pipeline 밖에 두는 것과 같은 이유로 별도 패키지에 둔다.
"""
