/**
 * 运行时文案翻译层。
 *
 * 移动端有大量早期中文文案散落在模板与提示里。这里用中文原文作为键，
 * 在英文界面下统一替换文本节点与 placeholder，避免遗漏；后续新增文案
 * 只需补 EN 词表即可，不影响中文原文和其他逻辑。
 */
const EN: Record<string, string> = {
  '选歌 → 挑模型 → 调参数，推理会在电脑端自动排队执行。':
    'Pick a song, choose models and tune params; inference queues on your PC.',
  '选择歌曲': 'Choose a song',
  '支持 AAC / FLAC / M4A / MP3 / OGG / WAV 等格式，不设固定大小上限':
    'AAC / FLAC / M4A / MP3 / OGG / WAV and more, no fixed size limit',
  '点击选择音频文件': 'Tap to choose an audio file',
  '从手机文件中选择一首歌': 'Pick a song from this phone',
  '从已下载素材选择': 'Choose from downloaded materials',
  '重新选择文件': 'Choose another file',
  '选择声音模型': 'Choose voice models',
  '单模型': 'Single',
  '多模型': 'Multi',
  '整首歌使用一个声音模型，适合大多数翻唱。':
    'One voice model for the whole song; best for most covers.',
  '选择 2 个以上模型并划分演唱区间，可做对唱或合唱。':
    'Pick 2+ models and split the timeline for duets or choruses.',
  '至少选择 2 个模型才能划分演唱分段。':
    'Select at least 2 models to split the song into segments.',
  '生成设置': 'Generation settings',
  '默认参数适合大多数歌曲，可按需微调':
    'Defaults suit most songs; adjust only if needed',
  '作品标题': 'Cover title',
  '留空则使用源文件名': 'Leave empty to use the source filename',
  '音高偏移': 'Pitch shift',
  '半音，男声↔女声常用 ±12': 'Semitones; ±12 for male↔female',
  '归零': 'Reset',
  'F0 提取算法': 'F0 extraction',
  'RMVPE 在多数场景表现稳定': 'RMVPE is stable in most cases',
  '高音保护': 'High-note guard',
  '对超出可靠音域的高音局部降调再还原':
    'Locally lower and restore notes beyond the reliable range',
  '模型专用参数': 'Model-specific params',
  '前处理与后期': 'Pre- and post-processing',
  '手机端只保留常用开关，精细编辑请回电脑端':
    'Only common switches on mobile; fine editing stays on the PC',
  '人声分离': 'Vocal separation',
  '推理前先分离人声和伴奏': 'Separate vocals and instrumental before inference',
  'AI 美声': 'AI vocal polish',
  '修音、对齐与轻母带，提升成品完整度':
    'Pitch, alignment and light mastering for a finished sound',
  '基础': 'Basic',
  '进阶': 'Advanced',
  '恢复默认': 'Reset',
  '自然修音': 'Natural tuning',
  '只收敛音高漂移，保留颤音与滑音。':
    'Correct pitch drift while keeping vibrato and slides.',
  'AI 对齐': 'AI alignment',
  '按停顿与音素对齐，校正抢拍和拖拍。':
    'Align on pauses and phonemes; fix rushed or dragged timing.',
  '音色共振峰': 'Vocal formant',
  '强化转换声音自身的稳定共振峰。':
    'Strengthen stable formants in the converted voice.',
  'AI EQ': 'AI EQ',
  '按人声频谱做保守宽带校正。': 'Conservative broadband correction for vocals.',
  'AI 压缩': 'AI compression',
  '自动设定阈值并补偿响度。': 'Set thresholds and compensate loudness automatically.',
  'AI 激励': 'AI excitation',
  '抑制齿音后生成少量高频谐波。': 'Add subtle high harmonics after taming sibilance.',
  '立体声宽度': 'Stereo width',
  '低频保持居中，保证单声道兼容。':
    'Keep bass centered for mono compatibility.',
  '响度包络': 'Loudness envelope',
  '恢复自然起伏，避开停顿与噪声。':
    'Restore natural dynamics without pauses or noise.',
  '高级参数': 'Advanced params',
  '多模型混唱、时间轴编排、音频编辑与自定义工作流仍由电脑端负责。':
    'Multi-model mixing, timeline editing and workflows stay on the PC.',
  '开始生成': 'Start generation',
  '请选择要翻唱的歌曲': 'Choose a song to cover',
  '已就绪，任务将进入电脑端队列': 'Ready; the job will enter the PC queue',
  '歌词时间轴': 'Lyric timeline',
  '可选 · 自动填歌名并生成分段': 'Optional · auto-fill song and build segments',
  '歌曲名 / 歌手': 'Song / artist',
  '获取': 'Fetch',
  '上传歌曲后会自动填入歌名；也可手动输入后从曲库获取时间轴歌词。':
    'The song name auto-fills after upload; you can also type it and fetch timed lyrics.',
  '重新分段': 'Rebuild segments',
  '演唱分段': 'Singing segments',
  '平均分段': 'Split evenly',
  '添加': 'Add',
  '开始': 'Start',
  '结束': 'End',
  '删除分段': 'Delete segment',
  '同一段选择多个模型会生成合唱；分段可以留白，留白区间不演唱。':
    'Multiple models in one segment create a chorus; gaps are left silent.',
  '搜索模型名称、框架或标签': 'Search model name, framework or tag',
  '全部模型': 'All models',
  '收藏': 'Favorites',
  '设为默认': 'Set default',
  '重命名': 'Rename',
  '检查': 'Inspect',
  '删除': 'Delete',
  '默认': 'Default',
  '声音模型': 'Voice models',
  '模型站': 'Model Hub',
  '声音模型用于翻唱，PyMSS 模型用于人声分离与净化':
    'Voice models for covers; PyMSS models for separation and cleanup',
  '搜索模型名称、作者或标签': 'Search model name, author or tag',
  '电脑端素材': 'PC materials',
  '在线候选': 'Online results',
  '下载位置': 'Download target',
  '在线搜索并下载到电脑': 'Search online and download to PC',
  '主软件素材库': 'Desktop library',
  '搜索': 'Search',
  '电脑端已下载素材': 'Downloaded on PC',
  '用于翻唱': 'Use for cover',
  '下载到电脑': 'Download to PC',
  '下载中': 'Downloading',
  '读取素材失败': 'Failed to load materials',
  '重试': 'Retry',
  '没有匹配的素材': 'No matching materials',
  '电脑端还没有已下载素材': 'No downloaded materials on the PC yet',
  '刷新素材': 'Refresh materials',
  '搜索电脑端已下载素材': 'Search downloaded materials on the PC',
  '素材下载会直接在电脑端完成并进入主软件「资源获取」素材库，不保存到手机； 翻唱作品在':
    'Downloads happen on the PC and land in the desktop “Resources” library, never on this phone. Covers are in',
  查看: 'view',
  '网易云音乐': 'NetEase',
  'QQ 音乐': 'QQ Music',
  '酷我音乐': 'Kuwo',
  '中文': 'Chinese',
  '女声': 'Female',
  '男声': 'Male',
  '温柔': 'Gentle',
  '低音': 'Low',
  '通用音色': 'General timbre',
  '参考音频': 'Reference audio',
  '气声': 'Breathy',
  未知: 'Unknown',
  '抒情': 'Lyrical',
  '输入歌名后搜索，选择结果即可在电脑端下载；下载完成后会出现在下方素材列表。':
    'Search a song, then download the result on your PC; it appears in the list below.',
  '这里只管理素材；完成或进行中的翻唱作品在「作品」页，音频编辑与自定义工作流仍在电脑端。':
    'This page manages materials only. Covers live under Works; audio editing and workflows stay on the PC.',
  '任务 ID': 'Job ID',
  '重命名作品': 'Rename cover',
  '删除这个翻唱任务？': 'Delete this cover job?',
  '放弃这次创建？': 'Discard this draft?',
  '取消选择': 'Deselect',
  '已取消选择': 'Deselected',
  '没有匹配的模型': 'No matching models',
  '电脑端还没有可用模型': 'No models available on the PC yet',
  '电脑端还没有声音模型': 'No voice models on the PC yet',
  '模型站没有返回结果': 'The model hub returned no results',
  '手机负责管理任务与素材，推理仍在电脑上完成。填好局域网地址与 API Key 即可开始。':
    'The phone manages jobs and materials; inference stays on the PC. Enter the LAN address and API Key to begin.',
  'API 服务默认关闭；请先在电脑端点「启动服务」，并切换到局域网模式。':
    'The API is off by default. Start the service on the PC and switch it to LAN mode first.',
  '电脑端「资料库 → API 接入」页会显示局域网地址，默认端口 8760。':
    'The desktop “Library → API Access” page shows the LAN address; default port 8760.',
  '地址与 API Key 存于应用私有存储，不会写入日志或上传。':
    'The address and API Key are stored only in app-private storage; never logged or uploaded.',
  'API 监听范围选「局域网」，不要在公网直接映射端口。':
    'Choose “LAN” for API listening; never expose the port directly to the internet.',
  '搜索作品、模型或任务 ID': 'Search covers, models or job ID',
  '全部任务': 'All jobs',
  '排队 / 进行中': 'Queued / running',
  '已完成': 'Done',
  '失败': 'Failed',
  '还没有翻唱作品': 'No covers yet',
  '创建第一首翻唱': 'Create your first cover',
  '任务详情': 'Job details',
  '试听': 'Preview',
  '下载成品': 'Download final',
  '下载伴奏': 'Download instrumental',
  '下载人声': 'Download vocals',
  '关闭': 'Close',
  '详情': 'Details',
  '状态': 'Status',
  '创建时间': 'Created',
  '完成时间': 'Finished',
  '未命名翻唱': 'Untitled cover',
  '推理队列空闲': 'Inference queue idle',
  '等待推理队列': 'Waiting for the inference queue',
  '服务地址': 'Server address',
  'API Key': 'API Key',
  '仅测试连接': 'Test only',
  '连接并进入': 'Connect & enter',
  '手机与电脑在同一 Wi-Fi': 'Phone and PC on the same Wi-Fi',
  'Key 只保存在本机': 'Key is stored only on this device',
  '哪些事情留给电脑': 'What stays on the PC',
  '搜索歌曲名': 'Search song name',
  '刷新': 'Refresh',
  '取消': 'Cancel',
  '保存': 'Save',
  '确定': 'Confirm',
  '清空': 'Clear',
  '下载': 'Download',
  '上传失败': 'Upload failed',
  '待上传': 'Waiting to upload',
  '已上传': 'Uploaded',
  '正在上传到电脑…': 'Uploading to PC…',
  '连接失败': 'Connection failed',
  '连接已断开': 'Connection lost',
  '重新连接并进入': 'Reconnect & enter',
  '连接你的': 'Connect your',
  '翻唱工作站': 'cover workstation',
  '移动工作台': 'Mobile Studio',
  '自动': 'Auto',
  '可用': 'Ready',
  '异常': 'Error',
  '就绪': 'Ready',
  '环境就绪': 'Environment ready',
  'CUDA 可用': 'CUDA available',
  '显存不足时自动降级': 'Falls back when VRAM is low',
  '返回': 'Back',
  '重连': 'Reconnect',
  '作品页': 'Works',
  '下载素材': 'Download materials',
  '任务操作': 'Job actions',
  '使用模型': 'Models used',
  '全部框架': 'All frameworks',
  '全部用途': 'All purposes',
  '刷新目录': 'Refresh library',
  '前期处理': 'Pre-processing',
  '处理流程': 'Processing pipeline',
  '推理框架': 'Inference framework',
  '推理设备': 'Inference device',
  '正在下载': 'Downloading',
  '生成流程': 'Generation pipeline',
  '读取失败': 'Failed to load',
  '重新搜索': 'Search again',
  '重新读取': 'Reload',
  '去混响模型': 'Dereverb model',
  '目标说话人': 'Target speaker',
  '任务执行失败': 'Job failed',
  '全参数手动调整': 'Manual full parameters',
  'RVC 网络版本': 'RVC network version',
  '目标音色参考音频': 'Target voice reference',
  '与电脑的连接已断开': 'Connection to the PC was lost',
  '留空使用说话人 1': 'Leave empty for speaker 1',
  'PyMSS 分离模型': 'PyMSS separation models',
  '下载模型': 'Download model',
  '删除模型': 'Delete model',
  '重新下载': 'Redownload',
  '下载导入': 'Download & import',
  '去混响 / 人声净化': 'Dereverb / vocal cleanup',
  '留空使用模型首个说话人': 'Leave empty for the model’s first speaker',
  '搜索模型名称、分类或架构': 'Search model name, category or architecture',
  'ModelScope 模型站': 'ModelScope hub',
  'PyMSS Studio 模型站': 'PyMSS Studio hub',
  'Rectified Flow 采样步数': 'Rectified Flow steps',
  '开启后可设置高音保护轮次与 F0 过滤阈值':
    'Enable to set high-note guard rounds and the F0 filter threshold',
  '请检查电脑端服务的监听范围、端口与防火墙设置':
    'Check the PC service listen scope, port and firewall settings',
  'SeedVC 必填，10~30 秒干净人声最佳':
    'Required for SeedVC; 10–30 s of clean vocals works best',
  '降低房间反射与残响，需要 PyMSS 去混响模型':
    'Reduce room reflections and reverb; requires a PyMSS dereverb model',
  '音频编辑、时间轴编排与自定义工作流仍在桌面端完成。':
    'Audio editing, timeline arrangement and custom workflows remain on the desktop.',
  'XB-SVCB · 移动伴生客户端 · GPL-3.0': 'XB-SVCB · Mobile companion · GPL-3.0',
  '电脑端 PyMSS 环境不可用，下载与分离任务会失败。':
    'The PC PyMSS environment is unavailable; downloads and separation will fail.',
  '搜索本软件上传的声音模型，下载完成后自动导入本地模型库。':
    'Search voice models uploaded by this app; they import automatically after download.',
  '换个关键词或框架筛选；也可以确认电脑端模型站配置是否可用。':
    'Try another keyword or framework filter; check the PC model-hub configuration.',
  '电脑端「资源获取」中已下载的歌曲，选中后会复制为本次任务的上传件。':
    'Songs downloaded in the desktop “Resources” library are copied as this job’s upload.',
  '请先在电脑端「模型站」导入 SVC / RVC / SeedVC 模型，再回到这里刷新。':
    'Import SVC / RVC / SeedVC models in the desktop Model Hub, then refresh here.',
  'Index 检索占比': 'Index retrieval ratio',
  '仅模型带 .index 时有效；越高越贴近目标音色，过高可能增加金属感。':
    'Only applies when the model has .index; higher is closer to the target, too high adds metallic artifacts.',
  '响度包络融合': 'Loudness envelope mix',
  '较小值保留原曲起伏，较大值保留转换结果自身响度。':
    'Lower keeps the source dynamics; higher keeps the converted loudness.',
  '清辅音保护': 'Consonant protection',
  '越大越保留原声辅音、齿音与呼吸，可减少破音。':
    'Higher keeps more source consonants, sibilance and breath, reducing crackle.',
  'F0 中值滤波': 'F0 median filter',
  '0 表示不滤波；3 以上可降低呼吸杂音。':
    '0 disables filtering; 3+ reduces breath noise.',
  '扩散强度': 'Diffusion strength',
  '映射为 10~50 个扩散步数；越高通常质量更好、速度更慢。':
    'Maps to 10–50 diffusion steps; higher usually means better quality but slower.',
  '浅扩散强度': 'Shallow diffusion strength',
  '映射为 1~200 个浅扩散步骤；越高越细致。':
    'Maps to 1–200 shallow diffusion steps; higher is more detailed.',
  '共振峰偏移': 'Formant shift',
  '负值更厚更暗，正值更薄更亮。':
    'Negative is thicker and darker; positive is thinner and brighter.',
  '高音保护轮次': 'High-note guard rounds',
  '0 表示交给系统使用默认保护轮次。':
    '0 lets the system use its default guard rounds.',
  'F0 过滤阈值': 'F0 filter threshold',
  '0 表示不滤波；阈值越高过滤越强。':
    '0 disables filtering; higher thresholds filter more.',
  '自动选择': 'Auto',
  '自动模式会按电脑端环境选择当前框架可用的后端。':
    'Auto picks a backend supported by the current framework on the PC.',
  '未读取到电脑端推理设备信息，手动后端可能不可用；建议保持自动。':
    'Could not read PC device info; manual backends may be unavailable. Keep Auto.',
  '请输入': 'Please enter',
  '简体中文': 'Simplified Chinese',
  '日本語': 'Japanese',
  '手机端用于管理与删除已导入模型；下载与导入新的声音模型请在电脑端模型站完成。':
    'Use mobile to manage or delete imported models; download and import new voice models from the desktop Model Hub.',
  '适配翻唱的人声分离模型': 'Cover-ready vocal separation models',
  '来自电脑端，仅显示已下载且用途为人声分离的模型':
    'From your PC; only downloaded models marked for vocal separation',
  '搜索分离模型': 'Search separation models',
  '没有适配翻唱的 PyMSS 模型': 'No cover-ready PyMSS models',
  '已下载的多轨、单乐器、卡拉 OK 或人声/伴奏双向模型不会出现在这里；请到模型页下载「人声分离」用途的模型，或先使用 UVR。':
    'Downloaded multi-stem, single-instrument, karaoke or duet models are excluded. Download a “vocal separation” model from the Models tab, or use UVR.',
  '只列出电脑端标记为「人声分离」且已下载的模型；多轨、单乐器、KTV 与语音分离模型会被排除。':
    'Only downloaded models marked “vocal separation” are listed; multi-stem, instrument, KTV and speech models are excluded.',
  '人声': 'Vocals',
  '伴奏': 'Instrumental',
  '人声 + 伴奏': 'Vocals + instrumental',
  '人声 / 伴奏': 'Vocals / instrumental',
}

