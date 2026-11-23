/**
 * Twitch 去广告（实验）。Quantumult X 与 Stash 共用同一文件。
 *
 * 请求侧只改 gql.twitch.tv/gql 的 PlaybackAccessToken 请求正文：
 *   - operationName 为 PlaybackAccessToken / PlaybackAccessToken_Template；
 *   - 或 query 含 streamPlaybackAccessToken / videoPlaybackAccessToken 且带 variables 对象。
 * 命中条目的 variables.playerType 改成 popout，已是 popout 的条目不动。
 * 不硬编码 persistedQuery hash，不改 Authorization、Client-Integrity 等请求头，
 * 不改会员或广告标志，也不动同一批里的其他 operation。
 *
 * 响应侧只处理 HLS m3u8 文本，按以下标记保守剥离广告分片：
 *   - 未过期的 twitch-stitched / twitch-maf-ad DATERANGE 区间；
 *   - CUE-OUT / SCTE35-OUT 到 CUE-IN 之间的媒体分片；
 *   - EXTINF 标题含 Amazon 或 stitched 的分片。
 * 单独出现的 EXT-X-DISCONTINUITY 不视为广告。静态 VOD 与直播滑窗都会在剥离后
 * 统计正片分片；若一个不剩（例如直播整窗全广告），原样放行，绝不输出空列表。
 * 移除列表开头的分片时同步递增已有的 EXT-X-MEDIA-SEQUENCE。
 *
 * 解析失败、缺字段、未改动或运行异常均 fail-open，保留原文字节。
 * 无外联、无持久存储、无动态执行。未在官方 App 上实机验证。
 */
