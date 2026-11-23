# my-rules

个人代理规则与配置集合：QuantumultX（iOS）和 Stash（iOS / macOS）两套配置，策略组与规则顺序对齐桌面端 mihomo 模板（在 dotfiles 仓库单独维护）。

## 目录结构

```
my-rules/
├── quantumultx/
│   ├── qx.conf                 # QuantumultX 主配置
│   ├── filter/
│   │   ├── ChinaGeoIP.list     # 国内 IP 兜底，作为最后一个远程规则加载
│   │   └── twitch-noad-route.list # 可选：Twitch 路线 A 少广告地区分流，不写入 qx.conf
│   └── rewrite/
│       ├── reddit-ads.snippet # 可选：Reddit 去广告片段，不写入 qx.conf
│       ├── wechat-mp-ads.snippet # 可选：公众号文章广告，不写入 qx.conf
│       ├── jd-splash-ads.snippet # 可选：京东开屏，不写入 qx.conf
│       └── twitch-ads.snippet # 可选：Twitch 路线 B MitM 实验脚本，不写入 qx.conf
├── stash/
│   ├── my.yml                  # Stash 主配置
│   └── override/
│       ├── biliintl.stoverride # B站国际版去除 sim_code 参数
│       ├── reddit-ads.stoverride # 可选：Reddit 去广告覆写，不写入 my.yml
│       ├── wechat-mp-ads.stoverride # 可选：公众号文章广告，不写入 my.yml
│       ├── jd-splash-ads.stoverride # 可选：京东开屏，不写入 my.yml
│       ├── twitch-noad-route.stoverride # 可选：Twitch 路线 A，不写入 my.yml
│       └── twitch-ads.stoverride # 可选：Twitch 路线 B，不写入 my.yml
├── script/
│   ├── reddit-ads.js           # QX / Stash 共用的 Reddit 响应脚本
│   ├── wechat-mp-ads.js        # QX / Stash 共用的公众号 getappmsgad 脚本
│   ├── jd-splash-ads.js        # QX / Stash 共用的京东开屏脚本
│   └── twitch-ads.js           # QX / Stash 共用的 Twitch 实验脚本
├── scripts/
│   ├── check_sync.py           # 对比 mihomo 模板与 Stash 配置的差异
│   ├── test_reddit_ads.js      # Reddit 脚本的离线测试
│   ├── test_wechat_mp_ads.js   # 公众号脚本的离线测试
│   ├── test_jd_splash_ads.js   # 京东开屏脚本的离线测试
│   └── test_twitch_ads.js      # Twitch 脚本与配置的离线测试
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

## 可选：Reddit 去广告

`script/reddit-ads.js` 供 Quantumult X 与 Stash 共用。主配置不引用它，导入对应资源后才生效。

```
https://raw.githubusercontent.com/bbq191/my-rules/main/script/reddit-ads.js
https://raw.githubusercontent.com/bbq191/my-rules/main/quantumultx/rewrite/reddit-ads.snippet
https://raw.githubusercontent.com/bbq191/my-rules/main/stash/override/reddit-ads.stoverride
```

脚本只处理 `gql.reddit.com` 与 `gql-fed.reddit.com` 的 JSON。从数组中删除 `__typename` 为 `AdPost` 的元素、`adPayload` 为带自有键的普通对象的元素，以及 `cells` 直接子项为 `AdMetadataCell` 或 `isAdPost === true` 的元素。edge 的 `node` 命中时删除整条 edge。`commentsPageAds`、`adPosts` 只删其中的广告元素，保留 `pageInfo`、`cursor` 和同级字段。不在数组里的单个对象保留。解析失败、非 JSON、缺字段或异常时返回原文。没有删除时不重新序列化。不修改 Premium、Employee、NSFW、遮罩、翻译、个性化字段。脚本不联网、不写存储。

启用后只为这两个主机增加 MitM。响应里可以有信息流、评论和账号字段；脚本只在本地改 JSON。使用自己的证书，不要安装别人提供的 CA。`www.reddit.com`、`oauth.reddit.com` 和媒体 CDN 不在这份名单里。

Quantumult X：把 snippet 加到「重写 → 规则资源」。官方导入片段里的 `hostname =` 会并入已有 MitM 主机名；不要用这两行覆盖 `[mitm]` 里现有的 `hostname`。需已信任 MitM 证书。空响应体不会进入 body 类重写。若当前版本不执行资源里的远程脚本，把规则放进 `[rewrite_local]`，把这两个主机名追加到现有 `hostname` 末尾并保留原有项，脚本存到 Quantumult X 的 Scripts 目录后把路径改成文件名 `reddit-ads.js`。

Stash：在「覆写」中添加该 stoverride，并安装 MitM 证书。`http.mitm` 未写 `#!replace`，按官方覆写规则这两个主机会插到已有 MitM 列表前面，原有主机名保留。正文超过 8388608 字节或超过 15 秒时脚本不运行，响应保持原样。

