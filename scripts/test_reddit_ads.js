#!/usr/bin/env node
"use strict";

const assert = require("assert");
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const scriptPath = path.join(root, "script", "reddit-ads.js");
const snippetPath = path.join(root, "quantumultx", "rewrite", "reddit-ads.snippet");
const overridePath = path.join(root, "stash", "override", "reddit-ads.stoverride");
const code = fs.readFileSync(scriptPath, "utf8");
const URL_RE = "^https?:\\/\\/gql(-fed)?\\.reddit\\.com(?:[:\\/]|$)";
let passed = 0;

function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null || typeof a !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
    return true;
  }
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (let i = 0; i < ka.length; i++) {
    if (!Object.prototype.hasOwnProperty.call(b, ka[i])) return false;
    if (!deepEqual(a[ka[i]], b[ka[i]])) return false;
  }
  return true;
}

function run(kind, body, extra) {
  const calls = [];
  const headers = extra && Object.prototype.hasOwnProperty.call(extra, "headers")
    ? extra.headers
    : { "Content-Type": "application/json" };
  const response = { headers: headers, body: body };
  if (kind === "qx") response.statusCode = extra && extra.statusCode !== undefined ? extra.statusCode : 200;
  else response.status = extra && extra.status !== undefined ? extra.status : 200;
  const sandbox = {
    $response: response,
    $request: {
      url: (extra && extra.url) || "https://gql.reddit.com/",
      method: (extra && extra.method) || "POST",
      headers: headers,
      body: (extra && extra.requestBody) || "{\"operationName\":\"HomeAds\"}"
    },
    $done: function (value) { calls.push(value); }
  };
  vm.runInNewContext(code, sandbox, { filename: "reddit-ads.js", timeout: 2000 });
  return calls;
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
  assert.strictEqual(Object.keys(value).length, Object.prototype.hasOwnProperty.call(value, "body") ? 1 : 0);
  return value;
}

function both(raw, extra) {
  const qx = doneBody(run("qx", raw, extra));
  const stash = doneBody(run("stash", raw, extra));
  if (typeof raw === "string" || raw === null || raw === undefined) {
    assert.strictEqual(qx.body, stash.body);
  }
  return qx.body;
}

function check(name, fn) {
  fn();
  passed += 1;
  console.log("ok " + name);
}

function same(name, raw, extra) {
  check(name, function () {
    assert.strictEqual(both(raw, extra), raw);
  });
}

function filtered(name, input, expected) {
  check(name, function () {
    const raw = typeof input === "string" ? input : JSON.stringify(input);
    const out = both(raw);
    const parsed = JSON.parse(out);
    assert.ok(deepEqual(parsed, expected), JSON.stringify(parsed));
  });
}

execFileSync(process.execPath, ["--check", scriptPath], { stdio: "inherit" });
execFileSync(process.execPath, ["--check", __filename], { stdio: "inherit" });

const organic = {
  __typename: "SubredditPost",
  id: "t3_ok",
  title: "普通帖",
  isPremium: false,
  isEmployee: false,
  isNsfw: true,
  blurred: false,
  isTranslated: false,
  translatedLanguage: null,
  personalized: { layout: "card", homeFeed: true },
  over18: true
};

filtered("信息流删除 AdPost，保留帖子、cursor 与 pageInfo", {
  data: {
    home: {
      elements: {
        edges: [
          { cursor: "ad", node: { __typename: "AdPost", id: "ad", isNsfw: false, isPremium: true } },
          { cursor: "ok", node: organic }
        ],
        pageInfo: { endCursor: "ok", hasNextPage: true }
      }
    }
  }
}, {
  data: {
    home: {
      elements: {
        edges: [{ cursor: "ok", node: organic }],
        pageInfo: { endCursor: "ok", hasNextPage: true }
      }
    }
  }
});

filtered("CellGroup 的 adPayload 与 AdMetadataCell 整条 edge 删除", {
  edges: [
    {
      cursor: "ad",
      node: {
        __typename: "CellGroup",
        adPayload: { impressionId: "imp" },
        cells: [
          { __typename: "AdMetadataCell" },
          { __typename: "TitleCell", title: "购买" }
        ]
      }
    },
    {
      cursor: "ok",
      node: {
        __typename: "CellGroup",
        adPayload: null,
        cells: [{ __typename: "MetadataCell", isAdPost: false, author: "u" }],
        isPremium: true
      }
    }
  ]
}, {
  edges: [
    {
      cursor: "ok",
      node: {
        __typename: "CellGroup",
        adPayload: null,
        cells: [{ __typename: "MetadataCell", isAdPost: false, author: "u" }],
        isPremium: true
      }
    }
  ]
});

