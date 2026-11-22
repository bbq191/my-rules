#!/usr/bin/env node
"use strict";

const assert = require("assert");
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const scriptPath = path.join(root, "script", "jd-splash-ads.js");
const snippetPath = path.join(root, "quantumultx", "rewrite", "jd-splash-ads.snippet");
const overridePath = path.join(root, "stash", "override", "jd-splash-ads.stoverride");
const code = fs.readFileSync(scriptPath, "utf8");
const URL_RE = "^https:\\/\\/api\\.m\\.jd\\.com(?::\\d+)?\\/client\\.action\\?(?:[^#]*&)?functionId=(?:start|startup)(?:&|#|$)";
const SPLASH = "https://api.m.jd.com/client.action?functionId=start&client=apple";
let passed = 0;

function run(kind, body, url) {
  const calls = [];
  const response = { headers: { "Content-Type": "application/json" }, body: body };
  if (kind === "qx") response.statusCode = 200;
  else response.status = 200;
  vm.runInNewContext(code, {
    $response: response,
    $request: { url: url, method: "POST", headers: response.headers, body: "functionId=pay" },
    $done: function (value) { calls.push(value); }
  }, { filename: "jd-splash-ads.js", timeout: 1000 });
  return calls;
}

function doneBody(calls) {
  assert.strictEqual(calls.length, 1);
  const value = calls[0];
  assert.ok(value && !Array.isArray(value));
  assert.strictEqual(Object.prototype.hasOwnProperty.call(value, "status"), false);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(value, "headers"), false);
  return value.body;
}

function both(raw, url) {
  const qx = doneBody(run("qx", raw, url));
  const stash = doneBody(run("stash", raw, url));
  if (typeof raw === "string") assert.strictEqual(qx, stash);
  return qx;
}

function check(name, fn) {
  fn();
  passed += 1;
  console.log("ok " + name);
}

function same(name, raw, url) {
  check(name, function () { assert.strictEqual(both(raw, url || SPLASH), raw); });
}

execFileSync(process.execPath, ["--check", scriptPath], { stdio: "inherit" });
execFileSync(process.execPath, ["--check", __filename], { stdio: "inherit" });

check("清空开屏 images 并保留业务字段", function () {
  const raw = JSON.stringify({
    code: "0",
    images: [[{ showTimes: 1, imageUrl: "https://ad.example/a.jpg" }]],
    showTimesDaily: 3,
    countdown: 5,
    pin: "user-pin",
    orderId: "9007199254740991"
  });
  const out = JSON.parse(both(raw, SPLASH));
  assert.deepStrictEqual(out.images, []);
  assert.strictEqual(out.showTimesDaily, 0);
  assert.strictEqual(out.countdown, 5);
  assert.strictEqual(out.pin, "user-pin");
  assert.strictEqual(out.orderId, "9007199254740991");
  assert.strictEqual(out.code, "0");
});

check("data.images 只改内层", function () {
  const raw = JSON.stringify({
    code: 0,
    echo: "ok",
    data: { images: [{ url: "ad" }], showTimesDaily: 2, sku: "10001", plusStatus: 1 }
  });
  const out = JSON.parse(both(raw, "https://api.m.jd.com/client.action?functionId=startup"));
  assert.deepStrictEqual(out.data.images, []);
  assert.strictEqual(out.data.showTimesDaily, 0);
  assert.strictEqual(out.data.sku, "10001");
  assert.strictEqual(out.data.plusStatus, 1);
  assert.strictEqual(out.echo, "ok");
});

same("空 images 字节不变", JSON.stringify({ images: [], showTimesDaily: 2, sku: "1" }));
same("没有 images", "{\"code\":\"0\",\"skuList\":[{\"sku\":\"1\"}]}");
same("非 JSON", "not-json");
same("残缺 JSON", "{");
same("JSON 数组", "[{\"images\":[1]}]");
same("搜索接口即使带 images 也不改", JSON.stringify({ images: [{ url: "banner" }], keyword: "手机" }),
  "https://api.m.jd.com/client.action?functionId=search&keyword=phone");
