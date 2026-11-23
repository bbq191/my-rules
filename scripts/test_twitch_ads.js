#!/usr/bin/env node
"use strict";

const assert = require("assert");
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const scriptPath = path.join(root, "script", "twitch-ads.js");
const snippetPath = path.join(root, "quantumultx", "rewrite", "twitch-ads.snippet");
const overridePath = path.join(root, "stash", "override", "twitch-ads.stoverride");
const routeListPath = path.join(root, "quantumultx", "filter", "twitch-noad-route.list");
const routeOverridePath = path.join(root, "stash", "override", "twitch-noad-route.stoverride");
const SCRIPT_URL = "https://raw.githubusercontent.com/bbq191/my-rules/main/script/twitch-ads.js";
const code = fs.readFileSync(scriptPath, "utf8");
let passed = 0;

function check(name, fn) {
  fn();
  passed += 1;
  console.log("ok " + name);
}

function doneBody(calls) {
  assert.strictEqual(calls.length, 1, "应只调用一次 $done");
  const value = calls[0];
  assert.strictEqual(typeof value, "object");
  assert.ok(value);
  assert.strictEqual(Array.isArray(value), false);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(value, "status"), false);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(value, "statusCode"), false);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(value, "headers"), false);
  assert.strictEqual(
    Object.keys(value).length,
    Object.prototype.hasOwnProperty.call(value, "body") ? 1 : 0
  );
  return value;
}

function runRequest(kind, raw, extra) {
  const calls = [];
  const headers = (extra && extra.headers) || {
    "Content-Type": "application/json",
    "Client-Integrity": "keep-me",
    Authorization: "OAuth keep-me"
  };
  const sandbox = {
    $request: {
      url: (extra && extra.url) || "https://gql.twitch.tv/gql",
      method: "POST",
      headers: headers,
      body: raw
    },
    $done: function (value) { calls.push(value); }
  };
  vm.runInNewContext(code, sandbox, { filename: "twitch-ads.js", timeout: 2000 });
  return calls;
}

function runResponse(kind, raw, extra) {
  const calls = [];
  const response = {
    headers: (extra && extra.headers) || { "Content-Type": "application/vnd.apple.mpegurl" },
    body: raw
  };
  if (kind === "qx") {
    response.statusCode = extra && extra.statusCode !== undefined ? extra.statusCode : 200;
  } else {
    response.status = extra && extra.status !== undefined ? extra.status : 200;
  }
  const sandbox = {
    $request: {
      url: (extra && extra.url) || "https://video-weaver.example.hls.ttvnw.net/v1/playlist/x.m3u8",
      method: "GET",
      headers: {}
    },
    $response: response,
    $done: function (value) { calls.push(value); }
  };
  vm.runInNewContext(code, sandbox, { filename: "twitch-ads.js", timeout: 2000 });
  return calls;
}

function bothResponse(raw, extra) {
  const qx = doneBody(runResponse("qx", raw, extra));
  const stash = doneBody(runResponse("stash", raw, extra));
  assert.strictEqual(qx.body, stash.body);
  return qx.body;
}

function bothRequest(raw, extra) {
  const qx = doneBody(runRequest("qx", raw, extra));
  const stash = doneBody(runRequest("stash", raw, extra));
  assert.strictEqual(JSON.stringify(qx), JSON.stringify(stash));
  return qx;
}

function requestChanged(name, input, expected) {
  check(name, function () {
    const raw = typeof input === "string" ? input : JSON.stringify(input);
    const out = bothRequest(raw);
    assert.strictEqual(typeof out.body, "string");
    assert.deepStrictEqual(JSON.parse(out.body), expected);
  });
}

function requestSame(name, input) {
  check(name, function () {
    const raw = typeof input === "string" ? input : JSON.stringify(input);
    const out = bothRequest(raw);
    assert.strictEqual(JSON.stringify(out), "{}");
  });
}

