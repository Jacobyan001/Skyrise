# ---- 构建阶段：安装依赖并生成前端产物 ----
FROM node:22-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- 运行阶段：仅保留生产依赖与构建产物 ----
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3101
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY server ./server
EXPOSE 3101
# API Key 等敏感配置通过运行时环境变量注入（SILICONFLOW_API_KEY）
CMD ["node", "server/index.mjs"]
