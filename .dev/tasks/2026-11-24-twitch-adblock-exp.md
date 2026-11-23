# Twitch 去广告实验版（路线 A / 路线 B 独立可选模块）

- Task ID: 2026-11-24-twitch-adblock-exp
- 负责 bot: my-rules
- 状态: pending
- 执行方: box-agent
- 分支: feat/twitch-adblock-exp（从最新 main 切出）
- 更新时间: 2026-11-24T06:46+08:00
- 引用: 无

## 需求原文
> 尝试编写 twitch 去广告
>
> 路线 A 和路线 B 分开做成两套独立可选模块，都先按流程在分支上写出来做离线验证。
>
> 讨论结论：Twitch 直播广告是服务端拼进 HLS 的 SSAI；官方 iOS App 使用 Amazon IVS Player。路线 A 为无 MITM 的少广告地区分流，路线 B 为 MITM 明文实验脚本（改写 PlaybackAccessToken 的 playerType 为 popout，并按标记保守剥离非全广告窗的 HLS 片段）。两套模块互不耦合，不写入主配置，未真机验证前不承诺直播去广告效果。本次只在本地任务分支开发与离线验证，不推送、不合并。

## 输入
- 背景：公开调研结论见对话记录。现有可选去广告模块（Reddit / 公众号 / 京东开屏）的风格与硬约束见 AGENTS.md、README.md 及 `script/*.js`、`quantumultx/rewrite/*.snippet`、`stash/override/*.stoverride`、`scripts/test_*.js`。
- 涉及文件：见下文「涉及文件」

## 涉及文件
- `.dev/tasks/2026-11-24-twitch-adblock-exp.md`（本任务单；状态与结果由 oc-exec 回填）
- `quantumultx/filter/twitch-noad-route.list`（新建：路线 A）
- `stash/override/twitch-noad-route.stoverride`（新建：路线 A）
- `script/twitch-ads.js`（新建：路线 B，QX / Stash 共用）
- `quantumultx/rewrite/twitch-ads.snippet`（新建：路线 B）
- `stash/override/twitch-ads.stoverride`（新建：路线 B）
- `scripts/test_twitch_ads.js`（新建：路线 B 离线测试）
- `README.md`（修改：在可选去广告章节补充 Twitch 两条实验路线，并更新目录结构与「已知限制」里「Twitch 仍不支持」的过时表述）

## 约束
- 不做：
  - 不修改 `quantumultx/qx.conf`、`stash/my.yml`、`scripts/check_sync.py` 及已有 Reddit / 公众号 / 京东脚本、测试、snippet、覆写
  - 不做 VAFT 式在 m3u8 响应脚本里异步再请求 GQL / Usher 的备用流替换
  - 不接入公共 Luminous / TTV LOL 代理，不把统计拦截（如 `spade.twitch.tv`）包装成直播去广告
  - 绝不 REJECT `PlaybackAccessToken`，不 MITM `video-edge-*` 视频分片主机，列表与规则绝不包含 `*.ttvnw.net` 泛域名
  - 不推送、不合并、不改默认分支、不碰用户本机
  - 全仓新增内容、注释、文档、commit 严禁出现 `Co-Authored-By` 或「AI 辅助/生成」等字样
- 只在上面的分支工作；不合并；不改「涉及文件」以外的文件，确需改时写进「结果 → 偏离」
- 提交信息用中文，`feat:` / `fix:` / `docs:` 等前缀 + 正文，不加 Co-Authored-By
- 不读密钥、`.env`、`auth*`
- 风险点：官方 iOS App 可能有证书锁定或 HTTP/3，MITM 不一定命中；`playerType=popout` 在 2026 年已衰减，可能报错、紫屏或降画质；少广告地区名单会波动且主配置现有区域组未必包含合适出口；直播整窗全广告时必须原样放行，无法去掉该类前贴片。本任务只做离线验证，不承诺真机效果。

## 分步任务

