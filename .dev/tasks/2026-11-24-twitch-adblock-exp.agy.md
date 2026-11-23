# 二审 .dev/tasks/2026-11-24-twitch-adblock-exp.md

- 仓库：/home/box/repos/my-rules
- 分支：feat/twitch-adblock-exp（对比 main）
- 时间：2026-11-24T07:01:46+08:00（Asia/Shanghai）
- 模型：gemini-3.8-flash-medium
- 用时：179s
- 退出码：0

## 结论

本次审查对象为任务分支 `feat/twitch-adblock-exp`（提交 `0194908` 及结果回填 `d0eb0fa`）。经对照需求原文、仓库规范（[AGENTS.md](file:///home/box/repos/my-rules/AGENTS.md)）、任务单及代码 diff，**本次实现完全符合两套实验路线的需求与硬约束，代码质量良好，无阻断合并或返工的缺陷，建议通过二审**。任务单状态目前记录为 `blocked`，系执行方在流程尾声调用未配置的 Web Search 导致包装器退出码 1，实际代码及测试已全部就绪；负责 bot 在后续验收确认后可将任务单状态归档为 `done`。

---

## 问题分档

### 阻断

无。

### 建议

1. **DISCONTINUITY 行尾空白防御**：[twitch-ads.js](file:///home/box/repos/my-rules/script/twitch-ads.js#L48-L49) 的 `trimmed(line)` 仅剥离了行首空白（`replace(/^\s+/, "")`），而在 [L341](file:///home/box/repos/my-rules/script/twitch-ads.js#L341) 判断广告块内切流标记时使用了严格匹配 `text === "#EXT-X-DISCONTINUITY"`。虽然标准 HLS 生成器不会输出行尾空白，但若遭遇带尾部空格的异常分片描述，可能漏判该行清理。建议改用 `text.trim() === "#EXT-X-DISCONTINUITY"` 或 `text.indexOf("#EXT-X-DISCONTINUITY") === 0`。
2. **测试脚本临时解释器硬编码**：[test_twitch_ads.js](file:///home/box/repos/my-rules/scripts/test_twitch_ads.js#L586) 中 `findPython()` 包含了 `/tmp/opencode/venv/bin/python` 临时沙箱路径。虽然具备 try-catch 保护，普通机器无此路径时会安全回退，但建议在后续清理时移除该临时路径，仅保留通用解释器探测。
3. **任务单状态回填修正**：任务单 [.dev/tasks/2026-11-24-twitch-adblock-exp.md](file:///home/box/repos/my-rules/.dev/tasks/2026-11-24-twitch-adblock-exp.md#L5) 状态记录为 `blocked`。经日志查证，代码开发、离线测试与提交均已正常完成，退出码 1 纯属非交互环境下的 Web Search 被取消所致。负责 bot 在正式验收时可将其修正。

### 线索

1. **真机证书锁定与 HTTP/3 (QUIC) 旁路风险**：Twitch 官方 iOS App 在当前版本及未来版本中若启用 TLS 证书锁定（SSL Pinning）或走 QUIC / HTTP/3，MitM 脚本将无法生效；路线 A 分流亦取决于出口机房 IP 是否被 Twitch 标记为少广告地区（且少广告名单会动态变动）。文档已客观说明该限制，提示用户仅作离线实验。

---

## 依据

1. **需求与约束对照**：
   - **两套独立模块未写入主配置**：[qx.conf](file:///home/box/repos/my-rules/quantumultx/qx.conf) 与 [stash/my.yml](file:///home/box/repos/my-rules/stash/my.yml) 未被改动；[test_twitch_ads.js:651-657](file:///home/box/repos/my-rules/scripts/test_twitch_ads.js#L651-L657) 亦包含对主配置文件的断言检查。
   - **无泛域名与视频分片主机**：[twitch-noad-route.list](file:///home/box/repos/my-rules/quantumultx/filter/twitch-noad-route.list#L13-L16) 与 [twitch-noad-route.stoverride](file:///home/box/repos/my-rules/stash/override/twitch-noad-route.stoverride#L19-L22) 仅包含 `gql.twitch.tv`、`usher.ttvnw.net` 及 `playlist` 域名，未包含 `*.ttvnw.net` 泛域名或 `video-edge-*` 分片主机。
   - **展示广告拦截与 Token 安全**：[twitch-ads.snippet](file:///home/box/repos/my-rules/quantumultx/rewrite/twitch-ads.snippet#L14-L15) 与 [twitch-ads.stoverride](file:///home/box/repos/my-rules/stash/override/twitch-ads.stoverride#L39-L40) 仅对 `ads.twitch.tv` / `edge.ads.twitch.tv` 进行 reject 拦截，未 REJECT `PlaybackAccessToken`，未引入 `spade.twitch.tv`。
2. **逻辑与边界保护**：
   - **全广告窗防卡死保护**：[twitch-ads.js:321-322](file:///home/box/repos/my-rules/script/twitch-ads.js#L321-L322) 明确检查 `contentCount === 0`，当整窗均为广告分片时直接 `return raw` 原样放行，禁止输出空播放列表。
   - **正片切流保护**：[twitch-ads.js:341](file:///home/box/repos/my-rules/script/twitch-ads.js#L341) 仅清理广告块内的 DISCONTINUITY；正片间的独立 DISCONTINUITY 绝不误删（[test_twitch_ads.js:286-298](file:///home/box/repos/my-rules/scripts/test_twitch_ads.js#L286-L298) 覆盖验证）。
   - **僵尸 DATERANGE 防误删**：[twitch-ads.js:263-276](file:///home/box/repos/my-rules/script/twitch-ads.js#L263-L276) 比对 `effectivePdtMs` 与 DATERANGE 的有效时间区间，过期时不调用位置剥离，保护恢复后的正片。
   - **序号同步**：[twitch-ads.js:357-367](file:///home/box/repos/my-rules/script/twitch-ads.js#L357-L367) 精确统计移除的开头媒体分片数量，递增 `#EXT-X-MEDIA-SEQUENCE`。
   - **Fail-Open 机制**：[twitch-ads.js:378-424](file:///home/box/repos/my-rules/script/twitch-ads.js#L378-L424) 解析失败或捕获异常时均保留原文放行。
3. **格式与规范**：
   - Stash 覆写正则严格采用单引号（[twitch-ads.stoverride:24,31](file:///home/box/repos/my-rules/stash/override/twitch-ads.stoverride#L24)）。
   - 提交记录与文档均无 `Co-Authored-By` 或「AI 辅助/生成」文案。
   - 改动范围严格局限在「涉及文件」清单内，未改动范围外文件。

---

## 置信度

**高**。全量代码与测试用例、执行日志均已完成逐行比对和静态逻辑推演，42 项新建测试用例完整覆盖了状态机分支、异常与防御边界，原有测试集（Reddit、公众号、京东）及主配置一致性检查均全部通过。

---

## 未核实

1. **真机环境实际去广告效果**：由于 iOS Twitch 官方 App 的客户端实现（是否强制 QUIC、是否有公钥锁定 Pinning、服务端 SSAI 打标实时变化），真机联调效果需由用户后续在设备上实测确认。
