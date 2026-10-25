FROM node:22.17.0-bookworm-slim@sha256:b04ce4ae4e95b522112c2e5c52f781471a5cbc3b594527bcddedee9bc48c03a0
WORKDIR /skill
COPY assets/toolchain/package.json assets/toolchain/package-lock.json ./assets/toolchain/
RUN npm ci --ignore-scripts --no-audit --no-fund --prefix assets/toolchain
COPY scripts/lib.mjs ./scripts/lib.mjs
COPY assets/toolchain/compile.mjs ./assets/toolchain/compile.mjs
ENTRYPOINT ["node", "/skill/assets/toolchain/compile.mjs"]
