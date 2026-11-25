/**
 * 本地假 FastAPI 服务，仅用于浏览器预览与界面截图。
 *
 * 不是交付物的一部分：不参与 APK 构建，也不应部署到生产环境。
 * 运行：node tools/mock-server.js [port]
 */
const http = require('http')
const fs = require('fs')
const path = require('path')

const PORT = Number(process.argv[2] || 8788)
const DIST = path.resolve(__dirname, '..', 'web', 'dist')

const now = Date.now()
const iso = (offsetSeconds) => new Date(now + offsetSeconds * 1000).toISOString()

const jobs = [
  {
    id: 'wrk_9f2c41a8d7e3',
    title: '起风了（AI 翻唱）',
    model: '小柔 Soft v2',
    model_id: 'model_ruo_soft',
    framework: 'so-vits-svc',
    status: 'running',
    progress: 63,
    duration: null,
    format: null,
    size: null,
    created_at: iso(-130),
    error: null,
    steps: [
      { key: 'separate', label: '人声分离', status: 'done' },
      { key: 'convert', label: '声音转换', status: 'active' },
      { key: 'enhance', label: 'AI 增强', status: 'wait' },
      { key: 'mix', label: '混音导出', status: 'wait' },
    ],
    workflow: 'auto_mix',
    preprocess: { enabled: true, engine: 'uvr', harmony_removal_enabled: false },
    vocal_enhancement: { enabled: true, level: 'basic' },
    queue_position: null,
    result_url: null,
  },
  {
    id: 'wrk_2b7c90df15aa',
    title: 'Lemon - 米津玄師',
    model: '男声·沉',
    model_id: 'model_deep_male',
    framework: 'rvc',
    status: 'done',
    progress: 100,
    duration: '4:12',
    format: 'WAV',
    size: '8.4 MB',
    created_at: iso(-3600),
    error: null,
    steps: [
      { key: 'separate', label: '人声分离', status: 'done' },
      { key: 'convert', label: '声音转换', status: 'done' },
      { key: 'enhance', label: 'AI 增强', status: 'done' },
      { key: 'mix', label: '混音导出', status: 'done' },
    ],
    workflow: 'auto_mix',
    preprocess: { enabled: true, engine: 'uvr', harmony_removal_enabled: false },
    vocal_enhancement: { enabled: true, level: 'advanced' },
    queue_position: null,
    result_url: '/api/v1/jobs/wrk_2b7c90df15aa/audio',
  },
  {
    id: 'wrk_71a0c5e9bb42',
    title: '海底（Cover）',
    model: '小柔 Soft v2',
    model_id: 'model_ruo_soft',
    framework: 'so-vits-svc',
    status: 'queue',
    progress: 0,
    duration: null,
    format: null,
    size: null,
    created_at: iso(-45),
    error: null,
    steps: [
      { key: 'separate', label: '人声分离', status: 'wait' },
      { key: 'convert', label: '声音转换', status: 'wait' },
      { key: 'mix', label: '混音导出', status: 'wait' },
    ],
    workflow: 'auto_mix',
    preprocess: { enabled: true, engine: 'pymss', harmony_removal_enabled: true },
    vocal_enhancement: { enabled: false, level: 'basic' },
    queue_position: 2,
    result_url: null,
  },
  {
    id: 'wrk_30d6b2f4c118',
    title: '孤勇者 - 陈奕迅',
    model: '星河 SeedVC',
    model_id: 'model_seed_galaxy',
    framework: 'seed-vc',
    status: 'done',
    progress: 100,
    duration: '4:01',
    format: 'FLAC',
    size: '24.6 MB',
    created_at: iso(-9800),
    error: null,
    steps: [
      { key: 'separate', label: '人声分离', status: 'done' },
      { key: 'convert', label: '声音转换', status: 'done' },
      { key: 'mix', label: '混音导出', status: 'done' },
    ],
    workflow: 'auto_mix',
    preprocess: { enabled: true, engine: 'uvr', harmony_removal_enabled: false },
    vocal_enhancement: { enabled: false, level: 'basic' },
    queue_position: null,
    result_url: '/api/v1/jobs/wrk_30d6b2f4c118/audio',
  },
  {
    id: 'wrk_5c8891ab77de',
    title: '空心（Live 版）',
    model: '男声·沉',
    model_id: 'model_deep_male',
    framework: 'rvc',
    status: 'failed',
    progress: 45,
    duration: null,
    format: null,
    size: null,
    created_at: iso(-18400),
    error: 'UVR 分离失败：模型文件 MD5 校验不通过，请到模型站重新下载 UVR 分离模型。',
    steps: [
      { key: 'separate', label: '人声分离', status: 'failed' },
      { key: 'convert', label: '声音转换', status: 'wait' },
      { key: 'mix', label: '混音导出', status: 'wait' },
    ],
    workflow: 'auto_mix',
    preprocess: { enabled: true, engine: 'uvr', harmony_removal_enabled: false },
    vocal_enhancement: { enabled: false, level: 'basic' },
    queue_position: null,
    result_url: null,
  },
  {
    id: 'wrk_8e34cd20f1b9',
    title: '光年之外',
    model: '小柔 Soft v2',
    model_id: 'model_ruo_soft',
    framework: 'so-vits-svc',
    status: 'done',
    progress: 100,
    duration: '3:55',
    format: 'WAV',
    size: '7.1 MB',
    created_at: iso(-86000),
    error: null,
    steps: [
      { key: 'separate', label: '人声分离', status: 'done' },
      { key: 'convert', label: '声音转换', status: 'done' },
      { key: 'mix', label: '混音导出', status: 'done' },
    ],
    workflow: 'auto_mix',
    preprocess: { enabled: true, engine: 'uvr', harmony_removal_enabled: false },
    vocal_enhancement: { enabled: true, level: 'basic' },
    queue_position: null,
    result_url: '/api/v1/jobs/wrk_8e34cd20f1b9/audio',
  },
]