const PATTERNS: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^(\d+) 个可用模型 · 来自电脑端模型库$/, (m) => `${m[1]} models · from the PC library`],
  [/^(\d+) 个模型 · (\d+) 段$/, (m) => `${m[1]} models · ${m[2]} segments`],
  [/^已载入 (\d+) 句歌词 · 已生成 (\d+) 段$/, (m) => `${m[1]} lyric lines · ${m[2]} segments`],
  [/^第 (\d+) 段$/, (m) => `Segment ${m[1]}`],
  [/^排队位置 (\d+)$/, (m) => `Queue #${m[1]}`],
  [/^(\d+) 个任务$/, (m) => `${m[1]} jobs`],
  [/^共 (\d+) 个$/, (m) => `${m[1]} total`],
  [/^(\d+) \/ (\d+) · 共 (\d+) 个$/, (m) => `${m[1]} / ${m[2]} · ${m[3]} total`],
  [/^已选用「(.+)」$/, (m) => `Selected “${m[1]}”`],
  [/^「(.+)」已加入推理队列$/, (m) => `“${m[1]}” added to the inference queue`],
  [/^已选择 (.+) 后端。$/, (m) => `Using ${m[1]} backend.`],
  [/^当前设备：(.+)$/, (m) => `Current device: ${m[1]}`],
  [/^(\d+) 个可用模型$/, (m) => `${m[1]} models available`],
  [/^(\d+) 个模型$/, (m) => `${m[1]} models`],
  [/^(.+) · 电脑端「资源获取」$/, (m) => `${m[1].trim()} · PC “Resources”`],
  [/^正在从电脑端读取音频 (\d+)%$/, (m) => `Reading audio from the PC ${m[1]}%`],
  [/^保存到 下载\/(.+)$/, (m) => `Saved to Downloads/${m[1]}`],
  [/^已下载 (\d+) 个素材$/, (m) => `${m[1]} materials downloaded`],
]

