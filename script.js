const CONFIG = {
    discordId: "518567677971660812",
    music: "",   // single song (path or URL). Ignored when "playlist" has songs.
    // Your songs: the files live in the "music" folder next to index.html.
    // "title" is what visitors see, "src" must match the file name exactly.
    playlist: [
        { title: "Let It Happen", src: "music/letithappen.mp3" },
        { title: "Borderline", src: "music/borderline.mp3" },
        { title: "No Bad Energy", src: "music/nobadenergy.mp3" },
        { title: "Party With a Jagaban", src: "music/partywithajagaban.mp3" },
        { title: "I'm a Be Alright", src: "music/imabealright.mp3" },
        { title: "Raincoat", src: "music/raincoat.mp3" },
        { title: "Nope Your Too Late I Already Died", src: "music/nopeyourtoolateialreadydied.mp3" },
        { title: "Impostor Syndrome", src: "music/impostorsyndrome.mp3" },
        { title: "idkidk", src: "music/idkidk.mp3" },
        { title: "Hex", src: "music/hex.mp3" },
        { title: "Se Encendió el Beeper", src: "music/seencendioelbeeper.mp3" },
        { title: "Heart To Heart", src: "music/hearttoheart.mp3" },
        { title: "Bola", src: "music/bola.mp3" },
        { title: "Headlock", src: "music/headlock.mp3" },
        { title: "Worms", src: "music/worms.mp3" },
    ],
    shuffle: true,       // random order (every song plays once before any repeats)
    autoplay: true,      // start on page load (see note: browsers may wait for your first click)
    musicVolume: 0.6,    // starting volume, 0 (silent) to 1 (full). Visitors can change it.
    // Covers: by default each song uses music/covers/<same name as the mp3>.jpg
    // (e.g. music/covers/hex.jpg). To use another image add  cover: "path"  to a song.
    // Banner image (path or URL). Leave empty to try your Discord banner automatically.
    banner: "banner.png",
    // Badges Lanyard can't see (Nitro, Server Boost, Orbs, etc.). Add whatever is on your profile.
    extraBadges: [
        { icon: "img/HypeSquadBravery.png", name: "HypeSquad Bravery" },
        { icon: "img/quest.png", name: "Completed a Quest" },
        { icon: "img/orb.png", name: "Orbs Apprentice" },
        { icon: "img/dev.png", name: "Developer" },
    ],

    // Nudge lyric timing in seconds. Positive = lyrics move earlier, negative = later.
    // Leave at 0 unless lines consistently appear a bit early or late.
    lyricsOffset: 0,

    // Apps that show up in Discord as a "game" but aren't games (matched by name, ignoring case).
    // They get an "Using ..." label and no store button. Add any others you run.
    nonGames: [
        "Code", "Visual Studio Code", "Visual Studio", "Cursor", "Sublime Text", "Notepad++",
        "IntelliJ IDEA", "PyCharm", "WebStorm", "Android Studio",
        "Figma", "Photoshop", "Premiere Pro", "After Effects", "Blender", "OBS Studio", "Notion",
        "YouTube", "Netflix", "Twitch", "Crunchyroll", "Google Chrome", "Brave", "Firefox", "Spotify"
    ],

    // Store links for games, by the name Discord shows. Order of preference for the button:
    //   1) an entry here   2) the Steam page Discord reports for the game   3) a Steam search
    // A value can be a URL, { href, label } for a custom label, or false to hide the button.
    gameLinks: {
        "Project Zomboid":    "https://store.steampowered.com/app/108600/Project_Zomboid/",
        // Games that aren't on Steam: link their official site instead of a Steam search.
        "League of Legends":  { href: "https://www.leagueoflegends.com/", label: "Official site" },
        "VALORANT":           { href: "https://playvalorant.com/",        label: "Official site" },
        "Fortnite":           { href: "https://www.fortnite.com/",        label: "Official site" },
        "Roblox":             { href: "https://www.roblox.com/",          label: "Official site" },
        "Minecraft":          { href: "https://www.minecraft.net/",       label: "Official site" }
    },

    // Replace each "#" with your real profile link.
    links: [
        { label: "Discord",   href: "https://discord.com/users/518567677971660812" },
        { label: "TikTok",    href: "https://www.tiktok.com/@ceciyuu1" },
        { label: "Instagram", href: "https://www.instagram.com/ceciyuu1/" },
        { label: "Spotify",   href: "https://open.spotify.com/user/31bclur2u7at3vg5d3lavazxecqe" },
        { label: "GitHub",    href: "https://github.com/ceciyuu1-sudo" }
    ]
};

const $ = (id) => document.getElementById(id);
const REST_URL = `https://api.lanyard.rest/v1/users/${CONFIG.discordId}`;
const WS_URL = "wss://api.lanyard.rest/socket";
const STATUS_LABELS = { online: "Online", idle: "Idle", dnd: "Do not disturb", offline: "Offline" };

// Build DOM safely (no innerHTML with remote data).
function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
}

function mediaRow(imgUrl, title, meta) {
    const row = el("div", "media");
    if (imgUrl) {
        const img = el("img");
        img.src = imgUrl;
        img.alt = "";
        img.loading = "lazy";
        row.append(img);
    }
    const text = el("div", "text");
    text.append(el("p", "title", title));
    if (meta) text.append(el("p", "meta", meta));
    row.append(text);
    return row;
}

function fmt(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    return h ? `${h}h ${m % 60}m` : `${m}:${String(s % 60).padStart(2, "0")}`;
}

function activityImage(a) {
    const img = a.assets && a.assets.large_image;
    if (!img) return null;
    if (img.startsWith("mp:")) return `https://media.discordapp.net/${img.slice(3)}`;
    return `https://cdn.discordapp.com/app-assets/${a.application_id}/${img}.png`;
}

// Connection pill in the footer (replaces the old "Live from Discord" text).
function setConn(state, label, tip) {
    const root = $("footnote");
    const pill = root && root.querySelector(".credit-live");
    if (!pill) return;
    pill.dataset.state = state;
    pill.title = tip || label;
    pill.querySelector(".credit-live-text").textContent = label;
}

// Empty-state block for the panels (static icon markup only, no remote data).
const EMPTY_ICONS = {
    music: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" opacity=".35"/><path d="M12 3a9 9 0 018.5 6"/><circle cx="12" cy="12" r="2.2"/></svg>',
    game:  '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="6" width="20" height="12" rx="4"/><path d="M6 12h4M8 10v4"/><circle class="f" cx="15.5" cy="11" r="1"/><circle class="f" cx="18" cy="13.2" r="1"/></svg>'
};
function emptyState(kind, title, sub) {
    const wrap = el("div", "empty");
    const ico = el("span", "empty-ico");
    ico.setAttribute("aria-hidden", "true");
    ico.innerHTML = EMPTY_ICONS[kind];
    const txt = el("div");
    txt.append(el("p", "empty-title", title), el("p", "sub-text", sub));
    wrap.append(ico, txt);
    return wrap;
}

let latest = null;
let shownTrack;
let embedOpen = false;
let lyricsOpen = false;
let lyricLines = null;
let lyricsBox = null;
let activeLyric = -1;
let lyricsFollow = true;
let lyricsSyncBtn = null;

function scrollToActive() {
    if (!lyricsBox || !lyricLines) return;
    const behavior = matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    if (activeLyric < 0) { lyricsBox.scrollTo({ top: 0, behavior }); return; }
    const node = lyricLines[activeLyric].node;
    lyricsBox.scrollTo({ top: node.offsetTop - lyricsBox.clientHeight / 2 + node.clientHeight / 2, behavior });
}

function updateSyncBtn() {
    if (!lyricsSyncBtn) return;
    let show = false;
    if (!lyricsFollow && lyricLines && lyricsBox) {
        if (activeLyric < 0) {
            show = lyricsBox.scrollTop > 8;
        } else {
            const n = lyricLines[activeLyric].node;
            show = n.offsetTop < lyricsBox.scrollTop ||
                   n.offsetTop + n.offsetHeight > lyricsBox.scrollTop + lyricsBox.clientHeight;
        }
    }
    lyricsSyncBtn.hidden = !show;
}

// ---- Game store button ----
const isNonGame = (name) => CONFIG.nonGames.some((n) => n.toLowerCase() === name.toLowerCase());

function storeLink(name, steamId) {
    const links = CONFIG.gameLinks || {};
    if (name in links) {
        const custom = links[name];
        if (!custom) return null;
        const href = typeof custom === "string" ? custom : custom.href;
        let label = typeof custom === "object" ? custom.label : "";
        if (!label) {
            label = "View store page";
            try {
                const host = new URL(href).hostname;
                if (host.includes("steampowered")) label = "View on Steam";
                else if (host.includes("epicgames")) label = "View on Epic";
                else if (host.includes("gog.com")) label = "View on GOG";
            } catch (e) { /* keep the generic label */ }
        }
        return { href, label };
    }
    if (steamId) return { href: `https://store.steampowered.com/app/${steamId}/`, label: "View on Steam" };
    return { href: `https://store.steampowered.com/search/?term=${encodeURIComponent(name)}`, label: "Search on Steam" };
}