1. [ ] 路线 A · QX 过滤列表 `quantumultx/filter/twitch-noad-route.list`（新建）
   - 风格对齐 `quantumultx/filter/ChinaGeoIP.list`：文件头用 `# NAME:` 与用途注释。
   - 只包含广告决策与播放列表域名，**绝不包含 `*.ttvnw.net` 泛域名或 `video-edge-*` 视频分片主机**，内容为：
     - `host, gql.twitch.tv, Twitch-NoAd`
     - `host, usher.ttvnw.net, Twitch-NoAd`
     - `host-suffix, playlist.live-video.net, Twitch-NoAd`
     - `host-suffix, playlist.ttvnw.net, Twitch-NoAd`
   - 注释必须说明：本列表是可选远程规则，不要写入 `qx.conf`；在 QX `[filter_remote]` 中自行添加，并用 `force-policy=<你的少广告地区节点或策略组>` 指定出口（该策略名会被 `force-policy` 覆盖；主配置没有名为 Twitch-NoAd 的策略组，也不得为此去改 `qx.conf`）。避开公开资料中限 720p 的俄/韩节点。可选补充：必要时可再按 URL 只把 `video-weaver.*.hls.ttvnw.net` 的播放列表纳入，但不要代理实际视频分片 CDN。效果取决于出口地区，未真机验证。

2. [ ] 路线 A · Stash 覆写 `stash/override/twitch-noad-route.stoverride`（新建）
   - 独立可选覆写，不写入 `stash/my.yml`。头信息风格对齐现有 `stash/override/*.stoverride`（`#!name` / `#!desc` / `#!author=bbq191`，以及 `name` / `desc`）。
   - 新增策略组 `Twitch-NoAd`：`type: select`，`proxies` 引用现有 `全部节点`（`stash/my.yml` 中已有该组），方便手动选少广告地区节点；并写清须自行选择少广告地区、避开俄/韩限 720p、未真机验证。
   - 前置 `rules:`：
     - `DOMAIN,gql.twitch.tv,Twitch-NoAd`
     - `DOMAIN,usher.ttvnw.net,Twitch-NoAd`
     - `DOMAIN-SUFFIX,playlist.live-video.net,Twitch-NoAd`
     - `DOMAIN-SUFFIX,playlist.ttvnw.net,Twitch-NoAd`
   - 若含正则必须使用单引号 `'...'`。用 PyYAML `yaml.safe_load` 校验语法。

