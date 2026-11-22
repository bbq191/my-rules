#!/usr/bin/env node
"use strict";

const assert = require("assert");
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const scriptPath = path.join(root, "script", "wechat-mp-ads.js");
const snippetPath = path.join(root, "quantumultx", "rewrite", "wechat-mp-ads.snippet");
const overridePath = path.join(root, "stash", "override", "wechat-mp-ads.stoverride");
const code = fs.readFileSync(scriptPath, "utf8");
const URL_RE = "^https:\\/\\/mp\\.weixin\\.qq\\.com(?::\\d+)?\\/mp\\/getappmsgad(?:[\\/?#]|$)";
let passed = 0;

function run(kind, body, extra) {
  const calls = [];
  const headers = extra && Object.prototype.hasOwnProperty.call(extra, "headers")
    ? extra.headers
    : { "Content-Type": "application/json" };
  const response = { headers: headers, body: body };
  if (kind === "qx") response.statusCode = 200;
  else response.status = 200;
  vm.runInNewContext(code, {
    $response: response,
    $request: {
      url: "https://mp.weixin.qq.com/mp/getappmsgad?f=json",
      method: "POST",
      headers: headers
    },
    $done: function (value) { calls.push(value); }
  }, { filename: "wechat-mp-ads.js", timeout: 1000 });
  return calls;
}

function doneBody(calls) {
  assert.strictEqual(calls.length, 1);
  const value = calls[0];
  assert.ok(value && typeof value === "object" && !Array.isArray(value));
  assert.strictEqual(Object.prototype.hasOwnProperty.call(value, "status"), false);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(value, "headers"), false);
  return value.body;
}

function both(raw, extra) {
  const qx = doneBody(run("qx", raw, extra));
  const stash = doneBody(run("stash", raw, extra));
  if (typeof raw === "string" || raw == null) assert.strictEqual(qx, stash);
  return qx;
}

function check(name, fn) {
  fn();
  passed += 1;
  console.log("ok " + name);
}

function same(name, raw, extra) {
  check(name, function () { assert.strictEqual(both(raw, extra), raw); });
}

function filtered(name, input, expected) {
  check(name, function () {
    const raw = JSON.stringify(input);
    assert.deepStrictEqual(JSON.parse(both(raw)), expected);
  });
}

execFileSync(process.execPath, ["--check", scriptPath], { stdio: "inherit" });
execFileSync(process.execPath, ["--check", __filename], { stdio: "inherit" });

const article = {
  title: "正文标题",
  content: "<p>作者正文，含商单软广字样也不改</p>",
  appmsgstat: { read_num: 12, like_num: 3, show: true },
  reward_head_imgs: ["a"],
  recommend: [{ title: "推荐" }]
};

filtered("清空 advertisement_info，保留正文和统计", Object.assign({
  advertisement_num: 2,
  advertisement_info: [{ id: "ad", title: "广告" }, { id: "ad2" }]
}, article), Object.assign({
  advertisement_num: 0,
  advertisement_info: []
}, article));

filtered("清空 ad_slot_data，数字改为 0", {
  advertisement_num: 1,
  ad_slot_data: [{ slot: "bottom" }],
  appmsgstat: { read_num: 9 }
}, {
  advertisement_num: 0,
  ad_slot_data: [],
  appmsgstat: { read_num: 9 }
});

filtered("两个广告数组都清空", {
  advertisement_num: 4,
  advertisement_info: [{ n: 1 }],
  ad_slot_data: [{ n: 2 }],
  content: "keep"
}, {
  advertisement_num: 0,
  advertisement_info: [],
  ad_slot_data: [],
  content: "keep"
});

same("广告数组已空时字节不变", JSON.stringify({
  advertisement_num: 0,
  advertisement_info: [],
  ad_slot_data: [],
  content: "keep",
  appmsgstat: { read_num: 1 }
}));

same("只有 advertisement_num 时不改", "{\"advertisement_num\":3,\"content\":\"正文\"}");
same("advertisement_info 不是数组时不改", "{\"advertisement_info\":{\"id\":1},\"title\":\"t\"}");
same("缺字段的普通正文", "{\n  \"title\": \"hello\",\n  \"content\": \"body\",\n  \"appmsgstat\": {\"read_num\": 1}\n}");
same("未知结构", "{\"foo\":[1],\"advertisement\":\"sponsored text\"}");
same("非 JSON", "<html>advertisement_info</html>");
same("残缺 JSON", "{");
same("JSON null", "null");
same("JSON 数组", "[{\"advertisement_info\":[1]}]");
same("空字符串", "");

