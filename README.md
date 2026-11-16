# PageFault

PageFault 开源组织的浅色 Cinema View 首页。一个持续存在的 Three.js 内存页立方体，随原生页面滚动完成五幕叙事。GitHub 入口指向 [PageFaultDev](https://github.com/PageFaultDev)，正式域名为 `pagefault.app`。

## 本地运行

需要 Node.js 22.12+ 或 24+，使用 pnpm 12.21.0。

```sh
pnpm install
pnpm dev
```

打开终端输出的本地地址，默认 `http://127.0.0.1:5173`。

```sh
pnpm build
pnpm preview
pnpm test:e2e
```

生产文件生成到 `dist/`，可部署到静态站点托管平台。测试默认使用本机安装的 Google Chrome，覆盖拖拽与键盘旋转、视角重置、滚动缓动与切幕、场景持续挂载、页表状态、移动菜单、减少动态效果、隐私弹窗与 404 页面。部署平台应将非静态资源路由交给 `index.html`，以显示品牌 404；如平台支持，也可直接为不存在的路径配置 HTTP 404。

## 页面与动画

- `src/App.tsx`：五幕内容、导航、移动菜单和说明弹窗。
- `src/MemoryScene.tsx`：三层立体内存块、页编号纹理、材质与实时阴影，以及五组连续模型姿态。WebGL 画布覆盖完整舞台，相机按照模型构图区域设置视场与偏移，投影可以完整延伸到区域之外。姿态曲线在章节之间连续，滚动跟随带阻尼与速度限制。画布按设备像素比渲染，范围为 1.5 至 3，手机和平板上限为 2.5；移动端使用 1024 像素阴影贴图。编号纹理保持 768 像素方形画布，内部页表标记为 PTE。无需外部模型、HDRI 或图片服务。
- `src/useModelRotation.ts`：鼠标拖拽、触屏横向拖动、方向键旋转与视角重置。垂直触屏手势和鼠标滚轮保留原生页面滚动。
- `src/memory.ts`：示意页大小、地址转换与访问、缺页、就绪、映射、继续五个状态。
- `src/useCinema.ts`：原生滚动进度、章节定位、逐词显现和系统动态偏好。滚动回调通过 requestAnimationFrame 合并。
- `src/styles.css`：字体与间距规则，以及桌面、平板、手机布局。

所有章节共用一个 WebGL 场景。拖拽调整模型朝向，方向键也可旋转；双击、R 键或「重置视角」恢复当前章节的默认朝向。「展开结构」拉开模型层次。滚动或点击章节导航时，模型会从当前姿态缓慢旋转、展开和收拢；滚动停止后继续减速到位。「暂停动效」保留当前模型姿态，恢复后平滑跟随页面进度。系统启用减少动态效果时自动采用各章稳定构图，3D 场景按需渲染。打开菜单或说明弹窗时暂停背景场景。

手机和平板采用居中的竖屏构图：上方标题、中部模型、下方说明与入口，底部仅保留章节导航。导航栏简化为品牌、GitHub 图标和菜单，隐私、使用说明与动效开关收进移动菜单；横屏采用紧凑的左右构图。模型控制位于侧边，按钮保留足够的触控区域。舞台随动态视口高度调整，章节定位使用舞台实际高度，兼容手机地址栏伸缩；刘海与底部手势条留出安全区。移动菜单可独立滚动，模型保留纵向页面滚动与双指缩放。

界面集中呈现标题、正文、GitHub 入口与一组章节导航。模型只保留重置和展开两个图标按钮，按钮提供可访问名称与悬停提示。

网站 Logo 使用 `public/pagefault.svg`，导航、说明弹窗、404、浏览器图标与分享图共用此资源。

GitHub 商标图标取自 [Simple Icons](https://github.com/simple-icons/simple-icons/blob/develop/icons/github.svg)，保存在 `src/assets/brands/github.svg` 并由本站提供。通用操作图标使用 Phosphor。

模型是内存分页的品牌化示意：以 4 KiB 页为例，将虚拟页 `0x04` 映射到物理页框 `0x07`。物理页框就绪与页表有效位分别驱动模型变化，技术读数不额外显示在页面上。立方体外形用于构成可交互雕塑，不表示真实内存的空间布局。

通过 `#beginning`、`#fault`、`#resident`、`#mapping`、`#next` 可直接进入对应章节。旧的 `#interface`、`#fullstack` 和 `#open` 链接仍可使用。正文与导航为 HTML，模型为辅助视觉。

## 分享与元信息

包含 favicon、Open Graph 分享图、canonical、Organization 结构化数据、robots.txt 与 sitemap.xml。修改文案或视觉后，可在开发服务器运行期间执行：

```sh
pnpm generate:og
```

重新生成 `public/og-image.png`。该命令同样需要本机 Chrome。使用 `pnpm exec node scripts/capture.mjs --review` 可额外保存各幕与常见屏幕尺寸的检查截图至 `.artifacts/`。

本站没有注册表单、第三方访问统计或 Cookie 追踪。隐私与使用说明位于页脚弹窗中；具体开源项目的许可证以对应仓库为准。