function sameResponse(name, raw, extra) {
  check(name, function () {
    assert.strictEqual(bothResponse(raw, extra), raw);
  });
}

function responseChanged(name, raw, assertFn) {
  check(name, function () {
    const out = bothResponse(raw);
    assert.notStrictEqual(out, raw);
    assertFn(out);
  });
}

function countSegments(text) {
  return text.split(/\r?\n/).filter(function (line) {
    const t = line.trim();
    return t && t.charAt(0) !== "#";
  }).length;
}

function mediaLines(text) {
  return text.split(/\r?\n/).filter(function (line) {
    const t = line.trim();
    return t && t.charAt(0) !== "#";
  });
}

execFileSync(process.execPath, ["--check", scriptPath], { stdio: "inherit" });
execFileSync(process.execPath, ["--check", __filename], { stdio: "inherit" });

// ---------------------------------------------------------------- 请求侧

requestChanged("单条 PlaybackAccessToken 把 playerType 改为 popout", {
  operationName: "PlaybackAccessToken",
  variables: { playerType: "site", login: "someone" },
  extensions: { persistedQuery: { version: 1, sha256Hash: "do-not-touch" } }
}, {
  operationName: "PlaybackAccessToken",
  variables: { playerType: "popout", login: "someone" },
  extensions: { persistedQuery: { version: 1, sha256Hash: "do-not-touch" } }
});

requestChanged("PlaybackAccessToken_Template 把 playerType 改为 popout", {
  operationName: "PlaybackAccessToken_Template",
  variables: { playerType: "embed", vodID: "v1" }
}, {
  operationName: "PlaybackAccessToken_Template",
  variables: { playerType: "popout", vodID: "v1" }
});

requestChanged("批量请求只改 token 条目，其他 operation 原样保留", [
  {
    operationName: "PlaybackAccessToken",
    variables: { playerType: "site", login: "a" }
  },
  {
    operationName: "ClientIntegrity",
    variables: { playerType: "site", integrityToken: "x" }
  },
  {
    operationName: "PlaybackAccessToken_Template",
    variables: { playerType: "site", vodID: "v2" }
  }
], [
  {
    operationName: "PlaybackAccessToken",
    variables: { playerType: "popout", login: "a" }
  },
  {
    operationName: "ClientIntegrity",
    variables: { playerType: "site", integrityToken: "x" }
  },
  {
    operationName: "PlaybackAccessToken_Template",
    variables: { playerType: "popout", vodID: "v2" }
  }
]);

requestChanged("query 含 streamPlaybackAccessToken 且有 variables 时改写", {
  query: "query streamPlaybackAccessToken($login: String!, $playerType: String!) { streamPlaybackAccessToken(login: $login) { value } }",
  variables: { login: "a", playerType: "site" }
}, {
  query: "query streamPlaybackAccessToken($login: String!, $playerType: String!) { streamPlaybackAccessToken(login: $login) { value } }",
  variables: { login: "a", playerType: "popout" }
});

requestChanged("query 含 videoPlaybackAccessToken 且有 variables 时改写", {
  query: "query videoPlaybackAccessToken($videoID: ID!) { videoPlaybackAccessToken(videoID: $videoID) { value } }",
  variables: { videoID: "v1", playerType: "embed" }
}, {
  query: "query videoPlaybackAccessToken($videoID: ID!) { videoPlaybackAccessToken(videoID: $videoID) { value } }",
  variables: { videoID: "v1", playerType: "popout" }
});

requestSame("已是 popout 时不改写", {
  operationName: "PlaybackAccessToken",
  variables: { playerType: "popout", login: "a" }
});

requestSame("非 token operation 不改写", {
  operationName: "VideoPlayerStreamInfoOverlayChannel",
  variables: { playerType: "site", channel: "x" }
});

requestSame("operationName 前缀相近但不完全匹配时不改写", {
  operationName: "PlaybackAccessTokenExtra",
  variables: { playerType: "site" }
});

