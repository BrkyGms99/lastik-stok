/* Ortak kayıt katmanı: Supabase üzerinde tek bir "records" tablosu kullanır.
   Sayfadaki kod collection(...).doc(...).set/delete ve onSnapshot ile konuşur. */
(function () {
  var cfg = window.LASTIK_CONFIG || {};
  var sb = null, mail = "", queries = [];

  function ready() {
    return !!(window.supabase && cfg.url && cfg.key && cfg.url.indexOf("PROJE") < 0 && cfg.key.indexOf("ANON") < 0);
  }

  function werr(e) {
    var x = new Error(e.message || "hata");
    x.code = (e.code === "42501" || /row-level security/i.test(e.message || "")) ? "invalid_argument" : (e.code || "error");
    throw x;
  }

  function loginUI() {
    return new Promise(function (resolve) {
      var box = document.getElementById("login");
      var form = document.getElementById("lf");
      var msg = document.getElementById("lm");
      box.hidden = false;
      form.onsubmit = async function (ev) {
        ev.preventDefault();
        msg.textContent = "";
        var r;
        try {
          r = await sb.auth.signInWithPassword({
            email: document.getElementById("le").value.trim(),
            password: document.getElementById("lp").value
          });
        } catch (e) {
          msg.textContent = "Bağlantı kurulamadı. İnternetini kontrol et.";
          return;
        }
        if (r.error) { msg.textContent = "E-posta veya şifre yanlış."; return; }
        box.hidden = true;
        resolve(r.data.session);
      };
    });
  }

  function Query(coll, field, val) {
    this.coll = coll; this.field = field || null; this.val = val;
    this.cache = {}; this.cb = null; this.err = null;
  }
  Query.prototype.match = function (d) {
    return !this.field || String(d && d[this.field]) === String(this.val);
  };
  Query.prototype.emit = function () {
    var self = this;
    if (!this.cb) return;
    var list = Object.keys(this.cache).map(function (k) { return self.cache[k]; });
    this.cb({
      docs: list.map(function (d) { return { data: function () { return d; } }; }),
      metadata: { fromCache: false }
    });
  };
  Query.prototype.load = function () {
    var self = this;
    var q = sb.from("records").select("id,data").eq("coll", this.coll);
    if (this.field) q = q.eq("data->>" + this.field, String(this.val));
    return q.then(function (r) {
      if (r.error) { if (self.err) self.err({ code: r.error.code || "error" }); return; }
      self.cache = {};
      (r.data || []).forEach(function (row) { self.cache[row.id] = row.data; });
      self.emit();
    }, function () {
      if (self.err) self.err({ code: "network" });
    });
  };
  Query.prototype.onSnapshot = function (cb, err) {
    var self = this;
    this.cb = cb; this.err = err || null;
    queries.push(this);
    this.load();
    return function () { queries = queries.filter(function (q) { return q !== self; }); };
  };

  function route(p) {
    var row = (p.new && p.new.coll) ? p.new : p.old;
    if (!row || !row.coll) return;
    queries.forEach(function (q) {
      if (q.coll !== row.coll) return;
      if (p.eventType === "DELETE") { delete q.cache[row.id]; q.emit(); return; }
      if (q.match(row.data)) q.cache[row.id] = row.data; else delete q.cache[row.id];
      q.emit();
    });
  }

  function collection(name) {
    return {
      doc: function (id) {
        return {
          set: async function (data) {
            var r = await sb.from("records").upsert({ coll: name, id: id, data: data }, { onConflict: "coll,id" });
            if (r.error) werr(r.error);
            route({ eventType: "UPDATE", new: { coll: name, id: id, data: data } });
          },
          delete: async function () {
            var r = await sb.from("records").delete().eq("coll", name).eq("id", id);
            if (r.error) werr(r.error);
            route({ eventType: "DELETE", old: { coll: name, id: id } });
          }
        };
      },
      where: function (field, op, val) { return new Query(name, field, val); },
      onSnapshot: function (cb, err) { return new Query(name).onSnapshot(cb, err); }
    };
  }

  async function init() {
    if (!ready()) return null;
    sb = window.supabase.createClient(cfg.url, cfg.key, { auth: { persistSession: true, autoRefreshToken: true } });
    var s = (await sb.auth.getSession()).data.session;
    if (!s) s = await loginUI();
    mail = (s.user && s.user.email) || "";
    sb.channel("records-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "records" }, route)
      .subscribe();
    /* Telefon uyuyunca canlı bağlantı kopabilir: uygulamaya dönünce listeyi tazele. */
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) queries.forEach(function (q) { q.load(); });
    });
    return { collection: collection };
  }

  async function signOut() {
    try { await sb.auth.signOut(); } catch (e) {}
    location.reload();
  }

  async function scan(b64) {
    var r = await sb.functions.invoke("scan-tire", { body: { image: b64, media_type: "image/jpeg" } });
    if (r.error) {
      var x = new Error(r.error.message || "hata");
      x.status = r.error.context && r.error.context.status;
      throw x;
    }
    return r.data;
  }

  window.Store = { init: init, email: function () { return mail; }, signOut: signOut, scan: scan };
})();