const models = [
  {
    id: 'model_ruo_soft',
    name: '小柔 Soft v2',
    type: '女声 · 温柔',
    framework: 'so-vits-svc',
    sample_rate: '44.1 kHz',
    size: '186 MB',
    favorite: true,
    tags: ['中文', '抒情'],
  },
  {
    id: 'model_deep_male',
    name: '男声·沉',
    type: '男声 · 低音',
    framework: 'rvc',
    sample_rate: '48 kHz',
    size: '142 MB',
    favorite: false,
    tags: ['中文', 'RVC v2'],
  },
  {
    id: 'model_seed_galaxy',
    name: '星河 SeedVC',
    type: '通用音色',
    framework: 'seed-vc',
    sample_rate: '44.1 kHz',
    size: '1.2 GB',
    favorite: true,
    tags: ['参考音频'],
  },
  {
    id: 'model_ddsp_air',
    name: '空气感 DDSP',
    type: '女声 · 气声',
    framework: 'ddsp-svc',
    sample_rate: '44.1 kHz',
    size: '98 MB',
    favorite: false,
    tags: ['气声'],
  },
  {
    id: 'model_old_demo',
    name: '旧版示例模型',
    type: '未知',
    framework: 'so-vits-svc',
    sample_rate: '40 kHz',
    size: '75 MB',
    favorite: false,
    tags: [],
  },
]
let defaultModelId = 'model_ruo_soft'