requestSame("token operation 没有 variables 时不凭空创建", {
  operationName: "PlaybackAccessToken"
});

requestSame("token operation 的 variables 不是对象时不改写", {
  operationName: "PlaybackAccessToken",
  variables: null
});

requestSame("query 命中但没有 variables 对象时不改写", {
  query: "query streamPlaybackAccessToken { streamPlaybackAccessToken { value } }"
});

requestSame("query 命中但 variables 是数组时不改写", {
  query: "query videoPlaybackAccessToken { videoPlaybackAccessToken { value } }",
  variables: []
});

requestSame("批量里没有 token operation 时不改写", [
  { operationName: "ClientIntegrity", variables: { playerType: "site" } },
  { operationName: "ChannelRoot_AboutPanel", variables: { playerType: "site" } }
]);

requestSame("非法 JSON 时 fail-open", "{\"operationName\":\"PlaybackAccessToken\",");
requestSame("空字符串时 fail-open", "");
requestSame("JSON null 时 fail-open", "null");
requestSame("JSON 数组里的 null 与普通值保留", "[null, 0, \"x\"]");

check("请求侧不回写 Authorization / Client-Integrity 等头", function () {
  const out = bothRequest(JSON.stringify({
    operationName: "PlaybackAccessToken",
    variables: { playerType: "site" }
  }));
  assert.strictEqual(Object.prototype.hasOwnProperty.call(out, "headers"), false);
  assert.strictEqual(typeof out.body, "string");
  assert.strictEqual(out.body.indexOf("Authorization"), -1);
  assert.strictEqual(out.body.indexOf("Client-Integrity"), -1);
});

// ---------------------------------------------------------------- 响应侧

const BASE = "2026-11-24T00:00:";
function pdt(seconds) {
  return "#EXT-X-PROGRAM-DATE-TIME:2026-11-24T00:00:" +
    (seconds < 10 ? "0" + seconds : String(seconds)) + ".000Z";
}

sameResponse("Master Playlist 含 EXT-X-STREAM-INF 时原样放行", [
  "#EXTM3U",
  "#EXT-X-VERSION:3",
  "#EXT-X-STREAM-INF:BANDWIDTH=3000000,RESOLUTION=1280x720",
  "720p/index.m3u8",
  "#EXT-X-STREAM-INF:BANDWIDTH=1000000,RESOLUTION=640x360",
  "360p/index.m3u8"
].join("\n"));

sameResponse("纯正片里单独出现的 EXT-X-DISCONTINUITY 不误删", [
  "#EXTM3U",
  "#EXT-X-VERSION:3",
  "#EXT-X-TARGETDURATION:4",
  "#EXT-X-MEDIA-SEQUENCE:40",
  pdt(0),
  "#EXTINF:4.000,content",
  "c1.ts",
  "#EXT-X-DISCONTINUITY",
  pdt(4),
  "#EXTINF:4.000,content",
  "c2.ts"
].join("\n"));

const liveMixed = [
  "#EXTM3U",
  "#EXT-X-VERSION:3",
  "#EXT-X-TARGETDURATION:4",
  "#EXT-X-MEDIA-SEQUENCE:100",
  pdt(0),
  "#EXT-X-DATERANGE:ID=\"stitched-ad-1\",CLASS=\"twitch-stitched-ad\",START-DATE=\"2026-11-24T00:00:00.000Z\",DURATION=8.000,PLANNED-DURATION=8.000",
  "#EXT-X-TWITCH-PREFETCH:https://video-edge-example.hls.ttvnw.net/ad.ts",
  "#EXTINF:4.000,Amazon",
  "seg-ad-1.ts",
  "#EXTINF:4.000,Amazon",
  "seg-ad-2.ts",
  "#EXT-X-DISCONTINUITY",
  pdt(8),
  "#EXTINF:4.000,content",
  "seg-c1.ts",
  pdt(12),
  "#EXTINF:4.000,content",
  "seg-c2.ts"
].join("\n");