filtered("cells[].isAdPost 为布尔 true 时删除该条", {
  edges: [
    { node: { cells: [{ __typename: "MetadataCell", isAdPost: true }, { __typename: "TitleCell", title: "广告标题" }] } },
    { node: { cells: [{ __typename: "MetadataCell", isAdPost: "true" }], title: "字符串标志保留" } },
    { node: { cells: [{ __typename: "MetadataCell", isAdPost: 1 }], title: "数字标志保留" } },
    { node: { cells: [{ __typename: "TitleCell", child: { __typename: "AdMetadataCell" } }], title: "嵌套同名类型保留" } },
    { node: { isAdPost: true, title: "顶层同名字段保留" } },
    { node: { adPayload: null, cells: [], title: "null payload 保留" } },
    { node: { adPayload: {}, title: "空 payload 保留" } },
    { node: { adPayload: "sponsored", title: "字符串 payload 保留" } },
    { node: { adPayload: [], title: "数组 payload 保留" } },
    { node: { __typename: "AdPostExtra", title: "相近类型名保留" } },
    { node: { __typename: "adpost", title: "大小写不同保留" } }
  ]
}, {
  edges: [
    { node: { cells: [{ __typename: "MetadataCell", isAdPost: "true" }], title: "字符串标志保留" } },
    { node: { cells: [{ __typename: "MetadataCell", isAdPost: 1 }], title: "数字标志保留" } },
    { node: { cells: [{ __typename: "TitleCell", child: { __typename: "AdMetadataCell" } }], title: "嵌套同名类型保留" } },
    { node: { isAdPost: true, title: "顶层同名字段保留" } },
    { node: { adPayload: null, cells: [], title: "null payload 保留" } },
    { node: { adPayload: {}, title: "空 payload 保留" } },
    { node: { adPayload: "sponsored", title: "字符串 payload 保留" } },
    { node: { adPayload: [], title: "数组 payload 保留" } },
    { node: { __typename: "AdPostExtra", title: "相近类型名保留" } },
    { node: { __typename: "adpost", title: "大小写不同保留" } }
  ]
});

filtered("嵌套评论广告删除，分页与普通评论保留", {
  data: {
    post: {
      id: "p",
      isPremium: true,
      isEmployee: false,
      isNsfw: true,
      blurred: true,
      isTranslated: false,
      personalized: { sort: "new" },
      comments: {
        edges: [
          { cursor: "c1", node: { __typename: "Comment", id: "c1", body: "你好", isNsfw: true } },
          { cursor: "a1", node: { __typename: "AdPost", id: "nested-ad" } }
        ],
        pageInfo: { endCursor: "a1", hasNextPage: true }
      }
    }
  }
}, {
  data: {
    post: {
      id: "p",
      isPremium: true,
      isEmployee: false,
      isNsfw: true,
      blurred: true,
      isTranslated: false,
      personalized: { sort: "new" },
      comments: {
        edges: [
          { cursor: "c1", node: { __typename: "Comment", id: "c1", body: "你好", isNsfw: true } }
        ],
        pageInfo: { endCursor: "a1", hasNextPage: true }
      }
    }
  }
});

filtered("commentsPageAds 只删广告元素，不因字段名清空", {
  data: {
    children: {
      commentsPageAds: [
        { __typename: "AdPost", id: "ad" },
        { __typename: "Comment", id: "keep", body: "不是广告结构" }
      ]
    }
  }
}, {
  data: {
    children: {
      commentsPageAds: [
        { __typename: "Comment", id: "keep", body: "不是广告结构" }
      ]
    }
  }
});