上述行为有离线测试。未在官方 App 上实机验证。

## 可选：Twitch 去广告（实验）

Twitch 直播广告由服务端拼进 HLS（SSAI），官方 iOS App 使用 Amazon IVS Player。这里提供两条互不耦合的实验路线，都不写入 `qx.conf` / `my.yml`，也未在官方 App 上真机验证。不能保证去掉直播前贴或中插；广告是否出现取决于地区、账号、频道与当时的服务端策略。两套模块只做离线验证，不接入公共代理，也不把统计拦截当作去广告。

### 路线 A：少广告地区分流（无 MitM）

只把广告决策与播放列表请求交给少广告地区出口，不改正文、不装证书。出口地区不同，广告数量和可用画质都会变。

```
https://raw.githubusercontent.com/bbq191/my-rules/main/quantumultx/filter/twitch-noad-route.list
https://raw.githubusercontent.com/bbq191/my-rules/main/stash/override/twitch-noad-route.stoverride
```

列表只含 `gql.twitch.tv`、`usher.ttvnw.net` 与 `playlist.live-video.net` / `playlist.ttvnw.net`，不包含 ttvnw.net 的泛域名，也不代理实际视频分片 CDN。

Quantumult X：把列表加到 `[filter_remote]`，用 `force-policy=<你的少广告地区节点或策略组>` 指定出口。条目里的 `Twitch-NoAd` 会被 `force-policy` 覆盖；主配置没有这个策略组，也不要为此改 `qx.conf`。公开资料里俄/韩节点常被限制到 720p，请避开。

Stash：添加该覆写后，在新增的 `Twitch-NoAd` 组里手动选择少广告地区节点（候选来自已有的「全部节点」）。

### 路线 B：MitM 明文实验脚本

在明文里改写 `PlaybackAccessToken` 的 `playerType` 为 `popout`，并按广告标记保守剥离 HLS 分片。需要自行安装并信任 MitM 证书；脚本不联网、不写存储。

```
https://raw.githubusercontent.com/bbq191/my-rules/main/script/twitch-ads.js
https://raw.githubusercontent.com/bbq191/my-rules/main/quantumultx/rewrite/twitch-ads.snippet
https://raw.githubusercontent.com/bbq191/my-rules/main/stash/override/twitch-ads.stoverride
```

请求侧只处理 `gql.twitch.tv/gql` 的 `PlaybackAccessToken` / `PlaybackAccessToken_Template`（或 query 含 `streamPlaybackAccessToken` / `videoPlaybackAccessToken` 且带 `variables` 的条目），只改 `variables.playerType`，不硬编码 hash，不改请求头、会员或广告标志，也不动同一批里的其他 operation。

响应侧只处理 weaver / playlist 主机上的 m3u8：Master Playlist 放行；按未过期的 `twitch-stitched` / `twitch-maf-ad` `DATERANGE`、`CUE-OUT` / `SCTE35-OUT` 到 `CUE-IN` 的区间，以及 `EXTINF` 标题含 `Amazon` / `stitched` 的分片剥离广告；单独的 `EXT-X-DISCONTINUITY` 不当作广告。静态 VOD 与直播滑窗都会在剥离后统计正片分片，若一个不剩（例如直播整窗全广告）原样放行，不会输出空列表。移除列表开头分片时同步递增已有的 `EXT-X-MEDIA-SEQUENCE`。不 MitM 实际视频分片主机，不 REJECT `PlaybackAccessToken`，也不处理统计域名。

局限：

- 官方 App 若有证书锁定或走 QUIC / HTTP/3，MitM 可能不命中。
- `playerType=popout` 可能失效，或导致报错、紫屏、降画质。
- 不能保证去掉直播前贴 / 中插；全广告滑窗会原样放行。
- 不代理视频分片 CDN，出口仍走正常分流。

关闭回退：路线 A 从 `[filter_remote]` 移除远程规则，或关闭 Stash 覆写；路线 B 关闭对应重写资源 / 覆写并移除相应 MitM 主机名即可。离线测试覆盖请求改写、广告标记识别、全广告窗保护和片段 / 覆写配置检查，但不代替真机验证。

## 可选：微信公众号文章广告

`script/wechat-mp-ads.js` 供 Quantumult X 与 Stash 共用。主配置不引用它。只匹配 `https://mp.weixin.qq.com/mp/getappmsgad`，不覆盖 `mp.weixin.qq.com` 的其他路径，也不包含朋友圈、小程序、`wxs.qq.com`、HTTPDNS、支付或安全域名。

