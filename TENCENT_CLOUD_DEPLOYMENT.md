# 腾讯云部署指南 - 法律合规审查系统

## 📋 系统概述
- **应用名称**: 法律合规审查系统
- **技术栈**: Next.js 15.0.3 + React + TypeScript + Tailwind CSS
- **数据库**: SQLite (文件数据库)
- **部署方式**: Docker容器化部署

## 🎯 推荐部署方案

### 方案一：云服务器 CVM（推荐）
**适用场景**: 中小型应用，需要完全控制权
**优点**: 
- 配置灵活，完全控制
- 成本相对较低
- 支持持久化文件存储

**配置建议**:
- **实例规格**: 2核4GB或更高
- **系统**: Ubuntu 20.04/22.04 LTS
- **磁盘**: 50GB SSD（数据库文件需要持久化存储）

### 方案二：容器服务 TKE
**适用场景**: 需要弹性伸缩和现代化部署
**优点**:
- 自动扩缩容
- 滚动更新，零停机部署
- 完善的监控和日志

## 🚀 快速部署步骤

### 准备工作
1. **腾讯云账号**: 确保已注册腾讯云账号并完成实名认证
2. **域名准备**: 准备备案的域名（可选）
3. **服务器准备**: 购买云服务器CVM或创建容器集群

### 方案一：云服务器CVM部署

#### 步骤1：连接服务器
```bash
ssh root@你的服务器IP
```

#### 步骤2：安装基础环境
```bash
# 更新系统
apt update && apt upgrade -y

# 安装Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# 安装Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# 验证安装
docker --version
docker-compose --version
```

#### 步骤3：部署应用
```bash
# 创建应用目录
mkdir -p /opt/legal-audit && cd /opt/legal-audit

# 上传项目文件（使用scp或git）
# 本地执行：scp -r e:\法律合规审查 root@你的服务器IP:/opt/legal-audit/

# 或者从Git仓库克隆
git clone [你的Git仓库地址] .

# 构建并启动容器
docker-compose up -d --build
```

#### 步骤4：配置反向代理（Nginx）
```bash
# 安装Nginx
apt install nginx -y

# 创建Nginx配置
cat > /etc/nginx/sites-available/legal-audit << EOF
server {
    listen 80;
    server_name 你的域名.com; # 或服务器IP
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

# 启用站点
ln -s /etc/nginx/sites-available/legal-audit /etc/nginx/sites-enabled/

# 测试配置并重启
nginx -t
systemctl restart nginx
```

#### 步骤5：配置SSL证书（可选但推荐）
```bash
# 安装Certbot
apt install certbot python3-certbot-nginx -y

# 获取证书
certbot --nginx -d 你的域名.com

# 证书会自动续期
```

### 方案二：容器服务TKE部署

#### 步骤1：创建容器集群
1. 登录腾讯云控制台 -> 容器服务 TKE
2. 创建集群（标准集群）
3. 配置节点：至少2个节点，规格2核4GB

#### 步骤2：配置镜像仓库
1. 创建镜像仓库（个人版或企业版）
2. 构建并推送镜像：
```bash
# 本地构建
docker build -t legal-audit:latest .

# 登录腾讯云镜像仓库
docker login ccr.ccs.tencentyun.com

# 标记镜像
docker tag legal-audit:latest ccr.ccs.tencentyun.com/[命名空间]/legal-audit:latest

# 推送镜像
docker push ccr.ccs.tencentyun.com/[命名空间]/legal-audit:latest
```

#### 步骤3：部署到TKE
1. 在TKE控制台创建Deployment
2. 配置：
   - 镜像地址: ccr.ccs.tencentyun.com/[命名空间]/legal-audit:latest
   - 端口映射: 3000
   - 环境变量: 见下方环境变量配置
3. 创建Service（LoadBalancer类型）暴露服务

## ⚙️ 环境变量配置

### 必要环境变量
```bash
# 生产环境
NODE_ENV=production
PORT=3000
HOSTNAME=0.0.0.0

# 数据库路径（SQLite）
DATABASE_PATH=/app/data/legal-library.db

# Next.js配置
NEXT_TELEMETRY_DISABLED=1
```

