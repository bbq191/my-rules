# my-rules

个人代理规则与配置集合：QuantumultX（iOS）和 Stash（iOS / macOS）两套配置，策略组与规则顺序对齐桌面端 mihomo 模板（在 dotfiles 仓库单独维护）。

## 目录结构

```
my-rules/
├── quantumultx/
│   ├── qx.conf                 # QuantumultX 主配置
│   └── filter/
│       └── ChinaGeoIP.list     # 国内 IP 兜底，作为最后一个远程规则加载
├── stash/
│   ├── my.yml                  # Stash 主配置
│   └── override/
│       └── biliad.stoverride   # Bilibili 去广告覆写
├── scripts/
│   └── check_sync.py           # 对比 mihomo 模板与 Stash 配置的差异
└── icons/
    └── Policy-Provider/        # 订阅图标（Flowercloud）
```

Raw 地址前缀：

```
https://raw.githubusercontent.com/bbq191/my-rules/main/
```

## 快速开始

### QuantumultX

1. 在 QX「配置文件」中以远程方式导入 `quantumultx/qx.conf`，或下载后本地编辑。
2. 替换两个占位符：
   - `[general]` 里的 `YOUR_HOME_SSID`：家庭 Wi-Fi 名称，连上后自动切换为全部直连。
   - `[server_remote]` 里的 `YOUR_SUBSCRIPTION_URL`：机场订阅地址。
3. 首次使用在「MitM」页生成证书并安装、信任，Bilibili 去广告重写才会生效。
4. 更新远程资源（规则、重写）后，`[filter_remote]` 末尾的 `ChinaGeoIP.list` 也会一并拉取。

要求：QX 需支持 `fallback_udp_policy` 和远程 `filter` 资源，当前 App Store 版本均满足。

### Stash

1. 在 Stash「配置」中以 URL 方式添加 `stash/my.yml`。
2. 替换 `proxy-providers` 下的 `YOUR_SUBSCRIPTION_URL_1` / `YOUR_SUBSCRIPTION_URL_2`；只有一个机场时删掉 `Provider2` 整段。
3. 「覆写」中添加 `stash/override/biliad.stoverride`，并在「HTTP 引擎」中安装 MitM 证书。
4. 端口、TUN、局域网共享、API 控制等在客户端界面设置，配置文件不声明这些键。

要求：Stash 3.1+（MRS 规则集自 3.1 起支持，仅 domain / ipcidr 两种 behavior）。

## 策略组

两套配置的策略组一致，QX 为 `static` 手动选择，Stash 为 `select` 手动选择。

| 分组 | 策略组 | 候选 | 说明 |
|---|---|---|---|
| 地区 | 香港 / 台湾 / 日本 / 美国 / 新加坡 | 按国旗 emoji、中文、带边界的英文缩写过滤订阅节点 | 正则已避开 `us` 命中 Australia、`tw` 命中 Network 之类的子串误匹配 |
| 地区 | 其它地区 | 不属于上述五地的节点 | 仅 Stash |
| 地区 | 全部节点 | 排除失联、剩余流量等信息节点 | 兜底 |
| 国内 | 国内 | DIRECT / 全部节点 | CN 域名与 IP、DeepSeek、国内游戏服 |
| 厂商 | AI / Github / Apple / Microsoft / Google | 美国、香港为主，Github / Apple / Microsoft 含 DIRECT | |
| 社交 | Telegram | 新加坡、香港、日本 | |
| 流媒体 | YouTube / GlobalMedia | 美国、香港、日本等 | GlobalMedia 覆盖 Netflix、Disney+、HBO、Prime Video、Spotify |
| 游戏 | Games / 巴哈姆特 | Games 含 DIRECT | Steam 国区 CDN 等国内游戏域名先走「国内」 |
| 广告 | Advertising | REJECT / DIRECT | Stash 与 mihomo 有此组，QX 直接 reject |

## 规则匹配顺序

### Stash

```
本地例外（工作域名、游戏国内服、.local）
→ 私有网络 IP / 域名 → DIRECT
→ 广告 → Advertising（默认 REJECT，可切 DIRECT 排障）
→ deepseek.com → 国内
→ AI / Github / YouTube / 流媒体 / Google / Apple / Microsoft / Telegram
→ 国内游戏 → 国内，其余游戏 → Games，巴哈姆特
→ 非中国域名 → 全部节点
→ Google / Telegram IP（no-resolve）
→ CN 域名 / CN IP → 国内
→ MATCH → 全部节点
```

### QuantumultX

QX 的 `[filter_local]` 永远先于 `[filter_remote]` 匹配，所以两段的分工是固定的：

