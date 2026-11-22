/**
 * Reddit GraphQL 响应广告过滤。Quantumult X 与 Stash 共用同一文件。
 *
 * 只从数组里去掉能按结构判定的广告元素（含 GraphQL edge：node 本身是广告单元时删整条 edge）。
 * 判定只看元素自身，不看操作名，也不因为同名字段出现在别处就删父对象：
 *   - __typename 精确等于 AdPost
 *   - adPayload 是至少有一个自有键的普通对象（null、空对象、数组、字符串都不算）
 *   - cells 数组里有直接子项 __typename 精确等于 AdMetadataCell，或 isAdPost 严格为布尔 true
 * 非数组字段上的单个广告对象保留。commentsPageAds、adPosts 只按上述结构过滤元素，
 * 字段本身、pageInfo、cursor 和其余同级字段保留。
 * 解析失败、超深度、序列化失败或运行异常时返回原文字节。没有任何删除时不重新序列化。
 * 不修改 Premium、Employee、NSFW、遮罩、翻译、个性化字段。
 * 无外联、无持久存储、无动态执行。未在官方 App 上实机验证。
 */
(function () {
  "use strict";

  var MAX_DEPTH = 48;

  function isPlainObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function isAdCell(cell) {
    if (!isPlainObject(cell)) return false;
    if (cell.__typename === "AdMetadataCell") return true;
    if (cell.isAdPost === true) return true;
    return false;
  }

  function cellsContainAd(cells) {
    var i;
    if (!Array.isArray(cells)) return false;
    for (i = 0; i < cells.length; i++) {
      if (isAdCell(cells[i])) return true;
    }
    return false;
  }

  function isAdUnit(obj) {
    if (!isPlainObject(obj)) return false;
    if (obj.__typename === "AdPost") return true;
    if (isPlainObject(obj.adPayload) && Object.keys(obj.adPayload).length > 0) return true;
    if (cellsContainAd(obj.cells)) return true;
    return false;
  }

  function isAdListItem(item) {
    if (!isPlainObject(item)) return false;
    if (isAdUnit(item)) return true;
    if (isAdUnit(item.node)) return true;
    return false;
  }

  function walk(value, depth, state) {
    var next, removed, childChanged, i, n, child;
    var keys, out, key, k, j;
    if (depth > MAX_DEPTH) return value;
    if (Array.isArray(value)) {
      next = new Array(value.length);
      removed = 0;
      childChanged = false;
      n = 0;
      for (i = 0; i < value.length; i++) {
        if (isAdListItem(value[i])) {
          removed++;
          continue;
        }
        child = walk(value[i], depth + 1, state);
        if (child !== value[i]) childChanged = true;
        next[n++] = child;
      }
      if (removed === 0 && !childChanged) return value;
      state.changed = true;
      next.length = n;
      return next;
    }
    if (!isPlainObject(value)) return value;
    keys = Object.keys(value);
    out = null;
    for (k = 0; k < keys.length; k++) {
      key = keys[k];
      child = walk(value[key], depth + 1, state);
      if (child !== value[key]) {
        if (out === null) {
          out = Object.create(null);
          for (j = 0; j < k; j++) out[keys[j]] = value[keys[j]];
        }
        out[key] = child;
        state.changed = true;
      } else if (out !== null) {
        out[key] = child;
      }
    }
    return out === null ? value : out;
  }

  function filterRedditBody(raw) {
    var data, state, out;
    if (typeof raw !== "string" || raw.length === 0) return raw;
    try {
      data = JSON.parse(raw);
    } catch (parseError) {
      return raw;
    }
    if (data === null || typeof data !== "object") return raw;
    state = { changed: false };
    try {
      out = walk(data, 0, state);
    } catch (walkError) {
      return raw;
    }
    if (!state.changed) return raw;
    try {
      return JSON.stringify(out);
    } catch (stringifyError) {
      return raw;
    }
  }

  function finish(body) {
    if (typeof $done === "function") $done({ body: body });
  }

  try {
    if (typeof $response === "undefined" || !$response || !Object.prototype.hasOwnProperty.call($response, "body")) {
      if (typeof $done === "function") $done({});
      return;
    }
    finish(filterRedditBody($response.body));
  } catch (runtimeError) {
    if (typeof $response !== "undefined" && $response && Object.prototype.hasOwnProperty.call($response, "body")) {
      finish($response.body);
    } else if (typeof $done === "function") {
      $done({});
    }
  }
})();
