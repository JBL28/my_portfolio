import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Phase 06 배포(02_구현계획.md 1장 7번, 01_설계.md 0장/1장): 홈서버 Docker 배포용
  // standalone 산출물을 생성한다. node_modules 전체 없이 server.js만으로 구동된다.
  output: "standalone",
  // apps/web은 빌드 타임에 저장소 루트의 data/를 읽으므로(01_설계.md 5.1,
  // lib/portfolio-data.ts) tracing root를 저장소 루트로 올린다 — standalone 산출물이
  // apps/web/ 하위 구조를 유지해 cwd 기준 ../../data 경로 계산이 그대로 성립한다.
  outputFileTracingRoot: path.join(__dirname, "../.."),
};

export default nextConfig;