// ---- Lyrics ----
const lyricsCache = new Map();

function parseLrc(lrc) {
    const out = [];
    for (const row of lrc.split("\n")) {
        const stamps = [...row.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)];
        if (!stamps.length) continue;
        const text = row.replace(/\[\d+:\d+(?:\.\d+)?\]/g, "").trim();
        for (const s of stamps) out.push({ t: Number(s[1]) * 60 + Number(s[2]), text });
    }
    return out.sort((a, b) => a.t - b.t);
}

function stripLrc(lrc) {
    return lrc.replace(/\[\d+:\d+(?:\.\d+)?\]/g, "").split("\n").map((l) => l.trim()).join("\n").trim();
}

async function fetchLyrics(track) {
    const id = track.track_id;
    if (lyricsCache.has(id)) return lyricsCache.get(id);
    const artist = track.artist.split(";")[0].trim();
    const duration = Math.round((track.timestamps.end - track.timestamps.start) / 1000);
    let data = null;
    try {
        const exact = { track_name: track.song, artist_name: artist, duration };
        if (track.album) exact.album_name = track.album;
        let res = await fetch(`https://lrclib.net/api/get?${new URLSearchParams(exact)}`);
        if (res.ok) {
            data = await res.json();
            data.__fits = true;
        } else {
            res = await fetch(`https://lrclib.net/api/search?${new URLSearchParams({ track_name: track.song, artist_name: artist })}`);
            if (res.ok) {
                const list = (await res.json())
                    .filter((x) => x.instrumental || x.syncedLyrics || x.plainLyrics)
                    .sort((a, b) => Math.abs(a.duration - duration) - Math.abs(b.duration - duration));
                data = list[0] || null;
                if (data) data.__fits = Math.abs(data.duration - duration) <= 3;
            }
        }
    } catch (e) {
        return undefined;
    }
    let result = null;
    if (data && (data.instrumental || data.syncedLyrics || data.plainLyrics)) {
        result = { instrumental: !!data.instrumental, synced: null, plain: data.plainLyrics || null };
        if (data.syncedLyrics) {
            if (data.__fits) result.synced = parseLrc(data.syncedLyrics);
            else if (!result.plain) result.plain = stripLrc(data.syncedLyrics);
        }
    }
    lyricsCache.set(id, result);
    return result;
}

async function showLyrics(track, box) {
    lyricLines = null;
    activeLyric = -1;
    lyricsBox = box;
    lyricsFollow = true;
    if (lyricsSyncBtn) lyricsSyncBtn.hidden = true;
    box.replaceChildren(el("p", "lyrics-msg", "Loading lyrics…"));
    const res = await fetchLyrics(track);
    if (!box.isConnected || !lyricsOpen) return;
    box.replaceChildren();

    if (res === undefined) {
        box.append(el("p", "lyrics-msg", "Couldn't reach the lyrics service. Press Lyrics again to retry."));
    } else if (!res) {
        const msg = el("p", "lyrics-msg", "No lyrics found for this song. ");
        const a = el("a", null, "Search on Genius");
        a.href = `https://genius.com/search?q=${encodeURIComponent(`${track.song} ${track.artist.split(";")[0]}`)}`;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        msg.append(a);
        box.append(msg);
    } else if (res.instrumental) {
        box.append(el("p", "lyrics-msg", "Instrumental, no lyrics."));
    } else if (res.synced && res.synced.length) {
        lyricLines = res.synced.map((l) => {
            const node = el("p", "lyric-line", l.text || "♪");
            node.dir = "auto";
            box.append(node);
            return { t: l.t, node };
        });
        tick();
    } else {
        res.plain.split("\n").forEach((line) => {
            const p = el("p", "lyric-plain", line || "\u00a0");
            p.dir = "auto";
            box.append(p);
        });
    }
}

// Public flags -> badges
const BADGES = [
    [0, "🔧", "Discord Staff"], [1, "🤝", "Partner"], [2, "🎪", "HypeSquad Events"], [3, "🐛", "Bug Hunter"],
    [7, "🟠", "HypeSquad Brilliance"], [8, "🟢", "HypeSquad Balance"],
    [9, "🌟", "Early Supporter"], [14, "🏆", "Bug Hunter Gold"], [17, "🤖", "Early Bot Developer"],
    [18, "🛡️", "Certified Moderator"], [22, "⚡", "Active Developer"]
];

function renderDetails(du) {
    const list = $("badges");
    list.replaceChildren();
    const add = (icon, name) => {
        const li = el("li");
        li.title = name;
        li.setAttribute("aria-label", name);
        if (icon.startsWith("http") || icon.endsWith(".png") || icon.includes("/")) {
            const img = el("img");
            img.src = icon;
            img.alt = "";
            li.append(img);
        } else {
            li.textContent = icon;
        }
        list.append(li);
    };

    BADGES.forEach(([bit, icon, name]) => {
        if (Math.floor((du.public_flags || 0) / 2 ** bit) % 2 === 1) add(icon, name);
    });
    CONFIG.extraBadges.forEach((b) => add(b.icon, b.name));
    list.hidden = !list.children.length;

    const tag = du.primary_guild && du.primary_guild.tag;
    const tagEl = $("clan-tag");
    tagEl.hidden = !tag;
    tagEl.replaceChildren();
    if (tag) {
        const pg = du.primary_guild;
        const local = "img/server-icon.png";
        const remote = pg.identity_guild_id && pg.badge
            ? `https://cdn.discordapp.com/guild-tag-badges/${pg.identity_guild_id}/${pg.badge}.png?size=64`
            : null;
        const ic = el("img");
        ic.alt = "";
        ic.width = 14;
        ic.height = 14;
        ic.src = remote || local;
        ic.onerror = () => {
            if (!remote || ic.src.endsWith(local)) ic.remove();
            else ic.src = local;
        };
        tagEl.append(ic, el("span", null, tag));
    }

    const deco = du.avatar_decoration_data;
    const dimg = $("avatar-decoration");
    dimg.hidden = !deco;
    if (deco) dimg.src = `https://cdn.discordapp.com/avatar-decoration-presets/${deco.asset}.png?size=160`;
}

document.addEventListener("DOMContentLoaded", () => {
    const tagEl = document.getElementById("clan-tag");
    const popover = document.getElementById("clan-popover");
    if (!tagEl || !popover) return;
    document.body.appendChild(popover);

    let hideTimer;
    const show = () => {
        clearTimeout(hideTimer);
        popover.hidden = false;
        const rect = tagEl.getBoundingClientRect();
        const pw = popover.offsetWidth, ph = popover.offsetHeight, m = 10;
        const left = Math.min(Math.max(rect.left, m), innerWidth - pw - m);
        let top = rect.bottom + 8;
        if (top + ph > innerHeight - m) top = Math.max(m, rect.top - ph - 8);
        popover.style.left = `${left}px`;
        popover.style.top = `${top}px`;
    };
    const hideSoon = () => { hideTimer = setTimeout(() => (popover.hidden = true), 150); };

    tagEl.addEventListener("mouseenter", show);
    tagEl.addEventListener("mouseleave", hideSoon);
    popover.addEventListener("mouseenter", () => clearTimeout(hideTimer));
    popover.addEventListener("mouseleave", hideSoon);

    tagEl.addEventListener("click", show);
    document.addEventListener("click", (e) => {
        if (!popover.contains(e.target) && !tagEl.contains(e.target)) popover.hidden = true;
    });
});

const infoCache = new Map();

async function gameInfo(game) {
    const direct = activityImage(game);
    const id = game.application_id;
    if (!id) return { icon: direct, steamId: null };
    if (!infoCache.has(id)) {
        const found = { icon: null, steamId: null };
        try {
            const res = await fetch(`https://discord.com/api/v10/applications/${id}/rpc`);
            const data = await res.json();
            if (data.icon) found.icon = `https://cdn.discordapp.com/app-icons/${id}/${data.icon}.png?size=128`;
            const steam = (data.third_party_skus || []).find((s) => s.distributor === "steam");
            const sid = steam && String(steam.id || steam.sku || "").replace(/\D/g, "");
            if (sid) found.steamId = sid;
        } catch (e) { /* ignore */ }
        infoCache.set(id, found);
    }
    const found = infoCache.get(id);
    return { icon: direct || found.icon, steamId: found.steamId };
}