responseChanged("直播混合窗去掉广告分片并递增 MEDIA-SEQUENCE", liveMixed, function (out) {
  assert.strictEqual(out.indexOf("seg-ad"), -1);
  assert.strictEqual(out.indexOf("TWITCH-PREFETCH"), -1);
  assert.strictEqual(out.indexOf("twitch-stitched-ad"), -1);
  assert.strictEqual(out.indexOf("seg-c1.ts") !== -1, true);
  assert.strictEqual(out.indexOf("seg-c2.ts") !== -1, true);
  assert.strictEqual(out.indexOf("#EXT-X-MEDIA-SEQUENCE:102") !== -1, true);
  assert.strictEqual(out.indexOf("#EXT-X-DISCONTINUITY") !== -1, true);
  assert.strictEqual(countSegments(out), 2);
  assert.strictEqual(out.split(/\r?\n/)[0], "#EXTM3U");
});

const fullAdWindow = [
  "#EXTM3U",
  "#EXT-X-VERSION:3",
  "#EXT-X-TARGETDURATION:4",
  "#EXT-X-MEDIA-SEQUENCE:10",
  pdt(0),
  "#EXT-X-DATERANGE:ID=\"stitched-ad-full\",CLASS=\"twitch-stitched-ad\",START-DATE=\"2026-11-24T00:00:00.000Z\",DURATION=8.000",
  "#EXTINF:4.000,Amazon",
  "full-ad-1.ts",
  "#EXTINF:4.000,stitched",
  "full-ad-2.ts"
].join("\n");
sameResponse("直播全广告窗剥离后为 0 时原样放行，不输出空列表", fullAdWindow);

const zombie = [
  "#EXTM3U",
  "#EXT-X-VERSION:3",
  "#EXT-X-TARGETDURATION:4",
  "#EXT-X-MEDIA-SEQUENCE:60",
  "#EXT-X-DATERANGE:ID=\"stitched-ad-old\",CLASS=\"twitch-stitched-ad\",START-DATE=\"2026-11-23T23:50:00.000Z\",DURATION=4.000,PLANNED-DURATION=4.000",
  pdt(0),
  "#EXTINF:4.000,content",
  "zombie-c1.ts",
  pdt(4),
  "#EXTINF:4.000,content",
  "zombie-c2.ts"
].join("\n");
sameResponse("已过期的僵尸 DATERANGE 不误删正片", zombie);

const maf = [
  "#EXTM3U",
  "#EXT-X-VERSION:3",
  "#EXT-X-TARGETDURATION:4",
  "#EXT-X-MEDIA-SEQUENCE:3",
  pdt(0),
  "#EXT-X-DATERANGE:ID=\"maf-1\",CLASS=\"twitch-maf-ad\",START-DATE=\"2026-11-24T00:00:00.000Z\",DURATION=4.000",
  "#EXTINF:4.000,content",
  "maf-ad.ts",
  pdt(4),
  "#EXTINF:4.000,content",
  "maf-c1.ts",
  pdt(8),
  "#EXTINF:4.000,content",
  "maf-c2.ts"
].join("\n");
responseChanged("CLASS 含 twitch-maf-ad 的 DATERANGE 被识别", maf, function (out) {
  assert.strictEqual(out.indexOf("maf-ad.ts"), -1);
  assert.strictEqual(out.indexOf("maf-c1.ts") !== -1, true);
  assert.strictEqual(out.indexOf("twitch-maf-ad"), -1);
  assert.strictEqual(out.indexOf("#EXT-X-MEDIA-SEQUENCE:4") !== -1, true);
});

