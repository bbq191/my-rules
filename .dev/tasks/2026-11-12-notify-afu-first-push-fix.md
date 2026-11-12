# 修复 notify-afu 新分支首次 push 误发历史回执

- Task ID: 2026-11-12-notify-afu-first-push-fix
- 负责 bot: my-rules
- 状态: verified
- 执行方: my-rules bot（alienware 本机直接执行；本仓库只由 my-rules bot 提交）
- 分支: fix/notify-afu-first-push（从最新 main 切出）
- 更新时间: 2026-11-12T14:43+08:00
- 引用: 2026-11-12-notify-afu-debounce

## 需求原文
> 正本已修好。用正本整文件替换 `.github/workflows/notify-afu.yml`。旧版在新分支首次 push（before 为全零/不可用）时会把历史回执误发；修复为与 origin/默认分支的 merge-base 做 diff。开任务单 `2026-11-12-notify-afu-first-push-fix`。只做到本地提交，不要 push、不要 merge。任务单状态写到「待推送（等用户确认）」。不改 vault 笔记。

## 输入
- 背景：任务单 `2026-11-12-notify-afu-debounce` 已把去抖版合进 main（`7ab751a`），当时复制的正本尚无「before 不可用时改用 merge-base」的修复；正本随后已更新。
- 涉及文件：
  - `.github/workflows/notify-afu.yml`（修改：整文件替换为已修复的正本模板）
  - `.dev/tasks/2026-11-12-notify-afu-first-push-fix.md`（新增：本任务单）

## 约束
- 不做：不 push、不 merge、不改仓库 Secrets、不把 URL/token/内网域名写入仓库、不改 vault 笔记
- 提交信息用中文，`fix(ci):` 前缀 + 正文写原因，不加 Co-Authored-By
- 不读密钥、`.env`、`auth*`

## 分步任务
1. [x] 核对正本 sha256 以 `2c3f9ea8` 开头、以 `d206` 结尾
2. [x] 确认 main 与 origin/main 一致、工作区干净，从 main 切出 `fix/notify-afu-first-push`
3. [x] 用正本整文件替换 workflow，校验 sha256、YAML、Secrets 名、merge-base 逻辑
4. [x] 填写任务单并仅本地提交

## 验收标准
- [x] 仓库内 workflow 与正本字节级一致，sha256 `2c3f9ea80688adfb0c14772cb91fed985f31806e564841c5cbebfac060dbd206`
- [x] before 不可用时改为与 origin/默认分支的 merge-base 做 diff，不再对整棵树 `ls-tree`
- [x] Secrets 名仍为 `AFU_WEBHOOK_URL` / `AFU_WEBHOOK_TOKEN`，仅通过 `${{ secrets.* }}` 引用
- [x] PyYAML 校验通过；无 URL/token/内网地址写入仓库
- [x] 用户确认后已 push 分支并 fast-forward 合并到 main

## 交付物
代码已推送并 fast-forward 合并到 main；状态改为 verified。

## 给执行方的指令
```
由负责 bot 在 alienware 本机直接执行本任务单：替换 workflow、校验、填写结果、仅本地提交。不要 push，不要 merge。
```

## 结果
- 执行方 / 开始–结束时间：my-rules bot / 2026-11-12T14:36+08:00–2026-11-12T14:37+08:00
- base..head：30a9e01fdc6c6c0b18c9598af1b62b49314435b7..969d32e3fbc957926086c7f79089a65411c2b799
- 提交：| 步骤 | 提交号 | 文件 | 说明 |
  | 替换已修复正本并开单 | 969d32e3fbc957926086c7f79089a65411c2b799 | `.github/workflows/notify-afu.yml`、`.dev/tasks/2026-11-12-notify-afu-first-push-fix.md` | 整文件替换为含 merge-base 修复的正本 |
- 测试：
  - 正本与仓库内文件 sha256 均为 `2c3f9ea80688adfb0c14772cb91fed985f31806e564841c5cbebfac060dbd206`，字节一致
  - `python3` + PyYAML `yaml.safe_load`：通过。PyYAML 1.1 仍把键 `on` 解析为布尔 `True`，GitHub Actions 按触发器 `on` 处理；`on.push.paths` 为 `.dev/tasks/**`
  - 敏感信息扫描：无 http(s) URL、无私网 IP、无硬编码 webhook/token；仅 `${{ secrets.AFU_WEBHOOK_URL }}` / `${{ secrets.AFU_WEBHOOK_TOKEN }}`
  - merge-base 逻辑：见下方说明，已在文件中核对存在
- 遇到的问题：无
- 偏离：先前按用户要求把状态写成「待推送（等用户确认）」；用户确认后改为 verified。未改 vault 笔记。
- 未完成：无

## 审查
- 验收：通过。证据：与正本字节一致（sha256 `2c3f9ea80688adfb0c14772cb91fed985f31806e564841c5cbebfac060dbd206`）；before 不可用时改走与 origin/默认分支的 merge-base；Secrets 名未变。用户已确认 push 并合并。
- 二审：未跑
- 合并：已推送 `fix/notify-afu-first-push`，fast-forward 合并到 main 并推送 origin/main，合并提交（即功能提交）`969d32e3fbc957926086c7f79089a65411c2b799`；不需要真机验收，状态改为 verified。未开 PR。

## merge-base 逻辑说明
收集步骤把 `BEFORE`（`github.event.before`）、`AFTER`（`github.sha`）、`DEFAULT_BRANCH`（`github.event.repository.default_branch`）传入。若 `BEFORE` 为空、等于 40 个 0，或 `git cat-file -e "$BEFORE"` 失败（新分支首次 push、force push 后旧提交不在等），则先把 `BEFORE` 清空，在 `DEFAULT_BRANCH` 非空时 `git fetch` 对应 `origin/<默认分支>`，再执行 `git merge-base refs/remotes/origin/$DEFAULT_BRANCH $AFTER`，用该公共祖先作为新的 `BEFORE`。随后只要 `BEFORE` 非空，就对 `.dev/tasks` 做 `git diff --name-only $BEFORE $AFTER`，只看相对默认分支新增的改动；仅在仍拿不到 `BEFORE`（仓库第一次 push、没有默认分支等）时才退回对 `$AFTER` 整棵树 `ls-tree`。