const originals = new WeakMap<Text, string>()
const attrOriginals = new WeakMap<Element, Map<string, string>>()
let observer: MutationObserver | null = null
let active = false

function translateValue(value: string): string | null {
  const key = value.trim().replace(/\s+/g, ' ')
  if (!key) return null
  if (key.startsWith('·')) {
    const parts = key
      .split('·')
      .map((part) => part.trim())
      .filter(Boolean)
    const mapped = parts.map((part) => EN[part] ?? part)
    if (mapped.some((part, index) => part !== parts[index])) return `· ${mapped.join(' · ')}`
  }
  const direct = EN[key]
  if (direct) return direct
  for (const [pattern, build] of PATTERNS) {
    const match = key.match(pattern)
    if (match) return build(match)
  }
  return null
}

function translateText(node: Text): void {
  const stored = originals.get(node)
  let source = node.data
  if (stored !== undefined) {
    const expected = translateValue(stored) ?? stored
    // Vue 把内容改回中文时，originals 里的旧原文已失效，重新以当前节点为准。
    source = node.data === expected ? stored : node.data
  }
  const translated = translateValue(source)
  if (!translated) return
  const lead = source.match(/^\s*/)?.[0] ?? ''
  const trail = source.match(/\s*$/)?.[0] ?? ''
  originals.set(node, source)
  const next = `${lead}${translated}${trail}`
  if (node.data !== next) node.data = next
}

