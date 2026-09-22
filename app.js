(function(){
"use strict";
const $ = (s, r=document) => r.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const clone = o => JSON.parse(JSON.stringify(o));
const uid = () => Math.random().toString(36).slice(2, 9);
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

let DATA = {activitats: []};
const TEACHER = new URLSearchParams(location.search).has("professorat");

const app = $("#app");
const state = {
  mode: "alumne",
  actId: null,
  game: null,        // {order:[itemIds shuffled], placed:{descId:itemId}, ok:{descId:true}, bad:{}, done:false, selected:null}
  draft: null,
  dirty: false,
  readOnly: false,
  saving: false,
  msg: ""
};

/* ---------- helpers ---------- */
function ytId(url){
  url = String(url || "").trim();
  if (/^[\w-]{11}$/.test(url)) return url;
  const m = url.match(/(?:youtu\.be\/|v=|embed\/|shorts\/|live\/)([\w-]{11})/);
  return m ? m[1] : null;
}
function secs(t){
  t = String(t || "").trim(); if (!t) return 0;
  const p = t.split(":").map(Number); if (p.some(isNaN)) return 0;
  return p.reduce((a, b) => a * 60 + b, 0);
}
function embedSrc(url, start, end){
  const id = ytId(url); if (!id) return null;
  const q = new URLSearchParams({enablejsapi: "1", rel: "0", playsinline: "1", modestbranding: "1"});
  const s = secs(start), e = secs(end);
  if (s) q.set("start", String(s));
  if (e && e > s) q.set("end", String(e));
  return "https://www.youtube-nocookie.com/embed/" + id + "?" + q.toString();
}
function watchUrl(url, start){
  const id = ytId(url); if (!id) return "#";
  const s = secs(start);
  return "https://www.youtube.com/watch?v=" + id + (s ? "&t=" + s + "s" : "");
}
function shuffle(a){ a = a.slice(); for (let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function act(){ return DATA.activitats.find(a => a.id === state.actId) || DATA.activitats[0]; }
function toast(t){
  let el = $(".toast"); if (!el){ el = document.createElement("div"); el.className = "toast"; el.setAttribute("role", "status"); document.body.appendChild(el); }
  el.textContent = t; el.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => el.hidden = true, 2800);
}

/* ---------- YouTube control via postMessage ---------- */
function ytCmd(iframe, func, args){
  if (!iframe || !iframe.contentWindow) return;
  iframe.contentWindow.postMessage(JSON.stringify({event: "command", func, args: args || []}), "*");
}
function stopAll(except){
  document.querySelectorAll(".player.playing").forEach(p => {
    if (p === except) return;
    ytCmd($("iframe", p), "pauseVideo"); p.classList.remove("playing"); const b = $(".play", p); if (b) b.textContent = "▶ Escolta";
  });
}
function playerHTML(url, start, end, label, hide){
  const src = embedSrc(url, start, end);
  if (!src) return `<div class="player"><div class="cover"><span>Enllaç de vídeo no vàlid</span></div></div>`;
  return `<div class="player" data-start="${secs(start)}">
    <iframe src="${esc(src)}" title="Fragment ${esc(label)}" loading="lazy" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>
    ${hide ? `<div class="cover"><span class="big">${esc(label)}</span><span class="eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
      <span class="ctrls"><button type="button" class="play">▶ Escolta</button><button type="button" class="restart" aria-label="Torna a començar">↺</button><button type="button" class="peek" aria-label="Mostra la imatge del vídeo">Veure</button></span></div>` : ``}
  </div>`;
}
document.addEventListener("load", e => {
  const f = e.target; if (f.tagName === "IFRAME" && f.contentWindow) f.contentWindow.postMessage(JSON.stringify({event: "listening", id: 1}), "*");
}, true);
document.addEventListener("click", e => {
  const b = e.target.closest(".cover button"); if (!b) return;
  const p = b.closest(".player"), f = $("iframe", p);
  if (b.classList.contains("play")){
    if (p.classList.contains("playing")){ ytCmd(f, "pauseVideo"); p.classList.remove("playing"); b.textContent = "▶ Escolta"; }
    else { stopAll(p); ytCmd(f, "playVideo"); p.classList.add("playing"); b.textContent = "❚❚ Pausa"; }
  } else if (b.classList.contains("restart")){
    stopAll(p); ytCmd(f, "seekTo", [Number(p.dataset.start) || 0, true]); ytCmd(f, "playVideo"); p.classList.add("playing"); $(".play", p).textContent = "❚❚ Pausa";
  } else if (b.classList.contains("peek")){
    $(".cover", p).remove();
  }
});

/* ---------- game ---------- */
function newGame(a){
  state.game = {order: shuffle(a.items.map(i => i.id)), placed: {}, ok: {}, bad: {}, done: false, selected: null};
}
function labelOf(itemId){ return LETTERS[state.game.order.indexOf(itemId)] || "?"; }
function placedWhere(itemId){ return Object.keys(state.game.placed).find(k => state.game.placed[k] === itemId); }

function grabHTML(id){
  const g = state.game, where = placedWhere(id), locked = !!(where && g.ok[where]);
  return locked ? `<span class="hint">Correcte</span>` : `<button type="button" class="grab" data-grab="${id}" aria-pressed="${g.selected === id}">${g.selected === id ? "Ara toca una descripció" : "Arrossega"}</button>`;
}
function fragClass(id){
  const g = state.game, where = placedWhere(id), locked = !!(where && g.ok[where]);
  return "frag" + (where ? " placed" : "") + (locked ? " locked" : "") + (g.selected === id ? " selected" : "");
}
function descsHTML(a){
  const g = state.game;
  return a.items.map(it => {
    const pid = g.placed[it.id], cls = g.ok[it.id] ? " ok" : g.bad[it.id] ? " bad" : "";
    const rev = g.ok[it.id] && g.done && (it.title || it.extra || (it.extraVideos || []).some(Boolean));
    return `<article class="desc${cls}${g.selected && !g.ok[it.id] ? " target" : ""}" data-desc="${it.id}">
      <div class="slot" data-slot="${it.id}">${pid ? `<button type="button" class="chip" data-unplace="${it.id}" aria-label="Treu el fragment ${labelOf(pid)}">${labelOf(pid)}</button>` : "?"}</div>
      <p>${esc(it.desc)}</p>
      ${rev ? `<div class="reveal">
        ${it.title ? `<div class="song">${esc(it.title)}</div>` : ""}
        ${it.extra ? `<div class="extra">${esc(it.extra)}</div>` : ""}
        ${(it.extraVideos || []).filter(ytId).map((v, k) => `<details><summary>Vídeo extra ${k + 1}</summary>${playerHTML(v, "", "", "+", false)}</details>`).join("")}
      </div>` : ""}
    </article>`;
  }).join("");
}
function statusHTML(a){
  const g = state.game, total = a.items.length, okN = Object.keys(g.ok).length, placedN = Object.keys(g.placed).length;
  return `<span class="meter"><b>${placedN}</b>/${total} col·locats · <b>${okN}</b> correctes</span>
    <button type="button" class="btn primary" id="check" ${placedN === 0 || g.done ? "disabled" : ""}>Comprova</button>
    <button type="button" class="btn ghost" id="restart">Torna a començar</button>`;
}
function bannerHTML(a){
  return state.game.done ? `<div class="banner" role="status"><b>${esc(a.feedback || "Molt bé!")}</b><span>Ara pots veure el títol de cada cançó i el material extra.</span></div>` : "";
}
function renderGame(){
  const a = act();
  if (!a){ app.innerHTML = `<div class="head"><h1>Encara no hi ha activitats</h1><p>Passa a mode professorat per crear-ne una.</p></div>`; return; }
  if (!state.game) newGame(a);
  const g = state.game;
  const pool = g.order.map(id => {
    const it = a.items.find(i => i.id === id); if (!it) return "";
    const L = labelOf(id);
    return `<article class="${fragClass(id)}" data-item="${id}">
      <div class="frag-top"><span class="tag">${L}</span><span class="grab-wrap">${grabHTML(id)}</span></div>
      ${playerHTML(it.video, it.start, it.end, L, a.hideVideo)}
      <div class="yt-link"><a href="${esc(watchUrl(it.video, it.start))}" target="_blank" rel="noopener">Obre a YouTube</a> si el vídeo no es carrega</div>
    </article>`;
  }).join("");
  app.innerHTML = `
    <div class="head">
      <h1>${esc(a.title)}</h1>
      ${a.instructions ? `<p>${esc(a.instructions)}</p>` : ""}
      <div class="status" id="status">${statusHTML(a)}</div>
    </div>
    <div id="banner">${bannerHTML(a)}</div>
    <div class="game">
      <section aria-label="Fragments musicals"><h2 class="col-title">Fragments</h2><div class="pool">${pool}</div></section>
      <section aria-label="Descripcions"><h2 class="col-title">Descripcions</h2><div class="descs" id="descs">${descsHTML(a)}</div></section>
    </div>`;
}
/* update in place so the players keep playing */
function updateGame(){
  const a = act();
  $("#status").innerHTML = statusHTML(a);
  $("#banner").innerHTML = bannerHTML(a);
  $("#descs").innerHTML = descsHTML(a);
  document.querySelectorAll(".frag[data-item]").forEach(f => {
    const id = f.dataset.item; f.className = fragClass(id); $(".grab-wrap", f).innerHTML = grabHTML(id);
  });
}

function place(itemId, descId){
  const g = state.game; if (!g || g.ok[descId]) return;
  const prev = placedWhere(itemId); if (prev){ if (g.ok[prev]) return; delete g.placed[prev]; delete g.bad[prev]; }
  g.placed[descId] = itemId; delete g.bad[descId]; g.selected = null;
  updateGame();
}
function renderKeepPlayers(){
  // Re-rendering reloads iframes; keep scroll position.
  const y = window.scrollY; render(); window.scrollTo(0, y);
}
function check(){
  const g = state.game, a = act();
  g.bad = {};
  for (const [d, i] of Object.entries(g.placed)){ if (d === i) g.ok[d] = true; else g.bad[d] = true; }
  const badN = Object.keys(g.bad).length;
  g.done = a.items.every(it => g.ok[it.id]);
  updateGame();
  if (g.done) $("#banner").scrollIntoView({behavior: "smooth", block: "nearest"});
  if (g.done) return;
  toast(badN ? `${badN} ${badN === 1 ? "no encaixa" : "no encaixen"}. Torna-ho a escoltar!` : "Tot el que has col·locat és correcte. Continua!");
  if (badN) setTimeout(() => { if (state.game !== g || state.mode !== "alumne") return; for (const d of Object.keys(g.bad)) delete g.placed[d]; g.bad = {}; updateGame(); }, 1600);
}

app.addEventListener("click", e => {
  if (state.mode !== "alumne") return;
  const t = e.target;
  if (t.id === "check") return check();
  if (t.id === "restart"){ newGame(act()); return renderKeepPlayers(); }
  const un = t.closest("[data-unplace]");
  if (un){ const d = un.dataset.unplace; if (!state.game.ok[d]){ delete state.game.placed[d]; delete state.game.bad[d]; updateGame(); } return; }
  const gb = t.closest("[data-grab]");
  if (gb){ if (drag.moved) return; const id = gb.dataset.grab; state.game.selected = state.game.selected === id ? null : id; return updateGame(); }
  const d = t.closest("[data-desc]");
  if (d && state.game.selected) place(state.game.selected, d.dataset.desc);
});

/* pointer drag (mouse + touch) */
const drag = {id: null, ghost: null, moved: false, sx: 0, sy: 0, over: null};
app.addEventListener("pointerdown", e => {
  const gb = e.target.closest("[data-grab]"); if (!gb || state.mode !== "alumne") return;
  drag.id = gb.dataset.grab; drag.moved = false; drag.sx = e.clientX; drag.sy = e.clientY;
  gb.setPointerCapture?.(e.pointerId);
});
app.addEventListener("pointermove", e => {
  if (!drag.id) return;
  if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 6) return;
  if (!drag.moved){ drag.moved = true; drag.ghost = document.createElement("div"); drag.ghost.className = "ghost-drag"; drag.ghost.textContent = labelOf(drag.id); document.body.appendChild(drag.ghost); }
  drag.ghost.style.left = e.clientX + "px"; drag.ghost.style.top = e.clientY + "px";
  const el = document.elementFromPoint(e.clientX, e.clientY), d = el && el.closest("[data-desc]");
  const slot = d ? $(".slot", d) : null;
  if (drag.over && drag.over !== slot) drag.over.classList.remove("over");
  if (slot){ slot.classList.add("over"); drag.over = slot; } else drag.over = null;
});
function endDrag(e){
  if (!drag.id) return;
  const id = drag.id, moved = drag.moved;
  if (drag.ghost) drag.ghost.remove();
  let target = null;
  if (moved && e && e.type === "pointerup"){ const el = document.elementFromPoint(e.clientX, e.clientY); const d = el && el.closest("[data-desc]"); if (d) target = d.dataset.desc; }
  drag.id = null; drag.ghost = null; drag.over = null;
  if (target) place(id, target);
  setTimeout(() => { drag.moved = false; }, 0);
}
app.addEventListener("pointerup", endDrag);
app.addEventListener("pointercancel", endDrag);

/* ---------- editor ---------- */
function blankItem(){ return {id: "c" + uid(), video: "", start: "", end: "", desc: "", title: "", extra: "", extraVideos: []}; }
function blankAct(){ return {id: "a" + uid(), title: "Nova activitat", instructions: "Escolta els fragments i arrossega cada vídeo a la descripció que li correspon.", feedback: "Enhorabona! Ho has encertat tot.", hideVideo: true, items: [blankItem(), blankItem()]}; }
function draftAct(){ return state.draft.activitats.find(a => a.id === state.actId) || state.draft.activitats[0]; }

function renderEditor(){
  if (!state.draft) state.draft = clone(DATA);
  const a = draftAct();
  if (!a){ app.innerHTML = `<div class="editor"><div class="panel"><h2>No hi ha cap activitat</h2><button class="btn primary" data-ed="newact">Crea una activitat</button></div></div>${saveBar()}`; return; }
  const items = a.items.map((it, n) => {
    const bad = it.video && !ytId(it.video);
    return `<div class="item" data-i="${n}">
      <div class="item-head"><span class="n">Cançó ${n + 1}</span>
        <button class="btn small" data-ed="up" ${n === 0 ? "disabled" : ""} aria-label="Puja">↑</button>
        <button class="btn small" data-ed="down" ${n === a.items.length - 1 ? "disabled" : ""} aria-label="Baixa">↓</button>
        <button class="btn small danger" data-ed="delitem">Elimina</button></div>
      <div class="row">
        <label class="f">Vídeo de YouTube (enllaç)<input id="v-${it.id}" data-k="video" value="${esc(it.video)}" placeholder="https://www.youtube.com/watch?v=…"></label>
        <label class="f">Inici del fragment (m:ss)<input id="s-${it.id}" data-k="start" value="${esc(it.start)}" placeholder="0:00" inputmode="numeric"></label>
        <label class="f">Final del fragment (m:ss)<input id="e-${it.id}" data-k="end" value="${esc(it.end)}" placeholder="opcional" inputmode="numeric"></label>
      </div>
      ${bad ? `<p class="warn">No reconec aquest enllaç de YouTube.</p>` : ""}
      <label class="f">Descripció que llegeix l'alumnat<textarea id="d-${it.id}" data-k="desc">${esc(it.desc)}</textarea></label>
      <div class="row">
        <label class="f">Títol i artista (es mostra en resoldre)<input id="t-${it.id}" data-k="title" value="${esc(it.title)}"></label>
      </div>
      <label class="f">Text extra (context, preguntes, curiositats…)<textarea id="x-${it.id}" data-k="extra">${esc(it.extra)}</textarea></label>
      <div class="extras"><span class="hint">Vídeos extra (apareixen quan l'alumnat ho resol)</span>
        ${(it.extraVideos || []).map((v, k) => `<div class="x"><input id="xv-${it.id}-${k}" data-xv="${k}" value="${esc(v)}" placeholder="Enllaç de YouTube" aria-label="Vídeo extra ${k + 1}"><button class="btn small" data-ed="delxv" data-k2="${k}">Treu</button></div>`).join("")}
        <div><button class="btn small" data-ed="addxv">+ Afegeix vídeo extra</button></div>
      </div>
    </div>`;
  }).join("");
  app.innerHTML = `<div class="editor">
    <div class="panel">
      <h2>Activitat</h2>
      <label class="f">Títol<input id="a-title" data-a="title" value="${esc(a.title)}"></label>
      <label class="f">Instruccions<textarea id="a-ins" data-a="instructions">${esc(a.instructions)}</textarea></label>
      <label class="f">Missatge quan ho encerten tot<input id="a-fb" data-a="feedback" value="${esc(a.feedback)}"></label>
      <label class="check"><input type="checkbox" id="a-hide" data-a="hideVideo" ${a.hideVideo ? "checked" : ""}> Amaga la imatge dels vídeos (només s'escolta; l'alumnat pot destapar-la)</label>
      <div class="item-head"><span class="n"></span>
        <button class="btn small" data-ed="dupact">Duplica l'activitat</button>
        <button class="btn small danger" data-ed="delact">Elimina l'activitat</button></div>
    </div>
    <div class="panel"><h2>Cançons (${a.items.length})</h2>${items}<div><button class="btn" data-ed="additem">+ Afegeix una cançó</button></div></div>
  </div>${saveBar()}`;
}
function saveBar(){
  const m = state.msg || (state.dirty ? "Tens canvis sense desar." : "Quan acabis, descarrega el fitxer i puja'l a GitHub.");
  return `<div class="savebar"><span class="msg" role="status">${esc(m)}</span>
    <button class="btn" data-ed="newact">+ Nova activitat</button>
    <button class="btn ghost" data-ed="discard" ${state.dirty ? "" : "disabled"}>Descarta</button>
    <button class="btn primary" data-ed="save" >Descarrega activitats.json</button></div>`;
}
function markDirty(){ state.dirty = true; state.msg = ""; const b = $('[data-ed="save"]'); if (b && !state.readOnly) b.disabled = false; const d = $('[data-ed="discard"]'); if (d) d.disabled = false; const m = $(".savebar .msg"); if (m && !state.readOnly) m.textContent = "Tens canvis sense desar."; stash(); }
function stash(){ try { sessionStorage.setItem("ea-draft", JSON.stringify({d: state.draft, act: state.actId})); } catch (e) {} }

app.addEventListener("input", e => {
  if (state.mode !== "prof") return;
  const t = e.target, a = draftAct(); if (!a) return;
  if (t.dataset.a){ a[t.dataset.a] = t.type === "checkbox" ? t.checked : t.value; if (t.dataset.a === "title") renderTabs(); return markDirty(); }
  const box = t.closest("[data-i]"); if (!box) return;
  const it = a.items[Number(box.dataset.i)];
  if (t.dataset.k) it[t.dataset.k] = t.value;
  else if (t.dataset.xv !== undefined) it.extraVideos[Number(t.dataset.xv)] = t.value;
  markDirty();
});
app.addEventListener("change", e => { if (state.mode === "prof" && e.target.dataset.k === "video") renderEditorKeep(); });
function renderEditorKeep(){ const y = window.scrollY, f = document.activeElement && document.activeElement.id; renderEditor(); renderTabs(); window.scrollTo(0, y); if (f && document.getElementById(f)) document.getElementById(f).focus(); }

app.addEventListener("click", async e => {
  if (state.mode !== "prof") return;
  const b = e.target.closest("[data-ed]"); if (!b) return;
  const op = b.dataset.ed, a = draftAct(), box = b.closest("[data-i]"), n = box ? Number(box.dataset.i) : -1;
  const L = state.draft.activitats;
  switch (op){
    case "additem": a.items.push(blankItem()); break;
    case "delitem": if (a.items.length <= 2){ toast("Una activitat necessita com a mínim dues cançons."); return; } a.items.splice(n, 1); break;
    case "up": [a.items[n - 1], a.items[n]] = [a.items[n], a.items[n - 1]]; break;
    case "down": [a.items[n + 1], a.items[n]] = [a.items[n], a.items[n + 1]]; break;
    case "addxv": (a.items[n].extraVideos ||= []).push(""); break;
    case "delxv": a.items[n].extraVideos.splice(Number(b.dataset.k2), 1); break;
    case "newact": { const x = blankAct(); L.push(x); state.actId = x.id; break; }
    case "dupact": { const x = clone(a); x.id = "a" + uid(); x.title = a.title + " (còpia)"; x.items.forEach(i => i.id = "c" + uid()); L.push(x); state.actId = x.id; break; }
    case "delact": {
      if (b.dataset.confirm !== "1"){ b.dataset.confirm = "1"; b.textContent = "Segur? Toca per eliminar"; return; }
      L.splice(L.indexOf(a), 1); state.actId = L[0] ? L[0].id : null; break;
    }
    case "discard": state.draft = clone(DATA); state.dirty = false; state.msg = "Canvis descartats."; try { sessionStorage.removeItem("ea-draft"); } catch (e) {} if (!DATA.activitats.some(x => x.id === state.actId)) state.actId = DATA.activitats[0]?.id || null; renderEditorKeep(); return;
    case "save": return save();
  }
  markDirty(); renderEditorKeep();
});

/* ---------- saving: download activitats.json to upload to GitHub ---------- */
function validate(d){
  for (const a of d.activitats){
    if (!a.title.trim()) return "Cada activitat necessita un títol.";
    for (const [n, it] of a.items.entries()){
      if (!ytId(it.video)) return `«${a.title}», cançó ${n + 1}: falta un enllaç de YouTube vàlid.`;
      if (!it.desc.trim()) return `«${a.title}», cançó ${n + 1}: falta la descripció.`;
    }
  }
  return null;
}
function githubEditUrl(){
  // https://usuari.github.io/repo/ -> https://github.com/usuari/repo/edit/main/activitats.json
  const m = location.hostname.match(/^([\w-]+)\.github\.io$/);
  if (!m) return null;
  const repo = location.pathname.split("/").filter(Boolean)[0] || (m[1] + ".github.io");
  return `https://github.com/${m[1]}/${repo}/upload/main`;
}
async function save(){
  const err = validate(state.draft); if (err){ toast(err); return; }
  const cleaned = clone(state.draft); cleaned.activitats.forEach(a => a.items.forEach(i => i.extraVideos = (i.extraVideos || []).filter(v => v.trim())));
  const text = JSON.stringify(cleaned, null, 2) + "\n";
  const blob = new Blob([text], {type: "application/json"});
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "activitats.json";
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  try { await navigator.clipboard.writeText(text); } catch (e) {}
  state.dirty = false; try { sessionStorage.removeItem("ea-draft"); } catch (e) {}
  state.msg = "S'ha descarregat activitats.json. Puja'l al repositori de GitHub per publicar els canvis.";
  const gh = githubEditUrl(); if (gh) window.open(gh, "_blank", "noopener");
  renderEditorKeep();
}

/* ---------- chrome ---------- */
function renderModes(){
  if (!TEACHER){ $("#modes").hidden = true; return; }
  $("#modes").innerHTML = `<button type="button" data-mode="alumne" aria-pressed="${state.mode === "alumne"}">Alumnat</button><button type="button" data-mode="prof" aria-pressed="${state.mode === "prof"}">Professorat</button>`;
}
function renderTabs(){
  const list = state.mode === "prof" ? state.draft.activitats : DATA.activitats;
  const nav = $("#acts");
  nav.hidden = list.length < 2 && state.mode !== "prof";
  nav.innerHTML = list.map(a => `<button type="button" data-act="${a.id}" aria-current="${a.id === state.actId}">${esc(a.title || "Sense títol")}</button>`).join("");
}
function render(){ renderModes(); renderTabs(); state.mode === "prof" ? renderEditor() : renderGame(); }

$("#modes").addEventListener("click", e => {
  const b = e.target.closest("[data-mode]"); if (!b || b.dataset.mode === state.mode) return;
  stopAll();
  state.mode = b.dataset.mode;
  if (state.mode === "prof" && !state.draft) state.draft = clone(DATA);
  if (state.mode === "alumne"){ if (!DATA.activitats.some(a => a.id === state.actId)) state.actId = DATA.activitats[0]?.id || null; state.game = null; }
  render(); window.scrollTo(0, 0);
});
$("#acts").addEventListener("click", e => {
  const b = e.target.closest("[data-act]"); if (!b) return;
  stopAll(); state.actId = b.dataset.act; state.game = null; render();
});

/* restore an unsaved draft after a reload (e.g. a save conflict) */
try {
  const s = JSON.parse(sessionStorage.getItem("ea-draft") || "null");
  if (TEACHER && s && s.d && Array.isArray(s.d.activitats)){ state.draft = s.d; state.actId = s.act; state.mode = "prof"; state.dirty = true; state.msg = "Hem recuperat canvis que no s'havien desat."; }
} catch (e) {}
fetch("activitats.json", {cache: "no-store"}).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
  .then(d => { if (Array.isArray(d.activitats)) DATA = d; })
  .catch(() => { app.innerHTML = `<div class="head"><h1>No s'han pogut carregar les activitats</h1><p>Comprova que el fitxer activitats.json és a la mateixa carpeta que aquesta pàgina i que el JSON és vàlid.</p></div>`; })
  .finally(() => { if (!state.actId || !DATA.activitats.some(a => a.id === state.actId)) state.actId = DATA.activitats[0]?.id || null; if (DATA.activitats.length || state.draft) render(); });
})();