function render(user) {
    latest = user;
    const du = user.discord_user;

    if (du.avatar) {
        const ext = du.avatar.startsWith("a_") ? "gif" : "png";
        $("avatar").src = `https://cdn.discordapp.com/avatars/${du.id}/${du.avatar}.${ext}?size=256`;
    }

    renderDetails(du);

    const status = user.discord_status || "offline";
    document.body.dataset.status = status;
    $("status-indicator").className = `status ${status}`;
    $("status-indicator").setAttribute("aria-label", `Status: ${STATUS_LABELS[status]}`);
    $("status-label").textContent = STATUS_LABELS[status];

    $("username").textContent = du.global_name || du.username;
    $("username-tag").textContent = `@${du.username}`;

    const custom = user.activities.find((a) => a.type === 4);
    const cs = $("custom-status");
    const csText = custom && [custom.emoji && custom.emoji.name, custom.state].filter(Boolean).join(" ");
    cs.hidden = !csText;
    cs.textContent = csText || "";

    const sp = $("spotify-content");
    const trackId = user.listening_to_spotify && user.spotify ? user.spotify.track_id : null;
    document.querySelector(".spotify-card").classList.toggle("live", !!trackId);
    if (trackId !== shownTrack) {
        shownTrack = trackId;
        lyricLines = null;
        lyricsBox = null;
        lyricsSyncBtn = null;
        activeLyric = -1;
        lyricsFollow = true;
        sp.replaceChildren();
        if (trackId) {
            const t = user.spotify;
            const row = mediaRow(t.album_art_url, t.song, `by ${t.artist.replaceAll(";", ",")}`);
            const npTag = el("div", "np-tag");
            const eq = el("span", "eq");
            eq.append(el("i"), el("i"), el("i"));
            npTag.append(eq, el("span", null, "Now playing"));
            row.querySelector(".text").prepend(npTag);
            sp.append(row);
            // blurred album art behind the card (only for plain https image URLs)
            const spCard = document.querySelector(".spotify-card");
            if (/^https:\/\/[\w.\-\/]+$/.test(t.album_art_url || "")) spCard.style.setProperty("--art", `url("${t.album_art_url}")`);
            else spCard.style.removeProperty("--art");
            const prog = el("div", "progress");
            prog.append(el("span"));
            const times = el("div", "times");
            times.append(el("span", null, "0:00"), el("span", null, "0:00"));

            const play = el("button", "btn");
            play.type = "button";
            const open = el("a", "btn", "Open in Spotify");
            open.href = `https://open.spotify.com/track/${trackId}`;
            open.target = "_blank";
            open.rel = "noopener noreferrer";
            const box = el("div", "embed");
            const mount = () => {
                box.replaceChildren();
                if (embedOpen) {
                    const f = el("iframe");
                    f.src = `https://open.spotify.com/embed/track/${trackId}?theme=0`;
                    f.title = "Spotify player";
                    f.height = "152";
                    f.allow = "encrypted-media";
                    box.append(f);
                }
                box.hidden = !embedOpen;
                play.textContent = embedOpen ? "Hide player" : "Play this song";
                play.setAttribute("aria-expanded", String(embedOpen));
            };
            play.addEventListener("click", () => { embedOpen = !embedOpen; mount(); });
            const lyr = el("button", "btn");
            lyr.type = "button";
            const lwrap = el("div", "lyrics-wrap");
            const lbox = el("div", "lyrics");
            lbox.setAttribute("aria-live", "off");
            const syncBtn = el("button", "lyrics-sync", "Sync lyrics");
            syncBtn.type = "button";
            syncBtn.hidden = true;
            syncBtn.setAttribute("aria-label", "Scroll lyrics back to the current line");
            lwrap.append(lbox, syncBtn);
            lyricsSyncBtn = syncBtn;

            const detach = () => { if (lyricLines) { lyricsFollow = false; updateSyncBtn(); } };
            lbox.addEventListener("wheel", detach, { passive: true });
            lbox.addEventListener("touchmove", detach, { passive: true });
            lbox.addEventListener("pointerdown", (e) => { if (e.target === lbox && e.offsetX >= lbox.clientWidth) detach(); });
            lbox.addEventListener("scroll", updateSyncBtn, { passive: true });
            syncBtn.addEventListener("click", () => { lyricsFollow = true; scrollToActive(); updateSyncBtn(); });

            const mountLyrics = () => {
                lwrap.hidden = !lyricsOpen;
                lyr.textContent = lyricsOpen ? "Hide lyrics" : "Lyrics";
                lyr.setAttribute("aria-expanded", String(lyricsOpen));
                if (lyricsOpen) showLyrics(t, lbox);
                else { lyricLines = null; lyricsBox = null; syncBtn.hidden = true; }
            };
            lyr.addEventListener("click", () => { lyricsOpen = !lyricsOpen; mountLyrics(); });

            const actions = el("div", "actions");
            actions.append(play, lyr, open);
            sp.append(prog, times, actions, lwrap, box);
            mount();
            mountLyrics();
        } else {
            sp.append(emptyState("music", "Nothing playing", "Start Spotify and your track shows up here live."));
        }
    }

    const game = user.activities.find((a) => a.type === 0);
    const gc = $("game-content");
    const bar = $("activity-status");
    gc.replaceChildren();
    document.querySelector(".game-card").classList.toggle("live", !!game);
    bar.classList.toggle("live", !!game);
    bar.replaceChildren();
    if (game) {
        const app = isNonGame(game.name);
        const meta = [game.details, game.state].filter(Boolean).join(" · ") || (app ? "Active now" : "Playing now");
        const row = mediaRow(null, game.name, meta);
        gc.append(row);
        const timeEl = el("p", "sub-text game-time");
        timeEl.dataset.verb = app ? "Active for" : "Playing for";
        gc.append(timeEl);
        const gameActions = el("div", "actions");
        gc.append(gameActions);

        gameInfo(game).then((info) => {
            if (!row.isConnected) return;
            if (info.icon) {
                const img = el("img");
                img.src = info.icon;
                img.alt = "";
                row.prepend(img);
            } else {
                const ph = el("span", "media-ph");
                ph.setAttribute("aria-hidden", "true");
                ph.innerHTML = EMPTY_ICONS.game;
                row.prepend(ph);
            }
            if (app) return;
            const store = storeLink(game.name, info.steamId);
            if (!store) return;
            const storeBtn = el("a", "btn", store.label);
            storeBtn.href = store.href;
            storeBtn.target = "_blank";
            storeBtn.rel = "noopener noreferrer";
            gameActions.append(storeBtn);
        });
        bar.append(el("p", null, app ? `💻 Using ${game.name}` : `🎮 Playing ${game.name}`));
        $("game-title").textContent = app ? "Working in" : "Play with me";
    } else {
        $("game-title").textContent = "Play with me";
        gc.append(emptyState("game", "No game right now", "Whatever is being played appears here automatically."));
        bar.append(el("p", null, "🎮 No active game detected"));
    }

    setConn("live", "live", "Live from Discord");
    tick();
}

/* =====================================================================
   CLOCK SYNC
   Discord reports when a song started using Discord's own clock, but every
   visitor compares it against their own device clock, and phones are often
   a minute or more off. That made the elapsed-time slider and the lyrics
   sync drift on those devices.

   Fix: read a real time from a JSON API (millisecond precision) and apply
   the difference wherever we use Date.now(). Falls back to the Date header
   our host returns, then to a value we cached on a previous visit. Re-syncs
   every 5 minutes and whenever the tab becomes visible again.

   Add ?debug to the page URL to see the numbers on screen.
   ===================================================================== */
let rawSkew = 0;      // real time minus this device's clock, in ms
let clockSkew = 0;    // value we add to Date.now() everywhere

// Reuse a previously measured skew so the very first second isn't wrong.
try {
    const c = JSON.parse(localStorage.getItem("clock:skew") || "null");
    if (c && typeof c.skew === "number" && Date.now() - c.at < 6 * 60 * 60 * 1000) {
        rawSkew = clockSkew = Math.round(c.skew);
    }
} catch (e) {}

async function sampleSkew() {
    // 1) timeapi.io — JSON, millisecond precision, CORS-enabled
    {
        const t0 = Date.now();
        try {
            const res = await fetch("https://timeapi.io/api/Time/current/zone?timeZone=UTC",
                                    { cache: "no-store" });
            const t1 = Date.now();
            if (res.ok) {
                const d = await res.json();
                const ms = Date.parse(d.dateTime || d.dateTimeUtc || "");
                if (Number.isFinite(ms)) {
                    // API time is when the server assembled the response.
                    // Response was generated at ~(t0+t1)/2 on our clock.
                    return { skew: ms - (t0 + t1) / 2, rtt: t1 - t0, source: "timeapi.io" };
                }
            }
        } catch (e) {}
    }
    // 2) Fallback: our own host's Date header (1-second resolution).
    {
        const t0 = Date.now();
        try {
            const res = await fetch(location.pathname + "?__t=" + t0,
                                    { method: "HEAD", cache: "no-store" });
            const t1 = Date.now();
            const h = res.headers.get("date");
            if (h) {
                const ms = new Date(h).getTime();
                if (Number.isFinite(ms)) {
                    return { skew: (ms + 500) - (t0 + t1) / 2, rtt: t1 - t0, source: "date-header" };
                }
            }
        } catch (e) {}
    }
    return null;
}