const ATTRS = ['placeholder', 'title', 'aria-label']

function translateAttributes(element: Element): void {
  for (const name of ATTRS) {
    const value = element.getAttribute(name)
    if (!value) continue
    const translated = translateValue(value)
    if (!translated) continue
    let map = attrOriginals.get(element)
    if (!map) {
      map = new Map()
      attrOriginals.set(element, map)
    }
    if (!map.has(name)) map.set(name, value)
    if (value !== translated) element.setAttribute(name, translated)
  }
}

function walk(root: Node): void {
  if (root.nodeType === Node.TEXT_NODE) {
    translateText(root as Text)
    return
  }
  if (!(root instanceof Element)) return
  if (root.tagName === 'SCRIPT' || root.tagName === 'STYLE') return
  translateAttributes(root)
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let node = walker.nextNode()
  while (node) {
    translateText(node as Text)
    node = walker.nextNode()
  }
  for (const element of root.querySelectorAll('*')) translateAttributes(element)
}

function restore(): void {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  let node = walker.nextNode()
  while (node) {
    const original = originals.get(node as Text)
    if (original !== undefined) (node as Text).data = original
    node = walker.nextNode()
  }
  for (const element of document.body.querySelectorAll('*')) {
    const map = attrOriginals.get(element)
    if (!map) continue
    for (const [name, value] of map) element.setAttribute(name, value)
  }
}

/** 在英文界面下扫描并持续翻译 DOM；切回中文时恢复原文。 */
export function applyAutoI18n(locale: string): void {
  observer?.disconnect()
  observer = null
  if (locale !== 'en-US') {
    if (active) restore()
    active = false
    return
  }
  active = true
  walk(document.body)
  observer = new MutationObserver((mutations) => {
    if (!active) return
    for (const mutation of mutations) {
      if (mutation.type === 'characterData') {
        translateText(mutation.target as Text)
      } else if (mutation.type === 'childList') {
        for (const node of mutation.addedNodes) walk(node)
      }
    }
  })
  observer.observe(document.body, { subtree: true, childList: true, characterData: true })
}
