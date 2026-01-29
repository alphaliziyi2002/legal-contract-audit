#!/bin/bash
# 腾讯云一键部署脚本
# 适用于Ubuntu/CentOS系统

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查Docker是否安装
check_docker() {
    if command -v docker &> /dev/null; then
        log_info "Docker已安装: $(docker --version)"
        return 0
    else
        log_warn "Docker未安装"
        return 1
    fi
}

# 检查Docker Compose是否安装
check_docker_compose() {
    if command -v docker-compose &> /dev/null; then
        log_info "Docker Compose已安装: $(docker-compose --version)"
        return 0
    else
        log_warn "Docker Compose未安装"
        return 1
    fi
}

# 安装Docker
install_docker() {
    log_info "开始安装Docker..."
    
    # 检测系统类型
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
        VERSION=$VERSION_ID
    else
        log_error "无法检测操作系统"
        exit 1
    fi
    
    case $OS in
        ubuntu|debian)
            log_info "检测到Ubuntu/Debian系统"
            # 卸载旧版本
            sudo apt-get remove -y docker docker-engine docker.io containerd runc
            
            # 安装依赖
            sudo apt-get update
            sudo apt-get install -y \
                apt-transport-https \
                ca-certificates \
                curl \
                gnupg \
                lsb-release
            
            # 添加Docker官方GPG密钥
            curl -fsSL https://download.docker.com/linux/$OS/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
            
            # 设置稳定版仓库
            echo \
                "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/$OS \
                $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
            
            # 安装Docker引擎
            sudo apt-get update
            sudo apt-get install -y docker-ce docker-ce-cli containerd.io
            
            # 启动Docker服务
            sudo systemctl start docker
            sudo systemctl enable docker
            
            # 将当前用户加入docker组
            sudo usermod -aG docker $USER
            log_info "请重新登录或执行 'newgrp docker' 使组权限生效"
            ;;
            
        centos|rhel|fedora)
            log_info "检测到CentOS/RHEL/Fedora系统"
            # 卸载旧版本
            sudo yum remove -y docker \
                docker-client \
                docker-client-latest \
                docker-common \
                docker-latest \
                docker-latest-logrotate \
                docker-logrotate \
                docker-engine
            
            # 安装依赖
            sudo yum install -y yum-utils
            
            # 添加Docker仓库
            sudo yum-config-manager \
                --add-repo \
                https://download.docker.com/linux/centos/docker-ce.repo
            
            # 安装Docker引擎
            sudo yum install -y docker-ce docker-ce-cli containerd.io
            
            # 启动Docker服务
            sudo systemctl start docker
            sudo systemctl enable docker
            
            # 将当前用户加入docker组
            sudo usermod -aG docker $USER
            log_info "请重新登录或执行 'newgrp docker' 使组权限生效"
            ;;
            
        *)
            log_error "不支持的操作系统: $OS"
            log_error "请手动安装Docker: https://docs.docker.com/engine/install/"
            exit 1
            ;;
    esac
    
    log_info "Docker安装完成"
}

# 安装Docker Compose
install_docker_compose() {
    log_info "开始安装Docker Compose..."
    
    # 获取最新版本
    COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')
    
    # 下载并安装
    sudo curl -L "https://github.com/docker/compose/releases/download/$COMPOSE_VERSION/docker-compose-$(uname -s)-$(uname -m)" \
        -o /usr/local/bin/docker-compose
    
    # 添加执行权限
    sudo chmod +x /usr/local/bin/docker-compose
    
    # 创建符号链接
    sudo ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose
    
    log_info "Docker Compose $COMPOSE_VERSION 安装完成"
}

# 创建应用目录结构
create_directories() {
    log_info "创建应用目录结构..."
    
    # 应用主目录
    APP_DIR="/opt/legal-audit"
    sudo mkdir -p $APP_DIR
    
    # 数据目录
    sudo mkdir -p $APP_DIR/data
    sudo mkdir -p $APP_DIR/uploads
    sudo mkdir -p $APP_DIR/logs
    sudo mkdir -p $APP_DIR/nginx/ssl
    
    # 设置权限
    sudo chmod -R 777 $APP_DIR/data
    sudo chmod -R 777 $APP_DIR/uploads
    sudo chmod -R 755 $APP_DIR/logs
    
    log_info "应用目录创建完成: $APP_DIR"
}

# 复制项目文件
copy_project_files() {
    log_info "复制项目文件..."
    
    APP_DIR="/opt/legal-audit"
    
    # 检查当前目录是否有项目文件
    if [ -f "package.json" ] && [ -f "next.config.js" ]; then
        log_info "检测到项目文件，复制到 $APP_DIR"
        sudo cp -r . $APP_DIR/
    else
        log_warn "未在当前目录检测到项目文件"
        log_warn "请将项目文件手动复制到 $APP_DIR"
        log_warn "或使用git克隆: git clone <repository> $APP_DIR"
    fi
    
    # 复制数据库文件（如果存在）
    if [ -f "legal-library.db" ]; then
        log_info "复制数据库文件..."
        sudo cp legal-library.db $APP_DIR/data/
        sudo chmod 666 $APP_DIR/data/legal-library.db
    else
        log_warn "未找到数据库文件 legal-library.db"
        log_warn "应用启动后将创建空数据库"
    fi
    
    log_info "项目文件复制完成"
}