filtered("commentsPageAds 连接保留 pageInfo", {
  commentsPageAds: {
    edges: [
      { cursor: "a", node: { __typename: "AdPost", id: "a" } },
      { cursor: "c", node: { __typename: "Comment", id: "c", isNsfw: true } }
    ],
    pageInfo: { endCursor: "c", hasNextPage: false }
  }
}, {
  commentsPageAds: {
    edges: [
      { cursor: "c", node: { __typename: "Comment", id: "c", isNsfw: true } }
    ],
    pageInfo: { endCursor: "c", hasNextPage: false }
  }
});

filtered("adPosts 中无广告结构的元素保留", {
  data: {
    postInfoById: {
      id: "p",
      isEmployee: true,
      pdpCommentsAds: {
        adPosts: [
          { __typename: "AdPost", id: "ad" },
          { id: "mystery", title: "同名字段但不是广告结构" }
        ],
        pageInfo: { endCursor: "e", hasNextPage: false }
      }
    }
  }
}, {
  data: {
    postInfoById: {
      id: "p",
      isEmployee: true,
      pdpCommentsAds: {
        adPosts: [
          { id: "mystery", title: "同名字段但不是广告结构" }
        ],
        pageInfo: { endCursor: "e", hasNextPage: false }
      }
    }
  }
});

filtered("批量响应只改含广告的一项", [
  { errors: [{ message: "persisted query not found" }], data: null },
  {
    data: {
      identity: { isEmployee: true, isPremium: true, isNsfw: true, personalized: { a: 1 } }
    }
  },
  {
    data: {
      home: {
        elements: {
          edges: [
            { node: { __typename: "AdPost", id: "ad" } },
            { node: { __typename: "Post", id: "p", isPremium: true } }
          ],
          pageInfo: { endCursor: "p", hasNextPage: false }
        }
      }
    }
  }
], [
  { errors: [{ message: "persisted query not found" }], data: null },
  {
    data: {
      identity: { isEmployee: true, isPremium: true, isNsfw: true, personalized: { a: 1 } }
    }
  },
  {
    data: {
      home: {
        elements: {
          edges: [
            { node: { __typename: "Post", id: "p", isPremium: true } }
          ],
          pageInfo: { endCursor: "p", hasNextPage: false }
        }
      }
    }
  }
]);

filtered("广告全部删除后保留空数组和 pageInfo", {
  edges: [{ node: { __typename: "AdPost" } }, { __typename: "AdPost", id: "direct" }],
  pageInfo: { endCursor: "z", hasNextPage: false }
}, {
  edges: [],
  pageInfo: { endCursor: "z", hasNextPage: false }
});

filtered("空对象、null node 与普通值保留", [
  null,
  0,
  "",
  {},
  { node: null },
  { node: {} },
  { cells: [] },
  { __typename: "AdPost" },
  { id: "k", isNsfw: true }
], [
  null,
  0,
  "",
  {},
  { node: null },
  { node: {} },
  { cells: [] },
  { id: "k", isNsfw: true }
]);

same("操作名含 Ads 但不含广告结构时字节不变",
  "{\"operationName\":\"GetUserAds\",\"data\":{\"adsEnabled\":false,\"isPremium\":true}}");

same("非数组字段上的单个 AdPost 保留",
  "{\"data\":{\"post\":{\"__typename\":\"AdPost\",\"id\":\"solo\",\"isNsfw\":true,\"isPremium\":true}}}");

same("标题文本里的广告字样保留",
  "{\"data\":{\"post\":{\"title\":\"this is an AdPost and adPayload\",\"isNsfw\":true}}}");

[
  ["空字符串", ""],
  ["非 JSON", "not json"],
  ["残缺 JSON", "{"],
  ["HTML", "<html>{\"__typename\":\"AdPost\"}</html>"],
  ["JSON null", "null"],
  ["JSON 数字", "0"],
  ["JSON 字符串", "\"AdPost\""],
  ["JSON true", "true"],
  ["空数组", "[]"],
  ["空对象", "{}"],
  ["只有 errors", "{\"errors\":[{\"message\":\"x\",\"path\":[\"home\"]}]} "],
  ["data null 加 errors", "{\"data\":null,\"errors\":[{\"message\":\"x\"}]}"],
  ["缺字段", "{\"data\":{\"home\":{}}}"],
  ["空白与 1.0", "{\n  \"n\": 1.0,\n  \"isPremium\": true\n}"],
  ["反斜杠", "{\"t\":\"a\\/b\",\"isEmployee\":false}"],
  ["BOM", "\uFEFF{\"a\":1}"],
  ["安全整数边界外且无广告", "{\"id\":9007199254740993,\"isPremium\":true}"]
].forEach(function (item) {
  same(item[0], item[1]);
});