check("请求头大小写不影响结果", function () {
  const raw = "{\"advertisement_num\":1,\"advertisement_info\":[{\"id\":1}],\"content\":\"c\"}";
  const a = both(raw, { headers: { "Content-Type": "application/json" } });
  const b = both(raw, { headers: { "content-type": "text/plain" } });
  const c = both(raw, { headers: null });
  assert.strictEqual(a, b);
  assert.strictEqual(b, c);
  assert.deepStrictEqual(JSON.parse(a), { advertisement_num: 0, advertisement_info: [], content: "c" });
});

check("QX 与 Stash 都只 $done 一次且不带 status", function () {
  const raw = "{\"ad_slot_data\":[1],\"advertisement_num\":\"2\",\"title\":\"t\"}";
  const qx = run("qx", raw);
  const stash = run("stash", raw);
  assert.strictEqual(doneBody(qx), doneBody(stash));
  assert.deepStrictEqual(JSON.parse(doneBody(qx)), {
    ad_slot_data: [],
    advertisement_num: "2",
    title: "t"
  });
});

check("没有 body 时不改写", function () {
  function bare(extra) {
    const calls = [];
    vm.runInNewContext(code, Object.assign({
      $done: function (value) { calls.push(value); }
    }, extra || {}), { timeout: 1000 });
    return calls;
  }
  [bare(), bare({ $response: {} }), bare({ $response: null })].forEach(function (calls) {
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(JSON.stringify(calls[0]), "{}");
  });
});

check("片段与覆写只匹配 getappmsgad", function () {
  const snippet = fs.readFileSync(snippetPath, "utf8");
  const override = fs.readFileSync(overridePath, "utf8");
  const rules = snippet.split(/\r?\n/).filter(function (line) {
    const trimmed = line.trim();
    return trimmed && trimmed[0] !== ";" && trimmed[0] !== "#";
  });
  assert.deepStrictEqual(rules, [
    "hostname = mp.weixin.qq.com",
    URL_RE + " url script-response-body https://raw.githubusercontent.com/bbq191/my-rules/main/script/wechat-mp-ads.js"
  ]);
  assert.strictEqual(rules.join("\n").includes("*"), false);
  const matchLine = override.split(/\r?\n/).filter(function (line) {
    return line.trim().indexOf("- match:") === 0;
  });
  assert.deepStrictEqual(matchLine, ["    - match: '" + URL_RE + "'"]);
  const re = new RegExp(URL_RE);
  [
    "https://mp.weixin.qq.com/mp/getappmsgad",
    "https://mp.weixin.qq.com/mp/getappmsgad?f=json",
    "https://mp.weixin.qq.com/mp/getappmsgad/",
    "https://mp.weixin.qq.com:443/mp/getappmsgad?x=1"
  ].forEach(function (url) { assert.ok(re.test(url), url); });
  [
    "https://mp.weixin.qq.com/mp/getappmsgext",
    "https://mp.weixin.qq.com/mp/getappmsgadextra",
    "https://mp.weixin.qq.com/s/abc",
    "https://mp.weixin.qq.com/wapad/getaddata?action=getad",
    "http://mp.weixin.qq.com/mp/getappmsgad",
    "https://wxs.qq.com/mp/getappmsgad",
    "https://payapp.weixin.qq.com/mchopenapp/goldplan/adpage",
    "https://evil.example/mp/getappmsgad",
    "https://mp.weixin.qq.com.evil/mp/getappmsgad"
  ].forEach(function (url) { assert.strictEqual(re.test(url), false, url); });
  const qx = fs.readFileSync(path.join(root, "quantumultx", "qx.conf"), "utf8");
  const stash = fs.readFileSync(path.join(root, "stash", "my.yml"), "utf8");
  ["wechat-mp-ads", "getappmsgad"].forEach(function (needle) {
    assert.strictEqual(qx.includes(needle), false);
    assert.strictEqual(stash.includes(needle), false);
  });
});

const yamlReport = execFileSync("python3", ["-c", [
  "import sys, yaml",
  "raw = open(sys.argv[1], encoding='utf-8').read()",
  "data = yaml.safe_load(raw)",
  "assert data['name'] == 'wechat-mp-ads'",
  "assert data['http']['mitm'] == ['mp.weixin.qq.com']",
  "assert '#!replace' not in raw",
  "script = data['http']['script'][0]",
  "assert script['type'] == 'response'",
  "assert script['require-body'] is True",
  "assert script['binary-mode'] is False",
  "assert script['timeout'] == 10",
  "assert script['max-size'] == 1048576",
  "assert script['match'] == " + JSON.stringify(URL_RE),
  "prov = data['script-providers']['wechat-mp-ads']",
  "assert prov['url'].endswith('/script/wechat-mp-ads.js')",
  "assert prov['interval'] == 86400",
  "print('yaml-ok')"
].join("\n"), overridePath], { encoding: "utf8" });
assert.strictEqual(yamlReport.trim(), "yaml-ok");
console.log("ok Stash YAML");
console.log("passed " + passed);
