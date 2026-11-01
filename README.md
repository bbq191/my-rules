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
│       └── biliintl.stoverride # B站国际版去除 sim_code 参数
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
2. `[general]` 的 `running_mode_trigger` 里把家庭 Wi-Fi 名改成自己的，连上后自动切换为全部直连。
3. 在 App 内添加机场订阅（`[server_remote]` 留空，订阅地址不进仓库）。
4. 首次使用在「MitM」页生成证书并安装、信任，R-Store 去广告合集和 BiliIntl 重写才会生效。
5. 建议在「设置 → 其他设置 → GeoLite2」把数据库换成 [Loyalsoldier/geoip](https://github.com/Loyalsoldier/geoip) 的 `Country.mmdb`：`[filter_remote]` 末尾的 `ChinaGeoIP.list` 只有一行 `GEOIP,CN,国内`，国内 IP 判定的准确度取决于这个库。

要求：QX 需支持 `fallback_udp_policy`、`udp_drop_list`、`url-latency-benchmark` 的 `server-tag-regex` 和远程 `filter` 资源，当前 App Store 版本均满足。

### Stash

1. 在 Stash「配置」中以 URL 方式添加 `stash/my.yml`。
2. 替换 `proxy-providers` 下的 `YOUR_SUBSCRIPTION_URL_1` / `YOUR_SUBSCRIPTION_URL_2`；只有一个机场时删掉 `Provider2` 整段。
3. 「覆写」中添加 `stash/override/biliintl.stoverride`，并在「HTTP 引擎」中安装 MitM 证书。
4. 去广告覆写：先安装 [Script-Hub](https://github.com/Script-Hub-Org/Script-Hub) 的 `script-hub.stash.stoverride`，再在 `http://script.hub` 把下列 Surge 模块转换为 Stash 覆写并安装：
   - B站：[kokoryh/Sparkle](https://github.com/kokoryh/Sparkle) `release/surge/module/bilibili.sgmodule`
   - YouTube：[Maasea/sgmodule](https://github.com/Maasea/sgmodule) `YouTube.Enhance.sgmodule`
   - 微信：[R-Store](https://github.com/zirawell/R-Store) `Rule/Surge/Adblock/App/W/微信/wechat.sgmodule`

   不用 R-Store 全量合集（约 372KB）：与上面的单 App 模块规则重复，且 iOS 代理扩展有内存上限。
5. 端口、TUN、局域网共享、API 控制等在客户端界面设置，配置文件不声明这些键。

要求：Stash 3.1+（MRS 规则集自 3.1 起支持，仅 domain / ipcidr 两种 behavior）。

## 策略组

三套配置（QX、Stash、mihomo）的策略组一致。地区组与「自动选择」按延迟自动选优（QX `url-latency-benchmark`，Stash / mihomo `url-test`，每 600 秒测一次，容差 50ms 防止频繁切换），其余为手动选择（QX `static`，Stash / mihomo `select`）。

| 分组 | 策略组 | 候选 | 说明 |
|---|---|---|---|
| 地区 | 香港 / 台湾 / 日本 / 美国 / 新加坡 | 按国旗 emoji、中文、带边界的英文缩写过滤订阅节点，先排除剩余流量、到期等信息节点 | 正则已避开 `us` 命中 Australia、`tw` 命中 Network 之类的子串误匹配 |
| 地区 | 其它地区 | 不属于上述五地的节点 | 仅 Stash / mihomo，作为 OutSide 的候选 |
| 地区 | 自动选择 / 全部节点 | 排除信息节点后的全部节点 | 前者自动选优，后者手动挑单个节点 |
| 兜底 | OutSide | 五地、其它地区、自动选择、全部节点 | 非中国域名与最终兜底（QX `final`、Stash / mihomo `MATCH`） |
| 国内 | 国内 | DIRECT / 全部节点 | CN 域名与 IP、DeepSeek、国内游戏服 |
| 厂商 | AI | 美国、日本、新加坡、台湾 | OpenAI / Claude / Gemini 均不对香港开放，故不含香港 |
| 厂商 | Github / Apple / Microsoft / Google | 美国、香港为主；Apple / Microsoft 默认 DIRECT，Github 含 DIRECT | |
| 社交 | Telegram | 新加坡、香港、日本 | |
| 流媒体 | TikTok | 日本、新加坡、台湾、美国 | 不对中国大陆及香港提供服务 |
| 流媒体 | YouTube / GlobalMedia | 美国、香港、日本等 | Stash / mihomo 的 GlobalMedia 覆盖 Netflix、Disney+、HBO、Prime Video、Spotify；QX 用 GlobalMedia.list，范围更广 |
| 游戏 | Games / 巴哈姆特 | Games 含 DIRECT | Steam 国区 CDN 等国内游戏域名先走「国内」 |
| 广告 | Advertising | REJECT / DIRECT | Stash 与 mihomo 有此组，QX 直接 reject |

## 规则匹配顺序

### Stash

```
本地例外（工作域名、游戏国内服、.local）
→ 私有网络 IP / 域名 → DIRECT
→ 广告 → Advertising（默认 REJECT，可切 DIRECT 排障）
→ deepseek.com → 国内
→ AI / TikTok / Github / YouTube / 流媒体 / Google / Apple / Microsoft / Telegram
→ 国内游戏 → 国内，其余游戏 → Games，巴哈姆特
→ 非中国域名 → OutSide
→ Google / Telegram IP（no-resolve）
→ CN 域名 / CN IP → 国内
→ MATCH → 全部节点
```

### QuantumultX

QX 的 `[filter_local]` 永远先于 `[filter_remote]` 匹配，所以两段的分工是固定的：

- `[filter_local]` 只放需要抢先命中的精确 host 例外（DeepSeek、游戏国内服、Anthropic.list 缺的 Claude 域名、`.local`）和 `final, OutSide`，不放任何 IP 类规则。
- `[filter_remote]` 按顺序：局域网 → 广告 / 反劫持 / 屏蔽 HTTPDNS（reject）→ AI → TikTok / YouTube / 巴哈姆特 / GlobalMedia → Telegram / Github / Google / Microsoft / Apple / Games → Global（OutSide）→ 国内规则 → 最后是 `ChinaGeoIP.list`（内容只有 `GEOIP,CN,国内`）。

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
| 区域组用 url-test，容差 50ms | 节点失效自动切走；容差防止延迟接近的节点来回切换导致出口 IP 频繁变化。AI 若频繁要求重新验证，在「全部节点」里固定一个 |
| AI 组不含香港 | OpenAI / Claude / Gemini 均不对香港开放 |
| QX 屏蔽 HTTPDNS，Stash / mihomo 不做 | QX 无嗅探，App 用 HTTPDNS 直连 IP 会绕过域名分流与 MitM；Stash / mihomo 开了 sniffer，能从 TLS SNI 还原域名 |
| QX `udp_drop_list = 443` | 丢弃 QUIC，让 YouTube 等回落 TCP，MitM 去广告才生效；按端口全局生效，国内直连的 HTTP/3 也会回落 TCP |
| Stash 按域名丢弃 QUIC | 只对 googlevideo.com / youtubei.googleapis.com / bilibili.com 的 UDP 443 REJECT，避免全局丢弃误伤国内 HTTP/3 与游戏 |
| QX 去广告用 R-Store 合集，并排除 GitHub / Google 的 MitM | 合集约 650 个 App 每日更新；它对 GitHub 只改 Accept-Language、对 www.google.com 只拦 /ads，不值得解密这两类流量 |
| QX 国内 IP 用 `GEOIP,CN` 而非 ChinaIPs.list | ChinaIPs.list 约 1.9 万条（其中 5600 条 IPv6 在 `no-ipv6` 下无用），iOS 网络扩展内存有限；GEOIP 准确度靠换 GeoLite2 库补 |
| 加密 DNS（阿里 / 腾讯 DoH，IP 直连） | 防运营商 DNS 劫持；用 IP 写法无需引导解析，mihomo `respect-rules` 下也不会循环 |

## 维护约定

- **改规则先改顺序表。** QX、Stash 和 mihomo 模板的策略组与规则顺序应保持一致，改动后运行同步检查：

  ```
  scripts/check_sync.py [mihomo模板路径]
  ```

  默认读取 `~/Projects/dotfiles/system/etc/mihomo/config.template.yaml`。脚本只读，输出 mihomo 与 Stash 的策略组、规则顺序、规则集 URL 差异，以及 QX 与 Stash 的策略组名称、类型、候选与测速参数差异，无差异时退出码为 0；桌面端专属规则（热点开关、进程名、工作域名、内网 IP）自动跳过。需要 PyYAML。

- **QX 本地段不放 IP 规则。** 新增例外只写精确的 `host` / `host-suffix`。
- **公开仓库不放工作域名。** 企业内网域名和内网 DNS 只留在 dotfiles 的 mihomo 模板里，这里用注释占位。
- **规则来源。** Stash 用 MetaCubeX meta-rules-dat 的 MRS（每日更新，`interval: 86400`）；QX 用 blackmatrix7 ios_rule_script（每日更新，`update-interval=86400`）。
- **地区正则依赖节点命名。** 订阅节点名应带国旗 emoji 或中文地区名；换机场后检查五个地区组是否都有节点、其它地区组是否误收。

## 图标

两套客户端用不同图标集，风格接近（圆形彩色底 + 白色主体）：

- **Stash / mihomo**：[Vbaethon/HOMOMIX](https://github.com/Vbaethon/HOMOMIX) `Icon/Color/` 等高版，300×300。
- **QX**：[Koolson/Qure](https://github.com/Koolson/Qure) `IconSet/Color/`，144×144。QX 生态的图标集（Qure、Zure、mini）均为 144×144；HOMOMIX 的 300×300 在 QX 上实测不显示，官方未记载尺寸上限，原因未完全确认。

```
https://raw.githubusercontent.com/Vbaethon/HOMOMIX/main/Icon/Color/
https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/
```

| 策略组 | HOMOMIX（Stash / mihomo） | Qure（QX） |
|---|---|---|
| 香港 / 台湾 / 日本 / 美国 / 新加坡 | Hong_Kong / Taiwan_Province / Japan / USA / Singapore | Hong_Kong / Taiwan / Japan / United_States / Singapore |
| 全部节点 / 自动选择 / OutSide / 其它地区 / 国内 | Global / Fast / GFW / Other / China | Global / Auto / Final / 无 / China |
| GlobalMedia / YouTube / TikTok | Stream / YouTube / TikTok | Streaming / YouTube / TikTok |
| AI / Github / Apple / Microsoft / Google | AI / GitHub / Apple / Microsoft / Google | 同名 |
| Telegram / Games / 巴哈姆特 / Advertising | Telegram / Game / Bahamut / Adblock | Telegram / Game / Bahamut / 无 |

两个图标仓库都没有 LICENSE，所以采用外链而非复制；上游改名会导致图标失效。`icons/Policy-Provider/` 只保留订阅图标 Flowercloud（自绘，圆形底色 + 白色主体，`viewBox="0 0 100 100"`）。

## 已知限制

- Stash 配置中的 `sniffer` 块和 DNS 的 `respect-rules`、`fake-ip-filter-mode`、`cache-algorithm` 在官方文档中没有记载，保留是为了不改变可能存在的行为；若确认不生效可删。
- Stash iOS 不支持 PROCESS-NAME 规则，进程相关规则只能放在桌面端 mihomo 模板。
- Stash 配置只用桌面端 `mihomo -t` 校验过语法，Stash 自身是否接受 `url-test` 的 `lazy`、`exclude-type` 以官方文档为准（文档记载 `interval` / `tolerance` / `lazy` / `include-all` / `filter`，未记载 `exclude-type`）。
- QX MitM 的 `-` 排除写法是社区通用约定，官方 sample.conf 未记载。
- mihomo 模板与本仓库的同步是手动的，`check_sync.py` 只报告差异，不自动修改任何一方。
- Stash 配置的 `rule-providers` 依赖 YAML 锚点合并（`<<: *domain`），官方样例未展示该写法；若导入后规则集全部报错，把每条展开写全即可。
