"use strict";
(() => {
  // src/shared.ts
  function getProp(props, name) {
    const k = Object.keys(props).find((p) => p.toLowerCase() === name.toLowerCase());
    return k === void 0 ? void 0 : props[k];
  }
  function resolveKey(measure, vm, props) {
    const segs = [];
    for (const tpl of vm.key) {
      const m = /^\{(.+)\}$/.exec(tpl);
      if (!m) {
        segs.push(tpl);
        continue;
      }
      const raw = getProp(props, m[1]);
      if (raw === void 0) return { error: `Figma variant has no "${m[1]}" property` };
      const v = raw.trim().toLowerCase();
      const tr = vm.values && Object.keys(vm.values).find((k) => k.toLowerCase() === m[1].toLowerCase());
      const mapped = tr ? vm.values[tr][v] : void 0;
      segs.push(mapped != null ? mapped : v);
    }
    return { key: [measure, ...segs].join("/") };
  }
  var clamp01 = (x) => Math.min(1, Math.max(0, x));
  var srgbEnc = (c) => c <= 31308e-7 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  function oklab(L, a, b, alpha) {
    const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = L - 0.0894841775 * a - 1.291485548 * b;
    const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
    return {
      r: clamp01(srgbEnc(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s)),
      g: clamp01(srgbEnc(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s)),
      b: clamp01(srgbEnc(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)),
      a: alpha
    };
  }
  var num = (s) => s.endsWith("%") ? parseFloat(s) / 100 : parseFloat(s);
  function parseColor(input) {
    if (!input) return null;
    const s = input.trim().toLowerCase();
    if (s === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
    const m = /^(oklch|oklab|rgba?|color)\((.*)\)$/.exec(s);
    if (!m) return null;
    const [body, alphaPart] = m[2].split("/").map((x) => x.trim());
    let parts = body.split(/[\s,]+/).filter(Boolean);
    let alpha = alphaPart !== void 0 ? num(alphaPart) : 1;
    if (m[1] === "color") {
      if (parts[0] !== "srgb") return null;
      parts = parts.slice(1);
      return { r: clamp01(num(parts[0])), g: clamp01(num(parts[1])), b: clamp01(num(parts[2])), a: alpha };
    }
    if (m[1] === "rgb" || m[1] === "rgba") {
      if (parts.length === 4 && alphaPart === void 0) alpha = num(parts[3]);
      const c = (v) => clamp01(v.endsWith("%") ? parseFloat(v) / 100 : parseFloat(v) / 255);
      return { r: c(parts[0]), g: c(parts[1]), b: c(parts[2]), a: alpha };
    }
    const L = num(parts[0]);
    if (m[1] === "oklab") return oklab(L, num(parts[1]), num(parts[2]), alpha);
    const C = parseFloat(parts[1]) || 0;
    const h = (parseFloat(parts[2]) || 0) * Math.PI / 180;
    return oklab(L, C * Math.cos(h), C * Math.sin(h), alpha);
  }
  var hex2 = (x) => Math.round(x * 255).toString(16).padStart(2, "0");
  function toHex(c) {
    if (!c || c.a <= 4e-3) return "none";
    return "#" + hex2(c.r) + hex2(c.g) + hex2(c.b) + (c.a < 0.996 ? hex2(c.a) : "");
  }
  function sameColor(a, b) {
    const ta = !a || a.a <= 4e-3, tb = !b || b.a <= 4e-3;
    if (ta || tb) return ta && tb;
    const t = 2 / 255;
    return Math.abs(a.r - b.r) <= t && Math.abs(a.g - b.g) <= t && Math.abs(a.b - b.b) <= t && Math.abs(a.a - b.a) <= 0.01;
  }
  var px = (s) => {
    if (s === void 0) return null;
    if (s === "normal" || s === "none" || s === "auto") return 0;
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : null;
  };
  function parseBox(s) {
    if (!s) return null;
    const v = s.trim().split(/\s+/).map((x) => parseFloat(x));
    if (!v.length || v.some((n) => !Number.isFinite(n))) return null;
    const [t, r = t, b = t, l = r] = v;
    return [t, r, b, l];
  }
  var fmt = (n) => String(Math.round(n * 100) / 100);
  var fmtBox = (b) => b.map(fmt).join(" ");
  var WEIGHTS = {
    thin: 100,
    hairline: 100,
    extralight: 200,
    ultralight: 200,
    light: 300,
    regular: 400,
    normal: 400,
    book: 400,
    medium: 500,
    semibold: 600,
    demibold: 600,
    bold: 700,
    extrabold: 800,
    ultrabold: 800,
    black: 900,
    heavy: 900
  };
  function weightFromStyle(style) {
    var _a;
    const k = style.toLowerCase().replace(/italic|oblique/g, "").replace(/[\s_-]/g, "");
    if (k === "") return 400;
    return (_a = WEIGHTS[k]) != null ? _a : null;
  }
  function firstText(n) {
    var _a;
    if (n.text && n.text.trim()) return n;
    for (const c of (_a = n.children) != null ? _a : []) {
      const f = firstText(c);
      if (f) return f;
    }
    return null;
  }
  function measureCode(entry) {
    var _a;
    const root = (_a = entry.children) == null ? void 0 : _a[0];
    if (!root) return null;
    const st = root.style;
    const t = firstText(root);
    const rad = ["border-top-left-radius", "border-top-right-radius", "border-bottom-right-radius", "border-bottom-left-radius"].map((k) => px(st[k]));
    const w = root.rect.width, h = root.rect.height;
    const cap = Math.min(w, h) / 2;
    return {
      width: w,
      height: h,
      radius: rad.every((x) => x !== null) ? rad.map((x) => Math.min(x, cap)) : null,
      padding: parseBox(st["padding"]),
      gap: px(st["gap"]),
      fontSize: t ? px(t.style["font-size"]) : null,
      fontWeight: t ? parseFloat(t.style["font-weight"]) || null : null,
      lineHeight: t && t.style["line-height"] !== "normal" ? px(t.style["line-height"]) : null,
      fill: parseColor(st["background-color"]),
      textColor: t ? parseColor(t.style["color"]) : void 0
    };
  }

  // src/code.ts
  figma.showUI(__html__, { width: 520, height: 640, themeColors: true });
  var IGNORE_KEY = "ignored-v1";
  var last = null;
  function lightModeId(coll) {
    const m = coll.modes.find((x) => /light/i.test(x.name));
    return m ? m.modeId : coll.defaultModeId;
  }
  async function resolveVariable(v, depth = 0) {
    var _a;
    if (depth > 8) return null;
    const coll = await figma.variables.getVariableCollectionByIdAsync(v.variableCollectionId);
    if (!coll) return null;
    const val = (_a = v.valuesByMode[lightModeId(coll)]) != null ? _a : v.valuesByMode[coll.defaultModeId];
    if (val && typeof val === "object" && "type" in val && val.type === "VARIABLE_ALIAS") {
      const next = await figma.variables.getVariableByIdAsync(val.id);
      return next ? resolveVariable(next, depth + 1) : null;
    }
    if (val && typeof val === "object" && "r" in val) return { r: val.r, g: val.g, b: val.b, a: "a" in val ? val.a : 1 };
    return null;
  }
  async function readFill(node) {
    var _a, _b;
    const fills = node.fills;
    if (fills === figma.mixed || !Array.isArray(fills)) return { color: null, variable: null, hasFill: false };
    const p = fills.find((x) => x.type === "SOLID" && x.visible !== false);
    if (!p) return { color: null, variable: null, hasFill: false };
    const alias = (_a = p.boundVariables) == null ? void 0 : _a.color;
    let variable = null;
    let color = null;
    if (alias) {
      variable = await figma.variables.getVariableByIdAsync(alias.id);
      if (variable) color = await resolveVariable(variable);
    }
    if (!color) color = { r: p.color.r, g: p.color.g, b: p.color.b, a: 1 };
    return { color: { ...color, a: color.a * ((_b = p.opacity) != null ? _b : 1) }, variable, hasFill: true };
  }
  function firstTextNode(n) {
    if (n.type === "TEXT") return n;
    if ("children" in n) for (const c of n.children) {
      const t = firstTextNode(c);
      if (t) return t;
    }
    return null;
  }
  function lineHeightPx(t) {
    const lh = t.lineHeight;
    if (lh === figma.mixed || lh.unit === "AUTO") return null;
    if (lh.unit === "PIXELS") return lh.value;
    const fs = t.fontSize;
    return fs === figma.mixed ? null : lh.value / 100 * fs;
  }
  async function measureFigma(node) {
    const text = firstTextNode(node);
    const fill = await readFill(node);
    const tfill = text ? await readFill(text) : null;
    const radius = ["topLeftRadius", "topRightRadius", "bottomRightRadius", "bottomLeftRadius"].map(
      (k) => node[k] || 0
    );
    const auto = node.layoutMode !== "NONE";
    return {
      node,
      text,
      fill,
      tfill,
      width: node.width,
      height: node.height,
      radius,
      padding: auto ? [node.paddingTop, node.paddingRight, node.paddingBottom, node.paddingLeft] : null,
      gap: auto ? node.itemSpacing : null,
      fontSize: text && text.fontSize !== figma.mixed ? text.fontSize : null,
      fontWeight: text && text.fontName !== figma.mixed ? weightFromStyle(text.fontName.style) : null,
      lineHeight: text ? lineHeightPx(text) : null
    };
  }
  function variantProps(n) {
    const vp = n.variantProperties;
    if (vp) return vp;
    const out = {};
    for (const part of n.name.split(",")) {
      const [k, ...v] = part.split("=");
      if (v.length) out[k.trim()] = v.join("=").trim();
    }
    return out;
  }
  async function compare() {
    if (!last) throw new Error("no data");
    const { map, light } = last;
    const ignored = await figma.clientStorage.getAsync(IGNORE_KEY) || {};
    const diffs = [];
    const skipped = [];
    const notes = [];
    let ignoredCount = 0;
    for (const [comp, c] of Object.entries(map.components)) {
      const vm = c.variantMap;
      if (!vm) {
        skipped.push({ component: comp, reason: "no variantMap in figma-map.json" });
        continue;
      }
      const setName = vm.figmaNode && c.figma[vm.figmaNode] ? vm.figmaNode : Object.keys(c.figma)[0];
      const nodeId = c.figma[setName];
      const set = await figma.getNodeByIdAsync(nodeId);
      if (!set || set.type !== "COMPONENT_SET") {
        skipped.push({ component: comp, reason: `node ${nodeId} (${setName}) not found or not a component set in this file` });
        continue;
      }
      for (const v of set.children) {
        if (v.type !== "COMPONENT") continue;
        const props = variantProps(v);
        const label = Object.entries(props).map(([k, x]) => `${k}=${x}`).join(", ");
        const r = resolveKey(c.measure, vm, props);
        if ("error" in r) {
          notes.push(`${comp} [${label}]: ${r.error}`);
          continue;
        }
        const entry = light[r.key];
        if (!entry) {
          notes.push(`${comp} [${label}]: no code measurement "${r.key}"`);
          continue;
        }
        const code = measureCode(entry);
        if (!code) {
          notes.push(`${comp} [${label}]: empty code measurement "${r.key}"`);
          continue;
        }
        const f = await measureFigma(v);
        const push = (prop, codeS, figS, value, target) => {
          const id = `${comp}|${label}|${prop}`;
          if (ignored[id] === codeS) {
            ignoredCount++;
            return;
          }
          diffs.push({ id, component: comp, variant: label, prop, code: codeS, figma: figS, nodeId: v.id, textNodeId: target, value });
        };
        const num2 = (prop, a, b, tol, target) => {
          if (a === null || b === null || Math.abs(a - b) < tol) return;
          push(prop, fmt(a), fmt(b), a, target);
        };
        num2("width", code.width, f.width, 1);
        num2("height", code.height, f.height, 1);
        if (code.radius && code.radius.some((x, i) => Math.abs(x - f.radius[i]) >= 0.01)) push("corner radius", fmtBox(code.radius), fmtBox(f.radius), code.radius);
        if (code.padding && f.padding && code.padding.some((x, i) => Math.abs(x - f.padding[i]) >= 0.01)) push("padding", fmtBox(code.padding), fmtBox(f.padding), code.padding);
        num2("gap", code.gap, f.gap, 0.01);
        if (f.text) {
          num2("font size", code.fontSize, f.fontSize, 0.01, f.text.id);
          num2("font weight", code.fontWeight, f.fontWeight, 0.5, f.text.id);
          num2("line height", code.lineHeight, f.lineHeight, 0.01, f.text.id);
          if (code.textColor !== void 0 && f.tfill && !sameColor(code.textColor, f.tfill.color))
            push("text colour", toHex(code.textColor), toHex(f.tfill.color), code.textColor, f.text.id);
        }
        if (!sameColor(code.fill, f.fill.color)) push("fill colour", toHex(code.fill), toHex(f.fill.color), code.fill);
      }
    }
    return { diffs, skipped, notes, ignoredCount, checkedAt: Date.now() };
  }
  async function setColor(node, color) {
    const cur = await readFill(node);
    if (cur.variable) {
      const coll = await figma.variables.getVariableCollectionByIdAsync(cur.variable.variableCollectionId);
      if (!coll) throw new Error("variable collection missing");
      if (!color || color.a <= 4e-3) throw new Error("code colour is transparent; cannot write that into a variable. Remove the fill manually.");
      cur.variable.setValueForMode(lightModeId(coll), { r: color.r, g: color.g, b: color.b, a: color.a });
      return `variable "${cur.variable.name}" (light)`;
    }
    if (!color || color.a <= 4e-3) {
      node.fills = [];
      return "removed fill";
    }
    node.fills = [{ type: "SOLID", color: { r: color.r, g: color.g, b: color.b }, opacity: color.a }];
    return "node fill (no bound variable)";
  }
  async function weightFont(t, weight) {
    const cur = t.fontName === figma.mixed ? null : t.fontName;
    const fonts = await figma.listAvailableFontsAsync();
    const family = cur ? cur.family : fonts[0].fontName.family;
    const hit = fonts.find((x) => x.fontName.family === family && weightFromStyle(x.fontName.style) === weight && !/italic|oblique/i.test(x.fontName.style));
    if (!hit) throw new Error(`no ${family} style with weight ${weight} available`);
    return hit.fontName;
  }
  async function apply(d) {
    const node = await figma.getNodeByIdAsync(d.nodeId);
    if (!node || node.type !== "COMPONENT") throw new Error("variant node not found");
    const text = d.textNodeId ? await figma.getNodeByIdAsync(d.textNodeId) : null;
    const v = d.value;
    switch (d.prop) {
      case "width":
        node.resize(v, node.height);
        return "width set";
      case "height":
        node.resize(node.width, v);
        return "height set";
      case "corner radius": {
        const r = v;
        node.topLeftRadius = r[0];
        node.topRightRadius = r[1];
        node.bottomRightRadius = r[2];
        node.bottomLeftRadius = r[3];
        return "radius set";
      }
      case "padding": {
        const p = v;
        node.paddingTop = p[0];
        node.paddingRight = p[1];
        node.paddingBottom = p[2];
        node.paddingLeft = p[3];
        return "padding set";
      }
      case "gap":
        node.itemSpacing = v;
        return "gap set";
      case "fill colour":
        return "updated " + await setColor(node, v);
    }
    if (!text || text.type !== "TEXT") throw new Error("text node not found");
    switch (d.prop) {
      case "font size":
      case "font weight":
      case "line height": {
        if (text.fontName === figma.mixed) throw new Error("mixed fonts");
        const font = d.prop === "font weight" ? await weightFont(text, v) : text.fontName;
        await figma.loadFontAsync(font);
        if (d.prop === "font weight") text.fontName = font;
        if (d.prop === "font size") text.fontSize = v;
        if (d.prop === "line height") text.lineHeight = { unit: "PIXELS", value: v };
        return d.prop + " set";
      }
      case "text colour":
        return "updated " + await setColor(text, v);
    }
    throw new Error("unknown property " + d.prop);
  }
  async function send() {
    try {
      figma.ui.postMessage({ type: "result", ...await compare() });
    } catch (e) {
      figma.ui.postMessage({ type: "error", message: String(e) });
    }
  }
  figma.ui.onmessage = async (msg) => {
    if (msg.type === "compare") {
      last = { map: msg.map, light: msg.light };
      await send();
    } else if (msg.type === "apply") {
      try {
        const how = await apply(msg.diff);
        figma.notify(`Applied: ${msg.diff.prop} (${how})`);
      } catch (e) {
        figma.notify("Apply failed: " + e, { error: true });
        figma.ui.postMessage({ type: "toast", message: `Apply failed: ${e}` });
      }
      if (last) await send();
    } else if (msg.type === "ignore") {
      const store = await figma.clientStorage.getAsync(IGNORE_KEY) || {};
      store[msg.diff.id] = msg.diff.code;
      await figma.clientStorage.setAsync(IGNORE_KEY, store);
      await send();
    } else if (msg.type === "clear-ignored") {
      await figma.clientStorage.setAsync(IGNORE_KEY, {});
      await send();
    }
  };
})();