check("请求头大小写与缺失不影响结果", function () {
  const raw = "{\"edges\":[{\"__typename\":\"AdPost\"},{\"id\":\"k\",\"isNsfw\":true}]}";
  const variants = [
    { "Content-Type": "application/json" },
    { "content-type": "Application/JSON; charset=utf-8" },
    { "CONTENT-TYPE": "text/plain" },
    {},
    null
  ];
  const outputs = variants.map(function (headers) {
    return both(raw, { headers: headers, requestBody: "{\"operationName\":\"AdsFeed\"}" });
  });
  outputs.forEach(function (out) {
    assert.strictEqual(out, outputs[0]);
  });
  assert.deepStrictEqual(JSON.parse(outputs[0]), { edges: [{ id: "k", isNsfw: true }] });
});

check("非字符串 body 原样交回", function () {
  const bytes = new Uint8Array([1, 2, 3]);
  assert.strictEqual(both(bytes), bytes);
  assert.strictEqual(both(null), null);
  const missing = doneBody(run("qx", undefined));
  assert.strictEqual(missing.body, undefined);
});

check("没有 body 键时不改写", function () {
  function bare(extra) {
    const calls = [];
    const sandbox = Object.assign({ $done: function (value) { calls.push(value); } }, extra || {});
    vm.runInNewContext(code, sandbox, { filename: "reddit-ads.js", timeout: 1000 });
    return calls;
  }
  [bare(), bare({ $response: {} }), bare({ $response: null })].forEach(function (calls) {
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(JSON.stringify(calls[0]), "{}");
  });
});

check("超深度子树停止下探且不抛错", function () {
  let deep = { edges: [{ __typename: "AdPost", id: "deep-ad" }, { id: "deep-keep" }] };
  for (let i = 0; i < 60; i++) deep = { nest: deep };
  const raw = JSON.stringify({ marker: "shallow", edges: [{ __typename: "AdPost", id: "shallow-ad" }, { id: "shallow-keep", isPremium: true }], deep: deep });
  const out = JSON.parse(both(raw));
  assert.strictEqual(out.marker, "shallow");
  assert.deepStrictEqual(out.edges, [{ id: "shallow-keep", isPremium: true }]);
  let cursor = out.deep;
  for (let i = 0; i < 60; i++) cursor = cursor.nest;
  assert.strictEqual(cursor.edges[0].id, "deep-ad");
  assert.strictEqual(cursor.edges[1].id, "deep-keep");
});

check("__proto__ 键不污染对象原型", function () {
  const raw = "{\"__proto__\":{\"polluted\":true},\"edges\":[{\"__typename\":\"AdPost\",\"id\":\"a\"},{\"id\":\"k\",\"isNsfw\":true}]}";
  const out = both(raw);
  assert.strictEqual(Object.prototype.polluted, undefined);
  assert.strictEqual(({}).polluted, undefined);
  const parsed = JSON.parse(out);
  assert.strictEqual(parsed.edges.length, 1);
  assert.strictEqual(parsed.edges[0].id, "k");
  assert.strictEqual(parsed.edges[0].isNsfw, true);
  assert.strictEqual(Object.prototype.polluted, undefined);
});

check("QX 与 Stash 适配器返回同一 body 且不带 status/headers", function () {
  const raw = "{\"data\":{\"edges\":[{\"node\":{\"__typename\":\"AdPost\"}},{\"node\":{\"id\":\"p\",\"isEmployee\":true}}]}}";
  const qxCalls = run("qx", raw, { statusCode: 201, url: "https://gql-fed.reddit.com/query" });
  const stashCalls = run("stash", raw, { status: 201, url: "https://gql.reddit.com:443/" });
  const qx = doneBody(qxCalls);
  const stash = doneBody(stashCalls);
  assert.strictEqual(qx.body, stash.body);
  assert.deepStrictEqual(JSON.parse(qx.body), {
    data: { edges: [{ node: { id: "p", isEmployee: true } }] }
  });
});

