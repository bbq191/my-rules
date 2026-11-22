/**
 * 微信公众号文章广告响应过滤。Quantumult X 与 Stash 共用。
 *
 * 调用方只应匹配 https://mp.weixin.qq.com/mp/getappmsgad。
 * 根对象上 advertisement_info、ad_slot_data 为非空数组时改成空数组；
 * 因此改动了正文时，若 advertisement_num 是非 0 数字则改为 0。
 * 这两个数组名来自公开资料，本仓库没有 2026 年实网样本。
 * 数组缺失、为空、类型不符、非 JSON 或异常时返回原文字节。
 * 不改阅读数、点赞、正文、推荐和其他同级字段。不发请求，不写存储。
 * 未在官方 App 上实机验证。
 */
(function () {
  "use strict";

  var AD_LISTS = ["advertisement_info", "ad_slot_data"];

  function isPlainObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function filterWechatMpAdBody(raw) {
    var data, keys, out, i, name, value, changed;
    if (typeof raw !== "string" || raw.length === 0) return raw;
    try {
      data = JSON.parse(raw);
    } catch (parseError) {
      return raw;
    }
    if (!isPlainObject(data)) return raw;
    keys = Object.keys(data);
    out = null;
    changed = false;
    for (i = 0; i < AD_LISTS.length; i++) {
      name = AD_LISTS[i];
      if (!Object.prototype.hasOwnProperty.call(data, name)) continue;
      value = data[name];
      if (!Array.isArray(value) || value.length === 0) continue;
      if (out === null) {
        out = Object.create(null);
        for (var j = 0; j < keys.length; j++) out[keys[j]] = data[keys[j]];
      }
      out[name] = [];
      changed = true;
    }
    if (changed && typeof data.advertisement_num === "number" && isFinite(data.advertisement_num) && data.advertisement_num !== 0) {
      out.advertisement_num = 0;
    }
    if (!changed) return raw;
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
    finish(filterWechatMpAdBody($response.body));
  } catch (runtimeError) {
    if (typeof $response !== "undefined" && $response && Object.prototype.hasOwnProperty.call($response, "body")) {
      finish($response.body);
    } else if (typeof $done === "function") {
      $done({});
    }
  }
})();