const idOnly = [
  "#EXTM3U",
  "#EXT-X-VERSION:3",
  "#EXT-X-TARGETDURATION:4",
  "#EXT-X-MEDIA-SEQUENCE:30",
  pdt(0),
  "#EXT-X-DATERANGE:ID=\"stitched-ad-idonly\",START-DATE=\"2026-11-24T00:00:00.000Z\",DURATION=4.000",
  "#EXTINF:4.000,content",
  "id-ad.ts",
  pdt(4),
  "#EXTINF:4.000,content",
  "id-c1.ts"
].join("\n");
responseChanged("DATERANGE 的 ID 以 stitched-ad- 开头时被识别", idOnly, function (out) {
  assert.strictEqual(out.indexOf("id-ad.ts"), -1);
  assert.strictEqual(out.indexOf("id-c1.ts") !== -1, true);
});

const cueSample = [
  "#EXTM3U",
  "#EXT-X-VERSION:3",
  "#EXT-X-TARGETDURATION:4",
  "#EXT-X-MEDIA-SEQUENCE:7",
  pdt(0),
  "#EXT-X-CUE-OUT:30",
  "#EXTINF:4.000,content",
  "cue-ad.ts",
  "#EXT-X-CUE-IN",
  pdt(4),
  "#EXTINF:4.000,content",
  "cue-c1.ts",
  pdt(8),
  "#EXTINF:4.000,content",
  "cue-c2.ts"
].join("\n");
responseChanged("EXT-X-CUE-OUT 到 CUE-IN 之间的分片被去掉", cueSample, function (out) {
  assert.strictEqual(out.indexOf("cue-ad.ts"), -1);
  assert.strictEqual(out.indexOf("cue-c1.ts") !== -1, true);
  assert.strictEqual(out.indexOf("cue-c2.ts") !== -1, true);
  assert.strictEqual(out.indexOf("EXT-X-CUE-OUT"), -1);
  assert.strictEqual(out.indexOf("#EXT-X-CUE-IN") !== -1, true);
  assert.strictEqual(out.indexOf("#EXT-X-MEDIA-SEQUENCE:8") !== -1, true);
});

const scteSample = [
  "#EXTM3U",
  "#EXT-X-VERSION:3",
  "#EXT-X-TARGETDURATION:4",
  "#EXT-X-MEDIA-SEQUENCE:20",
  pdt(0),
  "#EXT-X-SCTE35-OUT:0xFC302000",
  "#EXTINF:4.000,content",
  "scte-ad.ts",
  "#EXT-X-SCTE35-IN",
  pdt(4),
  "#EXTINF:4.000,content",
  "scte-c1.ts"
].join("\n");
responseChanged("EXT-X-SCTE35-OUT 到 IN 之间的分片被去掉", scteSample, function (out) {
  assert.strictEqual(out.indexOf("scte-ad.ts"), -1);
  assert.strictEqual(out.indexOf("scte-c1.ts") !== -1, true);
  assert.strictEqual(out.indexOf("EXT-X-SCTE35-OUT"), -1);
});

const titleAds = [
  "#EXTM3U",
  "#EXT-X-VERSION:3",
  "#EXT-X-TARGETDURATION:4",
  "#EXT-X-MEDIA-SEQUENCE:1",
  pdt(0),
  "#EXTINF:4.000,Amazon",
  "title-ad-1.ts",
  "#EXTINF:4.000,stitched",
  "title-ad-2.ts",
  pdt(8),
  "#EXTINF:4.000,normal",
  "title-c1.ts"
].join("\n");
responseChanged("EXTINF 标题含 Amazon 或 stitched 的分片被识别", titleAds, function (out) {
  assert.strictEqual(out.indexOf("title-ad"), -1);
  assert.strictEqual(out.indexOf("title-c1.ts") !== -1, true);
  assert.strictEqual(out.indexOf("#EXT-X-MEDIA-SEQUENCE:3") !== -1, true);
});

