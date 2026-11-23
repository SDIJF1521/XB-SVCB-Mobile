# 电脑端 API 依赖

移动端不直接推理，所有数据与任务都通过电脑端 XB-SVCB 的 FastAPI 服务完成。
本文档记录移动端实际依赖的接口、字段和版本要求；桌面端的完整契约见
<https://github.com/SDIJF1521/xb-svcb/blob/dev/docs/api.md>，运行中的 Swagger
文档见 `http://电脑IP:8760/docs`。

## 连接

- 默认地址：`http://电脑局域网IP:8760`
- 端口以桌面端「资料库 → API 接入」页面为准。
- 除 `GET /health` 外，所有 `/api/v1` 请求都需要请求头：

```http
X-API-Key: XB-SVCB-…
```

- 服务需在桌面端手动启动，并切换到「局域网」监听。
- 局域网 HTTP 为明文传输，不要把端口直接映射到公网。
- 客户端把地址与 Key 存在 Android 私有存储，不写入日志。

## 接口清单

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| `GET` | `/health` | 连接测试、版本与延迟 |
| `GET` | `/api/v1/system` | 工具状态、推理设备与后端能力 |
| `GET` | `/api/v1/models` | 声音模型列表、默认模型 |
| `PATCH` | `/api/v1/models/{id}` | 设为默认、重命名、收藏 |
| `POST` | `/api/v1/models/{id}/inspect` | 检查并修复模型 |
| `DELETE` | `/api/v1/models/{id}` | 删除模型及托管文件 |
| `GET` | `/api/v1/hub/models` | 模型站搜索、分页与筛选 |
| `POST` | `/api/v1/hub/downloads` | 从模型站下载并导入 |
| `GET` | `/api/v1/hub/downloads` | 模型站下载任务 |
| `GET` | `/api/v1/preprocess/pymss/models?all_models=true` | PyMSS 完整目录 |
| `POST` | `/api/v1/preprocess/pymss/models/{name}/download` | 下载 PyMSS 模型 |
| `DELETE` | `/api/v1/preprocess/pymss/models/{name}` | 删除 PyMSS 模型 |
| `POST` | `/api/v1/uploads` | 流式上传歌曲或参考音频 |
| `GET` | `/api/v1/uploads/{upload_id}/duration` | 读取上传音频时长 |
| `DELETE` | `/api/v1/uploads/{upload_id}` | 清理上传件 |
| `POST` | `/api/v1/jobs` | 创建翻唱任务 |
| `GET` | `/api/v1/jobs` | 任务列表、搜索、状态筛选 |
| `GET` | `/api/v1/jobs/{job_id}` | 任务详情与步骤 |
| `PATCH` | `/api/v1/jobs/{job_id}` | 重命名 |
| `POST` | `/api/v1/jobs/{job_id}/retry` | 失败重试 |
| `DELETE` | `/api/v1/jobs/{job_id}` | 删除任务及电脑端文件 |
| `GET` | `/api/v1/queue` | 队列概览 |
| `GET` | `/api/v1/jobs/{job_id}/audio?stem=output` | 成品试听/缓存 |
| `GET` | `/api/v1/jobs/{job_id}/stems/{stem}` | 下载成品、伴奏、人声 |
| `GET` | `/api/v1/music/downloaded` | 电脑端已下载素材 |
| `POST` | `/api/v1/music/downloads` | 在线搜索后下载素材到电脑 |
| `POST` | `/api/v1/music/downloaded/use` | 已下载素材复制为上传件 |
| `DELETE` | `/api/v1/music/downloaded/{name}` | 删除电脑端素材 |
| `GET` | `/api/v1/music/sources` | 歌词曲库 |
| `GET` | `/api/v1/music/search` | 搜索歌词候选 |
| `GET` | `/api/v1/music/lyrics` | 时间轴歌词 |

## 新接口与版本要求

以下接口是移动端独立后必须存在的；若电脑端 API 仍是旧版本，会返回 404：