const pymssModels = [
  ['bs_roformer_voc_hyperacev2', 'BS-RoFormer', 'vocal_separation', '人声分离', '人声 / 伴奏', 642, true],
  ['UVR-MDX-NET-Inst_HQ_4', 'MDX-Net', 'vocal_separation', '人声分离', '人声 / 伴奏', 128, true],
  ['HTDemucs4_6stems', 'HTDemucs', 'vocal_separation', '多轨分离', '鼓 / 贝斯 / 人声 / 其他', 402, false],
  ['UVR-DeEcho-DeReverb.pth', 'DeEcho', 'dereverb', '去混响', '人声净化', 96, true],
  ['UVR-DeEcho-Normal.pth', 'DeEcho', 'dereverb', '去混响', '人声净化', 96, false],
  ['vocals_mel_band_roformer', 'Mel-Band RoFormer', 'vocal_separation', '人声分离', '人声 / 伴奏', 512, false],
  ['Kim_Vocal_2.onnx', 'UVR', 'vocal_separation', '人声分离', '人声 / 伴奏', 64, true],
  ['UVR-MDX-NET-Inst_Main.onnx', 'UVR', 'vocal_separation', '人声分离', '人声 / 伴奏', 64, false],
  ['dereverb_echo_spotify', 'Spleeter', 'dereverb', '去混响', '人声净化', 58, false],
  ['bs_roformer_instrumental', 'BS-RoFormer', 'vocal_separation', '伴奏提取', '伴奏', 628, false],
  ['6_HP-Kim_Vocal_2.onnx', 'UVR', 'vocal_separation', '人声分离', '人声 / 伴奏', 66, false],
  ['UVR-MDX23C-vocals', 'MDX23C', 'vocal_separation', '人声分离', '人声 / 伴奏', 310, false],
  ['melband_roformer_instvox_duality_v2.ckpt', 'Mel-Band RoFormer', '', '人声 / 人声-伴奏双向分离', 'vocals / instrumental', 780, true],
  ['mel_band_roformer_karaoke_gabox_v2.ckpt', 'Mel-Band RoFormer', '', '卡拉OK/和声', 'backing_vocal', 410, true],
].map(([name, architecture, purpose, categoryLabel, target, size, downloaded]) => ({
  name,
  architecture,
  supported: true,
  category_label: categoryLabel,
  purpose,
  purpose_label: categoryLabel,
  target_stem: target,
  target_stems: target.split(' / '),
  stems: target.split(' / '),
  primary_stem: target.split(' / ')[0],
  size_bytes: Number(size) * 1024 * 1024,
  downloaded: Boolean(downloaded),
}))

const downloads = []

const hubModels = [
  ['xb-svcb/ruo-soft-v2', '小柔 Soft v2', 'so-vits-svc', 'So-VITS-SVC', 'Lkpap', '44.1 kHz', ['中文', '抒情'], '柔和女声，适合流行与民谣。', true],
  ['xb-svcb/deep-male', '男声·沉', 'rvc', 'RVC', 'Lkpap', '48 kHz', ['中文', '低音'], '低音男声，RVC v2 模型。', true],
  ['xb-svcb/seed-galaxy', '星河 SeedVC', 'seed-vc', 'SeedVC', 'Lkpap', '44.1 kHz', ['参考音频'], '零样本音色克隆，适合快速试音。', false],
  ['xb-svcb/ddsp-air', '空气感 DDSP', 'ddsp-svc', 'DDSP-SVC', 'Lkpap', '44.1 kHz', ['气声'], '轻气声女声，DDSP-SVC 训练。', false],
  ['xb-svcb/anime-rain', '雨音 · 动漫', 'so-vits-svc', 'So-VITS-SVC', 'Mio', '44.1 kHz', ['日文', '动漫'], '日系清亮音色，适合 ACG 曲目。', false],
  ['xb-svcb/night-radio', '午夜电台男声', 'rvc', 'RVC', 'Mio', '40 kHz', ['中文', '旁白'], '低沉电台嗓，RVC v2。', false],
  ['xb-svcb/clear-girl', '清透少女', 'so-vits-svc', 'So-VITS-SVC', 'Nanami', '44.1 kHz', ['中文', '清亮'], '高音清透，适合高音女声。', false],
  ['xb-svcb/seed-whisper', '耳语 SeedVC', 'seed-vc', 'SeedVC', 'Nanami', '44.1 kHz', ['气声'], '耳语质感，需要参考音频。', false],
].map(([repoId, name, framework, frameworkLabel, author, sampleRate, tags, description, installed]) => ({
  repo_id: repoId,
  name,
  type: frameworkLabel,
  framework,
  framework_label: frameworkLabel,
  sample_rate: sampleRate,
  author,
  has_diffusion: framework === 'so-vits-svc',
  url: `https://modelscope.cn/models/${repoId}`,
  description,
  tags,
  version: 'v1',
  uploaded_at: iso(-86400 * 30),
  update: installed
    ? { installed: true, available: true, model_id: `model_${repoId.replace('/', '_')}`, model_name: name }
    : { installed: false, available: true },
}))

