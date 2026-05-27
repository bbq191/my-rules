# my-rules

个人代理规则与配置集合，包含 QuantumultX 和 Stash 两套配置。

## 目录结构

```
my-rules/
├── quantumultx/
│   └── qx.conf          # QuantumultX 主配置
├── stash/
│   ├── my.yml           # Stash 主配置（mihomo 内核兼容）
│   └── override/
│       └── biliad.stoverride  # Bilibili 去广告重写
└── icons/
    ├── Policy-Country/  # 地区策略图标（HK/TW/JP/US/SG/CN/All/Other）
    └── Policy-Filter/   # 功能策略图标（AI/AdBlock/Apple/Bahamut/Final/Games/Github/Google/Microsoft/Telegram/YouTube）
```

## 配置说明

### QuantumultX (`quantumultx/qx.conf`)

- 策略组：香港 / 台湾 / 日本 / 美国 / 新加坡 / 全部节点 / 国内 / OutSide / GlobalMedia / YouTube / AI / Github / Apple / Microsoft / Google / Telegram / Games / 巴哈姆特
- 规则源：blackmatrix7 + 自定义
- 图标：使用本仓库 `icons/` 目录下的 SVG

### Stash (`stash/my.yml`)

- 内核：mihomo（Clash Meta）
- 规则集：MetaCubeX MRS 格式（更小、更快）
- TUN 模式：`mixed` stack，支持 `auto-route` + `auto-redirect`
- DNS：FakeIP + `respect-rules`，缓存算法 ARC
- 策略组与 QX 对齐，区域组使用 `url-test` 自动选最低延迟

### Stash Override (`stash/override/biliad.stoverride`)

- Bilibili 全平台去广告（App / 直播 / 动态 / 漫画 / 国际版）
- 规则来源：blackmatrix7 / app2smile / yjqiang

## 图标

SVG 图标自绘，风格参考 [erdongchanyo/icon](https://github.com/erdongchanyo/icon)，圆形底色 + 白色主体，`viewBox="0 0 100 100"`。

Raw URL 前缀：
```
https://raw.githubusercontent.com/bbq191/my-rules/main/icons/
```