async function syncClock() {
    const samples = [];
    for (let i = 0; i < 3; i++) {
        if (i) await new Promise((r) => setTimeout(r, 200));
        const s = await sampleSkew();
        if (s) samples.push(s);
    }
    if (!samples.length) {
        console.warn("[clock] all samples failed; keeping skew = " + clockSkew + "ms");
        return;
    }
    samples.sort((a, b) => a.rtt - b.rtt);
    const best = samples[0];
    if (Math.abs(best.skew) > 3600_000) {   // >1 h: obviously a bad sample
        console.warn("[clock] rejecting absurd skew:", best);
        return;
    }
    rawSkew = clockSkew = Math.round(best.skew);
    try {
        localStorage.setItem("clock:skew", JSON.stringify({ skew: rawSkew, at: Date.now() }));
    } catch (e) {}
    console.info(`[clock] skew ${rawSkew >= 0 ? "+" : ""}${rawSkew}ms via ${best.source} (rtt ${best.rtt}ms)`);
}

syncClock();
setInterval(syncClock, 5 * 60 * 1000);
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") syncClock();
});

const DEBUG = /[?&]debug\b/.test(location.search);
let debugBox = null;
function showDebug(now, t, over) {
    if (!debugBox) {
        debugBox = document.createElement("pre");
        debugBox.style.cssText = "position:fixed;left:8px;bottom:8px;z-index:99999;margin:0;padding:8px 10px;" +
            "background:rgba(0,0,0,.85);color:#7CFC9A;font:11px/1.45 monospace;border:1px solid #2a2a31;border-radius:8px;" +
            "pointer-events:none;max-width:92vw;white-space:pre-wrap";
        document.body.appendChild(debugBox);
    }
    const f = (ms) => (ms / 1000).toFixed(1) + "s";
    debugBox.textContent = [
        "device clock vs real time: " + (rawSkew >= 0 ? "-" : "+") + f(Math.abs(rawSkew)) + (rawSkew >= 0 ? " (behind)" : " (ahead)"),
        "correction applied: " + (clockSkew ? f(clockSkew) : "none"),
        t ? "song length: " + f(t.end - t.start) : "song: none",
        t ? "elapsed (corrected): " + f(now - t.start) : "",
        t ? "elapsed (raw device clock): " + f(Date.now() - t.start) : "",
        t ? "state: " + (over ? "OVER (last played)" : "playing") : ""
    ].filter(Boolean).join("\n");
}

function tick() {
    if (!latest) return;
    const now = Date.now() + clockSkew;

    const t = latest.listening_to_spotify && latest.spotify && latest.spotify.timestamps;
    // Song already finished (or paused) but Discord still lists it: show it as "Last played".
    const over = !!t && now > t.end + 4000;
    if (DEBUG) showDebug(now, t, over);
    const fill = document.querySelector(".progress > span");
    if (t && fill) {
        const total = t.end - t.start;
        const pos = Math.min(total, now - t.start);
        fill.style.width = `${(pos / total) * 100}%`;
        const spans = document.querySelectorAll(".times span");
        spans[0].textContent = fmt(pos);
        spans[1].textContent = fmt(total);
    }

    const npTag = document.querySelector(".np-tag");
    if (npTag && t) {
        const label = npTag.querySelector("span:not(.eq)");
        if (label) label.textContent = over ? "Last played" : "Now playing";
        npTag.querySelectorAll(".eq i").forEach((bar) => { bar.style.animationPlayState = over ? "paused" : "running"; });
    }

    if (t && lyricLines && lyricsBox) {
        const pos = (now - t.start) / 1000 + (CONFIG.lyricsOffset || 0);
        // If the song is over, don't jump to the last line.
        let idx = -1;
        if (!over) for (let i = 0; i < lyricLines.length && lyricLines[i].t <= pos; i++) idx = i;
        if (idx !== activeLyric) {
            if (activeLyric >= 0 && lyricLines[activeLyric]) lyricLines[activeLyric].node.classList.remove("active");
            activeLyric = idx;
            if (idx >= 0) lyricLines[idx].node.classList.add("active");
            if (lyricsFollow) scrollToActive();
        }
        updateSyncBtn();
    }

    const game = latest.activities.find((a) => a.type === 0);
    const gt = document.querySelector(".game-time");
    if (game && gt && game.timestamps && game.timestamps.start) {
        gt.textContent = `${gt.dataset.verb || "Playing for"} ${fmt(now - game.timestamps.start)}`;
    }
}
setInterval(tick, 500);

async function fetchOnce() {
    try {
        const res = await fetch(REST_URL);
        const json = await res.json();
        if (json.success) render(json.data);
        else setConn("error", "no presence", "Join the Lanyard Discord server to enable live presence.");
    } catch (err) {
        setConn("error", "offline", "Could not reach Lanyard.");
        console.error("Lanyard fetch failed:", err);
    }
}

function connect() {
    let heartbeat;
    const ws = new WebSocket(WS_URL);
    ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.op === 1) {
            ws.send(JSON.stringify({ op: 2, d: { subscribe_to_id: CONFIG.discordId } }));
            heartbeat = setInterval(() => ws.send(JSON.stringify({ op: 3 })), msg.d.heartbeat_interval);
        } else if (msg.op === 0 && msg.d) {
            render(msg.d);
        }
    };
    ws.onclose = () => {
        clearInterval(heartbeat);
        fetchOnce();
        setTimeout(connect, 5000);
    };
    ws.onerror = () => ws.close();
}

CONFIG.links.forEach(({ label, href }) => {
    const a = el("a", null, label);
    a.dataset.brand = label.toLowerCase();
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    $("socials").append(a);
});

// Music player: cover, play/pause, prev/next, volume, shuffle, autoplay
(function player() {
    const list = (CONFIG.playlist && CONFIG.playlist.length)
        ? CONFIG.playlist
        : (CONFIG.music ? [{ title: "Music", src: CONFIG.music }] : []);
    if (!list.length) return;

    const audio = $("bgm"), box = $("player"), toggle = $("pl-toggle");
    const prev = $("pl-prev"), next = $("pl-next"), titleEl = $("pl-title"), cover = $("pl-cover");
    const vol = $("pl-volume"), muteBtn = $("pl-mute"), collapse = $("pl-collapse");
    audio.loop = false;
    box.hidden = false;
    if (list.length < 2) { prev.hidden = true; next.hidden = true; }

    const store = {
        get(k) { try { return localStorage.getItem("player:" + k); } catch (e) { return null; } },
        set(k, v) { try { localStorage.setItem("player:" + k, v); } catch (e) {} }
    };

    /* ---------- volume ---------- */
    let volume = parseFloat(store.get("volume"));
    if (!isFinite(volume)) volume = CONFIG.musicVolume ?? 0.6;
    volume = Math.min(1, Math.max(0, volume));
    let muted = store.get("muted") === "1";
    const paintVolume = () => {
        audio.volume = volume;
        audio.muted = muted;
        const shown = muted ? 0 : volume;
        vol.value = Math.round(shown * 100);
        vol.style.setProperty("--v", vol.value + "%");
        box.classList.toggle("muted", muted || volume === 0);
        muteBtn.setAttribute("aria-label", muted || volume === 0 ? "Unmute" : "Mute");
    };
    vol.addEventListener("input", () => {
        volume = vol.value / 100;
        muted = volume === 0;
        store.set("volume", volume); store.set("muted", muted ? "1" : "0");
        paintVolume();
    });
    muteBtn.addEventListener("click", () => {
        muted = !(muted || volume === 0);
        if (!muted && volume === 0) volume = 0.6;
        store.set("volume", volume); store.set("muted", muted ? "1" : "0");
        paintVolume();
    });
    paintVolume();

    /* ---------- queue (shuffled so nothing repeats until all have played) ---------- */
    let order = [], pos = 0, current = 0, failures = 0;
    const makeOrder = (avoid) => {
        const o = list.map((_, n) => n);
        if (CONFIG.shuffle) {
            for (let k = o.length - 1; k > 0; k--) {
                const j = Math.floor(Math.random() * (k + 1));
                [o[k], o[j]] = [o[j], o[k]];
            }
            if (o.length > 1 && o[0] === avoid) [o[0], o[1]] = [o[1], o[0]];
        }
        return o;
    };
    const coverFor = (s) => s.cover || s.src.replace(/^music\//, "music/covers/").replace(/\.[^./]+$/, ".jpg");

    const load = (n) => {
        current = n;
        const song = list[n];
        audio.src = song.src;
        titleEl.textContent = song.title || "Music";
        titleEl.title = titleEl.textContent;
        box.classList.remove("has-cover");
        cover.onload = () => box.classList.add("has-cover");
        cover.onerror = () => box.classList.remove("has-cover");
        cover.src = coverFor(song);
        try {
            if ("mediaSession" in navigator) {
                navigator.mediaSession.metadata = new MediaMetadata({
                    title: titleEl.textContent,
                    artwork: [{ src: new URL(coverFor(song), location.href).href }]
                });
            }
        } catch (e) {}
    };
    const go = (delta) => {
        pos += delta;
        if (pos >= order.length) { order = makeOrder(order[order.length - 1]); pos = 0; }
        if (pos < 0) pos = order.length - 1;
        load(order[pos]);
    };
    const play = () => audio.play().catch(() => {});

    /* ---------- controls ---------- */
    let userPaused = false;
    toggle.addEventListener("click", () => {
        if (audio.paused) { userPaused = false; play(); }
        else { userPaused = true; audio.pause(); }
    });
    next.addEventListener("click", () => { const was = !audio.paused; go(1); if (was) play(); });
    prev.addEventListener("click", () => {
        if (audio.currentTime > 3) { audio.currentTime = 0; return; }   // like most players: restart first
        const was = !audio.paused; go(-1); if (was) play();
    });
    collapse.addEventListener("click", () => {
        const min = box.classList.toggle("min");
        collapse.setAttribute("aria-expanded", String(!min));
        collapse.setAttribute("aria-label", min ? "Expand player" : "Minimize player");
    });
    if (matchMedia("(max-width: 700px)").matches) {   // keep small screens uncluttered
        box.classList.add("min");
        collapse.setAttribute("aria-expanded", "false");
        collapse.setAttribute("aria-label", "Expand player");
    }

    audio.addEventListener("play", () => {
        failures = 0;
        box.classList.add("playing");
        toggle.setAttribute("aria-pressed", "true");
        toggle.setAttribute("aria-label", "Pause music");
    });
    audio.addEventListener("pause", () => {
        box.classList.remove("playing");
        toggle.setAttribute("aria-pressed", "false");
        toggle.setAttribute("aria-label", "Play music");
    });
    audio.addEventListener("ended", () => { go(1); play(); });
    // A missing/broken file: skip to the next one, but give up once every song has failed.
    audio.addEventListener("error", (e) => {
        console.warn("[player] Failed to load audio:", audio.src, e);
        if (++failures >= list.length) { titleEl.textContent = "Music files not found"; return; }
        go(1); play();
    });

    try {
        if ("mediaSession" in navigator) {
            navigator.mediaSession.setActionHandler("play", () => { userPaused = false; play(); });
            navigator.mediaSession.setActionHandler("pause", () => { userPaused = true; audio.pause(); });
            navigator.mediaSession.setActionHandler("previoustrack", () => { go(-1); play(); });
            navigator.mediaSession.setActionHandler("nexttrack", () => { go(1); play(); });
        }
    } catch (e) {}

    /* ---------- start ---------- */
    order = makeOrder();
    load(order[0]);

    // Browsers refuse to start sound before the visitor does something on the page.
    // So: try right away, and if it's blocked, start on the very first click/tap/key press.
    if (CONFIG.autoplay !== false) {
        const events = ["pointerdown", "pointerup", "touchend", "keydown", "click"];
        const disarm = () => events.forEach((ev) => window.removeEventListener(ev, kick, true));
        function kick(e) {
            if (e && e.target && box.contains(e.target)) return;   // the player's own buttons decide for themselves
            if (userPaused) { disarm(); return; }
            audio.play().then(disarm).catch(() => {});
        }
        const gate = $("enter-gate");
        const openGate = () => {
            if (!gate) return;
            gate.hidden = false;
            gate.focus();
            const enter = () => {
                gate.hidden = true;
                userPaused = false;
                disarm();
                play();
            };
            gate.addEventListener("click", enter, { once: true });
            gate.addEventListener("keydown", (e) => {
                if (e.key === "Enter" || e.key === " ") { e.preventDefault(); enter(); }
            }, { once: true });
        };
        audio.play().catch(() => {
            events.forEach((ev) => window.addEventListener(ev, kick, true));
            openGate();
        });
        audio.addEventListener("play", () => { if (gate) gate.hidden = true; });
    }
})();

fetchOnce();
connect();

// Mobile browsers suspend WebSockets when the tab is backgrounded or the
// screen locks. When the tab wakes, force a REST fetch right away so the
// panel doesn't sit on stale data.
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") fetchOnce();
});
window.addEventListener("focus", fetchOnce);