公开资料把该路径当作公众号文章广告响应，并提到根对象上的 `advertisement_info`、`ad_slot_data`。本仓库没有 2026 年实网样本，不保证当前微信仍使用这些字段。脚本只在这两个字段是非空数组时把该数组改成 `[]`；若因此改了内容，且 `advertisement_num` 是非 0 数字，则改为 0。阅读数、点赞、正文、推荐和其他字段保持不变。非 JSON、字段缺失或类型不符时返回原文字节。不改广告点击或奖励请求。

导入：

```
https://raw.githubusercontent.com/bbq191/my-rules/main/script/wechat-mp-ads.js
https://raw.githubusercontent.com/bbq191/my-rules/main/quantumultx/rewrite/wechat-mp-ads.snippet
https://raw.githubusercontent.com/bbq191/my-rules/main/stash/override/wechat-mp-ads.stoverride
```

Quantumult X：把 snippet 加到「重写 → 规则资源」。`hostname = mp.weixin.qq.com` 会并入已有 MitM，不要用它覆盖现有 `hostname`。Stash：添加该覆写。`http.mitm` 没有 `#!replace`，这个主机会插到已有列表前面。正文超过 1MiB 或超过 10 秒时脚本不运行，响应保持原样。

启用后会解密发往 `mp.weixin.qq.com` 的 HTTPS，其中有文章和账号相关响应；脚本只改上述路径里的广告数组。使用自己的证书。出问题就关掉这条重写资源或覆写。离线测试不能代替手机实测，也不表示 2026 年的微信一定仍走这个接口。

## 可选：京东开屏

`script/jd-splash-ads.js` 只处理 `https://api.m.jd.com/client.action` 且查询参数 `functionId` 精确为 `start` 或 `startup` 的 JSON。主配置不引用它。

公开脚本把这个查询对应开屏素材列表 `images`。2026-08-12 的一份无许可证 Loon 插件还写明：京东 15.9.50 起 `functionId` 改到 base64 POST 正文，响应也可能整体 base64。本仓库没有自己的抓包。因此只处理 URL 上就能看见 `functionId` 的明文 JSON：`images` 为非空数组时改为 `[]`，同一层的 `showTimesDaily` 若是非 0 数字则改为 0。没有 `images`、类型不符、非 JSON，或 URL 不是上述两个 functionId 时，返回原文字节。不改登录、支付、订单、领券、搜索和会员字段，也不解码 base64 正文。

`api.m.jd.com` 同时承载这些业务。启用后 MitM 会解密该主机；脚本规则不匹配其它 `functionId`。不要把主机名写成 `*.jd.com`。QX 的 `hostname` 并入已有名单。Stash 覆写不替换已有 MitM 列表。出问题就关闭这条资源。未在手机上验证，不表示当前京东版本仍把开屏放在 URL 查询参数里。

京东小游戏未实现。广告位按游戏的 `adUnitId` 开通，公开资料没有一个可共用的广告响应。需要具体游戏名和广告出现的位置，才能再写规则。不做激励视频完成回调、签到或游戏币。

导入：

```
https://raw.githubusercontent.com/bbq191/my-rules/main/script/jd-splash-ads.js
https://raw.githubusercontent.com/bbq191/my-rules/main/quantumultx/rewrite/jd-splash-ads.snippet
https://raw.githubusercontent.com/bbq191/my-rules/main/stash/override/jd-splash-ads.stoverride
```

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
→ MATCH → OutSide
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
- Reddit 去广告只覆盖 `gql.reddit.com` 与 `gql-fed.reddit.com` 的 JSON 响应，范围和安装前提见上文。离线测试通过不等于当前官方 App 已实测。Twitch 的两条实验路线见上文：路线 A 依赖少广告地区出口，路线 B 依赖 MitM 与 `playerType` 改写，都不能保证去掉直播前贴或中插，全广告滑窗会原样放行，且未在官方 App 上真机验证。
- 删过广告的 Reddit 响应会重新 `JSON.stringify`。无删除时保留原文字节。超过 `Number.MAX_SAFE_INTEGER` 的数字若和广告出现在同一份被改写的响应里，可能损失精度。
- 微信公众号脚本只匹配 `mp.weixin.qq.com/mp/getappmsgad`，见上文。没有实网样本，未在手机上验证。
- 京东只处理 URL 查询里 `functionId=start` 或 `startup` 的开屏 JSON。15.9.50 起把 functionId 放进 POST 正文的协议未覆盖。京东小游戏未实现。Twitch 直播广告仅提供上文两条实验路线，限制见该节。