- `[filter_local]` 只放需要抢先命中的精确 host 例外（DeepSeek、游戏国内服、`.local`）和 `final`，不放任何 IP 类规则。
- `[filter_remote]` 按顺序：局域网、广告拦截、各厂商列表、国内规则、最后是 `ChinaGeoIP.list`（内容只有 `GEOIP,CN,国内`）。

把 `geoip, cn` 从本地段挪到远程末尾，是为了让 Advertising 列表里的几百条国内 IP 拦截不被截胡。

## 关键设计决策

| 决策 | 原因 |
|---|---|
| 广告拦截排在厂商规则之前 | geosite google 与 blackmatrix7 Google.list 都包含 doubleclick 等广告域名，放在后面会被 Google 组先接走 |
| DeepSeek 抢先直连 | category-ai-!cn 包含 deepseek.com，国内 API 绕境外又慢又不稳 |
| 国内游戏先直连、Games 组带 DIRECT | category-games 含 mihoyo、4399、网易等国内域名；`@cn` 子集只有 Steam 国区等 36 条，其余靠 DIRECT 选项兜底 |
| AI 组合并三份列表（QX） | 单独的 Anthropic.list 只有 3 条，加 OpenAI 与 Gemini 才接近 mihomo 的 category-ai-!cn |
| QX 广告用 AdvertisingLite | 全量版 28 万条，iOS 启动与内存开销明显；Lite 约 3.8 万条，牺牲长尾域名 |
| QX `fallback_udp_policy=direct` | 默认 reject 会丢弃命中不支持 UDP 节点的流量，游戏与语音不可用；代价是同一目标 TCP / UDP 源地址不同 |
| 订阅 `proxy: DIRECT`（Stash） | 订阅更新不经代理，代理失效时仍能刷新 |
| 区域组用 select 而非 url-test | 与桌面端实际用法一致，手动选节点 |

## 维护约定

- **改规则先改顺序表。** 两套配置和 mihomo 模板的规则顺序应保持一致，改动后运行同步检查：

  ```
  scripts/check_sync.py [mihomo模板路径]
  ```

  默认读取 `~/Projects/dotfiles/system/etc/mihomo/config.template.yaml`。脚本只读，输出策略组、规则顺序、规则集 URL 三类差异，无差异时退出码为 0；桌面端专属规则（热点开关、进程名、工作域名）自动跳过。需要 PyYAML。

- **QX 本地段不放 IP 规则。** 新增例外只写精确的 `host` / `host-suffix`。
- **公开仓库不放工作域名。** 企业内网域名和内网 DNS 只留在 dotfiles 的 mihomo 模板里，这里用注释占位。
- **规则来源。** Stash 用 MetaCubeX meta-rules-dat 的 MRS（每日更新，`interval: 86400`）；QX 用 blackmatrix7 ios_rule_script（手动更新，`update-interval=-1`）。
- **地区正则依赖节点命名。** 订阅节点名应带国旗 emoji 或中文地区名；换机场后检查五个地区组是否都有节点、其它地区组是否误收。

## 图标

策略组图标统一引用 [Vbaethon/HOMOMIX](https://github.com/Vbaethon/HOMOMIX) 的 `Icon/Color/` 等高版，另有 `Icon/Color/Large/` 满高版可选：

```
https://raw.githubusercontent.com/Vbaethon/HOMOMIX/main/Icon/Color/
```

| 策略组 | 图标文件 |
|---|---|
| 香港 / 台湾 / 日本 / 美国 / 新加坡 | Hong_Kong / Taiwan_Province / Japan / USA / Singapore |
| 全部节点 / OutSide / 其它地区 / 国内 | Global / Global / Other / China |
| GlobalMedia / YouTube | Stream / YouTube |
| AI / Github / Apple / Microsoft / Google | AI / GitHub / Apple / Microsoft / Google |
| Telegram / Games / 巴哈姆特 / Advertising | Telegram / Game / Bahamut / Adblock |

HOMOMIX 仓库没有 LICENSE，所以采用外链而非复制；上游改名会导致图标失效。`icons/Policy-Provider/` 只保留订阅图标 Flowercloud（自绘，圆形底色 + 白色主体，`viewBox="0 0 100 100"`）。

## 已知限制

- Stash 配置中的 `sniffer` 块和 DNS 的 `respect-rules`、`fake-ip-filter-mode`、`cache-algorithm` 在官方文档中没有记载，保留是为了不改变可能存在的行为；若确认不生效可删。
- Stash iOS 不支持 PROCESS-NAME 规则，进程相关规则只能放在桌面端 mihomo 模板。
- mihomo 模板与本仓库的同步是手动的，`check_sync.py` 只报告差异，不自动修改任何一方。
- Stash 配置的 `rule-providers` 依赖 YAML 锚点合并（`<<: *domain`），官方样例未展示该写法；若导入后规则集全部报错，把每条展开写全即可。