// Safety net: a REST poll every 30 seconds in case the socket has silently died.
setInterval(fetchOnce, 30 * 1000);


// Banner
(function banner() {
    const img = $("banner-img");
    img.onload = () => { img.hidden = false; };
    img.onerror = () => { img.hidden = true; };
    img.src = CONFIG.banner || `https://dcdn.dstn.to/banner/${CONFIG.discordId}`;
})();

// Animated background
(function rain() {
    const canvas = $("bg-canvas"), ctx = canvas.getContext("2d");
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w, h, dpr, drops = [], color = "#80848e", last = 0, frame = 0;

    function spawn(anywhere) {
        return {
            x: Math.random() * w,
            y: anywhere ? Math.random() * h : -80 * dpr,
            len: (30 + Math.random() * 90) * dpr,
            speed: (40 + Math.random() * 110) * dpr,
            a: 0.08 + Math.random() * 0.22
        };
    }
    function resize() {
        dpr = Math.min(devicePixelRatio || 1, 2);
        w = canvas.width = innerWidth * dpr;
        h = canvas.height = innerHeight * dpr;
        drops = Array.from({ length: Math.min(110, Math.floor((innerWidth * innerHeight) / 14000)) }, () => spawn(true));
        if (still) draw(0);
    }
    function draw(dt) {
        if (frame++ % 30 === 0) color = getComputedStyle(document.body).getPropertyValue("--status").trim() || color;
        ctx.clearRect(0, 0, w, h);
        ctx.lineWidth = dpr;
        ctx.strokeStyle = color;
        for (const d of drops) {
            d.y += d.speed * dt;
            if (d.y - d.len > h) Object.assign(d, spawn(false));
            const g = ctx.createLinearGradient(0, d.y - d.len, 0, d.y);
            g.addColorStop(0, "transparent");
            g.addColorStop(1, color);
            ctx.globalAlpha = d.a;
            ctx.strokeStyle = g;
            ctx.beginPath();
            ctx.moveTo(d.x, d.y - d.len);
            ctx.lineTo(d.x, d.y);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
    }
    function loop(t) {
        const dt = Math.min(0.05, (t - last) / 1000 || 0);
        last = t;
        draw(dt);
        requestAnimationFrame(loop);
    }
    addEventListener("resize", resize);
    resize();
    if (!still) requestAnimationFrame(loop);
})();

// Lightbox
(function lightbox() {
    const box = $("lightbox"), stage = $("lightbox-stage"), img = $("lightbox-img");
    const zoomBtn = $("lightbox-zoom"), closeBtn = $("lightbox-close");
    let opener = null;

    function open(src, alt, from) {
        opener = from;
        img.src = src;
        img.alt = alt;
        box.classList.remove("zoomed");
        zoomBtn.setAttribute("aria-pressed", "false");
        box.hidden = false;
        document.body.style.overflow = "hidden";
        closeBtn.focus();
    }
    function close() {
        box.hidden = true;
        img.removeAttribute("src");
        document.body.style.overflow = "";
        if (opener) opener.focus();
    }
    function toggleZoom() {
        const zoomed = box.classList.toggle("zoomed");
        zoomBtn.setAttribute("aria-pressed", String(zoomed));
    }

    function bind(node, label, getSrc, isReady) {
        node.classList.add("zoomable");
        node.setAttribute("role", "button");
        node.setAttribute("aria-label", label);
        node.tabIndex = 0;
        const go = () => { if (!isReady || isReady()) open(getSrc(), label, node); };
        node.addEventListener("click", go);
        node.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); }
        });
    }
    bind(document.querySelector(".banner"), "View banner", () => $("banner-img").src, () => !$("banner-img").hidden);
    bind(document.querySelector(".avatar-container"), "View profile picture", () => $("avatar").src.replace("size=256", "size=1024"));

    closeBtn.addEventListener("click", close);
    zoomBtn.addEventListener("click", toggleZoom);
    img.addEventListener("click", toggleZoom);
    box.addEventListener("click", (e) => { if (e.target === box || e.target === stage) close(); });

    document.addEventListener("keydown", (e) => {
        if (box.hidden) return;
        if (e.key === "Escape") close();
        if (e.key === "Tab") {
            e.preventDefault();
            (document.activeElement === closeBtn ? zoomBtn : closeBtn).focus();
        }
    });
})();