const hubJobs = []

const downloadedMusic = [
  { id: '起风了 - 周深.mp3', name: '起风了 - 周深', size: '8.4 MB' },
  { id: 'Lemon - 米津玄師.flac', name: 'Lemon - 米津玄師', size: '24.6 MB' },
  { id: '海底 - 一支榴莲.wav', name: '海底 - 一支榴莲', size: '36.2 MB' },
  { id: '孤勇者 - 陈奕迅.mp3', name: '孤勇者 - 陈奕迅', size: '9.1 MB' },
]

const lyricLines = [
  { time: 0.5, text: '这一路上走走停停' },
  { time: 5.2, text: '顺着少年漂流的痕迹' },
  { time: 10.4, text: '迈出车站的前一刻' },
  { time: 15.6, text: '竟有些犹豫' },
  { time: 20.3, text: '不禁笑这近乡情怯' },
  { time: 25.1, text: '仍无可避免' },
  { time: 30.2, text: '而长野的天' },
  { time: 35.4, text: '依旧那么暖' },
  { time: 40.6, text: '风吹起了从前' },
]

function wavBuffer(seconds = 6, freq = 440) {
  const rate = 22050
  const samples = rate * seconds
  const buffer = Buffer.alloc(44 + samples * 2)
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + samples * 2, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(rate, 24)
  buffer.writeUInt32LE(rate * 2, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(samples * 2, 40)
  for (let i = 0; i < samples; i += 1) {
    const t = i / rate
    const envelope = Math.min(1, t * 4) * Math.min(1, (seconds - t) * 4)
    const value = Math.sin(2 * Math.PI * freq * t) * 0.25 * envelope
    buffer.writeInt16LE(Math.round(value * 32767), 44 + i * 2)
  }
  return buffer
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'X-API-Key, Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Cache-Control': 'no-store',
  })
  res.end(body)
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
  })
}

function publicJob(job) {
  return { ...job }
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
}

