# syntax=docker/dockerfile:1
# apps/web(Next.js) 배포 이미지 — 02_구현계획.md 1장 7번(배포), 01_설계.md 0장/1장.
#
# 빌드 컨텍스트는 **저장소 루트**다(deploy/docker-compose.yml의 context: .. 참고) —
# apps/web은 빌드 타임에 저장소 루트의 data/를 읽어 SSG 페이지를 생성하기 때문이다
# (01_설계.md 5.1, lib/portfolio-data.ts).

FROM node:22-alpine AS deps
WORKDIR /repo/apps/web
COPY apps/web/package.json apps/web/package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:22-alpine AS build
WORKDIR /repo/apps/web
COPY --from=deps /repo/apps/web/node_modules ./node_modules
COPY data /repo/data
COPY apps/web /repo/apps/web
RUN npm run build

FROM node:22-alpine AS runner
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# next.config.ts의 outputFileTracingRoot가 저장소 루트이므로 standalone 산출물은
# apps/web/ 하위 구조를 그대로 유지한다 — server.js는 /app/apps/web/server.js에 놓인다.
WORKDIR /app
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
# public/: 프로젝트 갤러리 이미지(projects/{slug}/*) 등 정적 자원.
COPY --from=build /repo/apps/web/public ./apps/web/public
# 런타임에는 data/를 읽지 않지만(모든 페이지 프리렌더 + dynamicParams=false),
# lib/portfolio-data.ts의 경로 계산(cwd 기준 ../../data)이 어떤 상황에서도 성립하도록
# 같은 상대 구조로 함께 둔다.
COPY data ./data

# Next.js 서버가 런타임 캐시를 쓸 수 있도록 .next 소유권을 런타임 사용자에게 준다.
RUN mkdir -p /app/apps/web/.next/cache && chown -R node:node /app/apps/web/.next
USER node

EXPOSE 3000
WORKDIR /app/apps/web
CMD ["node", "server.js"]
