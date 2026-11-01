# my-rules · Agent 约定

iOS 代理配置仓库：QuantumultX（`quantumultx/qx.conf`）与 Stash（`stash/my.yml`），
策略组与规则顺序对齐 dotfiles 的 mihomo 模板。设计决策、规则顺序详见 README.md。

## 硬约束
- 订阅地址、token、工作内网域名/IP 不进仓库（公开仓库）；`[server_remote]` 留空，Stash 用 `YOUR_SUBSCRIPTION_URL_*` 占位。
- 改策略组或规则后必须跑 `scripts/check_sync.py`，退出码 0 才算同步；平台专属规则加进脚本的 `*_ONLY_RULES` 白名单并写明原因。
- QX `[filter_local]` 只放精确 `host` / `host-suffix` 例外，不放 IP 规则。
- 广告规则必须在厂商规则之前；AI 规则在 GlobalMedia / Google / Microsoft 之前；AI 组不含香港。
- Stash 正则用单引号（双引号里 `\b` 会变成退格符）。
- QX 图标用 Koolson/Qure Color（144×144），Stash 用 HOMOMIX；只外链不复制。
- 新增上游规则或脚本前，核实链接返回 200 和最近提交日期，不用已归档或多年未更新的脚本。
- 改动后同步更新 README 对应段落。

## 协作
- 本仓库只由 my-rules bot 提交；改了 dotfiles 的 mihomo 模板后通知它同步。
- 提交信息用中文，带 `feat:` / `fix:` / `chore(scope):` / `docs:` 前缀，正文写原因；只有明确要求时才 commit / push。
- 项目上下文在 vault 的 `Projects/my-rules/context.md`。