(function () {
  "use strict";

  var MEDIA_SEQUENCE_PREFIX = "#EXT-X-MEDIA-SEQUENCE:";
  var PROGRAM_DATE_TIME_PREFIX = "#EXT-X-PROGRAM-DATE-TIME:";

  function hasOwn(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }

  function isPlainObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function toNumber(value) {
    if (typeof value !== "string" || value.length === 0) return null;
    var n = parseFloat(value);
    return isFinite(n) ? n : null;
  }

  function toTimeMs(value) {
    if (typeof value !== "string" || value.length === 0) return null;
    var t = Date.parse(value);
    return isFinite(t) ? t : null;
  }

  function trimmed(line) {
    return line.replace(/^\s+|\s+$/g, "");
  }

  // ---------------------------------------------------------------- request

  function isTokenEntry(entry) {
    if (!isPlainObject(entry)) return false;
    if (entry.operationName === "PlaybackAccessToken" ||
        entry.operationName === "PlaybackAccessToken_Template") {
      return true;
    }
    if (typeof entry.query !== "string") return false;
    if (entry.query.indexOf("streamPlaybackAccessToken") === -1 &&
        entry.query.indexOf("videoPlaybackAccessToken") === -1) {
      return false;
    }
    return isPlainObject(entry.variables);
  }

  function rewriteRequest(raw) {
    var root, list, i, entry, changed;
    if (typeof raw !== "string" || raw.length === 0) return null;
    try {
      root = JSON.parse(raw);
    } catch (parseError) {
      return null;
    }
    if (!isPlainObject(root) && !Array.isArray(root)) return null;
    list = Array.isArray(root) ? root : [root];
    changed = false;
    for (i = 0; i < list.length; i++) {
      entry = list[i];
      if (!isTokenEntry(entry)) continue;
      if (!isPlainObject(entry.variables)) continue;
      if (entry.variables.playerType === "popout") continue;
      entry.variables.playerType = "popout";
      changed = true;
    }
    if (!changed) return null;
    try {
      return JSON.stringify(root);
    } catch (stringifyError) {
      return null;
    }
  }

  // --------------------------------------------------------------- response

  /**
   * 解析 #EXT-X-DATERANGE 的属性。带引号的值可以包含逗号。
   */
  function parseAttributes(text) {
    var attrs = {};
    var re = /([A-Za-z0-9-]+)=("([^"]*)"|[^,]*)/g;
    var match, value;
    while ((match = re.exec(text)) !== null) {
      value = match[3] !== undefined ? match[3] : match[2];
      attrs[match[1].toUpperCase()] = value;
    }
    return attrs;
  }

  function isAdDaterange(attrs) {
    var cls = (attrs.CLASS || "").toLowerCase();
    var id = (attrs.ID || "").toLowerCase();
    if (cls.indexOf("twitch-stitched") !== -1) return true;
    if (cls.indexOf("twitch-maf-ad") !== -1) return true;
    return id.indexOf("stitched-ad-") === 0;
  }

  function buildSegments(lines) {
    var segments = [];
    var blockStart = 0;
    var i, j, text, extinfIndex, extinf, comma, duration, title, pdtMs;
    for (i = 0; i < lines.length; i++) {
      text = trimmed(lines[i]);
      if (text.length === 0 || text.charAt(0) === "#") continue;
      extinfIndex = -1;
      extinf = null;
      pdtMs = null;
      for (j = blockStart; j < i; j++) {
        var tag = trimmed(lines[j]);
        if (tag.indexOf("#EXTINF:") === 0 && extinfIndex === -1) {
          extinfIndex = j;
          extinf = tag;
        } else if (tag.indexOf(PROGRAM_DATE_TIME_PREFIX) === 0 && pdtMs === null) {
          pdtMs = toTimeMs(tag.slice(PROGRAM_DATE_TIME_PREFIX.length));
        }
      }
      if (extinf === null) {
        blockStart = i + 1;
        continue;
      }
      comma = extinf.indexOf(",");
      duration = comma === -1 ? toNumber(extinf.slice(8)) : toNumber(extinf.slice(8, comma));
      title = comma === -1 ? "" : extinf.slice(comma + 1);
      segments.push({
        blockStart: blockStart,
        extinfIndex: extinfIndex,
        uriIndex: i,
        duration: duration === null ? 0 : duration,
        title: title,
        pdtMs: pdtMs,
        effectivePdtMs: null,
        ad: false
      });
      blockStart = i + 1;
    }
    return segments;
  }

  function computeEffectivePdt(segments) {
    var lastStart = null;
    var previousDuration = 0;
    var i, segment;
    for (i = 0; i < segments.length; i++) {
      segment = segments[i];
      if (segment.pdtMs !== null) {
        segment.effectivePdtMs = segment.pdtMs;
      } else if (lastStart !== null) {
        segment.effectivePdtMs = lastStart + previousDuration * 1000;
      } else {
        segment.effectivePdtMs = null;
      }
      lastStart = segment.effectivePdtMs;
      previousDuration = segment.duration;
    }
  }

  function markCueSegments(lines, segments) {
    var byUri = {};
    var inCue = false;
    var i, text, segment;
    for (i = 0; i < segments.length; i++) byUri[segments[i].uriIndex] = segments[i];
    for (i = 0; i < lines.length; i++) {
      text = trimmed(lines[i]);
      if (text.indexOf("#EXT-X-CUE-OUT") === 0 ||
          text.indexOf("#EXT-X-SCTE35-OUT") === 0) {
        inCue = true;
      } else if (text.indexOf("#EXT-X-CUE-IN") === 0 ||
                 text.indexOf("#EXT-X-SCTE35-IN") === 0) {
        inCue = false;
      }
      if (inCue && hasOwn(byUri, i)) {
        segment = byUri[i];
        segment.ad = true;
      }
    }
  }

  function nextBoundaryLine(lines, afterIndex) {
    var i, text;
    for (i = afterIndex + 1; i < lines.length; i++) {
      text = trimmed(lines[i]);
      if (text.indexOf("#EXT-X-DATERANGE:") === 0) return i;
      if (text.indexOf("#EXT-X-CUE-IN") === 0 ||
          text.indexOf("#EXT-X-SCTE35-IN") === 0) return i;
      if (text.indexOf("#EXT-X-ENDLIST") === 0) return i;
    }
    return null;
  }

  function markRangeByPosition(range, segments, lines) {
    var firstIndex = -1;
    var boundary = nextBoundaryLine(lines, range.lineIndex);
    var elapsed = 0;
    var i, segment;
    for (i = 0; i < segments.length; i++) {
      if (segments[i].uriIndex > range.lineIndex) {
        firstIndex = i;
        break;
      }
    }
    if (firstIndex === -1) return;
    for (i = firstIndex; i < segments.length; i++) {
      segment = segments[i];
      if (boundary !== null && segment.uriIndex >= boundary) break;
      if (range.durationSec !== null && elapsed >= range.durationSec) break;
      segment.ad = true;
      elapsed += segment.duration;
    }
  }

  function markDateRanges(lines, segments) {
    var ranges = [];
    var adDaterangeLines = {};
    var anyPdt = false;
    var i, segment, range, markedByDate, text, attrs, startMs, durationSec, endMs;
    for (i = 0; i < lines.length; i++) {
      text = trimmed(lines[i]);
      if (text.indexOf("#EXT-X-DATERANGE:") !== 0) continue;
      attrs = parseAttributes(text.slice(17));
      if (!isAdDaterange(attrs)) continue;
      adDaterangeLines[i] = true;
      startMs = toTimeMs(attrs["START-DATE"]);
      durationSec = toNumber(attrs.DURATION);
      if (durationSec === null) durationSec = toNumber(attrs["PLANNED-DURATION"]);
      endMs = startMs !== null && durationSec !== null
        ? startMs + durationSec * 1000
        : null;
      ranges.push({
        lineIndex: i,
        startMs: startMs,
        endMs: endMs,
        durationSec: durationSec
      });
    }
    for (i = 0; i < segments.length; i++) {
      if (segments[i].effectivePdtMs !== null) anyPdt = true;
    }
    for (i = 0; i < ranges.length; i++) {
      range = ranges[i];
      markedByDate = false;
      if (range.startMs !== null && range.endMs !== null) {
        for (var j = 0; j < segments.length; j++) {
          segment = segments[j];
          if (segment.effectivePdtMs === null) continue;
          if (segment.effectivePdtMs >= range.startMs && segment.effectivePdtMs < range.endMs) {
            segment.ad = true;
            markedByDate = true;
          }
        }
      }
      if (markedByDate) continue;
      if (range.startMs === null || range.endMs === null || !anyPdt) {
        // 无法用日期证明区间已过期时，按 DATERANGE 在文件中的位置保守处理。
        markRangeByPosition(range, segments, lines);
      }
    }
    return adDaterangeLines;
  }

  function applyTitleAds(segments) {
    var i, title;
    for (i = 0; i < segments.length; i++) {
      title = (segments[i].title || "").toLowerCase();
      if (title.indexOf("amazon") !== -1 || title.indexOf("stitched") !== -1) {
        segments[i].ad = true;
      }
    }
  }

  function filterHls(raw) {
    var newline, lines, i, text, hasStreamInf;
    var segments, adCount, contentCount, adDaterangeLines, removals;
    var mediaSequenceIndex, mediaSequenceValue, leadingRemoved, segment, j;

    if (typeof raw !== "string" || raw.length === 0) return raw;
    if (raw.indexOf("#EXTM3U") !== 0) return raw;

    newline = raw.indexOf("\r\n") !== -1 ? "\r\n" : "\n";
    lines = raw.split(/\r?\n/);
    hasStreamInf = false;
    for (i = 0; i < lines.length; i++) {
      text = trimmed(lines[i]);
      if (text.indexOf("#EXT-X-STREAM-INF") === 0) hasStreamInf = true;
    }
    if (hasStreamInf) return raw;

    segments = buildSegments(lines);
    if (segments.length === 0) return raw;

    computeEffectivePdt(segments);
    markCueSegments(lines, segments);
    adDaterangeLines = markDateRanges(lines, segments);
    applyTitleAds(segments);

    adCount = 0;
    for (i = 0; i < segments.length; i++) {
      if (segments[i].ad) adCount++;
    }
    contentCount = segments.length - adCount;
    // 静态 VOD 与直播滑窗共用这条保护：剥离后没有正片就原样放行。
    if (adCount === 0 || contentCount === 0) return raw;

    removals = {};
    for (i = 0; i < segments.length; i++) {
      segment = segments[i];
      if (!segment.ad) continue;
      removals[segment.extinfIndex] = true;
      removals[segment.uriIndex] = true;
      for (j = segment.blockStart; j < segment.uriIndex; j++) {
        text = trimmed(lines[j]);
        if (text.indexOf(PROGRAM_DATE_TIME_PREFIX) === 0) {
          removals[j] = true;
        } else if (adDaterangeLines[j]) {
          removals[j] = true;
        } else if (text.indexOf("#EXT-X-TWITCH-PREFETCH:") === 0) {
          removals[j] = true;
        } else if (text.indexOf("#EXT-X-CUE-OUT") === 0 ||
                   text.indexOf("#EXT-X-SCTE35-OUT") === 0) {
          removals[j] = true;
        } else if (text === "#EXT-X-DISCONTINUITY") {
          removals[j] = true;
        }
      }
    }

    mediaSequenceIndex = -1;
    mediaSequenceValue = null;
    for (i = 0; i < lines.length; i++) {
      text = trimmed(lines[i]);
      if (text.indexOf(MEDIA_SEQUENCE_PREFIX) === 0) {
        mediaSequenceIndex = i;
        mediaSequenceValue = parseInt(text.slice(MEDIA_SEQUENCE_PREFIX.length), 10);
        break;
      }
    }
    if (mediaSequenceIndex !== -1 && isFinite(mediaSequenceValue)) {
      leadingRemoved = 0;
      for (i = 0; i < segments.length; i++) {
        if (!segments[i].ad) break;
        leadingRemoved++;
      }
      if (leadingRemoved > 0) {
        lines[mediaSequenceIndex] = MEDIA_SEQUENCE_PREFIX +
          (mediaSequenceValue + leadingRemoved);
      }
    }

    var output = [];
    for (i = 0; i < lines.length; i++) {
      if (!removals[i]) output.push(lines[i]);
    }
    return output.join(newline);
  }

  // ------------------------------------------------------------------ entry

  function requestBody() {
    if (typeof $request === "undefined" || !$request) return null;
    if (!hasOwn($request, "body")) return null;
    return $request.body;
  }

  function run() {
    var rawResponse, rawRequest, next;
    if (typeof $response !== "undefined" && $response && hasOwn($response, "body")) {
      rawResponse = $response.body;
      next = rawResponse;
      try {
        next = filterHls(rawResponse);
      } catch (responseError) {
        next = rawResponse;
      }
      if (typeof $done === "function") $done({ body: next });
      return;
    }
    if (typeof $request !== "undefined" && $request) {
      rawRequest = requestBody();
      next = null;
      try {
        next = rewriteRequest(rawRequest);
      } catch (requestError) {
        next = null;
      }
      if (typeof $done === "function") {
        if (typeof next === "string") $done({ body: next });
        else $done({});
      }
      return;
    }
    if (typeof $done === "function") $done({});
  }

  try {
    run();
  } catch (runtimeError) {
    if (typeof $done === "function") {
      if (typeof $response !== "undefined" && $response && hasOwn($response, "body")) {
        $done({ body: $response.body });
      } else {
        $done({});
      }
    }
  }
})();