(() => {
    "use strict";

    const imdb  = (id) => `https://www.imdb.com/title/${id}/`;
    const mal   = (id) => `https://myanimelist.net/anime/${id}`;
    const malQ  = (q)  => `https://myanimelist.net/anime.php?q=${encodeURIComponent(q)}`;
    const steam = (id) => `https://store.steampowered.com/app/${id}/`;
    const steamQ = (q) => `https://store.steampowered.com/search/?term=${encodeURIComponent(q)}`;

    const DATA = {
        movie: [
            { t: "Mission: Impossible", w: "Mission: Impossible (film)", y: "1996–2025", u: imdb("tt0117060"),
              d: "Ethan Hunt and the IMF take on impossible missions with real stunts, global chases and zero margin for error." },
            { t: "Interstellar", w: "Interstellar (film)", y: "2014", u: imdb("tt0816692"),
              d: "Explorers travel through a wormhole in search of a new home for humanity as Earth runs out of time." },
            { t: "The Wolf of Wall Street", w: "The Wolf of Wall Street (2013 film)", y: "2013", u: imdb("tt0993846"),
              d: "The wild rise and fall of stockbroker Jordan Belfort, built on greed, excess and fraud." },
            { t: "A Quiet Place", w: "A Quiet Place", y: "2018", u: imdb("tt6644200"),
              d: "A family survives in total silence, because the creatures hunting them react to the slightest sound." },
            { t: "Shutter Island", w: "Shutter Island (film)", y: "2010", u: imdb("tt1130884"),
              d: "A U.S. Marshal investigates a patient's disappearance from an asylum island where nothing adds up." }
        ],
        tv: [
            { t: "The Mentalist", w: "The Mentalist", y: "2008–2015", u: imdb("tt1196946"),
              d: "A sharp-eyed former fake psychic uses observation and mind games to help the CBI catch killers." },
            { t: "The Blacklist", w: "The Blacklist (TV series)", y: "2013–2023", u: imdb("tt2741602"),
              d: "A notorious criminal surrenders to the FBI and offers to take down others, but only if he works with a rookie profiler." },
            { t: "Suits", w: "Suits (American TV series)", y: "2011–2019", u: imdb("tt1632701"),
              d: "A brilliant college dropout joins a top law firm alongside the lawyer who takes a chance on him." },
            { t: "The Walking Dead", w: "The Walking Dead (TV series)", y: "2010–2022", u: imdb("tt1520211"),
              d: "Survivors fight to stay alive, and stay human, in a world overrun by the dead." },
            { t: "FROM", w: "From (TV series)", y: "2022–", u: imdb("tt9813792"),
              d: "Residents of a town they can't leave survive the day and hide from terrifying creatures at night." }
        ],
        anime: [
            { t: "Naruto Shippuden", w: "Naruto: Shippuden", y: "2007–2017", u: mal(1735),
              d: "Naruto returns from training to protect his village and face the Akatsuki, still chasing his dream of becoming Hokage." },
            { t: "Jujutsu Kaisen", w: "Jujutsu Kaisen (TV series)", y: "2020–", u: mal(40748),
              d: "Yuji Itadori swallows a cursed finger and is pulled into a hidden world of sorcerers and curses." },
            { t: "Tomodachi Game", w: "Tomodachi Game", y: "2022", u: malQ("Tomodachi Game"),
              d: "Five close friends are forced into twisted psychological games to repay a debt, and trust is the first thing to break." },
            { t: "Solo Leveling", w: "Solo Leveling", y: "2024–", u: mal(52299),
              d: "The weakest hunter gets a second chance through a mysterious system that lets him level up without limits." },
            { t: "Black Clover", w: "Black Clover", y: "2017–2021", u: mal(34572),
              d: "Born without magic in a world full of it, Asta trains relentlessly to become the Wizard King." },
            { t: "Bleach", w: "Bleach (TV series)", y: "2004–2012", u: mal(269),
              d: "Ichigo becomes a Soul Reaper to protect the living from Hollows and guide lost souls." },
            { t: "Attack on Titan", w: "Attack on Titan", y: "2013–2023", u: mal(16498),
              d: "Humanity lives behind giant walls to survive man-eating Titans, until the walls fall." },
            { t: "Blue Lock", w: "Blue Lock", y: "2022–", u: mal(49596),
              d: "Hundreds of young strikers are locked in a brutal program to forge Japan's ultimate ego-driven striker." },
            { t: "Demon Slayer", w: "Demon Slayer: Kimetsu no Yaiba", y: "2019–", u: mal(38000),
              d: "Tanjiro joins the Demon Slayer Corps to cure his sister Nezuko and avenge his family." },
            { t: "Hell's Paradise", w: "Hell's Paradise: Jigokuraku", y: "2023–", u: mal(46569),
              d: "A condemned ninja seeks a pardon by finding the elixir of life on an island full of deadly monsters." },
            { t: "Hunter x Hunter", w: "Hunter × Hunter (2011 TV series)", y: "2011–2014", u: mal(11061),
              d: "Gon sets out to become a Hunter and find his father, meeting friends and dangers along the way." },
            { t: "Monster", w: "Monster (manga)", y: "2004–2005", u: mal(19),
              d: "A brilliant surgeon saves a boy's life, then spends years hunting the monster he let live." },
            { t: "Mushoku Tensei", w: "Mushoku Tensei", y: "2021–", u: mal(39535),
              d: "A reincarnated shut-in gets a second life in a magical world and vows to live without regrets." },
            { t: "The Seven Deadly Sins", w: "The Seven Deadly Sins (manga)", y: "2014–2021", u: mal(23755),
              d: "Princess Elizabeth searches for the legendary knights known as the Seven Deadly Sins to save her kingdom." }
        ],
        game: [
            { t: "Resident Evil Requiem", w: "Resident Evil Requiem", y: "2026", u: steamQ("Resident Evil Requiem"),
              d: "The latest chapter of Capcom's survival horror series, built on tension, scarce resources and terrifying encounters." },
            { t: "Dead by Daylight", w: "Dead by Daylight", y: "2016", u: steam(381210),
              d: "An asymmetric horror game where four survivors try to escape one relentless killer." },
            { t: "EA SPORTS FC 27", w: "EA Sports FC 27", y: "2026", u: steamQ("EA SPORTS FC 27"),
              d: "The latest edition of EA's football series with Ultimate Team, Career Mode and online matches." },
            { t: "The Outlast Trials", w: "The Outlast Trials", y: "2024", u: steam(1304930),
              d: "A co-op psychological horror game where test subjects survive twisted experiments." },
            { t: "Dying Light", w: "Dying Light", y: "2015", u: steam(239140),
              d: "Parkour by day, pure terror by night, in a zombie-filled city where the dark changes everything." }
        ]
    };

    const LABEL = { movie: "Movie", tv: "TV Show", anime: "Anime", game: "Game" };
    const SITE  = { movie: "IMDb", tv: "IMDb", anime: "MyAnimeList", game: "Steam" };
    const ICON = {
        movie: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 3v18M17 3v18M3 8h4M3 12h4M3 16h4M17 8h4M17 12h4M17 16h4"/></svg>',
        tv:    '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M17 2l-5 5-5-5"/></svg>',
        anime: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.2 5.8L20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2z"/></svg>',
        game:  '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="6" width="20" height="12" rx="4"/><path d="M6 12h4M8 10v4"/><circle class="f" cx="15.5" cy="11" r="1"/><circle class="f" cx="18" cy="13.2" r="1"/></svg>'
    };

    /* ---------- Posters ----------
       Order tried for every card (first one that actually loads wins):
       1. it.img (explicit URL)   2. img/posters/<slug>.jpg (your own file)
       3. Steam art (games with an app id)   4. Jikan / MyAnimeList (anime)
       5. Wikipedia, exact page title (it.w)  6. Wikipedia search
       Drop your own image in img/posters/ to override any of them. */
    const CACHE_VERSION = "v6";
    const cache = {
        get: (k) => { try { return localStorage.getItem(`poster:${CACHE_VERSION}:${k}`); } catch (e) { return null; } },
        set: (k, v) => { try { localStorage.setItem(`poster:${CACHE_VERSION}:${k}`, v); } catch (e) {} },
        del: (k) => { try { localStorage.removeItem(`poster:${CACHE_VERSION}:${k}`); } catch (e) {} }
    };
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const getJSON = async (url, ms = 7000) => {
        const ctl = new AbortController();
        const timer = setTimeout(() => ctl.abort(), ms);
        try {
            const r = await fetch(url, { signal: ctl.signal });
            if (!r.ok) throw new Error(r.status);
            return await r.json();
        } finally { clearTimeout(timer); }
    };
    const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

    // Resolves true only if the image really loads (a URL that 404s counts as a miss).
    const loads = (url) => new Promise((ok) => {
        const i = new Image();
        const t = setTimeout(() => ok(false), 10000);
        i.onload = () => { clearTimeout(t); ok(i.naturalWidth > 1); };
        i.onerror = () => { clearTimeout(t); ok(false); };
        i.src = url;
    });

    // Jikan (MyAnimeList) — rate-limited, so calls are queued. Retries once on 429.
    let jikanQueue = Promise.resolve();
    function jikanPoster(it) {
        const id = (it.u.match(/\/anime\/(\d+)/) || [])[1];
        const run = async () => {
            for (let attempt = 0; attempt < 2; attempt++) {
                await wait(attempt ? 1200 : 400);
                try {
                    const j = id
                        ? await getJSON(`https://api.jikan.moe/v4/anime/${id}`, 15000)
                        : await getJSON(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(it.t)}&limit=1&order_by=popularity`, 15000);
                    const d = Array.isArray(j.data) ? j.data[0] : j.data;
                    const im = d && d.images && d.images.jpg;
                    return im && (im.large_image_url || im.image_url) || null;
                } catch (e) { /* retry, then give up */ }
            }
            return null;
        };
        const p = jikanQueue.then(run);
        jikanQueue = p.catch(() => null);
        return p;
    }

    const WIKI = "https://en.wikipedia.org/w/api.php?action=query&prop=pageimages&piprop=thumbnail&pithumbsize=600&format=json&origin=*";
    const thumbs = (data) => Object.values((data.query && data.query.pages) || {})
        .filter((p) => p.thumbnail && p.thumbnail.source && !/\.svg/i.test(p.thumbnail.source));

    // Exact page title -> deterministic, no wrong-page guessing.
    async function wikiExact(title) {
        try {
            const data = await getJSON(`${WIKI}&redirects=1&titles=${encodeURIComponent(title)}`);
            const t = thumbs(data);
            return t.length ? t[0].thumbnail.source : null;
        } catch (e) { return null; }
    }

    // Search fallback (ranked by how closely the page title matches).
    async function wikiSearch(title, type, year) {
        const hint = { movie: "film", tv: "television series", game: "video game", anime: "anime" }[type] || "";
        const yr = year ? (String(year).match(/\d{4}/) || [])[0] : null;
        const q = [title, yr, hint].filter(Boolean).join(" ");
        let data;
        try { data = await getJSON(`${WIKI}&generator=search&gsrlimit=5&gsrsearch=${encodeURIComponent(q)}`); }
        catch (e) { return null; }
        const want = norm(title);
        const rank = (n) => n === want ? 0 : n.startsWith(want + " ") ? 1 : n.startsWith(want) ? 2 : n.includes(want) ? 3 : 4;
        const c = thumbs(data).sort((a, b) => rank(norm(a.title)) - rank(norm(b.title)) || (a.index || 0) - (b.index || 0));
        return c.length ? c[0].thumbnail.source : null;
    }

    // Returns the first working poster URL for an item, or null.
    async function findPoster(type, it) {
        const key = type + ":" + it.t;
        const hit = cache.get(key);
        if (hit) { if (await loads(hit)) return hit; cache.del(key); }

        const found = async (url) => { if (url && await loads(url)) { cache.set(key, url); return url; } return null; };
        let url = null;

        if (type === "game") {
            const id = (it.u.match(/\/app\/(\d+)/) || [])[1];
            if (id) {
                for (const u of [
                    `https://cdn.cloudflare.steamstatic.com/steam/apps/${id}/library_600x900.jpg`,
                    `https://cdn.akamai.steamstatic.com/steam/apps/${id}/library_600x900.jpg`,
                    `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${id}/library_600x900.jpg`,
                    `https://cdn.cloudflare.steamstatic.com/steam/apps/${id}/header.jpg`
                ]) { if ((url = await found(u))) return url; }
            }
        }
        // Anime: MyAnimeList only (exact by id). Wikipedia guesses were picking wrong pages.
        if (type === "anime") {
            if ((url = await found(await jikanPoster(it)))) return url;
        } else if (it.w && (url = await found(await wikiExact(it.w)))) return url;
        console.warn("[posters] no poster found for", it.t);
        return null;
    }

    const slug = (s) => s.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

    const io = "IntersectionObserver" in window
        ? new IntersectionObserver((entries) => {
            entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
        }, { threshold: 0.12 })
        : null;

    function card(type, it) {
        const el = document.createElement("article");
        el.className = "pcard reveal";
        el.tabIndex = 0;
        el.setAttribute("role", "button");
        el.setAttribute("aria-expanded", "false");
        el.setAttribute("aria-label", `${it.t}: show description`);

        const src = it.img || `img/posters/${slug(it.t)}.jpg`;
        el.innerHTML =
            `<img class="poster" alt="" loading="lazy" draggable="false">` +
            `<span class="ghost" aria-hidden="true">${it.t}</span>` +
            `<div class="shade"></div>` +
            `<div class="pills">` +
                `<span class="pill pill-type">${ICON[type]}${LABEL[type]}</span>` +
                `<span class="pill">${it.y}</span>` +
            `</div>` +
            `<div class="body">` +
                `<h4 class="title">${it.t}</h4>` +
                `<span class="bar"></span>` +
                `<p class="desc">${it.d}</p>` +
                `<div class="foot">` +
                    `<a class="vlink" href="${it.u}" target="_blank" rel="noopener noreferrer">View on ${SITE[type]}<i>↗</i></a>` +
                    `<span class="more" aria-hidden="true">Info +</span>` +
                `</div>` +
            `</div>`;

        const img = el.querySelector(".poster");
        (async () => {
            const candidates = [it.img, `img/posters/${slug(it.t)}.jpg`].filter(Boolean);
            const done = (u) => { img.addEventListener("load", () => el.classList.remove("no-poster"), { once: true }); img.src = u; };
            el.classList.add("no-poster");
            for (const u of candidates) { if (await loads(u)) { done(u); return; } }
            const url = await findPoster(type, it);
            if (url) { done(url); return; }
            img.remove();
        })();

        const more = el.querySelector(".more");
        const toggle = () => {
            const open = el.classList.toggle("open");
            el.setAttribute("aria-expanded", String(open));
            more.textContent = open ? "Info −" : "Info +";
        };
        const canHover = window.matchMedia("(hover: hover)");
        el.addEventListener("click", (e) => { if (e.target.closest("a") || canHover.matches) return; toggle(); });
        el.addEventListener("keydown", (e) => {
            if (e.target !== el) return;
            if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
        });

        if (io) io.observe(el); else el.classList.add("in");
        return el;
    }

    function fill(id, type) {
        const host = document.getElementById(id);
        if (!host) return;
        DATA[type].forEach((it) => host.appendChild(card(type, it)));
    }

    fill("fav-movies", "movie");
    fill("fav-tv", "tv");
    fill("fav-anime", "anime");
    fill("fav-games", "game");

    /* ---------------- Scroll arrow ---------------- */
    const cue = document.getElementById("scroll-cue");
    const about = document.getElementById("about");
    if (cue && about) {
        cue.addEventListener("click", (e) => {
            e.preventDefault();
            about.scrollIntoView({ behavior: "smooth", block: "start" });
            history.replaceState(null, "", "#about");
        });
    }
})();
// Visitor counter: counts each browser once, then just shows the total.
// Uses the free Abacus API (no account). Change COUNTER_NS if you ever want to start from zero.
(function visitCounter() {
    const COUNTER_NS = "vanitas-couldbeyuu-profile";
    const COUNTER_KEY = "visits";
    const box = $("visits"), num = $("visits-count");
    if (!box || !num) return;

    let counted = false;
    try { counted = localStorage.getItem("visited:" + COUNTER_NS) === "1"; } catch (e) {}

    const url = `https://abacus.jasoncameron.dev/${counted ? "get" : "hit"}/${COUNTER_NS}/${COUNTER_KEY}`;
    fetch(url)
        .then((r) => r.json())
        .then((d) => {
            if (typeof d.value !== "number") throw new Error("no value");
            num.textContent = d.value.toLocaleString();
            box.hidden = false;
            if (!counted) { try { localStorage.setItem("visited:" + COUNTER_NS, "1"); } catch (e) {} }
        })
        .catch(() => { box.hidden = true; });   // service down or blocked: just hide the badge
})();

