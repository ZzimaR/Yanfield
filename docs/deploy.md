# 部署指南

砚田是一个**单进程 + 单文件数据库**的应用：一个 Node 进程，一个 SQLite 文件（`yanfield.db`）。没有 Redis、MongoDB、消息队列，也没有账号系统。因此部署可以非常轻——本机双击运行、Docker 一个容器、或 VPS 上一个 systemd 服务都行。

> 本文面向「把它长期跑起来」的场景。只想本地写作，看 [README 的快速开始](../README.md#快速开始) 就够。

## 部署前必读

| 事项 | 说明 |
| --- | --- |
| **没有登录鉴权** | 砚田假设使用者就是机器主人。**不要把 3000 端口直接暴露到公网**；远程访问请走 Tailscale / WireGuard / SSH 隧道，或在前面加带密码的反向代理（见下文）。 |
| **数据库与备份** | 默认在系统用户数据目录（见下方「数据位置」），Docker 与 systemd 模板显式指定 `YANFIELD_DB_PATH`。WAL 模式，伴随 `-wal` / `-shm`。停服后复制实际数据库目录，或使用 SQLite 在线备份。 |
| **Provider Key 明文** | 密钥保存在数据库 `providers` 表里，明文。服务器只给可信用户使用。 |
| **SSE 需要反向代理放行** | AI 输出是 Server-Sent Events；Nginx 默认缓冲会让「流式」变成「转圈很久然后一次性出现」。必须 `proxy_buffering off`。 |
| **出网** | 进程需要访问你配置的模型服务（OpenAI/DeepSeek/…）或本机 Ollama；不需要访问砚田的任何服务器。 |

## 数据位置

不设置 `YANFIELD_DB_PATH` 时，无论从哪个目录启动，都读写同一个数据库：

| 系统 | 默认路径 |
| --- | --- |
| Windows | `%APPDATA%\Yanfield\yanfield.db` |
| macOS | `~/Library/Application Support/Yanfield/yanfield.db` |
| Linux | `$XDG_DATA_HOME/yanfield/yanfield.db`，未设置时为 `~/.local/share/yanfield/yanfield.db` |

「设置 → 数据」会显示当前进程实际使用的完整路径，并可直接打开所在文件夹。设置 `YANFIELD_DB_PATH` 可改到任意位置（相对路径按进程工作目录解析，长期部署请用绝对路径）。

数据库带有结构版本号（SQLite `user_version`）。新版本启动时会自动升级旧库；如果用旧版本打开被新版本升级过的库，程序会拒绝启动并提示先升级，避免旧代码误写新结构。

## 模型 Key 与环境变量

模型服务既可以部署后在设置页里添加，也可以在**首次启动时用环境变量自动创建**。后者适合 Docker / 自托管：把 Key 写进 `.env` 或容器环境变量，品牌预设不会附带模型，之后需在设置页主动拉取并选择；自定义服务可用 `_MODEL` 指定模型。

| 变量 | 作用 |
| --- | --- |
| `OPENAI_API_KEY` / `DEEPSEEK_API_KEY` / `DASHSCOPE_API_KEY` / `MOONSHOT_API_KEY` / `ZHIPU_API_KEY` / `ANTHROPIC_API_KEY` / `GEMINI_API_KEY` / `OPENROUTER_API_KEY` / `SILICONFLOW_API_KEY` | 根据已填写的品牌变量各创建一个 Provider |
| `OLLAMA_BASE_URL` | 本地 Ollama 地址（免 Key），默认 `http://127.0.0.1:11434/v1` |
| `YANFIELD_OPENAI_COMPAT_BASE_URL` + `_API_KEY` + `_MODEL` | 任意 OpenAI 兼容服务（vLLM / LM Studio / one-api / 自建网关） |

规则：已有同名 Provider 会跳过（**不会覆盖**你在设置页里手改过的 baseUrl / 模型）；当前默认模型若仍是「离线演示模式」，会切到第一个新建的真实服务。品牌服务没有预置模型，须拉取或手动添加后选择；自定义兼容服务未填 `_MODEL` 时的 `gpt-4o-mini` 是占位，需要核对实际模型。完整模板见 [`.env.example`](../.env.example)，各服务商样例见 [ai-providers.md](./ai-providers.md)。

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
pnpm exec next telemetry disable   # ?? Next.js ???????????????
pnpm build
pnpm start --hostname 127.0.0.1
```

Windows PowerShell 在获取源码后使用：

```powershell
pnpm.cmd install --frozen-lockfile
pnpm.cmd exec next telemetry disable
pnpm.cmd build
pnpm.cmd start --hostname 127.0.0.1
```

- 上述命令使用生产模式并只监听本机。`pnpm dev` 用于开发调试，不建议日常使用。
- 监听地址 / 端口：例如 `pnpm start --hostname 127.0.0.1 --port 8080`。脚本默认显式传入 3000，不要只靠 `PORT` 环境变量改端口。若需监听其他地址，请先配置访问保护，不要直接暴露到公网。
- 数据库位置：默认在系统用户数据目录（见上方「数据位置」）；用 `YANFIELD_DB_PATH` 指定绝对路径可放到别处。
- 升级：备份数据库后，拉取代码、运行 `pnpm install --frozen-lockfile` 和 `pnpm build`，再重启进程。

### 3. 自动重启

Linux 用 systemd（见方式四）；Windows 可用「任务计划程序」或 [NSSM](https://nssm.cc/) 把 `pnpm start --hostname 127.0.0.1` 注册为服务；macOS 用 `launchd`。工作目录应指向仓库根，进程环境中设置 `NEXT_TELEMETRY_DISABLED=1` 和按需设置的 `YANFIELD_DB_PATH`。

---

## 方式二：Docker

适合：不想在宿主机装 Node、需要隔离、想一条命令升级。

```bash
docker build -t yanfield:latest .

# 首次：准备数据目录（Linux 上注意 uid，见下方说明）
mkdir -p data

docker run -d \
  --name yanfield \
  --restart unless-stopped \
  -p 127.0.0.1:3000:3000 \
  -v "$PWD/data:/app/data" \
  -e YANFIELD_DB_PATH=/app/data/yanfield.db \
  -e NEXT_TELEMETRY_DISABLED=1 \
  --add-host=host.docker.internal:host-gateway \
  yanfield:latest
```

PowerShell 中绑定挂载要写成 `-v "${PWD}/data:/app/data"`。

打开 <http://127.0.0.1:3000>。端口默认只绑定宿主机本地回环；远程访问请使用隧道或带鉴权的反向代理。常用操作：

```bash
docker logs -f yanfield                 # 看日志
docker stop yanfield && docker rm yanfield        # 停容器（数据在 ./data 里，安全）

# 升级：拉代码 → 重建镜像 → 用同样的 volume 重新起
git pull
docker build -t yanfield:latest .
docker stop yanfield && docker rm yanfield
docker run -d ...（同上）
```

如需新增示例，使用「设置 → 数据 → 重新生成示例作品」。不要把 `scripts/seed.mjs` 当作无风险重置：它会删除作者为「砚田示例」或标题为《潮信》《长夜行》的作品（包括同名自建作品），以及内置提示词预设。执行前请停服并备份；重启后仅在数据库没有任何作品时自动创建示例。

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
| 端口 | 宿主机 `127.0.0.1:3000` → 容器 `3000` |
| 数据 | `./data` 绑定挂载到 `/app/data`（`YANFIELD_DB_PATH=/app/data/yanfield.db`） |
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
sudo useradd --system --create-home --shell /usr/sbin/nologin yanfield
sudo mkdir -p /opt/yanfield
sudo chown yanfield:yanfield /opt/yanfield
sudo -u yanfield git clone https://github.com/ZzimaR/Yanfield.git /opt/yanfield
```

### 2. 安装与构建

```bash
cd /opt/yanfield
sudo -u yanfield pnpm install --frozen-lockfile
sudo -u yanfield env NEXT_TELEMETRY_DISABLED=1 pnpm build
```

### 3. 安装服务

仓库里的 [`deploy/yanfield.service`](../deploy/yanfield.service) 是可直接用的模板：

```bash
sudo cp deploy/yanfield.service /etc/systemd/system/yanfield.service
# 按实际用户/目录/端口修改 Environment= 与 ExecStart=
sudo systemctl daemon-reload
sudo systemctl enable --now yanfield
systemctl status yanfield --no-pager
journalctl -u yanfield -f
```

服务默认：

- 以 `yanfield` 用户运行，工作目录 `/opt/yanfield`；
- `HOSTNAME=127.0.0.1`（只监听本机，由反向代理对外）；
- `YANFIELD_DB_PATH=/opt/yanfield/data/yanfield.db`；
- `ExecStart=/opt/yanfield/node_modules/.bin/next start -H 127.0.0.1 -p 3000`；
- 失败自动重启，并带 `ProtectSystem=strict` 等加固（只允许写 `data/`）。

> 想让 systemd 直接跑 standalone 产物：以 `YANFIELD_STANDALONE=1` 重新构建，把 `ExecStart` 改成 `/usr/bin/node .next/standalone/server.js`，再把 `.next/static` 与 `public/` 复制进 `.next/standalone/`（构建不会自动复制这两个目录）。普通生产构建配合 `next start` 更省事。

### 4. 升级

升级前先运行 `sudo systemctl stop yanfield`，按下方「备份与恢复」备份实际数据库目录，再执行以下命令。

```bash
cd /opt/yanfield
sudo -u yanfield git pull
sudo -u yanfield pnpm install --frozen-lockfile
sudo -u yanfield env NEXT_TELEMETRY_DISABLED=1 pnpm build
sudo systemctl restart yanfield
```

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

数据库是 SQLite（WAL 模式），位置见「设置 → 数据」或上方「数据位置」。最稳的做法是**停服后复制整个目录**：

```bash
# Linux / macOS（systemd 模板）
sudo systemctl stop yanfield
cp -r /opt/yanfield/data "/backup/yanfield-data-$(date +%Y%m%d)"
sudo systemctl start yanfield
```

```powershell
# Windows PowerShell（先停掉砚田，默认位置）
Copy-Item -Recurse "$env:APPDATA\Yanfield" "backup-yanfield-$(Get-Date -Format yyyyMMdd)"
```

若设置了 `YANFIELD_DB_PATH`，请备份该路径所在的目录。不要在运行时直接复制单个数据库文件，或依次复制数据库与 WAL 文件：两者可能不是同一时刻的快照。

不想停服时，用 SQLite 的在线备份：

```bash
sqlite3 /opt/yanfield/data/yanfield.db ".backup '/backup/yanfield-$(date +%Y%m%d).db'"
```

Docker Compose 部署同理：先停止容器，再备份宿主机挂载的 `./data` 目录；或者使用 SQLite 在线备份。数据库包含明文 API Key，备份文件应妥善保管。

### 恢复

```bash
sudo systemctl stop yanfield
sudo mv /opt/yanfield/data "/opt/yanfield/data-before-restore-$(date +%Y%m%d-%H%M%S)"
sudo cp -r /backup/yanfield-data-20260101 /opt/yanfield/data
sudo chown -R yanfield:yanfield /opt/yanfield/data
sudo systemctl start yanfield
```

迁移到新机器：停服 → 复制数据库所在目录 → 在新机器放到默认数据位置（或用 `YANFIELD_DB_PATH` 指向它）→ 启动。

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
| 页面白屏 / 升级后样式错乱 | 先停服务，清理项目内的旧 `.next`，按上方的环境变量重新构建；Docker 则重新构建镜像。 |
| 磁盘越来越大 | 数据库 + 日志。WAL 文件会在 checkpoint 后回落；Docker 日志按 compose 里的轮转配置清理；数据目录以外基本不增长。 |
| 1 G 内存服务器构建失败（OOM） | 构建需要 1.5–2 G：加 swap，或在别的机器上 build 后把 `.next` + `node_modules` 打包过去；用 Docker 同理。 |
| 忘记密码 / 想换 key | 砚田没有账号密码；模型 Key 在「设置 → 模型服务」里改，或删掉数据库里对应 provider 行（不推荐，直接改更安全）。 |
| 想新建空库或示例 | 停服并备份后使用新的数据库路径；只新增示例可用设置页。「`pnpm db:seed`」会删除匹配示例作者或标题的作品（包括同名自建作品）及内置预设，不是安全的全库重置。 |

---

## 安全检查清单

- [ ] 3000 端口没有直接暴露公网（只监听 127.0.0.1，或安全组只放行反代）
- [ ] 远程访问有 Tailscale/VPN 或反向代理的 basic auth / Cloudflare Access
- [ ] `.env` 与 `data/` 不在 git 里（仓库默认已 gitignore）
- [ ] 服务器只给可信用户；API Key 与书稿都在这台机器上
- [ ] 有定期备份（停服后复制实际数据库目录，或使用 `sqlite3 .backup`），并验证过能恢复
- [ ] 用 HTTPS 访问（避免书稿与 Key 在明文 HTTP 上传输）


## 公开介绍页（GitHub Pages）

`/intro` 用于本地预览；GitHub Pages 构建把 `NEXT_PUBLIC_PUBLIC_SITE=1`，因此公开域名的首页显示介绍页，本地首页继续进入写作台。公开站点只有介绍内容与本地交互示例，不提供书稿数据库或模型调用接口。

`.github/workflows/pages.yml` 在推送 `main` 后导出静态站点，并由 GitHub Pages 发布。仅修改本地文件不会更新线上；须先把对应代码提交并推送，或在已更新的分支版本上运行工作流。配置需包含 `YANFIELD_PAGES=1` 和 `NEXT_PUBLIC_PUBLIC_SITE=1`，只构建公开页面。不要把本机的 `data/`、`.env` 或 API Key 放进静态产物。