function serveStatic(req, res) {
  const url = new URL(req.url, 'http://localhost')
  let filePath = path.join(DIST, decodeURIComponent(url.pathname))
  if (url.pathname === '/' || !path.extname(filePath)) filePath = path.join(DIST, 'index.html')
  if (!filePath.startsWith(DIST) || !fs.existsSync(filePath)) {
    res.writeHead(404)
    res.end('not found')
    return
  }
  res.writeHead(200, {
    'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream',
    'Cache-Control': 'no-store',
  })
  fs.createReadStream(filePath).pipe(res)
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost')
  const pathname = url.pathname

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'X-API-Key, Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    })
    res.end()
    return
  }

  if (!pathname.startsWith('/api/') && pathname !== '/health') {
    serveStatic(req, res)
    return
  }

  if (pathname === '/health') {
    sendJson(res, 200, { ok: true, app: 'XB-SVCB', version: '0.1.2', api_version: 'v1' })
    return
  }

  if (pathname === '/api/v1/system') {
    sendJson(res, 200, {
      ready: true,
      tools: [
        { key: 'uvr', name: 'UVR 人声分离', desc: '分离人声与伴奏', version: '5.6.0', status: 'CUDA 可用', ok: true },
        { key: 'ffmpeg', name: 'FFmpeg', desc: '音频解码与编码', version: '7.1', status: '就绪', ok: true },
        { key: 'pymss', name: 'PyMSS', desc: '人声分离 / 去混响', version: '1.2.4', status: '环境就绪', ok: true },
        { key: 'svc', name: 'So-VITS-SVC', desc: '歌声转换', version: '4.1', status: 'CUDA 12.6', ok: true },
        { key: 'rvc', name: 'RVC', desc: '歌声转换', version: '2.2', status: 'CUDA 12.6', ok: true },
        { key: 'seedvc', name: 'SeedVC', desc: '参考音频克隆', version: '1.0', status: '显存不足时自动降级', ok: true },
      ],
      inference_devices: {
        preferred: 'cuda',
        options: [
          { value: 'auto', label: '自动', backend: 'auto', name: 'RTX 4070 SUPER', frameworks: ['uvr', 'so-vits-svc', 'rvc', 'seed-vc'] },
          { value: 'cuda', label: 'CUDA', backend: 'cuda', name: 'RTX 4070 SUPER', frameworks: ['uvr', 'so-vits-svc', 'rvc', 'seed-vc'] },
          { value: 'cpu', label: 'CPU', backend: 'cpu', name: 'Intel i7-13700', frameworks: ['uvr', 'so-vits-svc', 'rvc', 'seed-vc'] },
        ],
        frameworks: {},
      },
    })
    return
  }

  if (pathname === '/api/v1/jobs' && req.method === 'GET') {
    sendJson(res, 200, { items: jobs.map(publicJob), total: jobs.length })
    return
  }

  if (pathname === '/api/v1/jobs/queue') {
    const pending = jobs.filter((job) => job.status === 'queue').map((job) => job.id)
    sendJson(res, 200, { running: jobs.some((job) => job.status === 'running'), pending, size: pending.length })
    return
  }

  if (pathname === '/api/v1/jobs' && req.method === 'POST') {
    const body = JSON.parse((await readBody(req)).toString('utf8') || '{}')
    const model = models.find((item) => item.id === body.model_id) || models[0]
    const job = {
      id: `wrk_${Math.random().toString(16).slice(2, 14)}`,
      title: body.title || '未命名翻唱',
      model: model.name,
      model_id: model.id,
      framework: model.framework,
      status: 'queue',
      progress: 0,
      duration: null,
      format: null,
      size: null,
      created_at: iso(0),
      error: null,
      steps: [
        { key: 'separate', label: '人声分离', status: 'wait' },
        { key: 'convert', label: '声音转换', status: 'wait' },
        { key: 'mix', label: '混音导出', status: 'wait' },
      ],
      workflow: body.workflow || 'auto_mix',
      preprocess: body.preprocess || { enabled: true, engine: 'uvr' },
      vocal_enhancement: body.vocal_enhancement || { enabled: false, level: 'basic' },
      queue_position: jobs.filter((item) => item.status === 'queue').length + 1,
      result_url: null,
    }
    jobs.unshift(job)
    sendJson(res, 202, job)
    return
  }

  const jobMatch = pathname.match(/^\/api\/v1\/jobs\/([^/]+)(\/retry|\/audio)?$/)
  if (jobMatch) {
    const job = jobs.find((item) => item.id === jobMatch[1])
    if (!job) {
      sendJson(res, 404, { detail: '任务不存在' })
      return
    }
    const suffix = jobMatch[2]
    if (suffix === '/audio') {
      const wav = wavBuffer(8, 392)
      res.writeHead(200, {
        'Content-Type': 'audio/wav',
        'Content-Length': wav.length,
        'Content-Disposition': `attachment; filename="${job.id}_output.wav"`,
        'Access-Control-Allow-Origin': '*',
      })
      res.end(wav)
      return
    }
    if (suffix === '/retry' && req.method === 'POST') {
      job.status = 'queue'
      job.progress = 0
      job.error = null
      job.queue_position = 2
      sendJson(res, 200, { ok: true, job_id: job.id })
      return
    }
    if (req.method === 'PATCH') {
      const body = JSON.parse((await readBody(req)).toString('utf8') || '{}')
      job.title = body.title || job.title
      sendJson(res, 200, job)
      return
    }
    if (req.method === 'DELETE') {
      const index = jobs.indexOf(job)
      jobs.splice(index, 1)
      sendJson(res, 200, { ok: true, id: job.id })
      return
    }
    sendJson(res, 200, job)
    return
  }

  if (pathname === '/api/v1/models' && req.method === 'GET') {
    sendJson(res, 200, { items: models, total: models.length, default_id: defaultModelId })
    return
  }

  if (pathname === '/api/v1/models/default' && req.method === 'POST') {
    const body = JSON.parse((await readBody(req)).toString('utf8') || '{}')
    defaultModelId = body.model_id
    sendJson(res, 200, { ok: true, id: defaultModelId })
    return
  }

  const modelMatch = pathname.match(/^\/api\/v1\/models\/([^/]+)(\/favorite|\/inspect)?$/)
  if (modelMatch) {
    const model = models.find((item) => item.id === modelMatch[1])
    if (!model) {
      sendJson(res, 404, { detail: '模型不存在' })
      return
    }
    if (modelMatch[2] === '/favorite') {
      model.favorite = !model.favorite
      sendJson(res, 200, model)
      return
    }
    if (modelMatch[2] === '/inspect') {
      sendJson(res, 200, {
        ok: model.id !== 'model_old_demo',
        model,
        issues: model.id === 'model_old_demo' ? [{ code: 'missing_config', message: '缺少 config.json，无法读取采样率' }] : [],
        fixed: [],
      })
      return
    }
    if (req.method === 'PATCH') {
      const body = JSON.parse((await readBody(req)).toString('utf8') || '{}')
      model.name = body.name || model.name
      sendJson(res, 200, model)
      return
    }
    if (req.method === 'DELETE') {
      models.splice(models.indexOf(model), 1)
      sendJson(res, 200, { ok: true, id: model.id })
      return
    }
    sendJson(res, 200, model)
    return
  }

  if (pathname === '/api/v1/music/sources') {
    sendJson(res, 200, {
      items: [
        { id: 'wy', name: '网易云音乐', cookie: false },
        { id: 'qq', name: 'QQ 音乐', cookie: true },
        { id: 'kuwo', name: '酷我音乐', cookie: false },
      ],
      total: 3,
      default_id: 'wy',
    })
    return
  }

  if (pathname === '/api/v1/music/search') {
    const query = url.searchParams.get('query') || ''
    sendJson(res, 200, {
      ok: true,
      keyword: query,
      source: url.searchParams.get('source') || 'wy',
      songs: [
        { n: 1, name: query || '起风了', singer: '周深', album: '起风了', rid: '1001' },
        { n: 2, name: `${query || '起风了'} (Live)`, singer: '周深', album: '演唱会', rid: '1002' },
        { n: 3, name: '雨爱', singer: '杨丞琳', album: '雨爱', rid: '1003' },
      ],
    })
    return
  }

  if (pathname === '/api/v1/music/lyrics') {
    sendJson(res, 200, {
      ok: true,
      name: url.searchParams.get('query') || '起风了',
      singer: '周深',
      lines: lyricLines,
    })
    return
  }

  if (pathname === '/api/v1/music/downloaded' && req.method === 'GET') {
    sendJson(res, 200, { items: downloadedMusic, total: downloadedMusic.length })
    return
  }

  if (pathname === '/api/v1/music/downloaded/use' && req.method === 'POST') {
    const body = JSON.parse((await readBody(req)).toString('utf8') || '{}')
    const item = downloadedMusic.find((entry) => entry.id === body.name)
    if (!item) {
      sendJson(res, 404, { detail: '素材不存在' })
      return
    }
    sendJson(res, 201, {
      upload_id: Math.random().toString(16).slice(2, 34),
      filename: item.id,
      size: 8_800_000,
    })
    return
  }

  if (pathname === '/api/v1/music/downloads' && req.method === 'POST') {
    const body = JSON.parse((await readBody(req)).toString('utf8') || '{}')
    const name = `${body.query || '新素材'} - 下载版`
    const filename = `${name}.mp3`
    if (!downloadedMusic.some((item) => item.id === filename)) {
      downloadedMusic.unshift({ id: filename, name, size: '10.2 MB' })
    }
    sendJson(res, 200, { ok: true, name, message: '已下载到电脑端素材库' })
    return
  }

  const materialAudioMatch = pathname.match(/^\/api\/v1\/music\/downloaded\/(.+)\/audio$/)
  if (materialAudioMatch && req.method === 'GET') {
    const name = decodeURIComponent(materialAudioMatch[1])
    const item = downloadedMusic.find((entry) => entry.id === name)
    if (!item) {
      sendJson(res, 404, { detail: '素材不存在' })
      return
    }
    const wav = wavBuffer(8, 330)
    res.writeHead(200, {
      'Content-Type': 'audio/wav',
      'Content-Length': wav.length,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(name)}"`,
      'Access-Control-Allow-Origin': '*',
    })
    res.end(wav)
    return
  }

  const materialDeleteMatch = pathname.match(/^\/api\/v1\/music\/downloaded\/(.+)$/)
  if (materialDeleteMatch && req.method === 'DELETE' && !pathname.endsWith('/use')) {
    const name = decodeURIComponent(materialDeleteMatch[1])
    const index = downloadedMusic.findIndex((entry) => entry.id === name)
    if (index < 0) {
      sendJson(res, 404, { detail: '素材不存在' })
      return
    }
    downloadedMusic.splice(index, 1)
    sendJson(res, 200, { ok: true, id: name })
    return
  }

  const uploadDurationMatch = pathname.match(/^\/api\/v1\/uploads\/([^/]+)\/duration$/)
  if (uploadDurationMatch) {
    sendJson(res, 200, { upload_id: uploadDurationMatch[1], duration: 240 })
    return
  }

  if (pathname === '/api/v1/hub/models' && req.method === 'GET') {
    const query = (url.searchParams.get('query') || '').trim().toLowerCase()
    const page = Math.max(1, Number(url.searchParams.get('page') || 1))
    const pageSize = Math.max(1, Number(url.searchParams.get('page_size') || 12))
    const framework = url.searchParams.get('framework') || ''
    const filtered = hubModels.filter((item) => {
      if (framework && item.framework !== framework) return false
      if (!query) return true
      return (
        item.name.toLowerCase().includes(query) ||
        item.author.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        (item.tags || []).some((tag) => tag.toLowerCase().includes(query))
      )
    })
    const start = (page - 1) * pageSize
    sendJson(res, 200, {
      ok: true,
      items: filtered.slice(start, start + pageSize),
      page,
      page_size: pageSize,
      total: filtered.length,
      has_more: start + pageSize < filtered.length,
    })
    return
  }

  if (pathname === '/api/v1/hub/downloads' && req.method === 'POST') {
    const body = JSON.parse((await readBody(req)).toString('utf8') || '{}')
    const repoId = String(body.repo_id || '')
    const item = hubModels.find((model) => model.repo_id === repoId)
    if (!item) {
      sendJson(res, 404, { detail: '模型不存在' })
      return
    }
    const key = `dl:${repoId}`
    if (!hubJobs.some((job) => job.key === key && job.status === 'running')) {
      hubJobs.unshift({
        key,
        kind: 'download',
        title: item.name,
        status: 'running',
        pct: 4,
        msg: '准备下载',
        phase: 'download',
        created_at: iso(0),
        error: null,
      })
    }
    sendJson(res, 202, { ok: true, key })
    return
  }

  if (pathname === '/api/v1/hub/downloads' && req.method === 'GET') {
    sendJson(res, 200, { items: hubJobs, total: hubJobs.length })
    return
  }

  if (pathname === '/api/v1/preprocess/pymss/models') {
    sendJson(res, 200, {
      items: pymssModels,
      status: { ok: true, environment: true, model: 'bs_roformer_voc_hyperacev2', status: 'ready', version: '1.2.4' },
    })
    return
  }

  if (pathname === '/api/v1/preprocess/pymss/downloads') {
    sendJson(res, 200, { items: downloads })
    return
  }

  const pymssMatch = pathname.match(/^\/api\/v1\/preprocess\/pymss\/models\/(.+?)(\/download)?$/)
  if (pymssMatch && req.method !== 'GET') {
    const name = decodeURIComponent(pymssMatch[1])
    const item = pymssModels.find((model) => model.name === name)
    if (!item) {
      sendJson(res, 404, { detail: '模型不存在' })
      return
    }
    if (pymssMatch[2] === '/download') {
      const key = `pymss:${name.replace(/\.[^.]+$/, '').toLowerCase()}`
      if (!downloads.some((job) => job.key === key && job.status === 'running')) {
        downloads.unshift({ key, model: name, status: 'running', pct: 3, message: '已加入后台下载' })
      }
      sendJson(res, 200, { ok: true, key })
      return
    }
    item.downloaded = false
    sendJson(res, 200, { ok: true, id: name })
    return
  }

  if (pathname === '/api/v1/uploads' && req.method === 'POST') {
    const body = await readBody(req)
    sendJson(res, 201, {
      upload_id: Math.random().toString(16).slice(2, 34),
      filename: 'demo-song.wav',
      size: body.length,
    })
    return
  }

  if (pathname.startsWith('/api/v1/uploads/') && req.method === 'DELETE') {
    sendJson(res, 200, { ok: true, upload_id: pathname.split('/').pop() })
    return
  }

  sendJson(res, 404, { detail: '接口不存在' })
})