// Like button: one like per browser (stored locally), total kept on the free Abacus counter.
// Note: the public counter can only go up, so a like can't be taken back.
(function likeButton() {
    const NS = "vanitas-couldbeyuu-profile", KEY = "likes";
    const btn = $("like-btn"), num = $("likes-count");
    if (!btn || !num) return;

    const base = `https://abacus.jasoncameron.dev`;
    const store = {
        get() { try { return localStorage.getItem("liked:" + NS) === "1"; } catch (e) { return false; } },
        set() { try { localStorage.setItem("liked:" + NS, "1"); } catch (e) {} }
    };
    let liked = store.get(), count = 0;

    const paint = () => {
        num.textContent = count.toLocaleString();
        btn.classList.toggle("liked", liked);
        btn.setAttribute("aria-pressed", String(liked));
        btn.title = liked ? "You liked this profile" : "Like this profile";
    };

    const burst = () => {
        if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        for (let i = 0; i < 7; i++) {
            const h = el("span", "heart-pop", "♥");
            h.style.setProperty("--dx", `${Math.round((Math.random() - 0.5) * 70)}px`);
            h.style.setProperty("--dy", `${-30 - Math.round(Math.random() * 40)}px`);
            h.style.setProperty("--d", `${Math.round(Math.random() * 120)}ms`);
            btn.append(h);
            setTimeout(() => h.remove(), 1000);
        }
    };

    fetch(`${base}/get/${NS}/${KEY}`)
        .then((r) => r.status === 404 ? { value: 0 } : r.json())
        .then((d) => {
            if (typeof d.value !== "number") throw new Error("no value");
            count = d.value;
            paint();
            btn.hidden = false;
        })
        .catch(() => { btn.hidden = true; });

    btn.addEventListener("click", () => {
        if (liked) return;
        liked = true;
        count += 1;                       // show it instantly, then confirm with the server
        store.set();
        paint();
        burst();
        fetch(`${base}/hit/${NS}/${KEY}`)
            .then((r) => r.json())
            .then((d) => { if (typeof d.value === "number") { count = d.value; paint(); } })
            .catch(() => {});
    });
})();

