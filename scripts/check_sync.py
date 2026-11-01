#!/usr/bin/env python3
"""对比桌面端 mihomo 模板与 Stash 配置，报告策略组 / 规则顺序 / 规则集 URL 的差异；
另外对比 QX 与 Stash 的策略组名称、类型和候选列表（QX 规则来源不同，不比规则）。

用法：
    scripts/check_sync.py [mihomo模板路径]
    默认模板路径：~/Projects/dotfiles/system/etc/mihomo/config.template.yaml

只读、不改文件。退出码 0 表示无差异，1 表示有差异。
"""
import difflib
import os
import sys

try:
    import yaml
except ImportError:
    sys.exit("需要 PyYAML：pip install pyyaml")

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STASH = os.path.join(REPO, "stash", "my.yml")
QX = os.path.join(REPO, "quantumultx", "qx.conf")
DEFAULT_MIHOMO = os.path.expanduser("~/Projects/dotfiles/system/etc/mihomo/config.template.yaml")

# 桌面端专属、不期望同步到 Stash 的规则（前缀匹配）
MIHOMO_ONLY_RULES = (
    "RULE-SET,hotspot_direct",
    "RULE-SET,usb_direct",
    "PROCESS-NAME,",
    "IP-CIDR,",  # 工作内网 IP，不写进公开仓库
    "DOMAIN-SUFFIX,lanxin.cn",
    "DOMAIN-SUFFIX,qianxin.com",
)
# Stash 专属：只对 MitM 去广告域名丢弃 QUIC，桌面 mihomo 不做 MitM 不需要
STASH_ONLY_RULES = (
    "AND,((NETWORK,UDP),(DST-PORT,443),",
)
# QX 没有的 Stash 策略组（QX 广告直接 reject，没有「其它地区」）
STASH_ONLY_GROUPS = {"其它地区", "Advertising"}
QX_TYPES = {"static": "select", "url-latency-benchmark": "url-test"}


def load(path):
    with open(path, encoding="utf-8") as f:
        return yaml.safe_load(f)


def groups(cfg):
    return {g["name"]: g for g in cfg.get("proxy-groups", [])}


def qx_groups(path):
    """解析 QX [policy]，返回 {名称: {type, proxies, interval, tolerance}}。"""
    out, in_policy = {}, False
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line.startswith("["):
                in_policy = line == "[policy]"
                continue
            if not in_policy or not line or line.startswith((";", "#", "//")) or "=" not in line:
                continue
            kind, rest = (x.strip() for x in line.split("=", 1))
            name, *items = (x.strip() for x in rest.split(","))
            kv = dict(x.split("=", 1) for x in items if "=" in x)
            proxies = [x.upper() if x in ("direct", "reject") else x for x in items if "=" not in x]
            out[name] = {
                "type": QX_TYPES.get(kind, kind),
                "proxies": proxies or None,
                "interval": int(kv["check-interval"]) if "check-interval" in kv else None,
                "tolerance": int(kv["tolerance"]) if "tolerance" in kv else None,
            }
    return out


def norm_url(u):
    return (u or "").replace("/refs/heads/", "/")


def main():
    mihomo_path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_MIHOMO
    if not os.path.exists(mihomo_path):
        sys.exit(f"找不到 mihomo 模板：{mihomo_path}")
    m, s = load(mihomo_path), load(STASH)
    diffs = []

    # 1. 策略组
    mg, sg = groups(m), groups(s)
    for name in sorted(set(mg) | set(sg)):
        if name not in mg:
            diffs.append(f"[策略组] 仅 Stash 有：{name}")
            continue
        if name not in sg:
            diffs.append(f"[策略组] 仅 mihomo 有：{name}")
            continue
        a, b = mg[name], sg[name]
        for key in ("type", "proxies", "filter", "include-all", "exclude-type", "interval", "tolerance", "lazy", "icon"):
            if a.get(key) != b.get(key):
                diffs.append(f"[策略组] {name}.{key} 不一致\n    mihomo: {a.get(key)}\n    stash : {b.get(key)}")

    # 2. 规则顺序（剔除各自专属规则后逐条比较）
    mr = [r for r in m.get("rules", []) if not r.startswith(MIHOMO_ONLY_RULES)]
    sr = [r for r in s.get("rules", []) if not r.startswith(STASH_ONLY_RULES)]
    if mr != sr:
        diffs.append("[规则] 顺序或内容不一致：")
        for line in difflib.unified_diff(mr, sr, "mihomo", "stash", lineterm="", n=1):
            diffs.append("    " + line)

    # 3. 规则集 URL
    mp, sp = m.get("rule-providers", {}), s.get("rule-providers", {})
    for name in sorted(set(mp) | set(sp)):
        if name in ("hotspot_direct", "usb_direct"):
            continue
        if name not in mp:
            diffs.append(f"[规则集] 仅 Stash 有：{name}")
        elif name not in sp:
            diffs.append(f"[规则集] 仅 mihomo 有：{name}")
        elif norm_url(mp[name].get("url")) != norm_url(sp[name].get("url")):
            diffs.append(f"[规则集] {name} URL 不一致\n    mihomo: {mp[name].get('url')}\n    stash : {sp[name].get('url')}")

    # 4. QX 策略组（图标、正则写法两边不同，不比）
    if os.path.exists(QX):
        qg = qx_groups(QX)
        for name in sorted(set(qg) | set(sg) - STASH_ONLY_GROUPS):
            if name not in qg:
                diffs.append(f"[QX] 仅 Stash 有策略组：{name}")
                continue
            if name not in sg:
                diffs.append(f"[QX] 仅 QX 有策略组：{name}")
                continue
            a, b = qg[name], sg[name]
            b_proxies = [x for x in b.get("proxies") or [] if x not in STASH_ONLY_GROUPS] or None
            for key, bv in (("type", b.get("type")), ("proxies", b_proxies),
                            ("interval", b.get("interval")), ("tolerance", b.get("tolerance"))):
                if a[key] != bv:
                    diffs.append(f"[QX] {name}.{key} 不一致\n    qx   : {a[key]}\n    stash: {bv}")

    if not diffs:
        print("mihomo 模板、QX 与 Stash 配置一致。")
        return 0
    print("\n".join(diffs))
    print(f"\n共 {len(diffs)} 处差异。")
    return 1


if __name__ == "__main__":
    sys.exit(main())
