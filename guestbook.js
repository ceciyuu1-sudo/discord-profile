/* =====================================================================
   GUESTBOOK  (Discord login + Supabase)
   1) Run guestbook.sql in Supabase.
   2) Paste your project URL and anon key below (both are safe to publish:
      the database rules in guestbook.sql are what protect your data).
   Until you do, the guestbook section stays hidden.
   ===================================================================== */
(function guestbook() {
    "use strict";

    const GB = {
    url: "https://glopomvarxkhqbxzmbun.supabase.co",
    anonKey: "paste-your-anon-key-here",
        pageSize: 12,
        maxLength: 200
    };

    const root = document.getElementById("guestbook");
    if (!root) return;
    if (!window.supabase || /YOUR-/.test(GB.url + GB.anonKey)) { root.hidden = true; return; }

    const sb = window.supabase.createClient(GB.url, GB.anonKey, {
        auth: { flowType: "pkce", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });

    const composeBox = document.getElementById("gb-compose");
    const wall = document.getElementById("gb-wall");
    const moreBtn = document.getElementById("gb-more");
    const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const DEFAULT_AVATAR = "https://cdn.discordapp.com/embed/avatars/0.png";

    let session = null;
    let userId = null;
    let offset = 0;
    let loading = false;
    let booted = false;

    /* ---------- helpers ---------- */
    function h(tag, cls, text) {
        const n = document.createElement(tag);
        if (cls) n.className = cls;
        if (text != null) n.textContent = text;
        return n;
    }

    function avatarImg(src, cls) {
        const img = h("img", cls);
        img.alt = "";
        img.width = 38; img.height = 38;
        img.loading = "lazy";
        img.referrerPolicy = "no-referrer";
        img.addEventListener("error", () => { img.src = DEFAULT_AVATAR; }, { once: true });
        img.src = src || DEFAULT_AVATAR;
        return img;
    }

    const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
    function timeAgo(iso) {
        const s = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
        const steps = [[60, "second"], [60, "minute"], [24, "hour"], [7, "day"], [4.345, "week"], [12, "month"], [Infinity, "year"]];
        let v = s;
        for (const [size, unit] of steps) {
            if (Math.abs(v) < size) return rtf.format(Math.round(v), unit);
            v /= size;
        }
        return "";
    }

    function errorText(err) {
        const m = (err && err.message) || "";
        if (m.includes("gb:blocked")) return "That message has words this wall doesn't allow. Reword it and post again.";
        if (m.includes("gb:name"))    return "Your Discord display name isn't allowed here. Change it on Discord, then sign in again.";
        if (m.includes("gb:links"))   return "Links aren't allowed on the wall. Remove the link and post again.";
        if (m.includes("gb:rate"))    return "You've posted 3 messages in the last hour. Try again later.";
        if (m.includes("gb:banned"))  return "This account can't post on the wall.";
        if (m.includes("gb:short"))   return "Write at least 2 characters.";
        if (m.includes("gb:long"))    return `Keep it under ${GB.maxLength} characters.`;
        if (m.includes("gb:auth"))    return "Sign in with Discord to post.";
        return "The message wasn't sent. Check your connection and try again.";
    }

    /* ---------- sign in / out ---------- */
    function signIn() {
        try { sessionStorage.setItem("gb:return", "1"); } catch (e) {}
        sb.auth.signInWithOAuth({
            provider: "discord",
            options: { redirectTo: location.origin + location.pathname }
        });
    }
    function signOut() { sb.auth.signOut(); }

    /* ---------- compose area ---------- */
    const SVG_NS = "http://www.w3.org/2000/svg";
    const RING_C = 2 * Math.PI * 11;

    function makeRing() {
        const svg = document.createElementNS(SVG_NS, "svg");
        svg.setAttribute("viewBox", "0 0 28 28");
        svg.setAttribute("class", "gb-ring");
        svg.setAttribute("aria-hidden", "true");
        const bg = document.createElementNS(SVG_NS, "circle");
        bg.setAttribute("class", "bg"); bg.setAttribute("cx", 14); bg.setAttribute("cy", 14); bg.setAttribute("r", 11);
        const fg = document.createElementNS(SVG_NS, "circle");
        fg.setAttribute("class", "fg"); fg.setAttribute("cx", 14); fg.setAttribute("cy", 14); fg.setAttribute("r", 11);
        fg.style.strokeDasharray = RING_C;
        fg.style.strokeDashoffset = RING_C;
        const txt = document.createElementNS(SVG_NS, "text");
        txt.setAttribute("x", 14); txt.setAttribute("y", 14);
        svg.append(bg, fg, txt);
        return { svg, fg, txt };
    }

    function renderCompose() {
        composeBox.replaceChildren();

        if (!session) {
            const gate = h("div", "gb-card gb-gate");
            const text = h("div", "gb-gate-text");
            text.append(
                h("p", "gb-gate-title", "Sign the wall"),
                h("p", "gb-gate-sub", "Log in with Discord so your name and picture appear next to your message.")
            );
            const btn = h("button", "gb-signin", "Sign in with Discord");
            btn.type = "button";
            btn.addEventListener("click", signIn);
            gate.append(text, btn);
            composeBox.append(gate);
            return;
        }

        const meta = session.user.user_metadata || {};
        const name = (meta.custom_claims && meta.custom_claims.global_name) || meta.full_name || meta.name || "You";

        const form = h("form", "gb-card gb-form");
        form.noValidate = true;

        const who = h("div", "gb-who");
        const ava = avatarImg(meta.avatar_url, "gb-ava");
        ava.width = 30; ava.height = 30;
        const nameEl = h("span", "gb-name", name);
        const out = h("button", "gb-link", "Sign out");
        out.type = "button";
        out.addEventListener("click", signOut);
        who.append(ava, nameEl, out);

        const label = h("label", "gb-sr", "Your message");
        label.htmlFor = "gb-text";
        const ta = h("textarea", "gb-text");
        ta.id = "gb-text";
        ta.rows = 3;
        ta.maxLength = GB.maxLength;
        ta.placeholder = "Leave a line on the wall…";

        const bar = h("div", "gb-bar");
        const status = h("p", "gb-status");
        status.setAttribute("role", "status");
        const ring = makeRing();
        const post = h("button", "gb-post", "Post");
        post.type = "submit";
        post.disabled = true;
        bar.append(status, ring.svg, post);

        const stamp = h("span", "gb-stamp", "✤");
        stamp.setAttribute("aria-hidden", "true");

        form.append(who, label, ta, bar, stamp);
        composeBox.append(form);

        const setStatus = (msg, kind) => { status.textContent = msg || ""; status.className = "gb-status" + (kind ? " " + kind : ""); };

        const paint = () => {
            const used = ta.value.length;
            const left = GB.maxLength - used;
            ring.fg.style.strokeDashoffset = RING_C * (1 - used / GB.maxLength);
            ring.svg.classList.toggle("warn", left <= 30 && left > 10);
            ring.svg.classList.toggle("max", left <= 10);
            ring.txt.textContent = left <= 30 ? String(left) : "";
            post.disabled = ta.value.trim().length < 2;
        };
        ta.addEventListener("input", () => { paint(); if (status.classList.contains("err")) setStatus(""); });
        ta.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !post.disabled) form.requestSubmit();
        });
        paint();

        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const message = ta.value.trim();
            if (message.length < 2) return;
            post.disabled = true; ta.readOnly = true;
            setStatus("Sending…");

            const { data, error } = await sb.from("guestbook").insert({ message }).select().single();

            ta.readOnly = false;
            if (error) {
                setStatus(errorText(error), "err");
                paint();
                return;
            }
            ta.value = "";
            paint();
            setStatus("Sent. It goes on the wall once it's approved.", "ok");
            if (!reduceMotion) { stamp.classList.remove("go"); void stamp.offsetWidth; stamp.classList.add("go"); }
            removeEmpty();
            insertNew(entry(data, true));
        });
    }

    /* ---------- wall ---------- */
    function entry(row, isNew) {
        const mine = !!userId && row.user_id === userId;
        const art = h("article", "gb-card gb-entry");
        if (row.pinned) art.classList.add("pinned");
        if (!row.approved) art.classList.add("pending");
        if (isNew) art.classList.add("gb-new");
        art.dataset.id = row.id;

        const head = h("header", "gb-entry-head");
        const who = h("div", "gb-entry-who");
        const time = h("time", null, timeAgo(row.created_at));
        time.dateTime = row.created_at;
        time.title = new Date(row.created_at).toLocaleString();
        who.append(h("span", "gb-entry-name", row.name || "Visitor"), time);
        head.append(avatarImg(row.avatar, "gb-ava"), who);

        const tools = h("div", "gb-tools");
        if (row.pinned) tools.append(h("span", "gb-pin", "✤ Pinned"));
        if (mine) {
            const del = h("button", "gb-del", "Delete");
            del.type = "button";
            del.setAttribute("aria-label", "Delete your message");
            let armed = null;
            del.addEventListener("click", async () => {
                if (!armed) {
                    del.textContent = "Sure?";
                    del.classList.add("sure");
                    armed = setTimeout(() => { armed = null; del.textContent = "Delete"; del.classList.remove("sure"); }, 3000);
                    return;
                }
                clearTimeout(armed);
                del.disabled = true;
                const { error } = await sb.from("guestbook").delete().eq("id", row.id);
                if (error) { del.disabled = false; del.textContent = "Try again"; armed = null; return; }
                art.classList.add("gb-gone");
                setTimeout(() => { art.remove(); if (!wall.children.length) showEmpty(); }, reduceMotion ? 0 : 260);
            });
            tools.append(del);
        }
        if (tools.children.length) head.append(tools);

        art.append(head, h("p", "gb-msg", row.message));
        if (!row.approved) art.append(h("p", "gb-state", "Waiting for approval. Only you can see this."));
        return art;
    }

    function insertNew(node) {
        const firstUnpinned = Array.from(wall.children).find((c) => !c.classList.contains("pinned"));
        wall.insertBefore(node, firstUnpinned || null);
    }

    function showEmpty() {
        const box = h("div", "gb-empty");
        box.append(h("p", "gb-empty-title", "The wall is empty"), h("p", null, "Be the first to leave a message."));
        wall.append(box);
    }
    function removeEmpty() { const e = wall.querySelector(".gb-empty"); if (e) e.remove(); }

    async function load(reset) {
        if (loading) return;
        loading = true;
        if (reset) { offset = 0; wall.replaceChildren(); moreBtn.hidden = true; }

        const { data, error } = await sb
            .from("guestbook")
            .select("id,user_id,name,avatar,message,pinned,approved,created_at")
            .order("pinned", { ascending: false })
            .order("created_at", { ascending: false })
            .range(offset, offset + GB.pageSize - 1);

        loading = false;
        if (error) {
            if (!wall.children.length) {
                const box = h("div", "gb-empty");
                box.append(h("p", "gb-empty-title", "Messages didn't load"), h("p", null, "Refresh the page to try again."));
                wall.append(box);
            }
            return;
        }
        if (reset && !data.length) { showEmpty(); return; }
        data.forEach((row) => wall.append(entry(row, false)));
        offset += data.length;
        moreBtn.hidden = data.length < GB.pageSize;
    }

    moreBtn.addEventListener("click", () => load(false));

    /* ---------- boot ---------- */
    function setSession(s) {
        const nextId = s && s.user ? s.user.id : null;
        const changed = nextId !== userId || !booted;
        booted = true;
        session = s;
        userId = nextId;
        renderCompose();
        if (changed) load(true);
    }

    sb.auth.getSession().then(({ data }) => {
        setSession(data.session);
        let back = false;
        try { back = sessionStorage.getItem("gb:return") === "1"; sessionStorage.removeItem("gb:return"); } catch (e) {}
        if (back && data.session) {
            if (/[?&]code=/.test(location.search)) history.replaceState(null, "", location.pathname + "#guestbook");
            root.scrollIntoView({ block: "start" });
        }
    });
    sb.auth.onAuthStateChange((_event, s) => setSession(s));
})();