const vod = [
  "#EXTM3U",
  "#EXT-X-VERSION:3",
  "#EXT-X-PLAYLIST-TYPE:VOD",
  "#EXT-X-TARGETDURATION:4",
  pdt(0),
  "#EXTINF:4.000,content",
  "vod-c1.ts",
  "#EXT-X-DATERANGE:ID=\"stitched-ad-vod\",CLASS=\"twitch-stitched-ad\",START-DATE=\"2026-11-24T00:00:04.000Z\",DURATION=4.000",
  "#EXTINF:4.000,Amazon",
  "vod-ad-1.ts",
  "#EXT-X-CUE-OUT",
  "#EXTINF:4.000,content",
  "vod-ad-2.ts",
  "#EXT-X-CUE-IN",
  pdt(12),
  "#EXTINF:4.000,content",
  "vod-c2.ts",
  "#EXT-X-ENDLIST"
].join("\n");
responseChanged("静态 VOD 多段广告剥离且保留 ENDLIST", vod, function (out) {
  assert.strictEqual(out.indexOf("vod-ad"), -1);
  assert.strictEqual(out.indexOf("vod-c1.ts") !== -1, true);
  assert.strictEqual(out.indexOf("vod-c2.ts") !== -1, true);
  assert.strictEqual(out.indexOf("#EXT-X-ENDLIST") !== -1, true);
  assert.strictEqual(out.indexOf("#EXT-X-PLAYLIST-TYPE:VOD") !== -1, true);
  assert.strictEqual(countSegments(out), 2);
});

sameResponse("非 m3u8 的 JSON 响应原样放行", "{\"hello\":\"world\"}");
sameResponse("HTML 响应原样放行", "<html><body>nope</body></html>");
sameResponse("空字符串响应原样放行", "");
sameResponse("null 响应原样放行", null);

check("非字符串 body 原样交回", function () {
  const bytes = new Uint8Array([1, 2, 3]);
  assert.strictEqual(bothResponse(bytes), bytes);
});

check("没有 body 键时 fail-open", function () {
  function bare(extra) {
    const calls = [];
    const sandbox = Object.assign({ $done: function (value) { calls.push(value); } }, extra || {});
    vm.runInNewContext(code, sandbox, { filename: "twitch-ads.js", timeout: 1000 });
    return calls;
  }
  [bare(), bare({ $response: {} }), bare({ $response: null }), bare({ $request: {} })].forEach(function (calls) {
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(JSON.stringify(calls[0]), "{}");
  });
});

check("QX 与 Stash 入口对同一输入给出一致 body", function () {
  const qx = doneBody(runResponse("qx", liveMixed, { statusCode: 206 }));
  const stash = doneBody(runResponse("stash", liveMixed, { status: 206 }));
  assert.strictEqual(qx.body, stash.body);
  assert.strictEqual(qx.body.indexOf("seg-ad"), -1);
});

// ------------------------------------------------------- 片段 / 覆写静态检查

function nonCommentLines(text) {
  return text.split(/\r?\n/).map(function (line) {
    return line.trim();
  }).filter(function (line) {
    return line && line.charAt(0) !== ";" && line.charAt(0) !== "#";
  });
}