3. [ ] 路线 B · 共用脚本 `script/twitch-ads.js`（新建）
   - 纯明文、无混淆、无外联、无持久存储。单文件同时兼容 Quantumult X 与 Stash。
   - 对齐现有 `script/*.js`：用 IIFE + `"use strict"`；运行时通过 `$request` / `$response` / `$done` 判断环境，不要依赖 Node 内置模块。现有脚本本身不 `module.exports`，测试用 `vm.runInNewContext` 注入沙箱（见 `scripts/test_reddit_ads.js`）。本脚本同样走这条路径即可；不要为测试破坏 QX/Stash 运行形态。
   - 入口分发：
     - 存在 `$response` 且带 `body`：按 HLS 响应处理。
     - 否则若存在 `$request`（`script-request-body` / Stash `type: request`）：按 GQL 请求处理。
     - 其他情况 fail-open：`$done({})`。
   - 任意解析失败、缺字段、未改动或运行异常均 fail-open。请求侧未改动时 `$done({})`，不要无意义地重写 body；响应侧未改动时既可 `$done({})` 也可 `$done({ body: 原文 })`，但不得改变正文。异常时有原文则回写原文，否则 `$done({})`。

   **请求处理**（仅针对 `gql.twitch.tv/gql` 的 request body，由调用方规则匹配 URL）：
   - 支持单对象和批量数组 JSON。
   - 仅匹配：`operationName` 为 `PlaybackAccessToken` 或 `PlaybackAccessToken_Template`；或 `query` 字符串含 `streamPlaybackAccessToken` / `videoPlaybackAccessToken` 且带 `variables` 对象的条目。
   - 对命中且已有 `variables` 对象的条目，仅将 `variables.playerType` 设为 `'popout'`；已为 `'popout'` 则该条目不动。没有 `variables` 时不要凭空创建整个 variables 对象。
   - 不硬编码 persistedQuery hash，不改 `Authorization` / `Client-Integrity` / 其它请求头，不改会员或广告标志，不改动同一批请求中的其他 operation。
   - 有改动时 `$done({ body: 新 JSON })`；否则 `$done({})`。

   **响应处理**（针对 HLS m3u8 文本）：
   - `body` 非字符串、空、或不是以 `#EXTM3U` 开头，直接原样放行。
   - Master Playlist（含 `#EXT-X-STREAM-INF`）直接原样放行。
   - 精准识别 SSAI 广告标记：
     - `#EXT-X-DATERANGE`：`CLASS` 含 `twitch-stitched`（覆盖 `twitch-stitched-ad` 及其前缀变体）或 `twitch-maf-ad`，或 `ID` 以 `stitched-ad-` 开头；必须解析 `START-DATE` + `DURATION` / `PLANNED-DURATION`，与后续分片的 `#EXT-X-PROGRAM-DATE-TIME` 比对，过滤已过期的「僵尸」DATERANGE，防止误伤已恢复的正片。区间尚未过期且分片时间落在区间内则视为广告。缺少可用于比对的日期时，对该仍有效（或无法判断过期）的广告 DATERANGE 采取保守策略：不要把无法证明已过期的广告标记当正片。
     - `#EXT-X-CUE-OUT` / `#EXT-X-CUE-IN`（以及 `#EXT-X-SCTE35-OUT`）区间标记：CUE-OUT / SCTE35-OUT 之后到 CUE-IN 之前的媒体分片视为广告。
     - `#EXTINF` 标题含 `Amazon` 或 `stitched` 的广告分片。
     - 清理随附广告的 `#EXT-X-TWITCH-PREFETCH` 与广告专用 DATERANGE；**绝不把单独出现的 `#EXT-X-DISCONTINUITY` 判为广告**（保护正片切流）。
   - **防卡死保护**：静态 VOD（含 `#EXT-X-ENDLIST` 或 `#EXT-X-PLAYLIST-TYPE:VOD`）与直播滑窗均统计剥离后剩余的正片媒体分片数；**若剥离后剩余正片分片数为 0（如直播整窗全广告），必须原样放行，禁止输出空播放列表**。
   - 若移除了列表开头的分片，正确同步递增 `#EXT-X-MEDIA-SEQUENCE`（按去掉的开头媒体分片数增加）。
   - 若本身未命中广告段则直接原样放行，不重写无关空白。

4. [ ] 路线 B · QX 片段 `quantumultx/rewrite/twitch-ads.snippet`（新建）
   - 风格对齐 `quantumultx/rewrite/reddit-ads.snippet`：注释说明可选、不要写入 `qx.conf`、作为重写资源导入时 `hostname` 并入已有 MitM、不要覆盖现有 `[mitm]` 的 hostname、需自行信任证书、空响应体不会进入 body 类重写、未实机验证；若当前版本不执行资源里的远程脚本，规则放进 `[rewrite_local]`，主机名追加到现有 hostname 末尾，脚本改成本地文件名。
   - `hostname = gql.twitch.tv, video-weaver.*.hls.ttvnw.net, *.playlist.live-video.net, *.playlist.ttvnw.net, ads.twitch.tv, edge.ads.twitch.tv`
   - 不 MITM `video-edge-*` 视频分片主机。
   - 屏蔽纯展示广告域：对 `ads.twitch.tv` / `edge.ads.twitch.tv` 使用 `url reject-200`（或与仓库现有 reject 风格等价的写法）。绝不 REJECT `PlaybackAccessToken`，也不把 `spade.twitch.tv` 写入本片段。
   - 挂载 `script-request-body`（匹配 `gql.twitch.tv/gql`）与 `script-response-body`（匹配 weaver / playlist 主机上的 `.m3u8`），脚本 URL 均为 `https://raw.githubusercontent.com/bbq191/my-rules/main/script/twitch-ads.js`。
   - 响应脚本的正则不要误伤 `video-edge-*` 分片主机。

