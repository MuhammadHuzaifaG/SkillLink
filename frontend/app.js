// Plain JS SPA-like logic: handles auth, skills listing, create skill, booking and realtime chat.
// Designed to work when served at / (nginx proxies /api & /socket.io to backend)
(() => {
  const API_BASE = "/api";
  const $ = (s) => document.querySelector(s);
  const qs = (s) => Array.from(document.querySelectorAll(s));

  // token helpers
  function setTokens({ accessToken, refreshToken }) {
    if (accessToken) localStorage.setItem("accessToken", accessToken);
    if (refreshToken) localStorage.setItem("refreshToken", refreshToken);
    renderAuthArea();
  }
  function getAccess() { return localStorage.getItem("accessToken"); }
  function getRefresh() { return localStorage.getItem("refreshToken"); }
  function clearTokens() { localStorage.removeItem("accessToken"); localStorage.removeItem("refreshToken"); renderAuthArea(); }

  async function apiFetch(path, opts = {}) {
    opts.headers = opts.headers || {};
    const token = getAccess();
    if (token) opts.headers["Authorization"] = `Bearer ${token}`;
    opts.headers["Content-Type"] = opts.headers["Content-Type"] || "application/json";
    try {
      const res = await fetch(API_BASE + path, opts);
      if (res.status === 401) {
        // try refresh once
        const refreshed = await tryRefresh();
        if (refreshed) {
          return apiFetch(path, opts);
        }
      }
      const txt = await res.text();
      let json = null;
      try { json = txt ? JSON.parse(txt) : {}; } catch (e) { json = { raw: txt }; }
      if (!res.ok) throw { status: res.status, body: json };
      return json;
    } catch (err) {
      throw err;
    }
  }

  async function tryRefresh() {
    const refreshToken = getRefresh();
    if (!refreshToken) return false;
    try {
      const res = await fetch(API_BASE + "/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) {
        clearTokens();
        return false;
      }
      const data = await res.json();
      setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
      return true;
    } catch {
      clearTokens();
      return false;
    }
  }

  // UI helpers
  function renderAuthArea() {
    const el = $("#auth-area");
    el.innerHTML = "";
    if (getAccess()) {
      const btnProfile = document.createElement("button");
      btnProfile.className = "btn btn-outline";
      btnProfile.textContent = "Profile";
      btnProfile.onclick = openProfile;
      const btnLogout = document.createElement("button");
      btnLogout.className = "btn";
      btnLogout.textContent = "Logout";
      btnLogout.onclick = async () => {
        // call logout to revoke refresh token
        const refreshToken = getRefresh();
        if (refreshToken) await fetch(API_BASE + "/auth/logout", { method: "POST", headers: { "Content-Type":"application/json" }, body: JSON.stringify({ refreshToken }) });
        clearTokens();
        renderSkills();
      };
      el.appendChild(btnProfile);
      el.appendChild(btnLogout);
    } else {
      const btnLogin = document.createElement("button");
      btnLogin.className = "btn";
      btnLogin.textContent = "Login / Sign up";
      btnLogin.onclick = openAuthModal;
      el.appendChild(btnLogin);
    }
  }

  // Modals
  const modal = $("#modal");
  function showModal(html) { modal.innerHTML = `<div class="panel">${html}</div>`; modal.classList.remove("hidden"); modal.querySelector(".panel").focus?.(); }
  function closeModal() { modal.classList.add("hidden"); modal.innerHTML = ""; }
  modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });

  // Auth
  function openAuthModal() {
    showModal(`
      <div style="display:flex;gap:12px;align-items:center;justify-content:space-between;margin-bottom:8px">
        <h3>Login or Sign up</h3><button id="close-auth" class="btn btn-outline">Close</button>
      </div>
      <div class="row">
        <div style="flex:1">
          <h4>Login</h4>
          <div class="form-row">
            <input id="login-email" placeholder="Email" value="alice@example.com" />
            <input id="login-password" type="password" placeholder="Password" value="password123" />
            <button id="login-submit" class="btn">Login</button>
          </div>
        </div>
        <div style="flex:1">
          <h4>Sign up</h4>
          <div class="form-row">
            <input id="su-name" placeholder="Full name" value="New Student" />
            <input id="su-email" placeholder="Email" />
            <input id="su-password" type="password" placeholder="Password (8+ chars)" />
            <textarea id="su-bio" placeholder="Short bio (optional)"></textarea>
            <button id="signup-submit" class="btn">Create account</button>
          </div>
        </div>
      </div>
    `);
    $("#close-auth").onclick = closeModal;
    $("#login-submit").onclick = async () => {
      const email = $("#login-email").value.trim();
      const password = $("#login-password").value;
      try {
        const data = await fetch(API_BASE + "/auth/login", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        }).then(r => r.json());
        if (data.error) return alert("Login failed: " + JSON.stringify(data));
        setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
        closeModal();
        renderAuthArea();
        renderSkills();
      } catch (e) { alert("Login error"); }
    };
    $("#signup-submit").onclick = async () => {
      const name = $("#su-name").value.trim();
      const email = $("#su-email").value.trim();
      const password = $("#su-password").value;
      const bio = $("#su-bio").value.trim();
      try {
        const data = await fetch(API_BASE + "/auth/signup", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password, bio }),
        }).then(r => r.json());
        if (data.error) return alert("Signup failed: " + JSON.stringify(data));
        setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
        closeModal();
        renderAuthArea();
        renderSkills();
      } catch (e) { alert("Signup error"); }
    };
  }

  async function openProfile() {
    try {
      const data = await apiFetch("/users/me");
      showModal(`
        <div style="display:flex;justify-content:space-between;align-items:center">
          <h3>Profile</h3><button id="close-profile" class="btn btn-outline">Close</button>
        </div>
        <div class="form-row">
          <label>Name</label><input id="profile-name" value="${escapeHtml(data.user.name)}" />
          <label>Bio</label><textarea id="profile-bio">${escapeHtml(data.user.bio || "")}</textarea>
          <div class="row">
            <button id="save-profile" class="btn">Save</button>
            <button id="del-tokens" class="btn btn-outline">Clear tokens</button>
          </div>
        </div>
      `);
      $("#close-profile").onclick = closeModal;
      $("#save-profile").onclick = async () => {
        const name = $("#profile-name").value.trim();
        const bio = $("#profile-bio").value.trim();
        try {
          const res = await apiFetch("/users/me", { method: "PUT", body: JSON.stringify({ name, bio }) });
          alert("Saved");
          closeModal();
          renderSkills();
        } catch (e) { alert("Save failed"); }
      };
      $("#del-tokens").onclick = () => { clearTokens(); closeModal(); renderSkills(); };
    } catch {
      alert("Not authenticated");
      clearTokens();
      renderAuthArea();
    }
  }

  // Skills
  async function fetchSkills(q = "", tag = "") {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (tag) params.set("tag", tag);
    const data = await apiFetch("/skills?" + params.toString());
    return data;
  }

  function formatCurrency(cents) { return "$" + (cents/100).toFixed(2); }
  function escapeHtml(s){ return String(s||"").replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

  async function renderSkills() {
    const q = $("#search").value;
    const tag = $("#filter-tag").value;
    const container = $("#skills-grid");
    container.innerHTML = "<div class='small'>Loading...</div>";
    try {
      const data = await fetchSkills(q, tag);
      const items = data.items || [];
      container.innerHTML = items.map(s => `
        <div class="card">
          <div>
            <h3>${escapeHtml(s.title)}</h3>
            <div class="meta">${escapeHtml(s.description.slice(0,140))}${s.description.length>140?"…":""}</div>
            <div class="small">By ${escapeHtml(s.owner.name)} • <span class="badge">${formatCurrency(s.priceCents)}</span></div>
          </div>
          <div class="actions">
            <button class="btn btn-outline btn-view" data-id="${s.id}">View</button>
            <button class="btn btn-outline btn-book" data-id="${s.id}">Quick book</button>
          </div>
        </div>
      `).join("");
      // attach listeners
      qs(".btn-view").forEach(b => b.onclick = (e) => openSkillDetail(e.target.dataset.id));
      qs(".btn-book").forEach(b => b.onclick = (e) => openQuickBooking(e.target.dataset.id));
      populateTags(items);
    } catch (err) {
      container.innerHTML = "<div class='small'>Failed to load skills</div>";
    }
  }

  function populateTags(skills) {
    const tagSet = new Set();
    skills.forEach(s => (s.tags||[]).forEach(t => tagSet.add(t)));
    const sel = $("#filter-tag");
    sel.innerHTML = '<option value="">All tags</option>' + Array.from(tagSet).map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join("");
  }

  // Create skill modal
  function openCreateSkill() {
    if (!getAccess()) { openAuthModal(); return; }
    showModal(`
      <div style="display:flex;justify-content:space-between;align-items:center">
        <h3>Create Skill</h3><button id="close-skill" class="btn btn-outline">Close</button>
      </div>
      <div class="form-row">
        <input id="sk-title" placeholder="Title (e.g. Intro to React 30m)" />
        <textarea id="sk-desc" placeholder="Description"></textarea>
        <input id="sk-tags" placeholder="Tags (comma separated)" />
        <div class="row">
          <input id="sk-price" placeholder="Price in cents (1000 = $10.00)" />
          <input id="sk-duration" placeholder="Duration (minutes)" />
        </div>
        <button id="sk-submit" class="btn">Create</button>
      </div>
    `);
    $("#close-skill").onclick = closeModal;
    $("#sk-submit").onclick = async () => {
      const title = $("#sk-title").value.trim();
      const description = $("#sk-desc").value.trim();
      const tags = $("#sk-tags").value.split(",").map(s=>s.trim()).filter(Boolean);
      const priceCents = Number($("#sk-price").value) || 0;
      const durationMin = Number($("#sk-duration").value) || 30;
      try {
        await apiFetch("/skills", { method: "POST", body: JSON.stringify({ title, description, tags, priceCents, durationMin }) });
        closeModal();
        renderSkills();
      } catch (e) {
        alert("Create failed: " + JSON.stringify(e));
      }
    };
  }

  // Quick booking helper
  async function openQuickBooking(skillId) {
    if (!getAccess()) { openAuthModal(); return; }
    showModal(`<h3>Quick Book</h3>
      <div class="form-row">
        <label>Start time (UTC)</label><input id="bk-start" type="datetime-local" />
        <label>Duration (min)</label><input id="bk-duration" type="number" value="30" />
        <div class="row">
          <button id="bk-submit" class="btn">Book</button><button id="bk-close" class="btn btn-outline">Close</button>
        </div>
      </div>`);
    $("#bk-close").onclick = closeModal;
    $("#bk-submit").onclick = async () => {
      const start = $("#bk-start").value;
      const duration = Number($("#bk-duration").value) || 30;
      if (!start) return alert("Choose start time");
      try {
        const booking = await apiFetch("/bookings", { method: "POST", body: JSON.stringify({ skillId, startAt: new Date(start).toISOString(), durationMin: duration }) });
        closeModal();
        alert("Booked! Booking id: " + booking.id);
        openChatForBooking(booking.id);
      } catch (err) {
        alert("Booking failed: " + JSON.stringify(err));
      }
    };
  }

  // Skill detail + chat
  let socket = null;
  function openSkillDetail(skillId) {
    showModal(`<div style="display:flex;justify-content:space-between;align-items:center">
      <h3>Skill</h3><button id="close-detail" class="btn btn-outline">Close</button>
    </div>
    <div id="skill-body"><div class="small">Loading...</div></div>`);
    $("#close-detail").onclick = closeModal;
    (async () => {
      try {
        const skill = await apiFetch("/skills/" + skillId);
        const body = document.getElementById("skill-body");
        body.innerHTML = `
          <h2>${escapeHtml(skill.title)}</h2>
          <p class="muted">${escapeHtml(skill.description)}</p>
          <div class="row" style="gap:12px;margin-bottom:12px">
            <div class="small">By ${escapeHtml(skill.owner.name)}</div>
            <div class="small badge">${formatCurrency(skill.priceCents)}</div>
            <div class="small">${skill.durationMin} min</div>
          </div>
          <div style="display:flex;gap:12px;flex-wrap:wrap">
            <button id="btn-create-booking" class="btn">Book this</button>
            <button id="btn-join-chat" class="btn btn-outline">Join demo chat</button>
          </div>
          <hr />
          <div id="reviews">
            <h4>Reviews</h4>
            ${ (skill.reviews||[]).map(r => `<div class="card small"><strong>${escapeHtml(r.reviewer.name)}</strong> — ${r.rating}/5<br/>${escapeHtml(r.comment||"")}</div>`).join("") }
          </div>
          <div id="chat-area" class="hidden">
            <h4>Chat</h4>
            <div class="chat">
              <div class="msgs" id="msgs"></div>
              <div class="input"><input id="msg-in" placeholder="Say hi..." /><button id="msg-send" class="btn">Send</button></div>
            </div>
          </div>
        `;
        $("#btn-create-booking").onclick = () => openQuickBooking(skillId);
        $("#btn-join-chat").onclick = async () => {
          // demo: create or use a "demo" booking room if not present — we rely on server permission checks.
          const bookingId = prompt("Enter booking id to join (or leave empty to use demo-room id)", "");
          const targetId = bookingId || "demo-booking";
          openChatForBooking(targetId);
        };
      } catch (e) {
        document.getElementById("skill-body").innerHTML = "<div class='small'>Failed to load</div>";
      }
    })();
  }

  // Chat
  function openChatForBooking(bookingId) {
    if (!getAccess()) { openAuthModal(); return; }
    // show chat area in modal if exists, else show a chat modal
    closeModal();
    showModal(`<div style="display:flex;justify-content:space-between;align-items:center">
      <h3>Chat — ${bookingId}</h3><button id="close-chat" class="btn btn-outline">Close</button>
    </div>
    <div class="chat panel">
      <div class="msgs" id="msgs"></div>
      <div class="input"><input id="msg-in" placeholder="Type a message" /><button id="msg-send" class="btn">Send</button></div>
    </div>`);
    $("#close-chat").onclick = () => { if (socket) socket.disconnect(); closeModal(); };
    connectSocketAndJoin(bookingId);
  }

  function renderMessages(msgs) {
    const box = $("#msgs");
    if (!box) return;
    box.innerHTML = msgs.map(m => `<div style="padding:6px;border-radius:8px;margin-bottom:6px;background:#f8fafc"><strong>${escapeHtml(m.senderId.substring(0,6))}</strong>: ${escapeHtml(m.content)}</div>`).join("");
    box.scrollTop = box.scrollHeight;
  }

  async function connectSocketAndJoin(bookingId) {
    const token = getAccess();
    if (!token) { openAuthModal(); return; }
    try {
      socket = io({ auth: { token } });
      socket.on("connect_error", (err) => { console.warn("socket error", err); alert("Socket error: " + (err.message || err)); });
      socket.emit("joinBooking", bookingId);
      socket.on("messages:history", (messages) => renderMessages(messages));
      socket.on("message", (m) => {
        const box = $("#msgs");
        if (!box) return;
        box.innerHTML += `<div style="padding:6px;border-radius:8px;margin-bottom:6px;background:#fff"><strong>${escapeHtml(m.senderId.substring(0,6))}</strong>: ${escapeHtml(m.content)}</div>`;
        box.scrollTop = box.scrollHeight;
      });
      $("#msg-send").onclick = () => {
        const input = $("#msg-in");
        const content = input.value.trim();
        if (!content) return;
        socket.emit("message", { bookingId, content });
        input.value = "";
      };
    } catch (err) {
      alert("Failed to connect to chat");
    }
  }

  // Bind global controls
  $("#search").addEventListener("input", debounce(() => renderSkills(), 350));
  $("#btn-new-skill").onclick = openCreateSkill;
  document.addEventListener("DOMContentLoaded", () => {
    renderAuthArea();
    renderSkills();
  });

  // small utilities
  function debounce(fn, t){ let id; return (...a)=>{ clearTimeout(id); id=setTimeout(()=>fn(...a),t); }; }
})();