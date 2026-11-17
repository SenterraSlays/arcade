/* Senterra Arcade
   Games are listed in games.json. Each entry:
   {
     "id": "my-game",                 // url-safe, unique
     "title": "My Game",
     "description": "One or two sentences.",
     "tags": ["arcade", "speedrun"],
     "added": "2026-11-17",           // YYYY-MM-DD, drives Newest + NEW badge
     "path": "games/my-game/",        // folder with the game's index.html (or a full URL)
     "cover": "games/my-game/cover.png", // optional, 16:9
     "controls": "Space to jump",     // optional
     "aspect": "landscape",           // optional: landscape | portrait | square
     "site": "https://..."            // optional: "Game website" button on the play page
   }
*/
(function () {
  "use strict";

  const NEW_DAYS = 14;

  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  function coverStyle(id) {
    const h = hash(id);
    const a = h % 360, b = (a + 50 + (h >> 9) % 80) % 360;
    return `background:linear-gradient(135deg,hsl(${a} 85% 58%),hsl(${b} 80% 45%))`;
  }

  function initials(title) {
    const words = String(title).trim().split(/\s+/).filter(Boolean);
    return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] || "?").slice(0, 2)).toUpperCase();
  }

  function isNew(g) {
    if (!g.added) return false;
    const t = Date.parse(g.added);
    return !isNaN(t) && Date.now() - t < NEW_DAYS * 864e5 && Date.now() >= t;
  }

  async function loadGames() {
    try {
      const res = await fetch("games.json", { cache: "no-cache" });
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      return Array.isArray(data) ? data.filter((g) => g && g.id && g.title && g.path) : [];
    } catch (e) {
      console.error("Could not load games.json", e);
      return [];
    }
  }

  /* ---------- Home ---------- */
  async function home() {
    const games = await loadGames();
    const grid = document.getElementById("grid");
    const q = document.getElementById("q");
    const sort = document.getElementById("sort");
    const tagsEl = document.getElementById("tags");
    const count = document.getElementById("count");
    const empty = document.getElementById("empty");
    const nomatch = document.getElementById("nomatch");
    const params = new URLSearchParams(location.search);
    let activeTag = params.get("tag") || "";
    q.value = params.get("q") || "";
    let shuffleSeed = Math.random();

    if (!games.length) {
      empty.hidden = false;
      document.querySelector(".toolbar").hidden = true;
      return;
    }

    const tagCounts = {};
    games.forEach((g) => (g.tags || []).forEach((t) => { tagCounts[t] = (tagCounts[t] || 0) + 1; }));
    const allTags = Object.keys(tagCounts).sort((a, b) => tagCounts[b] - tagCounts[a] || a.localeCompare(b));
    if (activeTag && !tagCounts[activeTag]) activeTag = "";

    const TOP_TAGS = 12;
    let tagsOpen = false;
    function renderTags() {
      if (!allTags.length) { tagsEl.innerHTML = ""; return; }
      let shown = tagsOpen ? allTags : allTags.slice(0, TOP_TAGS);
      if (activeTag && !shown.includes(activeTag)) shown = shown.concat(activeTag);
      const more = allTags.length > TOP_TAGS
        ? [`<button class="tag more" type="button" data-more="1" aria-expanded="${tagsOpen}">${tagsOpen ? "Fewer tags" : `+${allTags.length - shown.length} more`}</button>`]
        : [];
      tagsEl.innerHTML = ['<button class="tag" type="button" data-tag="" aria-pressed="' + (!activeTag) + '">All</button>']
        .concat(shown.map((t) => `<button class="tag" type="button" data-tag="${esc(t)}" aria-pressed="${t === activeTag}">${esc(t)}</button>`))
        .concat(more)
        .join("");
    }
    const order = new Map(games.map((g, i) => [g, i]));

    function syncUrl() {
      const p = new URLSearchParams();
      if (q.value.trim()) p.set("q", q.value.trim());
      if (activeTag) p.set("tag", activeTag);
      const s = p.toString();
      history.replaceState(null, "", s ? "?" + s : location.pathname);
    }

    function render() {
      const term = q.value.trim().toLowerCase();
      let list = games.filter((g) => {
        if (activeTag && !(g.tags || []).includes(activeTag)) return false;
        if (!term) return true;
        return [g.title, g.description, (g.tags || []).join(" ")].join(" ").toLowerCase().includes(term);
      });
      if (sort.value === "az") list.sort((a, b) => a.title.localeCompare(b.title));
      else if (sort.value === "random") list.sort((a, b) => hash(a.id + shuffleSeed) - hash(b.id + shuffleSeed));
      else list.sort((a, b) => String(b.added || "").localeCompare(String(a.added || "")) || order.get(a) - order.get(b));

      count.textContent = list.length === games.length
        ? `${games.length} game${games.length === 1 ? "" : "s"}`
        : `${list.length} of ${games.length} games`;
      nomatch.hidden = list.length > 0;

      grid.innerHTML = list.map((g) => {
        const cover = g.cover
          ? `<img src="${esc(g.cover)}" alt="" loading="lazy">`
          : `<span class="initials">${esc(initials(g.title))}</span>`;
        return `<a class="card" href="play.html?g=${encodeURIComponent(g.id)}">
          <div class="cover" style="${g.cover ? "" : coverStyle(g.id)}">
            ${cover}
            ${isNew(g) ? '<span class="badge">NEW</span>' : ""}
            <span class="play-hint" aria-hidden="true"></span>
          </div>
          <div class="card-body">
            <h3 class="card-title">${esc(g.title)}</h3>
            ${g.description ? `<p class="card-desc">${esc(g.description)}</p>` : ""}
            ${(g.tags || []).length ? `<div class="card-tags">${g.tags.map((t) => `<span>${esc(t)}</span>`).join("")}</div>` : ""}
          </div>
        </a>`;
      }).join("");
      syncUrl();
    }

    tagsEl.addEventListener("click", (e) => {
      const b = e.target.closest(".tag");
      if (!b) return;
      if (b.dataset.more) { tagsOpen = !tagsOpen; renderTags(); tagsEl.querySelector(".more")?.focus(); return; }
      activeTag = b.dataset.tag;
      renderTags();
      render();
    });
    q.addEventListener("input", render);
    sort.addEventListener("change", () => { shuffleSeed = Math.random(); render(); });
    document.getElementById("clear").addEventListener("click", () => {
      q.value = ""; activeTag = ""; renderTags(); render(); q.focus();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "/" && document.activeElement !== q) { e.preventDefault(); q.focus(); }
    });

    renderTags();
    render();
  }

  /* ---------- Play ---------- */
  async function play() {
    const id = new URLSearchParams(location.search).get("g");
    const games = await loadGames();
    const g = games.find((x) => x.id === id);
    const frame = document.getElementById("frame");
    const stage = document.getElementById("stage");

    if (!g) {
      document.getElementById("title").textContent = "Not found";
      stage.hidden = true;
      document.getElementById("stageActions").hidden = true;
      document.getElementById("info").hidden = true;
      document.getElementById("missing").hidden = false;
      document.title = "Not found | Senterra Arcade";
      return;
    }

    document.title = `${g.title} | Senterra Arcade`;
    document.getElementById("title").textContent = g.title;
    if (g.aspect === "portrait" || g.aspect === "square") stage.classList.add(g.aspect);
    frame.title = g.title;
    frame.src = g.path;

    document.getElementById("desc").textContent = g.description || "";
    document.getElementById("meta").innerHTML = (g.tags || [])
      .map((t) => `<a class="tag" href="./?tag=${encodeURIComponent(t)}">${esc(t)}</a>`).join("");
    if (g.site) {
      const site = document.getElementById("site");
      site.href = g.site;
      site.hidden = false;
    }
    if (g.controls) {
      document.getElementById("controls").hidden = false;
      document.getElementById("controlsText").textContent = g.controls;
    }

    document.getElementById("restart").addEventListener("click", () => {
      frame.src = "about:blank";
      setTimeout(() => { frame.src = g.path; frame.focus(); }, 30);
    });

    const toggleFull = () => {
      if (document.fullscreenElement) document.exitFullscreen();
      else stage.requestFullscreen().then(() => frame.focus()).catch(() => {});
    };
    const full = document.getElementById("full");
    const fullBig = document.getElementById("fullBig");
    if (!document.fullscreenEnabled) {
      full.hidden = true;
      document.getElementById("stageActions").hidden = true;
    }
    full.addEventListener("click", toggleFull);
    fullBig.addEventListener("click", toggleFull);

    frame.addEventListener("load", () => { try { frame.focus(); } catch (e) { /* cross-origin */ } });
  }

  const page = document.body.dataset.page;
  if (page === "home") home();
  else if (page === "play") play();
})();