check("片段与覆写的匹配范围一致", function () {
  const snippet = fs.readFileSync(snippetPath, "utf8");
  const override = fs.readFileSync(overridePath, "utf8");
  const rules = snippet.split(/\r?\n/).filter(function (line) {
    const trimmed = line.trim();
    return trimmed && trimmed[0] !== ";" && trimmed[0] !== "#";
  });
  assert.deepStrictEqual(rules, [
    "hostname = gql.reddit.com, gql-fed.reddit.com",
    URL_RE + " url script-response-body https://raw.githubusercontent.com/bbq191/my-rules/main/script/reddit-ads.js"
  ]);
  assert.strictEqual(rules.join("\n").includes("*"), false);
  assert.strictEqual(/\b\d{1,3}(?:\.\d{1,3}){3}\b/.test(rules.join("\n")), false);
  const matchLine = override.split(/\r?\n/).filter(function (line) { return line.trim().indexOf("- match:") === 0; });
  assert.strictEqual(matchLine.length, 1);
  assert.strictEqual(matchLine[0], "    - match: '" + URL_RE + "'");
  assert.strictEqual(matchLine[0].includes("\""), false);
  const re = new RegExp(URL_RE);
  [
    "https://gql.reddit.com/",
    "https://gql.reddit.com",
    "http://gql.reddit.com/graphql",
    "https://gql-fed.reddit.com/",
    "https://gql-fed.reddit.com/query?x=1",
    "https://gql.reddit.com:443/",
    "https://gql-fed.reddit.com:8443/abc"
  ].forEach(function (url) { assert.ok(re.test(url), url); });
  [
    "https://gql.reddit.com.evil.com/",
    "https://www.reddit.com/",
    "https://oauth.reddit.com/",
    "https://notgql.reddit.com/",
    "https://gql-fed.reddit.com.attacker.com/",
    "https://evil.com/gql.reddit.com/",
    "https://gql.redditXcom/"
  ].forEach(function (url) { assert.strictEqual(re.test(url), false, url); });
  const qx = fs.readFileSync(path.join(root, "quantumultx", "qx.conf"), "utf8");
  const stash = fs.readFileSync(path.join(root, "stash", "my.yml"), "utf8");
  ["reddit-ads", "gql.reddit.com", "gql-fed.reddit.com"].forEach(function (needle) {
    assert.strictEqual(qx.includes(needle), false, "qx.conf " + needle);
    assert.strictEqual(stash.includes(needle), false, "my.yml " + needle);
  });
  [scriptPath, snippetPath, overridePath].forEach(function (file) {
    const text = fs.readFileSync(file, "utf8");
    assert.strictEqual(text.includes("eval("), false, file);
    assert.strictEqual(text.includes("new Function"), false, file);
    assert.strictEqual(text.includes("XMLHttpRequest"), false, file);
    assert.strictEqual(text.includes("$prefs"), false, file);
    assert.strictEqual(text.includes("$task"), false, file);
  });
  assert.strictEqual(code.includes("fetch("), false);
  assert.strictEqual(code.includes("require("), false);
});

const yamlReport = execFileSync("python3", ["-c", [
  "import sys, yaml",
  "raw = open(sys.argv[1], encoding='utf-8').read()",
  "data = yaml.safe_load(raw)",
  "assert data['name'] == 'reddit-ads'",
  "assert data['http']['mitm'] == ['gql.reddit.com', 'gql-fed.reddit.com']",
  "script = data['http']['script'][0]",
  "assert script['name'] == 'reddit-ads'",
  "assert script['type'] == 'response'",
  "assert script['require-body'] is True",
  "assert script['binary-mode'] is False",
  "assert script['timeout'] == 15",
  "assert script['max-size'] == 8388608",
  "assert script['match'] == " + JSON.stringify(URL_RE),
  "prov = data['script-providers']['reddit-ads']",
  "assert prov['url'] == 'https://raw.githubusercontent.com/bbq191/my-rules/main/script/reddit-ads.js'",
  "assert prov['interval'] == 86400",
  "assert 'argument' not in script",
  "print('yaml-ok')"
].join("\n"), overridePath], { encoding: "utf8" });
assert.strictEqual(yamlReport.trim(), "yaml-ok");
console.log("ok Stash YAML");

console.log("passed " + passed);