check("QX snippet：脚本 URL、主机范围与 reject 规则符合要求", function () {
  const text = fs.readFileSync(snippetPath, "utf8");
  const rules = nonCommentLines(text);
  assert.deepStrictEqual(rules, [
    "hostname = gql.twitch.tv, video-weaver.*.hls.ttvnw.net, *.playlist.live-video.net, *.playlist.ttvnw.net, ads.twitch.tv, edge.ads.twitch.tv",
    "^https?:\\/\\/gql\\.twitch\\.tv\\/gql(?:[\\/?#]|$) url script-request-body " + SCRIPT_URL,
    "^https?:\\/\\/(?:video-weaver\\.[^/]+\\.hls\\.ttvnw\\.net|[^/]+\\.playlist\\.live-video\\.net|[^/]+\\.playlist\\.ttvnw\\.net)\\/.*\\.m3u8(?:[?#]|$) url script-response-body " + SCRIPT_URL,
    "^https?:\\/\\/ads\\.twitch\\.tv(?::\\d+)?(?:[\\/?#]|$) url reject-200",
    "^https?:\\/\\/edge\\.ads\\.twitch\\.tv(?::\\d+)?(?:[\\/?#]|$) url reject-200"
  ]);
  const joined = rules.join("\n");
  assert.strictEqual(joined.indexOf("spade.twitch.tv"), -1);
  assert.strictEqual(joined.indexOf("PlaybackAccessToken"), -1);
  assert.strictEqual(joined.indexOf("*.ttvnw.net"), -1);
  assert.strictEqual(joined.indexOf("video-edge"), -1);
  assert.strictEqual(text.indexOf("spade.twitch.tv"), -1);

  const responseRule = rules.filter(function (line) { return line.indexOf("script-response-body") !== -1; })[0];
  const responseRe = new RegExp(responseRule.split(" ")[0]);
  [
    "https://video-weaver.abc123.hls.ttvnw.net/v1/playlist/xyz.m3u8",
    "https://abc123.playlist.live-video.net/v1/playlist/xyz.m3u8?token=1",
    "https://abc123.playlist.ttvnw.net/v1/playlist/xyz.m3u8"
  ].forEach(function (url) { assert.strictEqual(responseRe.test(url), true, url); });
  [
    "https://video-edge-abc123.hls.ttvnw.net/v1/playlist/xyz.m3u8",
    "https://gql.twitch.tv/gql",
    "https://ads.twitch.tv/x"
  ].forEach(function (url) { assert.strictEqual(responseRe.test(url), false, url); });

  const requestRule = rules.filter(function (line) { return line.indexOf("script-request-body") !== -1; })[0];
  const requestRe = new RegExp(requestRule.split(" ")[0]);
  assert.strictEqual(requestRe.test("https://gql.twitch.tv/gql"), true);
  assert.strictEqual(requestRe.test("https://gql.twitch.tv/gql?x=1"), true);
  assert.strictEqual(requestRe.test("https://gql.twitch.tv.evil.com/gql"), false);
});

check("路线 A 列表只含规定的决策 / 播放列表域名", function () {
  const text = fs.readFileSync(routeListPath, "utf8");
  assert.deepStrictEqual(nonCommentLines(text), [
    "host, gql.twitch.tv, Twitch-NoAd",
    "host, usher.ttvnw.net, Twitch-NoAd",
    "host-suffix, playlist.live-video.net, Twitch-NoAd",
    "host-suffix, playlist.ttvnw.net, Twitch-NoAd"
  ]);
  assert.strictEqual(text.indexOf("*.ttvnw.net"), -1);
  assert.strictEqual(text.indexOf("video-edge"), -1);
});

function findPython() {
  const candidates = [];
  if (process.env.PYTHON) candidates.push(process.env.PYTHON);
  candidates.push("python3", "python");
  // 任务沙箱可能预装 PyYAML 的临时解释器；普通环境不存在时会被跳过。
  candidates.push("/tmp/opencode/venv/bin/python");
  for (let i = 0; i < candidates.length; i++) {
    try {
      execFileSync(candidates[i], ["-c", "import yaml"], { stdio: "ignore" });
      return candidates[i];
    } catch (error) {
      // 尝试下一个解释器
    }
  }
  return "python3";
}

const python = findPython();

function yamlCheck(pathname, source) {
  return execFileSync(python, ["-c", source, pathname], { encoding: "utf8" }).trim();
}