# 配置环境变量
setup_environment() {
    log_info "配置环境变量..."
    
    APP_DIR="/opt/legal-audit"
    
    # 检查是否已有环境文件
    if [ ! -f "$APP_DIR/.env.production" ]; then
        log_warn "未找到生产环境配置文件 .env.production"
        log_info "正在创建环境配置文件..."
        
        cat > $APP_DIR/.env.production << EOF
# 腾讯云生产环境配置
# 请根据实际情况修改以下配置

# AI服务配置
AI_PROVIDER=deepseek
AI_API_KEY=your_api_key_here
AI_API_BASE_URL=https://api.deepseek.com/v1

# 应用配置
NEXT_PUBLIC_APP_NAME=AI合约风险审计系统
NEXT_PUBLIC_APP_VERSION=1.0.0

# 性能配置
ENABLE_PERFORMANCE_MONITOR=true
NEXT_PUBLIC_MAX_FILE_SIZE=10485760  # 10MB

# 数据库配置
DATABASE_PATH=/app/data/legal-library.db

# 服务器配置
PORT=3000
HOSTNAME=0.0.0.0

# 功能开关
LEGAL_LIBRARY_ENABLED=true
ENABLE_FILE_UPLOAD=true
EOF
        
        log_warn "请编辑 $APP_DIR/.env.production 文件，填写实际的API密钥和其他配置"
    else
        log_info "已存在环境配置文件"
    fi
}

# 构建和启动应用
start_application() {
    log_info "构建和启动应用..."
    
    APP_DIR="/opt/legal-audit"
    cd $APP_DIR
    
    # 构建Docker镜像
    log_info "正在构建Docker镜像..."
    sudo docker-compose build
    
    # 启动应用
    log_info "正在启动应用..."
    sudo docker-compose up -d
    
    # 等待应用启动
    log_info "等待应用启动..."
    sleep 10
    
    # 检查应用状态
    if sudo docker-compose ps | grep -q "Up"; then
        log_info "应用启动成功！"
        
        # 显示容器状态
        sudo docker-compose ps
        
        # 显示应用日志
        log_info "应用日志:"
        sudo docker-compose logs --tail=10 legal-audit
        
        # 显示访问信息
        SERVER_IP=$(curl -s ifconfig.me)
        log_info "=============================================="
        log_info "应用已成功部署！"
        log_info "访问地址: http://$SERVER_IP:3000"
        log_info "或: http://localhost:3000"
        log_info "=============================================="
        log_info "查看完整日志: docker-compose logs -f legal-audit"
        log_info "停止应用: docker-compose down"
        log_info "重启应用: docker-compose restart"
        log_info "更新应用: docker-compose pull && docker-compose up -d"
    else
        log_error "应用启动失败"
        sudo docker-compose logs legal-audit
        exit 1
    fi
}

# 停止应用
stop_application() {
    log_info "停止应用..."
    
    APP_DIR="/opt/legal-audit"
    if [ -d "$APP_DIR" ]; then
        cd $APP_DIR
        sudo docker-compose down
        log_info "应用已停止"
    else
        log_error "应用目录不存在: $APP_DIR"
    fi
}

# 重启应用
restart_application() {
    log_info "重启应用..."
    
    APP_DIR="/opt/legal-audit"
    if [ -d "$APP_DIR" ]; then
        cd $APP_DIR
        sudo docker-compose restart
        log_info "应用已重启"
    else
        log_error "应用目录不存在: $APP_DIR"
    fi
}

# 备份数据
backup_data() {
    log_info "备份应用数据..."
    
    APP_DIR="/opt/legal-audit"
    BACKUP_DIR="/opt/backups"
    BACKUP_FILE="legal-audit-backup-$(date +%Y%m%d-%H%M%S).tar.gz"
    
    # 创建备份目录
    sudo mkdir -p $BACKUP_DIR
    
    # 备份数据库和上传文件
    sudo tar -czf $BACKUP_DIR/$BACKUP_FILE \
        -C $APP_DIR \
        data/legal-library.db \
        uploads/ \
        logs/ \
        2>/dev/null || true
    
    # 设置权限
    sudo chmod 644 $BACKUP_DIR/$BACKUP_FILE
    
    log_info "备份完成: $BACKUP_DIR/$BACKUP_FILE"
    log_info "备份大小: $(du -h $BACKUP_DIR/$BACKUP_FILE | cut -f1)"
}

# 显示使用说明
show_usage() {
    echo -e "${GREEN}腾讯云部署脚本 - 使用说明${NC}"
    echo "================================"
    echo "用法: $0 [命令]"
    echo ""
    echo "可用命令:"
    echo "  install     - 安装Docker环境并部署应用"
    echo "  start       - 启动已部署的应用"
    echo "  stop        - 停止应用"
    echo "  restart     - 重启应用"
    echo "  backup      - 备份应用数据"
    echo "  status      - 查看应用状态"
    echo "  help        - 显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  $0 install   # 完整安装和部署"
    echo "  $0 start     # 启动应用"
    echo "  $0 backup    # 备份数据"
}

# 主函数
main() {
    log_info "开始部署法律合规审查系统到腾讯云"
    log_info "=============================================="
    
    case "$1" in
        install)
            check_docker || install_docker
            check_docker_compose || install_docker_compose
            create_directories
            copy_project_files
            setup_environment
            start_application
            ;;
        start)
            start_application
            ;;
        stop)
            stop_application
            ;;
        restart)
            restart_application
            ;;
        backup)
            backup_data
            ;;
        status)
            APP_DIR="/opt/legal-audit"
            if [ -d "$APP_DIR" ]; then
                cd $APP_DIR
                sudo docker-compose ps
                sudo docker-compose logs --tail=5 legal-audit
            else
                log_error "应用目录不存在: $APP_DIR"
            fi
            ;;
        help|--help|-h|"")
            show_usage
            ;;
        *)
            log_error "未知命令: $1"
            show_usage
            exit 1
            ;;
    esac
}

# 执行主函数
main "$@"