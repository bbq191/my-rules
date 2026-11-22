/**
 * 京东开屏响应过滤。Quantumult X 与 Stash 共用。
 *
 * 只处理 https://api.m.jd.com/client.action 且查询参数 functionId
 * 精确为 start 或 startup 的明文 JSON。
 * 根对象或 data 上的非空 images 数组改为 []；同一层 showTimesDaily
 * 若是非 0 数字则改为 0。其它字段原样保留。
 * URL 不符、非 JSON、没有该数组或运行异常时返回原文字节。
 * 不解码 base64 正文，不改请求。未在官方 App 上实机验证。
 */
(function () {
  "use strict";

  var SPLASH_URL = /^https:\/\/api\.m\.jd\.com(?::\d+)?\/client\.action\?(?:[^#]*&)?functionId=(?:start|startup)(?:&|#|$)/;

  function isPlainObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function cleared(obj) {
    var keys, out, i;
    if (!isPlainObject(obj)) return null;
    if (!Array.isArray(obj.images) || obj.images.length === 0) return null;
    keys = Object.keys(obj);
    out = Object.create(null);
    for (i = 0; i < keys.length; i++) out[keys[i]] = obj[keys[i]];
    out.images = [];
    if (typeof obj.showTimesDaily === "number" && isFinite(obj.showTimesDaily) && obj.showTimesDaily !== 0) {
      out.showTimesDaily = 0;
    }
    return out;
  }

  function filterJdSplashBody(raw, url) {
    var data, next, keys, out, i, inner;
    if (!SPLASH_URL.test(url)) return raw;
    if (typeof raw !== "string" || raw.length === 0) return raw;
    try {
      data = JSON.parse(raw);
    } catch (parseError) {
      return raw;
    }
    if (!isPlainObject(data)) return raw;
    try {
      next = cleared(data);
      if (next) return JSON.stringify(next);
      if (isPlainObject(data.data)) {
        inner = cleared(data.data);
        if (inner) {
          keys = Object.keys(data);
          out = Object.create(null);
          for (i = 0; i < keys.length; i++) out[keys[i]] = data[keys[i]];
          out.data = inner;
          return JSON.stringify(out);
        }
      }
    } catch (runtimeError) {
      return raw;
    }
    return raw;
  }

  function finish(body) {
    if (typeof $done === "function") $done({ body: body });
  }

  try {
    if (typeof $response === "undefined" || !$response || !Object.prototype.hasOwnProperty.call($response, "body")) {
      if (typeof $done === "function") $done({});
      return;
    }
    var requestUrl = (typeof $request !== "undefined" && $request) ? $request.url : "";
    finish(filterJdSplashBody($response.body, requestUrl));
  } catch (outerError) {
    if (typeof $response !== "undefined" && $response && Object.prototype.hasOwnProperty.call($response, "body")) {
      finish($response.body);
    } else if (typeof $done === "function") {
      $done({});
    }
  }
})();