check("路线 B Stash 覆写：YAML 合法、正则单引号、MitM 最小集", function () {
  const text = fs.readFileSync(overridePath, "utf8");
  const lines = text.split(/\r?\n/);
  const matchLines = lines.filter(function (line) { return line.trim().indexOf("- match:") === 0; });
  assert.strictEqual(matchLines.length, 2);
  matchLines.forEach(function (line) {
    assert.strictEqual(line.trim().indexOf("- match: '") === 0, true, line);
    assert.strictEqual(line.trim().slice(-1), "'", line);
    assert.strictEqual(line.indexOf("\""), -1, line);
  });
  const joined = nonCommentLines(text).join("\n");
  assert.strictEqual(joined.indexOf("spade.twitch.tv"), -1);
  assert.strictEqual(joined.indexOf("*.ttvnw.net"), -1);

  const report = yamlCheck(overridePath, [
    "import sys, yaml",
    "data = yaml.safe_load(open(sys.argv[1], encoding='utf-8'))",
    "assert data['name'] == 'twitch-ads'",
    "assert data['http']['mitm'] == ['gql.twitch.tv', 'ads.twitch.tv', 'edge.ads.twitch.tv', 'video-weaver.*.hls.ttvnw.net', '*.playlist.live-video.net', '*.playlist.ttvnw.net']",
    "scripts = data['http']['script']",
    "assert len(scripts) == 2",
    "assert scripts[0]['type'] == 'request'",
    "assert scripts[1]['type'] == 'response'",
    "assert scripts[0]['name'] == scripts[1]['name'] == 'twitch-ads'",
    "assert all(s['require-body'] is True for s in scripts)",
    "assert all(s['binary-mode'] is False for s in scripts)",
    "assert all(s['timeout'] == 5 for s in scripts)",
    "assert all(isinstance(s['max-size'], int) and s['max-size'] > 0 for s in scripts)",
    "assert data['rules'] == ['DOMAIN,ads.twitch.tv,REJECT', 'DOMAIN,edge.ads.twitch.tv,REJECT']",
    "prov = data['script-providers']['twitch-ads']",
    "assert prov['url'] == 'https://raw.githubusercontent.com/bbq191/my-rules/main/script/twitch-ads.js'",
    "for s in scripts:",
    "    import re",
    "    assert not re.search(r'video-edge', s['match'])",
    "print('yaml-ok')"
  ].join("\n"));
  assert.strictEqual(report, "yaml-ok");
});

check("路线 A Stash 覆写：YAML 合法、策略组与规则符合要求", function () {
  const text = fs.readFileSync(routeOverridePath, "utf8");
  const joined = nonCommentLines(text).join("\n");
  assert.strictEqual(joined.indexOf("*.ttvnw.net"), -1);
  assert.strictEqual(joined.indexOf("video-edge"), -1);
  const report = yamlCheck(routeOverridePath, [
    "import sys, yaml",
    "data = yaml.safe_load(open(sys.argv[1], encoding='utf-8'))",
    "assert data['name'] == 'twitch-noad-route'",
    "group = data['proxy-groups'][0]",
    "assert group['name'] == 'Twitch-NoAd'",
    "assert group['type'] == 'select'",
    "assert group['proxies'] == ['全部节点']",
    "assert data['rules'] == ['DOMAIN,gql.twitch.tv,Twitch-NoAd', 'DOMAIN,usher.ttvnw.net,Twitch-NoAd', 'DOMAIN-SUFFIX,playlist.live-video.net,Twitch-NoAd', 'DOMAIN-SUFFIX,playlist.ttvnw.net,Twitch-NoAd']",
    "print('yaml-ok')"
  ].join("\n"));
  assert.strictEqual(report, "yaml-ok");
});

check("两套模块都没有写进 qx.conf / my.yml", function () {
  const qx = fs.readFileSync(path.join(root, "quantumultx", "qx.conf"), "utf8");
  const stash = fs.readFileSync(path.join(root, "stash", "my.yml"), "utf8");
  ["twitch-ads", "twitch-noad-route", "gql.twitch.tv"].forEach(function (needle) {
    assert.strictEqual(qx.indexOf(needle), -1, "qx.conf " + needle);
    assert.strictEqual(stash.indexOf(needle), -1, "my.yml " + needle);
  });
});

check("脚本无外联、无动态执行、无持久存储", function () {
  ["eval(", "new Function", "XMLHttpRequest", "$prefs", "$task", "fetch(", "require(", "module.exports", "setTimeout"].forEach(function (needle) {
    assert.strictEqual(code.indexOf(needle), -1, needle);
  });
});

console.log("passed " + passed);