// 模拟 PyMSS 下载进度，方便观察进度条与完成态。
setInterval(() => {
  for (const job of downloads) {
    if (job.status !== 'running') continue
    job.pct = Math.min(100, job.pct + 4)
    job.message = `正在下载 ${job.pct}%`
    if (job.pct >= 100) {
      job.status = 'done'
      job.message = '下载完成'
      const item = pymssModels.find((model) => model.name === job.model)
      if (item) item.downloaded = true
    }
  }
  for (const job of hubJobs) {
    if (job.status !== 'running') continue
    job.pct = Math.min(100, job.pct + 3)
    job.msg = `正在下载 ${job.pct}%`
    if (job.pct >= 100) {
      job.status = 'done'
      job.msg = '下载完成'
      job.result = { model: { id: `model_${job.key.slice(3).replace('/', '_')}`, name: job.title } }
      const hubItem = hubModels.find((model) => `dl:${model.repo_id}` === job.key)
      if (hubItem) {
        hubItem.update = { installed: true, available: true, model_id: job.result.model.id, model_name: job.title }
        if (!models.some((model) => model.id === job.result.model.id)) {
          models.push({
            id: job.result.model.id,
            name: job.title,
            type: '模型站导入',
            framework: hubItem.framework,
            sample_rate: hubItem.sample_rate,
            size: '—',
            favorite: false,
            tags: hubItem.tags,
          })
        }
      }
    }
  }
}, 600)

server.listen(PORT, '127.0.0.1', () => {
  console.log(`mock XB-SVCB API & UI: http://127.0.0.1:${PORT}`)
})