5. [ ] 路线 B · Stash 覆写 `stash/override/twitch-ads.stoverride`（新建）
   - 与 QX 片段功能等价的可选覆写，不写入 `stash/my.yml`。头信息风格对齐现有覆写。
   - 所有正则**必须使用单引号 `'...'`**。
   - `http.script`：一条 `type: request` 匹配 GQL，一条 `type: response` 匹配 m3u8；均 `require-body: true`，`timeout: 5`。`binary-mode: false`。可设合理 `max-size`（m3u8 与 GQL 请求体通常不大）。
   - `http.mitm` 仅含上述最小主机集（`gql.twitch.tv`、`ads.twitch.tv`、`edge.ads.twitch.tv`，以及 weaver / playlist 的通配写法，以 Stash 支持的主机名形式为准），未使用 `#!replace`，不覆盖已有 MitM。
   - 含 `ads.twitch.tv` / `edge.ads.twitch.tv` 拦截规则（例如 `rules:` 里 `DOMAIN,ads.twitch.tv,REJECT` 与 `DOMAIN,edge.ads.twitch.tv,REJECT`，或等价的 http 拒绝）。
   - `script-providers` URL 指向 `https://raw.githubusercontent.com/bbq191/my-rules/main/script/twitch-ads.js`。
   - 用 `yaml.safe_load` 校验语法。

6. [ ] 离线测试 `scripts/test_twitch_ads.js`（新建）
   - 对齐 `scripts/test_reddit_ads.js`：Node + `vm.runInNewContext` 分别模拟 QX（`$response.statusCode`）与 Stash（`$response.status`）入口；请求侧注入 `$request.body` 且不提供 `$response`。
   - 必须覆盖：
     - 单条与批量 GQL `PlaybackAccessToken` / `PlaybackAccessToken_Template` 将 `playerType` 改为 `popout`
     - 已是 `popout`、以及非 token operation（含同一批里的其它 operation）零改动，请求侧 `$done({})`
     - `query` 含 `streamPlaybackAccessToken` / `videoPlaybackAccessToken` 且带 `variables` 的条目会被改写
     - 非法 JSON、缺字段 fail-open
     - 不改 Authorization / Client-Integrity 等头（测试不要要求脚本输出这些头）
     - Master Playlist（含 `#EXT-X-STREAM-INF`）放行
     - 纯正片含单独 `#EXT-X-DISCONTINUITY` 不误删
     - 直播混合窗去掉广告分片，并在去掉列表开头分片时递增 `#EXT-X-MEDIA-SEQUENCE`
     - 直播全广告窗（剥离后正片分片为 0）必须原样放行，禁止空播放列表
     - 僵尸 DATERANGE（`START-DATE + DURATION` 已过期，正片分片的 PROGRAM-DATE-TIME 已超出区间）不误删正片
     - `CLASS` 含 `twitch-maf-ad` 的 DATERANGE 被识别
     - `#EXT-X-CUE-OUT` / `#EXT-X-CUE-IN`（及如有样本的 `#EXT-X-SCTE35-OUT`）区间处理
     - `#EXTINF` 标题含 `Amazon` 或 `stitched` 的分片被识别
     - 静态 VOD（`#EXT-X-ENDLIST` 或 `#EXT-X-PLAYLIST-TYPE:VOD`）多段广告剥离
     - 非 m3u8、空响应 fail-open
     - QX 与 Stash 入口对同一输入给出一致的 body 结果
     - 抽查 snippet / stoverride：脚本 URL、hostname / mitm 范围、正则单引号、未 REJECT PlaybackAccessToken、未写入 `spade.twitch.tv`、未出现 `*.ttvnw.net` 泛域名（路线 A 列表同样检查）
   - 跑 `node scripts/test_twitch_ads.js` 应全部通过，并打印通过项数。

