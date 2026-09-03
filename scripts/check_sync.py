#!/usr/bin/env python3
"""对比桌面端 mihomo 模板与 Stash 配置，报告策略组 / 规则顺序 / 规则集 URL 的差异。

用法：
    scripts/check_sync.py [mihomo模板路径]
    默认模板路径：~/Projects/dotfiles/system/etc/mihomo/config.template.yaml

只读、不改文件。退出码 0 表示无差异，1 表示有差异。
"""
import os
import sys

try:
    import yaml
except ImportError:
    sys.exit("需要 PyYAML：pip install pyyaml")

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STASH = os.path.join(REPO, "stash", "my.yml")
DEFAULT_MIHOMO = os.path.expanduser("~/Projects/dotfiles/system/etc/mihomo/config.template.yaml")

# 桌面端专属、不期望同步到 Stash 的规则（前缀匹配）
MIHOMO_ONLY_RULES = (
    "RULE-SET,hotspot_direct",
    "RULE-SET,usb_direct",
    "PROCESS-NAME,",
    "DOMAIN-SUFFIX,lanxin.cn",
    "DOMAIN-SUFFIX,qianxin.com",
)
# Stash 专属
STASH_ONLY_RULES = ()


def load(path):
    with open(path, encoding="utf-8") as f:
        return yaml.safe_load(f)


def groups(cfg):
    return {g["name"]: g for g in cfg.get("proxy-groups", [])}


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
        for key in ("type", "proxies", "filter", "include-all", "icon"):
            if a.get(key) != b.get(key):
                diffs.append(f"[策略组] {name}.{key} 不一致\n    mihomo: {a.get(key)}\n    stash : {b.get(key)}")

    # 2. 规则顺序（剔除各自专属规则后逐条比较）
    mr = [r for r in m.get("rules", []) if not r.startswith(MIHOMO_ONLY_RULES)]
    sr = [r for r in s.get("rules", []) if not r.startswith(STASH_ONLY_RULES)]
    if mr != sr:
        diffs.append("[规则] 顺序或内容不一致：")
        import difflib
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

    if not diffs:
        print("mihomo 模板与 Stash 配置一致。")
        return 0
    print("\n".join(diffs))
    print(f"\n共 {len(diffs)} 处差异。")
    return 1


if __name__ == "__main__":
    sys.exit(main())
