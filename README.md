# my-rules

个人代理规则与配置集合，包含 QuantumultX 和 Stash 两套配置。

## 目录结构

```
my-rules/
├── quantumultx/
│   ├── qx.conf          # QuantumultX 主配置
│   └── filter/
│       └── ChinaGeoIP.list  # 国内 IP 兜底（作为最后一个远程规则加载）
├── stash/
│   ├── my.yml           # Stash 主配置
│   └── override/
│       └── biliad.stoverride  # Bilibili 去广告重写
├── scripts/
│   └── check_sync.py    # 对比桌面端 mihomo 模板与 Stash 配置的差异
└── icons/
    ├── Policy-Country/  # 地区策略图标（HK/TW/JP/US/SG/CN/All/Other）
    └── Policy-Filter/   # 功能策略图标（AI/AdBlock/Apple/Bahamut/Final/Games/Github/Google/Microsoft/Telegram/YouTube）
```

## 配置说明

### QuantumultX (`quantumultx/qx.conf`)

- 策略组：香港 / 台湾 / 日本 / 美国 / 新加坡 / 全部节点 / 国内 / OutSide / GlobalMedia / YouTube / AI / Github / Apple / Microsoft / Google / Telegram / Games / 巴哈姆特
- 规则源：blackmatrix7 + 自定义（AI 组合并 OpenAI / Anthropic / Gemini 三份列表；广告用 AdvertisingLite，约 3.8 万条，全量版 28 万条对 iOS 太重）
- `fallback_udp_policy=direct`：节点不支持 UDP 转发时回退直连，保证游戏 / 语音可用
- 注意：QX 本地规则优先于远程规则匹配，`[filter_local]` 只放需要抢先命中的精确 host 例外；`geoip, cn` 兜底放在 `filter/ChinaGeoIP.list`，作为最后一个远程规则加载，避免截胡远程列表里的 IP-CIDR 条目
- 图标：策略组图标来自 [Vbaethon/HOMOMIX](https://github.com/Vbaethon/HOMOMIX)（`Icon/Color/` 等高版）

### Stash (`stash/my.yml`)

- 规则集：MetaCubeX MRS 格式（Stash 3.1+ 支持，仅 domain / ipcidr）
- DNS：FakeIP，国内 UDP 解析器，`proxy-server-nameserver` 独立解析代理服务器域名
- 流媒体：YouTube 单独分组，Netflix / Disney+ / HBO / Prime Video / Spotify 归入 GlobalMedia
- 端口、TUN、局域网代理、API 等由 Stash 客户端界面管理，配置文件只保留 Stash 会读取的键
- 策略组与 QX 对齐，区域组为 `select` 手动选择，按地区关键字自动过滤节点
- 规则顺序与桌面端 mihomo 模板一致：私有网络 → DeepSeek 抢先直连 → AI/厂商/游戏规则集 → 广告拦截 → 非中国域名 → CN 域名/IP → 兜底

### Stash Override (`stash/override/biliad.stoverride`)

- Bilibili 全平台去广告（App / 直播 / 动态 / 漫画 / 国际版）
- 规则来源：blackmatrix7 / app2smile / yjqiang

## 同步检查

桌面端 mihomo 配置模板在 dotfiles 仓库中单独维护，规则顺序和策略组应保持一致。改动后运行：

```
scripts/check_sync.py [mihomo模板路径]
```

脚本只读，输出策略组、规则顺序、规则集 URL 三类差异，无差异时退出码为 0。

## 图标

策略组图标统一引用 [Vbaethon/HOMOMIX](https://github.com/Vbaethon/HOMOMIX) 的 `Icon/Color/` 等高版（另有 `Icon/Color/Large/` 满高版可选）：

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

`icons/` 目录保留自绘 SVG/PNG（圆形底色 + 白色主体，`viewBox="0 0 100 100"`，风格参考 [erdongchanyo/icon](https://github.com/erdongchanyo/icon)），目前仅 `Policy-Provider/Flowercloud.png` 仍被 Stash 配置引用：

```
https://raw.githubusercontent.com/bbq191/my-rules/main/icons/
```
