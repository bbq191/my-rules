# notify-afu 工作流改为去抖版

- Task ID: 2026-11-12-notify-afu-debounce
- 负责 bot: my-rules
- 状态: verified
- 执行方: my-rules bot（按 Jarvis 转达，在 alienware 本机直接执行；本仓库只由 my-rules bot 提交）
- 分支: chore/notify-afu-debounce（从最新 main 切出）
- 更新时间: 2026-11-12T14:35+08:00
- 引用: 无

## 需求原文
> 更新本仓库 `.github/workflows/notify-afu.yml` 为去抖版。正本模板：`~/Documents/ikate/Projects/_templates/notify-afu.yml`。整文件替换旧 workflow。要点：仅 done/blocked 或 `.agy.md` 改动才 POST；Secrets 名仍 `AFU_WEBHOOK_URL` / `AFU_WEBHOOK_TOKEN`（值由用户换成 Jarvis webhook，勿改 Secrets）。开任务单 `2026-11-12-notify-afu-debounce`，验收后 push 合并。

## 输入
- 背景：工作流「唤醒配置 · A」于 2026-11-12 改为去抖；正本在 vault 模板
- 涉及文件：
  - `.github/workflows/notify-afu.yml`（修改：整文件替换为去抖模板）
  - `.dev/tasks/2026-11-12-notify-afu-debounce.md`（新增：本任务单）
  - README.md 未提及该 workflow，不改

## 约束
- 不做：不改仓库 Secrets 的值；不把订阅地址、token、工作内网域名/IP 写入仓库；不改策略组或规则
- 提交信息用中文，`chore(ci):` 前缀 + 正文写原因，不加 Co-Authored-By
- 不读密钥、`.env`、`auth*`
- 风险点：无设备行为 / install.sh / 数据迁移；workflow 只在任务单变为 done/blocked 或 `.agy.md` 变化时 POST

## 分步任务
1. [x] 从最新 main 切出 `chore/notify-afu-debounce`
2. [x] 用模板整文件替换 `.github/workflows/notify-afu.yml`
3. [x] 核对仅 done/blocked 或 `.agy.md` 改动才 POST；Secrets 名仍为 `AFU_WEBHOOK_URL` / `AFU_WEBHOOK_TOKEN`
4. [x] YAML 语法校验、diff、敏感信息扫描；可选跑 `scripts/check_sync.py`
5. [x] 更新任务单并提交、push、合并到 main

## 验收标准
- [x] 工作流与模板字节级一致
- [x] 仅当任务单状态变为 done/blocked，或 `.agy.md` 有改动时才 POST
- [x] Secrets 名仍为 `AFU_WEBHOOK_URL` / `AFU_WEBHOOK_TOKEN`，仅通过 `${{ secrets.* }}` 引用
- [x] `python3` + PyYAML 校验 YAML 语法通过
- [x] 仓库中无订阅地址、token、内网域名
- [x] README.md 未提及该 workflow，无需同步

## 交付物
代码提交到上面的分支并推送；「结果」填好；状态改为 done。合并后若不需真机验收，改为 verified。

## 给执行方的指令
```
由负责 bot 在 alienware 本机直接执行本任务单：替换 workflow、校验、填写结果、提交并推送分支，验收后合并到 main。
```

## 结果
- 执行方 / 开始–结束时间：my-rules bot / 2026-11-12T14:32+08:00–2026-11-12T14:34+08:00
- base..head：cd31693..7ab751adb1a3aa97bfe4ff3ec3d885734da62db9
- 提交：| 步骤 | 提交号 | 文件 | 说明 |
  | 替换 workflow 并开单 | 7ab751adb1a3aa97bfe4ff3ec3d885734da62db9 | `.github/workflows/notify-afu.yml`、`.dev/tasks/2026-11-12-notify-afu-debounce.md` | 整文件替换为去抖模板 |
- 测试：
  - `python3` `yaml.safe_load(.github/workflows/notify-afu.yml)`：通过（YAML 语法有效）。说明：PyYAML 1.1 会把键 `on` 解析为布尔 `True`，这是预存在的 YAML 1.1 特性，GitHub Actions 仍按触发器 `on` 处理；`on.push.paths` 为 `.dev/tasks/**`，`on.push.branches` 为 `**`。未安装 actionlint。
  - 与模板 `sha256 e1e80c781cf7813141ea40e74f910b452e27a5ce608dd8dd0cf94d50dc3a71a8` 字节一致
  - 敏感信息扫描：无 http(s) URL、无私网 IP、无内网域名、无硬编码 webhook/token；仅 `${{ secrets.AFU_WEBHOOK_URL }}` / `${{ secrets.AFU_WEBHOOK_TOKEN }}`
  - `scripts/check_sync.py`：退出码 0（本次不涉及策略组/规则，仅作确认）
- 遇到的问题：无
- 偏离：无。模板无仓库专属占位，整文件替换，未改 Secrets。
- 未完成：无

## 审查
- 验收：通过。证据：工作区文件与模板字节一致；diff 要点为收集步骤增加 done/blocked / `.agy.md` 过滤，步骤名改为「唤醒 Jarvis」，Secrets 引用未变；YAML 可被 PyYAML 加载；敏感信息扫描无命中。
- 二审：本次未跑 agy（workflow 模板整文件替换，无代码逻辑分叉需二审阻断项；用户要求验收后直接 push 合并）
- 合并：已 fast-forward 合并到 main 并推送 origin/main，合并提交（即功能提交）`7ab751adb1a3aa97bfe4ff3ec3d885734da62db9`；不需要真机验收，状态改为 verified。未开 PR。
