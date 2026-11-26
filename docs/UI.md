# 界面自适应与布局规范

移动端只面向安卓 WebView 与手机浏览器，页面尺寸不写死 px：以 **390×844**
（主流安卓机）为 1× 基准，用 `clamp()` 随屏宽线性缩放，320px 窄屏自动收紧，
390–440px 之间陆续到达各自上限后不再放大；屏幕高度不足时再压缩纵向节奏。
所有页面共用同一组尺寸令牌，因此不会出现某个页面比其它页面"大一圈"的情况。

令牌定义在 `web/src/style.css` 的 `:root` 中，主题（cyber / brand / anime）
只覆盖颜色变量，不影响尺寸。

## 尺寸令牌

每条令牌先写 px 兜底、再写 `clamp()`：未支持 `clamp()` 的旧版 WebView 会退回
固定值，不会丢样式。

| 令牌 | 取值 | 320px | 390px | 用途 |
| --- | --- | --- | --- | --- |
| `--xb-pad-x` | `clamp(12px, 4.1vw, 18px)` | 13.1 | 16.0 | 页面、页头、标签栏左右边距 |
| `--xb-page-gap` | `clamp(11px, 3.6vw, 14px)` | 11.5 | 14.0 | `.page` 内块间距（矮屏 11px / 9px） |
| `--xb-page-title` | `clamp(19px, 6.15vw, 24px)` | 19.7 | 24.0 | `.page-title`（矮屏 18–22px） |
| `--xb-card-pad` | `clamp(12px, 3.6vw, 15px)` | 12.0 | 14.0 | 卡片、按钮左右内边距 |
| `--xb-radius-lg` | `clamp(15px, 4.6vw, 18px)` | 15 | 17.9 | `.glass` 圆角 |
| `--xb-control-h` | `clamp(40px, 11.3vw, 44px)` | 40 | 44 | 按钮、输入框最小高度（矮屏 38–42px） |
| `--xb-icon-btn` | `clamp(34px, 9.7vw, 38px)` | 34 | 37.8 | `.icon-btn` 尺寸 |
| `--xb-tab-h` | `clamp(46px, 13.3vw, 52px)` | 46 | 51.9 | 标签栏按钮高度 |
| `--xb-tabbar-pad` | `clamp(4px, 1.5vw, 6px)` | 4.8 | 5.9 | 标签栏内边距 |
| `--xb-hero-logo` | `clamp(64px, 21vw, 84px)` | 67.2 | 81.9 | 连接页徽标（连接页内可覆写） |
| `--xb-page-bottom` | `calc(var(--xb-tab-h) + 52px + env(safe-area-inset-bottom))` | 98 | 104 | `.page` 底部留白，避开标签栏 |

字号类的缩放只用在标题与说明文字上，最小字号保持 9px 以上；主要操作按钮、
标签栏不小于 38px，次级小按钮不小于 32px，避免小屏上"看着变小、实际点不到"。

## 断点

| 条件 | 处理 |
| --- | --- |
| 宽度 320–440px | 按各令牌的 `clamp()` 公式缩放，上限落在 390–440px 之间 |
| 宽度 > 440px | 全部封顶，靠 `.app-shell` 的 `max-width: 560px` 居中 |
| 高度 ≤ 700px | 收紧节奏：标题 18–22px、控件 38–42px、间距 11px；连接页收掉装饰副标题 |
| 高度 ≤ 560px | 间距 9px、底部留白改为「标签栏 + 34px」；连接页徽标 48px、卡片内边距 11px |
| 视口 ≥ 600px（桌面预览） | `.app-shell` 左右加描边，模拟手机宽度 |

`env(safe-area-inset-*)` 在 APK 内为 0（`MainActivity` 未开沉浸式、WebView 不铺满
状态栏），保留它是为了在浏览器或后续全屏改造时仍然安全。页面高度一律用
`100vh` + `100dvh` 双写，底部固定元素用 `dvh` 上限而不是 `vh`。

## 页面骨架

| 页面 | 根类 | 滚动容器 | 头部 | 底部 |
| --- | --- | --- | --- | --- |
| 作品 / 模型 / 素材 / 设置 | `.page` | `.app-main`（`App.vue`） | `.app-header` | `.tabbar` |
| 连接页 | `.connect-page` | 自身（`flex:1 + min-height:0`） | 无 | 无 |
| 创建翻唱 | `.create-page` | `.app-main` | `.create-head`（sticky） | `.create-foot`（fixed） |

要点：

- 页面根节点不要写 `min-height: 100vh` 自己撑满，交给 `.app-shell` 的 `100dvh`
  与滚动容器；连接页同理，它只是把自身做成可滚动列，而不是固定一屏空白。
- `.page` 的底部留白由 `--xb-page-bottom` 计算，标签栏高度变化时不用改各页面。
- 连接页在矮屏隐藏 `kicker` 装饰副标题、压缩徽标与卡片间距，保证 360×640
  上两个输入框和「连接并进入」按钮完整出现在首屏。

## 新增页面或组件

1. 页面根节点使用 `.page`，标题用 `.page-title` / `.page-sub`，卡片用 `.glass`，
   按钮用 `.btn`，输入框用 `.input`，即可自动获得自适应尺寸。
2. 需要自定义尺寸时优先引用令牌，或写 `clamp(最小, 视口比例, 最大)`，
   并在前面补一条 px 兜底声明。
3. 不要新增 `min-height: 100vh` 或固定 `height` 的页面容器；高度交给滚动容器。
4. 需要局部适配时在组件内覆写令牌，例如连接页：

   ```css
   @media (max-height: 700px) {
     .connect-page {
       --xb-hero-logo: 60px;
       --xb-hero-logo: clamp(52px, 15vw, 60px);
     }
   }
   ```

5. 图片、徽标等替换元素用 `width/height` 双写，避免缩放后比例失真。

## 验证

先起 mock 服务并构建：

```powershell
node tools/mock-server.js 8788
node web/build.mjs
node tools/postbuild.js
```

多机型截图 + 布局测量：

```powershell
node tools/shoot-sizes.js current connect tasks settings models materials create
```

- 视口基线：320×568、360×640、360×780、390×844、412×915、横屏 780×360。
- 截图写入 `.screenshots/sizes/<标签>/`，`report.json` 记录每个页面的
  `titleFont`、`cardPad`、`overflowY`（纵向溢出）、`horizontalOverflow`
  （横向溢出）与页面错误。
- 判据：所有页面 `horizontalOverflow = 0`；连接页在 360×640 及以上
  `overflowY = 0`；其余内容页允许纵向滚动。

390×844 为基准，各页面渲染结果与改造前基本一致，仓库内 `docs/screenshots/`
的其余截图仍然有效；连接页与断线页因统一了字号与边距，已按新版本重截
（`01-connect.png`、`16-offline.png`）。
