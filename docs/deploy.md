# 部署指南

砚田是一个**单进程 + 单文件数据库**的应用：一个 Node 进程，一个 SQLite 文件（`data/yantian.db`）。没有 Redis、MongoDB、消息队列，也没有账号系统。因此部署可以非常轻——本机双击运行、Docker 一个容器、或 VPS 上一个 systemd 服务都行。

> 本文面向「把它长期跑起来」的场景。只想本地写作，看 [README 的快速开始](../README.md#快速开始) 就够。

## 部署前必读

| 事项 | 说明 |
| --- | --- |
| **没有登录鉴权** | 砚田假设使用者就是机器主人。**不要把 3000 端口直接暴露到公网**；远程访问请走 Tailscale / WireGuard / SSH 隧道，或在前面加带密码的反向代理（见下文）。 |
| **数据只有一个文件** | `data/yantian.db`（WAL 模式，伴随 `-wal` / `-shm`）。备份 = 复制这个目录；迁移 = 拷过去。 |
| **Provider Key 明文** | 密钥保存在数据库 `providers` 表里，明文。服务器只给可信用户使用。 |
| **SSE 需要反向代理放行** | AI 输出是 Server-Sent Events；Nginx 默认缓冲会让「流式」变成「转圈很久然后一次性出现」。必须 `proxy_buffering off`。 |
| **出网** | 进程需要访问你配置的模型服务（OpenAI/DeepSeek/…）或本机 Ollama；不需要访问砚田的任何服务器。 |

## 模型 Key 与环境变量

模型服务既可以部署后在设置页里添加，也可以在**首次启动时用环境变量自动创建**。后者适合 Docker / 自托管：把 Key 写进 `.env` 或容器环境变量，不用打开界面。

| 变量 | 作用 |
| --- | --- |
| `OPENAI_API_KEY` / `DEEPSEEK_API_KEY` / `DASHSCOPE_API_KEY` / `MOONSHOT_API_KEY` / `ZHIPU_API_KEY` / `ANTHROPIC_API_KEY` / `GEMINI_API_KEY` / `OPENROUTER_API_KEY` / `SILICONFLOW_API_KEY` | 按内置 11 家预设各创建一个 Provider |
| `OLLAMA_BASE_URL` | 本地 Ollama 地址（免 Key），默认 `http://127.0.0.1:11434/v1` |
| `YANTIAN_OPENAI_COMPAT_BASE_URL` + `_API_KEY` + `_MODEL` | 任意 OpenAI 兼容服务（vLLM / LM Studio / one-api / 自建网关） |

规则：已有同名 Provider 会跳过（**不会覆盖**你在设置页里手改过的 baseUrl / 模型）；当前默认模型若仍是「离线演示模式」，会切到第一个创建成功的真实服务。完整模板见 [`.env.example`](../.env.example)，各服务商样例见 [ai-providers.md](./ai-providers.md)。

---

## 方式一：Node 直接跑（最简单）

适合：自己的电脑、局域网内的小主机、已经装了 Node 的 VPS。

### 1. 环境

| 项 | 要求 |
| --- | --- |
| Node.js | ≥ 22.13（推荐 22 LTS 最新或 24 LTS；`node:sqlite` 从 22.13 起无需额外 flag） |
| pnpm | ≥ 9（`npm install -g pnpm` 或 `corepack enable`） |
| 磁盘 | 源码与依赖约 700 MB；数据库按篇幅增长（100 万字 ≈ 100 MB 内） |

### 2. 构建与启动

```bash
git clone https://github.com/ZzimaR/Yanfield.git
cd Yanfield
pnpm install --frozen-lockfile
pnpm build
pnpm start            # 生产模式，监听 http://127.0.0.1:3000
```

- 监听地址 / 端口：`HOSTNAME=0.0.0.0 PORT=8080 pnpm start`（bash）或 PowerShell 里先 `$env:PORT=8080`。`pnpm dev` 的端口固定为 3000。
- 数据库位置：默认 `./data/yantian.db`；用 `YANTIAN_DB_PATH` 指定绝对路径更适合长期部署。
- 升级：`git pull && pnpm install --frozen-lockfile && pnpm build`，重启进程即可（数据库自动兼容，升级前仍建议先备份）。

> **Windows 构建注意**：`next build` 默认产出 Docker 用的 standalone 目录，这一步需要创建符号链接。没开「开发者模式」会报 `EPERM: operation not permitted, symlink`。此时用 `$env:YANTIAN_STANDALONE='0'; pnpm build`，再 `pnpm start` 即可（只影响 Docker 产物，不影响生产运行）。

### 3. 自动重启

Linux 用 systemd（见方式四）；Windows 可用「任务计划程序」或 [NSSM](https://nssm.cc/) 把 `pnpm start` 注册为服务；macOS 用 `launchd`。核心只有两点：工作目录指向仓库根、进程环境里带 `YANTIAN_DB_PATH`。

---

## 方式二：Docker

适合：不想在宿主机装 Node、需要隔离、想一条命令升级。

```bash
docker build -t yantian:latest .

# 首次：准备数据目录（Linux 上注意 uid，见下方说明）
mkdir -p data

docker run -d \
  --name yantian \
  --restart unless-stopped \
  -p 3000:3000 \
  -v "$PWD/data:/app/data" \
  -e YANTIAN_DB_PATH=/app/data/yantian.db \
  -e NEXT_TELEMETRY_DISABLED=1 \
  --add-host=host.docker.internal:host-gateway \
  yantian:latest
```

PowerShell 中绑定挂载要写成 `-v "${PWD}/data:/app/data"`。

打开 <http://127.0.0.1:3000>。常用操作：

```bash
docker logs -f yantian                 # 看日志
docker exec -it yantian node scripts/seed.mjs   # 只重置示例数据（不动你的作品）
docker stop yantian && docker rm yantian        # 停容器（数据在 ./data 里，安全）

# 升级：拉代码 → 重建镜像 → 用同样的 volume 重新起
git pull
docker build -t yantian:latest .
docker stop yantian && docker rm yantian
docker run -d ...（同上）
```

要点：

- **镜像以非 root 用户（uid 1001）运行**。Linux 上若 `./data` 是 root 拥有的目录，容器会写不进去；先 `sudo chown -R 1001:1001 data`。
- 想用 `.env` 里的模型 Key：加 `--env-file .env`（`docker run` 支持）。密钥以明文落库，注意容器日志不要外泄。
- **连宿主机 Ollama**：容器内 `127.0.0.1` 指向容器自己。Linux 用 `http://172.17.0.1:11434/v1`（或 `--add-host=host.docker.internal:host-gateway` 后用 `http://host.docker.internal:11434/v1`）；Docker Desktop（macOS/Windows）直接用 `host.docker.internal`。
- 镜像自带健康检查（`wget` 探活），`docker ps` 里能看到 healthy/unhealthy。

---

## 方式三：Docker Compose（推荐给长期自托管）

仓库根目录已带 [`docker-compose.yml`](../docker-compose.yml)，做的事情和上面的 `docker run` 一样，但配置可提交、升级一条命令。

```bash
cp .env.example .env        # 可选：按需填模型 Key（不建 .env 也能启动，走离线演示模式）
mkdir -p data
docker compose up -d --build

docker compose logs -f          # 看日志
docker compose ps               # 看健康状态
docker compose down             # 停止（数据保留在 ./data）
git pull && docker compose up -d --build   # 升级
```

Compose 文件的默认行为：

| 项 | 值 |
| --- | --- |
| 端口 | 宿主机 `3000` → 容器 `3000` |
| 数据 | `./data` 绑定挂载到 `/app/data`（`YANTIAN_DB_PATH=/app/data/yantian.db`） |
| 环境 | `env_file: .env`（可选，缺失也能启动）+ `NEXT_TELEMETRY_DISABLED=1` |
| 重启 | `restart: unless-stopped` |
| 日志 | json-file，10 MB × 3 轮转 |

`.env` 里的 `*_API_KEY` / `OLLAMA_BASE_URL` 会随 `env_file` 透传进容器，首次启动自动创建 Provider（已有同名 Provider 会跳过，不覆盖手改配置）。

Linux 上如遇 `permission denied`：`sudo chown -R 1001:1001 data`。

---

## 方式四：VPS + systemd

适合：一台长期在线的 Linux 服务器（1 核 1 G 就能跑；构建时建议 2 G 内存 + swap）。

### 1. 创建用户与目录

```bash
sudo useradd --system --create-home --shell /usr/sbin/nologin yantian
sudo mkdir -p /opt/yantian
sudo chown yantian:yantian /opt/yantian
sudo -u yantian git clone https://github.com/ZzimaR/Yanfield.git /opt/yantian
```

### 2. 安装与构建

```bash
cd /opt/yantian
sudo -u yantian pnpm install --frozen-lockfile
sudo -u yantian pnpm build
```

### 3. 安装服务

仓库里的 [`deploy/yantian.service`](../deploy/yantian.service) 是可直接用的模板：

```bash
sudo cp deploy/yantian.service /etc/systemd/system/yantian.service
# 按实际用户/目录/端口修改 Environment= 与 ExecStart=
sudo systemctl daemon-reload
sudo systemctl enable --now yantian
systemctl status yantian --no-pager
journalctl -u yantian -f
```

服务默认：

- 以 `yantian` 用户运行，工作目录 `/opt/yantian`；
- `HOSTNAME=127.0.0.1`（只监听本机，由反向代理对外）；
- `YANTIAN_DB_PATH=/opt/yantian/data/yantian.db`；
- `ExecStart=/opt/yantian/node_modules/.bin/next start -p 3000`；
- 失败自动重启，并带 `ProtectSystem=strict` 等加固（只允许写 `data/`）。

> 想让 systemd 直接跑 standalone 产物：把 `ExecStart` 改成 `/usr/bin/node .next/standalone/server.js`，并把 `.next/static` 与 `public/` 复制进 `.next/standalone/`（`pnpm build` 不会自动复制这两个目录）。`pnpm start` 方式更省事，推荐前者即可。

### 4. 升级

```bash
cd /opt/yantian
sudo -u yantian git pull
sudo -u yantian pnpm install --frozen-lockfile
sudo -u yantian pnpm build
sudo systemctl restart yantian
```

升级前备份：`sudo -u yantian cp -r data "data-backup-$(date +%Y%m%d)"`。

---

## 反向代理与 HTTPS

### Nginx（推荐做法）

```nginx
server {
    listen 80;
    server_name novel.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name novel.example.com;

    ssl_certificate     /etc/letsencrypt/live/novel.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/novel.example.com/privkey.pem;

    # 可选：加一层 basic auth（砚田自己没有登录）
    # auth_basic "Yanfield";
    # auth_basic_user_file /etc/nginx/.htpasswd;

    client_max_body_size 20m;     # TXT 导入

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SSE / 长连接：这三行是关键，否则 AI 输出不会流式
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
    }
}
```

> 砚田的 AI 流式接口本身已返回 `X-Accel-Buffering: no` 响应头，上面的 `proxy_buffering off` 是双保险；如果 Nginx 前面还有 CDN / Cloudflare，也要关掉那一层的缓冲（Cloudflare 可走 Tunnel，或对 `/api/ai/*` 关闭缓冲）。

HTTPS 证书用 certbot 一键签发：

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d novel.example.com
```

生成 basic auth 密码文件：

```bash
sudo apt install apache2-utils
sudo htpasswd -c /etc/nginx/.htpasswd yourname
sudo systemctl reload nginx
```

### Caddy（自动 HTTPS，配置更短）

```caddyfile
novel.example.com {
    basic_auth {
        yourname $2a$14$REPLACE_WITH_HTPASSWD_HASH
    }
    reverse_proxy 127.0.0.1:3000 {
        flush_interval -1      # 让 SSE 立即刷新
    }
}
```

### 不放公网时的远程访问

- **Tailscale / WireGuard**：组网后直接访问内网 IP，最简单也更安全；
- **SSH 隧道**：`ssh -L 3000:127.0.0.1:3000 user@server`，本机打开 <http://127.0.0.1:3000>；
- **Cloudflare Tunnel**：无需开放端口，再配合 Cloudflare Access 做鉴权。

---

## 备份与恢复

### 备份

`data/yantian.db` 是 SQLite（WAL 模式）。最稳的做法是**停服后复制整个目录**：

```bash
# Linux / macOS
sudo systemctl stop yantian
cp -r /opt/yantian/data "/backup/yantian-data-$(date +%Y%m%d)"
sudo systemctl start yantian
```

```powershell
# Windows PowerShell（先 Ctrl+C 停掉 dev/start）
Copy-Item -Recurse data "backup-data-$(Get-Date -Format yyyyMMdd)"
```

不想停服时，用 SQLite 的在线备份（幂等、可脚本化）：

```bash
sqlite3 /opt/yantian/data/yantian.db ".backup '/backup/yantian-$(date +%Y%m%d).db'"
```

Docker Compose 部署同理：备份宿主机的 `./data` 目录即可。

### 恢复

```bash
sudo systemctl stop yantian
rm -rf /opt/yantian/data && cp -r /backup/yantian-data-20260101 /opt/yantian/data
sudo chown -R yantian:yantian /opt/yantian/data
sudo systemctl start yantian
```

迁移到新机器：停服 → 复制 `data/` → 新机器放同一位置（或改 `YANTIAN_DB_PATH`）→ 启动。

> 升级大版本前建议同时保留一份**导出**（设置 → 数据 → 导出 Markdown/TXT），数据库备份之外多一层保险。

---

## 常见问题

| 现象 | 原因 / 处理 |
| --- | --- |
| `EADDRINUSE: 3000` | 端口被占用：换 `PORT=3001`，或杀掉旧进程（`lsof -i:3000` / `Get-NetTCPConnection -LocalPort 3000`）。 |
| 容器启动即退出，日志 `EACCES ... /app/data` | 宿主 `./data` 权限不对：`sudo chown -R 1001:1001 data`。 |
| `docker compose` 提示 `.env` 不存在 | 新版 Compose 已把 `.env` 设为可选；若你的 Compose 较旧，先 `cp .env.example .env`（可以留空）。 |
| 反向代理后 AI 不流式 / 转圈很久 | Nginx 加 `proxy_buffering off; proxy_cache off; proxy_read_timeout 600s;`；Caddy 用 `flush_interval -1`。 |
| 容器里连不上 Ollama | 用 `host.docker.internal` / `172.17.0.1`，见方式二。 |
| 页面白屏 / 升级后样式错乱 | 旧 `.next` 残留：`rm -rf .next && pnpm build`；Docker 则重新构建镜像。 |
| 磁盘越来越大 | 数据库 + 日志。WAL 文件会在 checkpoint 后回落；Docker 日志按 compose 里的轮转配置清理；`data/` 以外基本不增长。 |
| 1 G 内存服务器构建失败（OOM） | 构建需要 1.5–2 G：加 swap，或在别的机器上 build 后把 `.next` + `node_modules` 打包过去；用 Docker 同理。 |
| 忘记密码 / 想换 key | 砚田没有账号密码；模型 Key 在「设置 → 模型服务」里改，或删掉数据库里对应 provider 行（不推荐，直接改更安全）。 |
| 想彻底重来 | 停服 → 删除 `data/` → 启动，得到全新库 + 示例作品。只想重置示例数据用 `pnpm db:seed`（不会删你的作品）。 |

---

## 安全检查清单

- [ ] 3000 端口没有直接暴露公网（只监听 127.0.0.1，或安全组只放行反代）
- [ ] 远程访问有 Tailscale/VPN 或反向代理的 basic auth / Cloudflare Access
- [ ] `.env` 与 `data/` 不在 git 里（仓库默认已 gitignore）
- [ ] 服务器只给可信用户；API Key 与书稿都在这台机器上
- [ ] 有定期备份（`data/` 或 `sqlite3 .backup`），并验证过能恢复
- [ ] 用 HTTPS 访问（避免书稿与 Key 在明文 HTTP 上传输）