- `GET /api/v1/music/downloaded`
- `POST /api/v1/music/downloads`
- `POST /api/v1/music/downloaded/use`
- `GET /api/v1/music/downloaded/{name}/audio`
- `DELETE /api/v1/music/downloaded/{name}`
- `GET /api/v1/music/sources`
- `GET /api/v1/music/search`
- `GET /api/v1/music/lyrics`
- `GET /api/v1/uploads/{upload_id}/duration`

更新桌面端后需要**重启 API 服务**，旧进程不会自动加载新路由。

## 关键数据契约

### 上传

```http
POST /api/v1/uploads
Content-Type: multipart/form-data

file=<binary>
```

```json
{
  "upload_id": "32 位十六进制",
  "filename": "song.wav",
  "size": 8123456
}
```

### 创建任务（单模型）

```http
POST /api/v1/jobs
Content-Type: application/json
```

```json
{
  "source_upload_id": "…",
  "model_id": "…",
  "title": "作品标题",
  "mode": "single",
  "workflow": "auto_mix",
  "params": {
    "pitch": 0,
    "f0_method": "rmvpe",
    "device": "auto",
    "high_pitch_guard": true,
    "model_params": {},
    "ai_enhancement": {}
  },
  "preprocess": {
    "enabled": true,
    "engine": "pymss",
    "pymss_model": "bs_roformer_voc_hyperacev2.ckpt",
    "harmony_removal_enabled": false
  },
  "vocal_enhancement": {
    "enabled": false,
    "level": "basic"
  }
}
```

多模型任务使用 `mode: "multi"` 与 `segments` 数组；`segments[]` 包含
`start`、`end`、`model_ids`，移动端按音频时长生成并允许手动调整。

### 任务

```json
{
  "id": "…",
  "title": "…",
  "model": "…",
  "model_id": "…",
  "framework": "rvc",
  "status": "running",
  "progress": 63,
  "duration": "4:12",
  "created_at": "ISO 8601",
  "steps": [{ "key": "separate", "label": "人声分离", "status": "done" }],
  "preprocess": { "enabled": true, "engine": "pymss", "pymss_model": "…" },
  "vocal_enhancement": { "enabled": false, "level": "basic" },
  "queue_position": 2
}
```

`status` 取值：`queue` / `running` / `done` / `failed`。

### 已下载素材

```json
{
  "items": [
    { "id": "起风了 - 周深.mp3", "name": "起风了 - 周深", "size": "8.4 MB" }
  ],
  "total": 1
}
```

`id` 是电脑端文件名，可直接用于：

- `POST /api/v1/music/downloaded/use` 复制为上传件；
- `DELETE /api/v1/music/downloaded/{name}` 删除素材。

接口不返回电脑端绝对路径。

### 歌词

```json
{
  "ok": true,
  "name": "起风了",
  "singer": "周深",
  "lines": [
    { "time": 16.6, "text": "这一路上走走停停" }
  ]
}
```

移动端按歌词行生成演唱分段，并循环指派已选模型；歌词只作为初始切分，
后续仍可手动修改。

## PyMSS 约束

移动端不会展示全部 PyMSS 模型。筛选条件：

1. 已下载；
2. 用途为 `vocal_separation`；
3. 输出包含人声轨；
4. 双轨模型必须同时包含人声与伴奏；
5. 排除多轨、单乐器、纯伴奏、KTV/和声、男女声、语音/说话人、二重唱模型。

除 `purpose`、`target_stems`、`stems` 外，还会对文件名做兜底判断。
这与桌面端翻唱页的用途约束一致，并额外拦截不适合整曲翻唱的多轨/乐器模型。

## 错误约定

- `200/201` 成功；
- `400` 参数或业务状态错误；
- `401` API Key 无效；
- `404` 资源不存在（旧版 API 缺少新路由时也会返回 404）；
- `409` 冲突（文件已存在、路径不可用等）；
- `415` 不支持的媒体格式；
- 错误体通常为 `{"detail": "..."}`。

移动端会把 `404 / Not Found` 显示为「电脑端 API 版本过旧，缺少素材/歌词接口」，
提示更新并重启桌面端。