same("支付 functionId 不改", JSON.stringify({ images: ["pay-icon"], payId: "p" }),
  "https://api.m.jd.com/client.action?functionId=weixinPay");
same("functionId 前缀不误伤", JSON.stringify({ images: [1] }),
  "https://api.m.jd.com/client.action?functionId=startupHome");
same("没有查询参数的 client.action 不改", JSON.stringify({ images: [1], showTimesDaily: 9 }),
  "https://api.m.jd.com/client.action");

check("QX 与 Stash 只回调一次", function () {
  const raw = "{\"images\":[1],\"showTimesDaily\":\"2\"}";
  assert.strictEqual(doneBody(run("qx", raw, SPLASH)), doneBody(run("stash", raw, SPLASH)));
  assert.deepStrictEqual(JSON.parse(doneBody(run("qx", raw, SPLASH))), { images: [], showTimesDaily: "2" });
});

check("片段与覆写的匹配范围", function () {
  const snippet = fs.readFileSync(snippetPath, "utf8");
  const override = fs.readFileSync(overridePath, "utf8");
  const rules = snippet.split(/\r?\n/).filter(function (line) {
    const trimmed = line.trim();
    return trimmed && trimmed[0] !== ";" && trimmed[0] !== "#";
  });
  assert.deepStrictEqual(rules, [
    "hostname = api.m.jd.com",
    URL_RE + " url script-response-body https://raw.githubusercontent.com/bbq191/my-rules/main/script/jd-splash-ads.js"
  ]);
  const matchLine = override.split(/\r?\n/).filter(function (line) {
    return line.trim().indexOf("- match:") === 0;
  });
  assert.deepStrictEqual(matchLine, ["    - match: '" + URL_RE + "'"]);
  const re = new RegExp(URL_RE);
  [
    "https://api.m.jd.com/client.action?functionId=start",
    "https://api.m.jd.com/client.action?functionId=startup&client=apple",
    "https://api.m.jd.com/client.action?client=apple&functionId=start",
    "https://api.m.jd.com:443/client.action?functionId=startup#x"
  ].forEach(function (url) { assert.ok(re.test(url), url); });
  [
    "https://api.m.jd.com/client.action?functionId=search",
    "https://api.m.jd.com/client.action?functionId=wareBusiness",
    "https://api.m.jd.com/client.action?functionId=startXXX",
    "https://api.m.jd.com/client.action?functionId=startupHome",
    "https://api.m.jd.com/client.action",
    "http://api.m.jd.com/client.action?functionId=start",
    "https://api.jd.com/client.action?functionId=start",
    "https://evil.jd.com/client.action?functionId=start"
  ].forEach(function (url) { assert.strictEqual(re.test(url), false, url); });
  const qx = fs.readFileSync(path.join(root, "quantumultx", "qx.conf"), "utf8");
  const stash = fs.readFileSync(path.join(root, "stash", "my.yml"), "utf8");
  assert.strictEqual(qx.includes("jd-splash-ads"), false);
  assert.strictEqual(stash.includes("jd-splash-ads"), false);
  assert.strictEqual(snippet.includes("*.jd.com"), false);
  assert.strictEqual(override.includes("#!replace"), false);
});

const yamlReport = execFileSync("python3", ["-c", [
  "import sys, yaml",
  "raw = open(sys.argv[1], encoding='utf-8').read()",
  "data = yaml.safe_load(raw)",
  "assert data['name'] == 'jd-splash-ads'",
  "assert data['http']['mitm'] == ['api.m.jd.com']",
  "script = data['http']['script'][0]",
  "assert script['type'] == 'response' and script['require-body'] is True",
  "assert script['binary-mode'] is False and script['max-size'] == 1048576",
  "assert script['match'] == " + JSON.stringify(URL_RE),
  "assert data['script-providers']['jd-splash-ads']['url'].endswith('/script/jd-splash-ads.js')",
  "print('yaml-ok')"
].join("\n"), overridePath], { encoding: "utf8" });
assert.strictEqual(yamlReport.trim(), "yaml-ok");
console.log("ok Stash YAML");
console.log("passed " + passed);