7. [ ] 更新 `README.md`
   - 在目录结构中补充路线 A / 路线 B 的新文件。
   - 在可选去广告章节用独立小节写明 Twitch 两条实验路线（A 少广告地区分流、B MITM 明文实验脚本），给出 raw 地址，客观写明：实验状态、未真机验证、适用前提（路线 A 需要少广告地区节点并用 `force-policy` 或手动选择；路线 B 需自行安装并信任 MitM 证书，且 App 若证书锁定或走 QUIC 可能不命中）、局限（不能保证去掉直播前贴/中插，全广告滑窗会放行，`playerType` 可能失效或降画质，不代理视频分片 CDN）及关闭回退方式（关闭对应远程规则 / 覆写即可）。
   - 同步修正「已知限制」及原「### Twitch」中「本次不支持 / 未实现」的过时表述，改为指向上述实验模块及其限制，避免自相矛盾。
   - 全文不得出现「AI 辅助/生成」等字样。

8. [ ] 自检
   - `node scripts/test_twitch_ads.js` 全部通过
   - `node scripts/test_reddit_ads.js`、`node scripts/test_wechat_mp_ads.js`、`node scripts/test_jd_splash_ads.js` 回归通过
   - `python3 scripts/check_sync.py` 若本环境缺少 PyYAML，可改用已安装 PyYAML 的解释器跑，退出码应为 0
   - 用 `yaml.safe_load` 校验两个新建 `.stoverride`
   - 确认未改「不做」列出的文件；提交信息中文且无 Co-Authored-By

## 验收标准
- [ ] 路线 A、路线 B 均为独立可选模块，互不耦合，且均未写入 `qx.conf` / `my.yml`
- [ ] 路线 A 列表与覆写只含规定的决策/播放列表域名，无 `*.ttvnw.net` 泛域名、无 `video-edge-*`
- [ ] 路线 B 脚本满足请求/响应规格，fail-open，全广告窗不输出空列表，不把单独 DISCONTINUITY 当广告，僵尸 DATERANGE 不误删正片
- [ ] QX snippet 与 Stash 覆写功能等价；Stash 正则均为单引号；MITM 为主机最小集；展示广告域被拦截；未 REJECT PlaybackAccessToken
- [ ] `node scripts/test_twitch_ads.js` 全部通过，且覆盖「分步任务」第 6 步列出的用例
- [ ] 既有 Reddit / 公众号 / 京东测试与 `scripts/check_sync.py` 不回归
- [ ] README 已补充两条实验路线、前提、局限和关闭方式
- [ ] 「不做」的事确实没做；无 Co-Authored-By，无「AI 辅助/生成」文案

## 交付物
代码只提交到任务分支 `feat/twitch-adblock-exp`，**本次不推送、不合并**。「结果」填好；状态改为 done 或 blocked。真机验收与是否发布由用户确认后再进行。

## 给执行方的指令
box（`box-agent`）由 `oc-exec` 调用，**不加 `--push`**：状态和结果由包装器处理，执行器只按「分步任务」改代码并跑验收命令。只在任务分支本地提交，不推送、不合并、不改默认分支。提交信息用中文，不加 Co-Authored-By，不要写入「AI 辅助/生成」等字样。

## 结果
<!-- 执行方填写 -->
- 执行方 / 开始–结束时间：
- base..head：
- 提交：| 步骤 | 提交号 | 文件 | 说明 |
- 测试：| 命令 | 通过 / 失败 / 未跑 | 摘要 |
- 遇到的问题：
- 偏离：无
- 未完成：

## 审查
<!-- 负责 bot 填写：结论、关键 path:line、测试通过与否、回执指针；长证据另放或只写路径 -->
- 验收：通过 / 退回（附关键证据：命令、路径:行号；长输出写路径）
- 二审：回执 `.dev/tasks/2026-11-24-twitch-adblock-exp.agy.md`；阻断 / 建议 / 线索，及采纳与否和理由（不要把回执全文抄进本栏）
- 合并：本次不合并；待用户确认后再推送与合并