// Draggable music player: grab it anywhere except the buttons/slider and move it where you like.
// Position is remembered; double-click the player to put it back in its original corner.
(function draggablePlayer() {
    const box = $("player");
    if (!box) return;
    const KEY = "player:pos", M = 8;
    const store = {
        get() { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } },
        set(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} },
        del() { try { localStorage.removeItem(KEY); } catch (e) {} }
    };

    const place = (x, y) => {
        const r = box.getBoundingClientRect();
        x = Math.min(Math.max(M, x), Math.max(M, innerWidth - r.width - M));
        y = Math.min(Math.max(M, y), Math.max(M, innerHeight - r.height - M));
        box.style.left = x + "px";
        box.style.top = y + "px";
        return { x, y };
    };

    const saved = store.get();
    if (saved && isFinite(saved.x) && isFinite(saved.y)) place(saved.x, saved.y);

    // keep it on screen when the window shrinks or the player changes size (minimize/expand)
    const keepInView = () => {
        if (!box.style.left) return;
        const r = box.getBoundingClientRect();
        place(r.left, r.top);
    };
    addEventListener("resize", keepInView);
    if ("ResizeObserver" in window) new ResizeObserver(keepInView).observe(box);

    let dragging = false, dx = 0, dy = 0;
    box.addEventListener("pointerdown", (e) => {
        if (e.button !== 0 || e.target.closest("button, input, a")) return;
        const r = box.getBoundingClientRect();
        dx = e.clientX - r.left;
        dy = e.clientY - r.top;
        dragging = true;
        box.classList.add("dragging");
        box.setPointerCapture(e.pointerId);
        e.preventDefault();
    });
    box.addEventListener("pointermove", (e) => {
        if (dragging) place(e.clientX - dx, e.clientY - dy);
    });
    const stop = () => {
        if (!dragging) return;
        dragging = false;
        box.classList.remove("dragging");
        const r = box.getBoundingClientRect();
        store.set({ x: Math.round(r.left), y: Math.round(r.top) });
    };
    box.addEventListener("pointerup", stop);
    box.addEventListener("pointercancel", stop);

    box.addEventListener("dblclick", (e) => {
        if (e.target.closest("button, input, a")) return;
        box.style.left = "";
        box.style.top = "";
        store.del();
    });

    box.title = "Drag to move · double-click to reset";
})();


// Footer credit: types itself out once when it scrolls into view.
(function credit() {
    const root = $("footnote");
    if (!root || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    root.classList.add("armed");
    if (!("IntersectionObserver" in window)) { root.classList.add("in"); return; }
    const io = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) { root.classList.add("in"); io.disconnect(); }
    }, { threshold: 0.6 });
    io.observe(root);
})();

/* =========================================
   CUSTOM CURSOR
   Three layers: a dot that sits exactly on the pointer, a ring that
   eases behind it, and a fainter ghost ring trailing further back.
   The ring grows and pulls gently toward clickable elements.
   Skipped on touch devices and for reduced-motion users.
   ========================================= */
(function customCursor() {
    if (!matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const dot   = document.createElement("div");
    const ring  = document.createElement("div");
    const ghost = document.createElement("div");
    const label = document.createElement("div");
    dot.className   = "cursor-dot";
    ring.className  = "cursor-ring";
    ghost.className = "cursor-ghost";
    label.className = "cursor-label";
    document.body.append(ghost, ring, dot, label);

    let mx = -200, my = -200;      // pointer target
    let rx = -200, ry = -200;      // ring  (eases behind)
    let gx = -200, gy = -200;      // ghost (eases further behind)
    let ready = false;

    // Magnetic pull toward interactive element centers
    let pullX = 0, pullY = 0, targetEl = null;
    const recomputePull = () => {
        if (!targetEl) { pullX = 0; pullY = 0; return; }
        const r = targetEl.getBoundingClientRect();
        const cx = r.left + r.width  / 2;
        const cy = r.top  + r.height / 2;
        pullX = Math.max(-10, Math.min(10, (cx - mx) * 0.22));
        pullY = Math.max(-10, Math.min(10, (cy - my) * 0.22));
    };

    window.addEventListener("pointermove", (e) => {
        if (e.pointerType === "touch") return;
        mx = e.clientX;
        my = e.clientY;
        if (!ready) {
            ready = true;
            rx = mx; ry = my;
            gx = mx; gy = my;
            document.body.classList.add("cursor-ready");
        }
        recomputePull();
    }, { passive: true });

    // Animation loop
    (function loop() {
        rx += (mx + pullX - rx) * 0.24;
        ry += (my + pullY - ry) * 0.24;
        gx += (mx - gx) * 0.12;
        gy += (my - gy) * 0.12;
        dot.style.transform   = `translate3d(${mx}px, ${my}px, 0)`;
        ring.style.transform  = `translate3d(${rx}px, ${ry}px, 0)`;
        ghost.style.transform = `translate3d(${gx}px, ${gy}px, 0)`;
        label.style.transform = `translate3d(${mx}px, ${my}px, 0)`;
        requestAnimationFrame(loop);
    })();

    // Categorize element types for custom morphing & floating badge
    function getCursorMode(el) {
        if (!el || el === document.body || el === document.documentElement) return null;

        // 1. Text input / forms
        if (el.closest("textarea, input[type='text'], input:not([type]), [contenteditable='true']")) {
            return { mode: "mode-text", label: "" };
        }
        // 2. Lightbox / zoomable images
        if (el.closest(".zoomable, .lightbox-stage img, #banner-img, #avatar")) {
            return { mode: "mode-zoom", label: "Inspect ⌕" };
        }
        // 3. Media cards (Favorites, Posters)
        if (el.closest(".pcard")) {
            return { mode: "mode-card", label: "View Details" };
        }
        // 4. Music Player & Spotify controls
        if (el.closest(".player, #player, .pl-btn, .spotify-card, .lyrics-sync")) {
            if (el.closest("#pl-toggle, #pl-next, #pl-prev")) return { mode: "mode-music", label: "Track ♫" };
            return { mode: "mode-music", label: "Sound ♫" };
        }
        // 5. Social Pills with brand styling
        const social = el.closest(".socials a");
        if (social) {
            const brand = (social.dataset.brand || social.textContent).toLowerCase().trim();
            if (brand.includes("discord"))   return { mode: "mode-discord",   label: "Discord ✤" };
            if (brand.includes("spotify"))   return { mode: "mode-spotify",   label: "Spotify ♬" };
            if (brand.includes("instagram")) return { mode: "mode-instagram", label: "Instagram ✦" };
            if (brand.includes("tiktok"))    return { mode: "mode-tiktok",    label: "TikTok ♪" };
            if (brand.includes("github"))    return { mode: "mode-github",    label: "GitHub ⎇" };
            return { mode: "mode-link", label: "External ↗" };
        }
        // 6. Like button
        if (el.closest(".like-btn")) {
            return { mode: "mode-link", label: "Love ♥" };
        }
        // 7. Clan tag server popover
        if (el.closest(".clan-tag, .popover-btn")) {
            return { mode: "mode-discord", label: "Server ✤" };
        }
        // 8. General buttons / links
        if (el.closest("a, button, [role='button'], .btn, .gb-post, .gb-signin, .gb-del")) {
            return { mode: "mode-link", label: "" };
        }
        return null;
    }

    const ALL_MODES = [
        "mode-link", "mode-music", "mode-card", "mode-text", "mode-zoom",
        "mode-discord", "mode-spotify", "mode-instagram", "mode-tiktok", "mode-github"
    ];

    document.addEventListener("pointerover", (e) => {
        if (e.pointerType === "touch") return;
        const target = e.target;
        if (!target || target.nodeType !== 1) return;

        const info = getCursorMode(target);
        if (info) {
            targetEl = target;
            ALL_MODES.forEach((m) => {
                ring.classList.remove(m);
                dot.classList.remove(m);
                ghost.classList.remove(m);
                label.classList.remove(m);
            });
            ring.classList.add(info.mode);
            dot.classList.add(info.mode);
            ghost.classList.add(info.mode);
            label.classList.add(info.mode);

            if (info.label) {
                label.textContent = info.label;
                label.style.opacity = "1";
            } else {
                label.style.opacity = "0";
            }
            recomputePull();
        } else {
            targetEl = null;
            ALL_MODES.forEach((m) => {
                ring.classList.remove(m);
                dot.classList.remove(m);
                ghost.classList.remove(m);
                label.classList.remove(m);
            });
            label.style.opacity = "0";
            pullX = 0; pullY = 0;
        }
    }, { passive: true });

    // Pressed state
    window.addEventListener("pointerdown", () => {
        dot.classList.add("is-down");
        ring.classList.add("is-down");
        ghost.classList.add("is-down");
    });
    const release = () => {
        dot.classList.remove("is-down");
        ring.classList.remove("is-down");
        ghost.classList.remove("is-down");
    };
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    window.addEventListener("blur", release);

    // Hide when leaving viewport
    document.addEventListener("mouseleave", () => {
        document.body.classList.remove("cursor-ready");
        label.style.opacity = "0";
    });
    document.addEventListener("mouseenter", () => {
        if (ready) document.body.classList.add("cursor-ready");
    });
})();
