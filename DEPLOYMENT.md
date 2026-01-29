# 法律合规审查系统 - 部署说明

## 部署方式

由于项目使用Next.js 15，需要使用以下方式之一部署：

### 方式一：使用Node.js服务器部署（推荐）

1. 安装依赖：
```bash
npm install
```

2. 构建项目：
```bash
npm run build
```

3. 启动生产服务器：
```bash
npm start
```

4. 或者使用自定义服务器：
```bash
node server.js
```

### 方式二：使用Vercel部署（推荐用于Next.js）

1. 安装Vercel CLI：
```bash
npm i -g vercel
```

2. 部署到Vercel：
```bash
vercel
```

### 方式三：使用Docker部署

创建Dockerfile：
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## 环境配置

确保`.env.local`文件包含必要的环境变量：
- 数据库连接信息
- API密钥（如需要AI功能）

## 访问地址

部署成功后，访问：`http://localhost:3000`

## 功能说明

- 合同文件上传和解析（支持PDF、DOCX、TXT）
- AI智能合规审查
- 法律条文库查询
- 风险点分析和建议