### 可选环境变量
```bash
# API密钥（如果需要外部API）
OPENAI_API_KEY=your_api_key_here

# 上传文件大小限制
NEXT_PUBLIC_MAX_FILE_SIZE=10485760  # 10MB

# 性能监控
ENABLE_PERFORMANCE_MONITOR=true
```

## 📁 文件持久化配置

### SQLite数据库持久化
```bash
# 创建持久化目录
mkdir -p /opt/legal-audit/data
chmod 777 /opt/legal-audit/data

# 在Docker Compose中配置数据卷
# volumes:
#   - /opt/legal-audit/data:/app/data
```

### 上传文件持久化
```bash
# 创建上传文件目录
mkdir -p /opt/legal-audit/uploads
chmod 777 /opt/legal-audit/uploads
```

## 🐳 Docker Compose配置

创建 `docker-compose.yml` 文件：

```yaml
version: '3.8'

services:
  legal-audit:
    build: .
    container_name: legal-audit
    restart: always
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - HOSTNAME=0.0.0.0
      - DATABASE_PATH=/app/data/legal-library.db
    volumes:
      - ./data:/app/data  # 数据库持久化
      - ./uploads:/app/uploads  # 上传文件持久化
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

## 🛡️ 安全配置建议

### 1. 防火墙配置
```bash
# 只开放必要端口
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw --force enable
```

### 2. 数据库安全
- 定期备份SQLite数据库文件
- 限制数据库文件访问权限
- 考虑迁移到云数据库（如MySQL）以提升性能和可靠性

### 3. 应用安全
- 使用环境变量存储敏感信息
- 配置合适的文件上传限制
- 启用HTTPS强制跳转

## 📊 监控和维护

### 系统监控
```bash
# 查看容器状态
docker ps
docker logs legal-audit

# 查看资源使用
docker stats legal-audit

# 健康检查
curl http://localhost:3000/api/health
```

### 日志管理
```bash
# 查看实时日志
docker logs -f legal-audit

# 查看最近100行日志
docker logs --tail 100 legal-audit

# 导出日志
docker logs legal-audit > app.log
```

### 备份策略
```bash
# 备份数据库
cp /opt/legal-audit/data/legal-library.db /opt/backups/legal-library-$(date +%Y%m%d).db

# 备份上传文件
tar -czf /opt/backups/uploads-$(date +%Y%m%d).tar.gz /opt/legal-audit/uploads/
```

## 🔄 更新部署

### 手动更新
```bash
cd /opt/legal-audit
git pull origin main
docker-compose down
docker-compose up -d --build
```

### 自动更新（CI/CD）
推荐使用GitHub Actions或腾讯云CODING进行自动化部署。

## 🆘 故障排除

### 常见问题
1. **端口占用**: 确保3000端口未被占用
2. **权限问题**: 检查/data和/uploads目录权限
3. **数据库连接**: 确认数据库文件存在且有读写权限
4. **内存不足**: 增加交换空间或升级服务器配置

### 查看错误日志
```bash
# 查看应用错误
docker logs legal-audit 2>&1 | grep -i error

# 查看系统日志
journalctl -u docker --since "1 hour ago"
```

## 📞 技术支持
- **腾讯云文档**: https://cloud.tencent.com/document/product
- **Docker文档**: https://docs.docker.com/
- **Next.js文档**: https://nextjs.org/docs

## 📝 部署验证清单
- [ ] 服务器或集群已准备就绪
- [ ] Docker和Docker Compose已安装
- [ ] 项目文件已上传到服务器
- [ ] 环境变量已正确配置
- [ ] 数据库文件已正确部署
- [ ] 容器已成功启动
- [ ] 应用可通过IP或域名访问
- [ ] SSL证书已配置（可选）
- [ ] 防火墙和安全组已配置
- [ ] 备份策略已制定

完成以上步骤后，您的法律合规审查系统将成功部署到腾讯云！