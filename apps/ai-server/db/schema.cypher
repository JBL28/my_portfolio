// apps/ai-server/db/schema.cypher
//
// Neo4j 5.x DDL: 노드 라벨별 id UNIQUE 제약과 Section.embedding에 대한 벡터 인덱스.
// 01_설계.md 3장(Neo4j 스키마 확정)·3.3(임베딩), 02_구현계획.md 0장(임베딩 모델 확정) 기준.
//
// - 임베딩 모델: OpenAI text-embedding-3-small → 1536차원
// - 유사도 함수: cosine (3.3 "Neo4j 5.x 벡터 인덱스" 요구사항)
//
// 이 파일은 scripts/load_graph.py가 재적재 시작 시점에 그대로 실행한다(멱등 —
// 모두 IF NOT EXISTS이므로 여러 번 실행해도 안전하다). 수동으로 Neo4j Browser/cypher-shell에서
// 먼저 실행해 둬도 무방하다.

// ---------------------------------------------------------------------------
// 제약조건: 각 노드 라벨의 id UNIQUE
// (UNIQUE 제약은 Neo4j에서 해당 프로퍼티에 대한 인덱스도 함께 생성하므로,
//  MERGE (n:Label {id: $id}) 패턴의 조회 성능도 이 제약이 함께 보장한다.)
// ---------------------------------------------------------------------------

CREATE CONSTRAINT portfolio_id_unique IF NOT EXISTS
FOR (n:Portfolio) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT project_id_unique IF NOT EXISTS
FOR (n:Project) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT section_id_unique IF NOT EXISTS
FOR (n:Section) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT case_id_unique IF NOT EXISTS
FOR (n:Case) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT competency_id_unique IF NOT EXISTS
FOR (n:Competency) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT technology_id_unique IF NOT EXISTS
FOR (n:Technology) REQUIRE n.id IS UNIQUE;

// ---------------------------------------------------------------------------
// 벡터 인덱스: searchable=true인 Section.embedding만 값이 채워진다(3.2/3.3).
// Overview Section은 embedding 프로퍼티 자체가 없으므로 이 인덱스에 잡히지 않는다 —
// 그것이 의도된 동작이다(벡터 검색으로 우연히 후보가 되지 않아야 함).
// ---------------------------------------------------------------------------

CREATE VECTOR INDEX section_embedding_index IF NOT EXISTS
FOR (s:Section) ON (s.embedding)
OPTIONS {
  indexConfig: {
    `vector.dimensions`: 1536,
    `vector.similarity_function`: 'cosine'
  }
};
