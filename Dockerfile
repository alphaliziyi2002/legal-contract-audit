# 使用Node.js 18 LTS作为基础镜像
FROM node:18-alpine AS base

# 安装依赖项
FROM base AS deps
RUN apk add --no-cache libc6-compat git
WORKDIR /app

# 复制package.json和package-lock.json
COPY package.json package-lock.json* ./
RUN npm ci

# 构建阶段
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 设置环境变量
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1

# 构建应用
RUN npm run build

# 生产运行阶段
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    NEXT_TELEMETRY_DISABLED=1

# 创建非root用户
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# 创建必要的目录
RUN mkdir -p /app/data && chown nextjs:nodejs /app/data

# 从builder阶段复制文件
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# 复制数据库文件（如果存在）
COPY --from=builder --chown=nextjs:nodejs /app/legal-library.db* ./data/ 2>/dev/null || true
COPY --from=builder --chown=nextjs:nodejs /app/lib ./lib

# 切换到非root用户
USER nextjs

# 暴露端口
EXPOSE 3000

# 设置环境变量
ENV HOSTNAME="0.0.0.0"
ENV DATABASE_PATH="/app/data/legal-library.db"

# 启动命令
CMD ["node", "server.js"]