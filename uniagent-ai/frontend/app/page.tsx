"use client";
import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "../lib/api";

type User = { id: number; name: string; email: string; role: string };
type View = "login" | "register";

const LETTERS: Record<string, string> = {
  aktif_kuliah: "Keterangan aktif kuliah",
  rekomendasi_beasiswa: "Rekomendasi beasiswa",
  cuti_akademik: "Cuti akademik",
};
const SUGGEST = [
  "Berapa maksimal SKS yang boleh diambil?",
  "Syarat beasiswa prestasi apa saja?",
  "Bagaimana cara mengajukan cuti?",
  "WiFi di lab mati, tolong dibantu",
];

function errMsg(x: unknown): string {
  if (x instanceof ApiError) {
    if (x.status === 403) return "Fitur ini hanya tersedia untuk staf kampus.";
    if (x.status === 401) return "Sesi berakhir, silakan masuk kembali.";
    return x.message;
  }
  if (x instanceof Error) return x.message;
  return "Terjadi kesalahan, coba lagi.";
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [tab, setTab] = useState("chat");
  const [view, setView] = useState<View>("login");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      try {
        const u = await api("/auth/me");
        setUser(u);
      } catch {
        localStorage.removeItem("token");
      } finally {
        setReady(true);
      }
    }
    checkAuth();
  }, []);

  if (!ready) return null;

  if (!user) {
    return view === "login"
      ? <Login onDone={setUser} onRegister={() => setView("register")} />
      : <Register onDone={setUser} onLogin={() => setView("login")} />;
  }

  const staff = user.role === "staff" || user.role === "admin";
  const isDosen = user.role === "dosen";
  const tabs = [
    ["chat", "Asisten AI"],
    ["tickets", "Tiket layanan"],
    ...(!isDosen ? [["letters", "Surat otomatis"]] : []),
    ["docs", "Basis pengetahuan"],
    ...(staff ? [["analytics", "Analitik"]] : []),
  ];

  return (
    <div className="app">
      <nav className="rail">
        <div className="brand"><span className="dot" /> UniAgent</div>
        {tabs.map(([id, label]) => (
          <button
            key={id}
            className={"nav" + (tab === id ? " on" : "")}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
        <div className="who">
          {user.name}
          <small>
            {staff ? "Staf kampus" : isDosen ? "Dosen" : "Mahasiswa"}
          </small>
          <button onClick={() => { localStorage.removeItem("token"); setUser(null); setView("login"); }}>
            Keluar
          </button>
        </div>
      </nav>
      <main>
        {tab === "chat"      && <Chat goto={(t) => setTab(t)} />}
        {tab === "tickets"   && <Tickets staff={staff} />}
        {tab === "letters"   && <Letters />}
        {tab === "docs"      && <Docs staff={staff || isDosen} />}
        {tab === "analytics" && <Analytics />}
      </main>
    </div>
  );
}

// ── Login ─────────────────────────────────────────────────────────────────────
function Login({ onDone, onRegister }: { onDone: (u: User) => void; onRegister: () => void }) {
  const [email, setEmail]       = useState("mahasiswa@uniagent.ac.id");
  const [password, setPassword] = useState("demo1234");
  const [err, setErr]           = useState("");
  const [loading, setLoading]   = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(""); setLoading(true);
    try {
      const r = await api("/auth/login", { method: "POST", body: { email, password } });
      localStorage.setItem("token", r.token);
      onDone(r.user);
    } catch (x) { setErr(errMsg(x)); }
    finally { setLoading(false); }
  };

  return (
    <div className="login">
      <section className="login-hero">
        <span className="orb" /><span className="orb two" />
        <h1>Urusan kampus selesai dalam satu percakapan.</h1>
        <p>Tanya aturan akademik, laporkan kendala, dan buat surat resmi. Jawaban diambil dari dokumen kampus.</p>
      </section>
      <section className="login-form">
        <form onSubmit={submit}>
          <h2>Masuk ke UniAgent</h2>
          <input value={email} onChange={e => setEmail(e.target.value)}
            placeholder="Email kampus" aria-label="Email" disabled={loading} />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="Kata sandi" aria-label="Kata sandi" disabled={loading} />
          {err && <div className="err">{err}</div>}
          <button className="btn" disabled={loading}>
            {loading ? "Memverifikasi…" : "Masuk"}
          </button>
          <div className="auth-switch">
            Belum punya akun?{" "}
            <button type="button" className="link-btn" onClick={onRegister}>
              Daftar sekarang
            </button>
          </div>
          <p className="hint">
            Demo: mahasiswa@uniagent.ac.id · staf@uniagent.ac.id · dosen@uniagent.ac.id
            <br />Sandi: demo1234
          </p>
        </form>
      </section>
    </div>
  );
}

// ── Register ──────────────────────────────────────────────────────────────────
type RoleTab = "mahasiswa" | "dosen";

function Register({ onDone, onLogin }: { onDone: (u: User) => void; onLogin: () => void }) {
  const [role, setRole]     = useState<RoleTab>("mahasiswa");
  const [err, setErr]       = useState("");
  const [loading, setLoading] = useState(false);

  // Shared fields
  const [email, setEmail]       = useState("");
  const [name, setName]         = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");

  // Mahasiswa fields
  const [nim, setNim]           = useState("");
  const [prodi, setProdi]       = useState("");
  const [angkatan, setAngkatan] = useState("");
  const [semester, setSemester] = useState("1");
  const [ipk, setIpk]           = useState("0.00");

  // Dosen fields
  const [nip, setNip]           = useState("");
  const [prodiD, setProdiD]     = useState("");
  const [jabatan, setJabatan]   = useState("Dosen");

  const reset = () => {
    setEmail(""); setName(""); setPassword(""); setConfirm("");
    setNim(""); setProdi(""); setAngkatan(""); setSemester("1"); setIpk("0.00");
    setNip(""); setProdiD(""); setJabatan("Dosen");
    setErr("");
  };

  const switchRole = (r: RoleTab) => { setRole(r); reset(); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (password !== confirm) { setErr("Konfirmasi kata sandi tidak cocok."); return; }
    if (password.length < 6)  { setErr("Kata sandi minimal 6 karakter."); return; }

    setLoading(true);
    try {
      const endpoint = role === "mahasiswa" ? "/auth/register/mahasiswa" : "/auth/register/dosen";
      const body = role === "mahasiswa"
        ? { email, name, password, nim, prodi, angkatan: Number(angkatan), semester: Number(semester), ipk: Number(ipk) }
        : { email, name, password, nip, prodi: prodiD, jabatan };

      const r = await api(endpoint, { method: "POST", body });
      localStorage.setItem("token", r.token);
      onDone(r.user);
    } catch (x) { setErr(errMsg(x)); }
    finally { setLoading(false); }
  };

  return (
    <div className="login">
      <section className="login-hero">
        <span className="orb" /><span className="orb two" />
        <h1>Bergabung dengan UniAgent.</h1>
        <p>Buat akun mahasiswa atau dosen untuk mengakses layanan akademik berbasis AI.</p>
      </section>
      <section className="login-form">
        <form onSubmit={submit} className="reg-form">
          <h2>Daftar Akun Baru</h2>

          {/* Role selector */}
          <div className="role-tabs">
            <button type="button"
              className={"role-tab" + (role === "mahasiswa" ? " on" : "")}
              onClick={() => switchRole("mahasiswa")}>
              🎓 Mahasiswa
            </button>
            <button type="button"
              className={"role-tab" + (role === "dosen" ? " on" : "")}
              onClick={() => switchRole("dosen")}>
              👨‍🏫 Dosen
            </button>
          </div>

          {/* Shared fields */}
          <div className="field-group">
            <label>Nama lengkap</label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="Nama sesuai KTP / SK" required disabled={loading} />
          </div>
          <div className="field-group">
            <label>Email kampus</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder={role === "mahasiswa" ? "nim@student.ac.id" : "nama@dosen.ac.id"}
              required disabled={loading} />
          </div>
          <div className="reg-row">
            <div className="field-group">
              <label>Kata sandi</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Min. 6 karakter" required disabled={loading} />
            </div>
            <div className="field-group">
              <label>Konfirmasi sandi</label>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                placeholder="Ulangi kata sandi" required disabled={loading} />
            </div>
          </div>

          {/* Mahasiswa fields */}
          {role === "mahasiswa" && (
            <>
              <div className="reg-row">
                <div className="field-group">
                  <label>NIM</label>
                  <input value={nim} onChange={e => setNim(e.target.value)}
                    placeholder="Nomor Induk Mahasiswa" required disabled={loading} />
                </div>
                <div className="field-group">
                  <label>Program Studi</label>
                  <input value={prodi} onChange={e => setProdi(e.target.value)}
                    placeholder="Teknik Informatika" required disabled={loading} />
                </div>
              </div>
              <div className="reg-row">
                <div className="field-group">
                  <label>Angkatan</label>
                  <input type="number" value={angkatan} onChange={e => setAngkatan(e.target.value)}
                    placeholder="2022" min="2000" max="2100" required disabled={loading} />
                </div>
                <div className="field-group">
                  <label>Semester</label>
                  <select value={semester} onChange={e => setSemester(e.target.value)} disabled={loading}>
                    {[1,2,3,4,5,6,7,8,9,10,11,12,13,14].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div className="field-group">
                  <label>IPK</label>
                  <input type="number" value={ipk} onChange={e => setIpk(e.target.value)}
                    placeholder="3.50" min="0" max="4" step="0.01" disabled={loading} />
                </div>
              </div>
            </>
          )}

          {/* Dosen fields */}
          {role === "dosen" && (
            <>
              <div className="reg-row">
                <div className="field-group">
                  <label>NIP</label>
                  <input value={nip} onChange={e => setNip(e.target.value)}
                    placeholder="Nomor Induk Pegawai" required disabled={loading} />
                </div>
                <div className="field-group">
                  <label>Program Studi</label>
                  <input value={prodiD} onChange={e => setProdiD(e.target.value)}
                    placeholder="Teknik Informatika" required disabled={loading} />
                </div>
              </div>
              <div className="field-group">
                <label>Jabatan akademik</label>
                <select value={jabatan} onChange={e => setJabatan(e.target.value)} disabled={loading}>
                  <option value="Asisten Ahli">Asisten Ahli</option>
                  <option value="Lektor">Lektor</option>
                  <option value="Lektor Kepala">Lektor Kepala</option>
                  <option value="Guru Besar / Profesor">Guru Besar / Profesor</option>
                  <option value="Dosen">Dosen (belum memiliki jabatan)</option>
                </select>
              </div>
            </>
          )}

          {err && <div className="err">{err}</div>}

          <button className="btn" disabled={loading}>
            {loading ? "Mendaftarkan…" : `Daftar sebagai ${role === "mahasiswa" ? "Mahasiswa" : "Dosen"}`}
          </button>

          <div className="auth-switch">
            Sudah punya akun?{" "}
            <button type="button" className="link-btn" onClick={onLogin}>
              Masuk di sini
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

// ── Chat ──────────────────────────────────────────────────────────────────────
function Chat({ goto }: { goto: (t: string) => void }) {
  const [msgs, setMsgs] = useState<any[]>([{
    role: "ai",
    text: "Halo! Saya UniAgent. Tanyakan soal KRS, beasiswa, cuti, atau laporkan kendala kampus.",
  }]);
  const [input, setInput] = useState("");
  const [busy, setBusy]   = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  const send = async (text: string) => {
    if (!text.trim() || busy) return;
    setInput(""); setBusy(true);
    setMsgs(m => [...m, { role: "me", text }]);
    try {
      const r = await api("/chat", { method: "POST", body: { message: text } });
      setMsgs(m => [...m, { role: "ai", text: r.answer, sources: r.sources, action: r.action, intent: r.intent }]);
    } catch (x) { setMsgs(m => [...m, { role: "ai", text: errMsg(x) }]); }
    setBusy(false);
  };

  return (
    <>
      <h1>Asisten AI</h1>
      <p className="sub">Jawaban bersumber dari dokumen resmi kampus.</p>
      <div className="card chat">
        <div className="msgs">
          {msgs.map((m, i) => (
            <div key={i} className={"bubble " + m.role}>
              {m.text}
              {(m.sources?.length > 0 || m.action) && (
                <div className="chips">
                  {m.sources?.map((s: any, j: number) => (
                    <span key={j} className="chip">{s.title}</span>
                  ))}
                  {m.action && (
                    <span className="chip act"
                      onClick={() => goto(m.intent === "ticket" ? "tickets" : "letters")}>
                      {m.action}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
          {busy && <div className="bubble ai">Sedang mencari di dokumen kampus…</div>}
          <div ref={end} />
        </div>
        <div className="suggest">
          {SUGGEST.map(s => (
            <button key={s} className="chip" onClick={() => send(s)}>{s}</button>
          ))}
        </div>
        <div className="composer">
          <input value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && send(input)}
            placeholder="Tulis pertanyaan Anda" aria-label="Pesan" disabled={busy} />
          <button className="btn" onClick={() => send(input)} disabled={busy}>Kirim</button>
        </div>
      </div>
    </>
  );
}

// ── Tickets ───────────────────────────────────────────────────────────────────
function Tickets({ staff }: { staff: boolean }) {
  const [items, setItems]   = useState<any[]>([]);
  const [title, setTitle]   = useState("");
  const [desc, setDesc]     = useState("");
  const [err, setErr]       = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try { setItems(await api("/tickets")); }
    catch (x) { setErr(errMsg(x)); }
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!title.trim()) return;
    setErr(""); setLoading(true);
    try {
      await api("/tickets", { method: "POST", body: { title, description: desc } });
      setTitle(""); setDesc("");
      await load();
    } catch (x) { setErr(errMsg(x)); }
    finally { setLoading(false); }
  };

  const setStatus = async (id: number, status: string) => {
    try { await api(`/tickets/${id}`, { method: "PATCH", body: { status } }); await load(); }
    catch (x) { setErr(errMsg(x)); }
  };

  return (
    <>
      <h1>Tiket layanan</h1>
      <p className="sub">Kategori dan prioritas ditentukan otomatis dari isi laporan.</p>
      {err && <div className="err" style={{ marginBottom: 12 }}>{err}</div>}
      <div className="card grid">
        <input value={title} onChange={e => setTitle(e.target.value)}
          placeholder="Judul laporan" aria-label="Judul" disabled={loading} />
        <textarea rows={3} value={desc} onChange={e => setDesc(e.target.value)}
          placeholder="Ceritakan kendalanya" aria-label="Deskripsi" disabled={loading} />
        <div><button className="btn" onClick={create} disabled={loading}>
          {loading ? "Mengirim…" : "Kirim laporan"}
        </button></div>
      </div>
      <div className="list">
        {items.length === 0 && <div className="card">Belum ada tiket. Kirim laporan pertama Anda di atas.</div>}
        {items.map(t => (
          <div key={t.id} className="card tk">
            <div>
              <b>{t.title}</b>
              <p>{t.description}</p>
              <div className="row" style={{ marginTop: 8 }}>
                <span className="pill">{t.category}</span>
                <span className={"pill " + t.priority}>{t.priority}</span>
                <span className={"pill " + t.status}>{t.status}</span>
              </div>
            </div>
            {staff && (
              <select style={{ width: 130 }} value={t.status}
                onChange={e => setStatus(t.id, e.target.value)} aria-label="Ubah status">
                <option value="open">open</option>
                <option value="proses">proses</option>
                <option value="selesai">selesai</option>
              </select>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

// ── Letters ───────────────────────────────────────────────────────────────────
function Letters() {
  const [type, setType]     = useState("aktif_kuliah");
  const [purpose, setPurpose] = useState("");
  const [items, setItems]   = useState<any[]>([]);
  const [err, setErr]       = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try { setItems(await api("/letters")); }
    catch (x) { setErr(errMsg(x)); }
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    setErr(""); setLoading(true);
    try {
      await api("/letters", { method: "POST", body: { type, purpose } });
      setPurpose(""); await load();
    } catch (x) { setErr(errMsg(x)); }
    finally { setLoading(false); }
  };

  return (
    <>
      <h1>Surat otomatis</h1>
      <p className="sub">Data diri diisi dari profil mahasiswa Anda.</p>
      {err && <div className="err" style={{ marginBottom: 12 }}>{err}</div>}
      <div className="card grid g2">
        <select value={type} onChange={e => setType(e.target.value)} aria-label="Jenis surat" disabled={loading}>
          {Object.entries(LETTERS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input value={purpose} onChange={e => setPurpose(e.target.value)}
          placeholder="Keperluan surat (contoh: melamar kerja)" aria-label="Keperluan" disabled={loading} />
        <div><button className="btn gold" onClick={create} disabled={loading}>
          {loading ? "Membuat surat…" : "Buat surat"}
        </button></div>
      </div>
      <div className="list">
        {items.length === 0 && <div className="card" style={{ color: "var(--muted)" }}>Belum ada surat. Buat surat pertama Anda di atas.</div>}
        {items.map(l => (
          <div key={l.id} className="card">
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
              <b>{LETTERS[l.type] ?? l.type}</b>
              <button className="btn ghost" onClick={() => window.print()}>Cetak</button>
            </div>
            <pre className="letter">{l.body}</pre>
          </div>
        ))}
      </div>
    </>
  );
}

// ── Docs ──────────────────────────────────────────────────────────────────────
function Docs({ staff }: { staff: boolean }) {
  const [docs, setDocs]   = useState<any[]>([]);
  const [q, setQ]         = useState("");
  const [hits, setHits]   = useState<any[] | null>(null);
  const [addForm, setAddForm] = useState({ title: "", category: "umum", content: "" });
  const [upForm, setUpForm]   = useState({ title: "", category: "umum" });
  const [file, setFile]   = useState<File | null>(null);
  const [addErr, setAddErr] = useState("");
  const [upErr, setUpErr]   = useState("");
  const [loadErr, setLoadErr] = useState("");

  const load = async () => {
    try { setDocs(await api("/documents")); }
    catch (x) { setLoadErr(errMsg(x)); }
  };
  useEffect(() => { load(); }, []);

  const deleteDoc = async (id: number, title: string) => {
    if (!confirm(`Hapus dokumen "${title}"?\n\nDokumen ini tidak akan bisa dipulihkan dan AI tidak akan lagi menggunakannya sebagai sumber jawaban.`)) return;
    try {
      await api(`/documents/${id}`, { method: "DELETE" });
      await load();
    } catch (x) { setLoadErr(errMsg(x)); }
  };

  const find = async () => {
    if (!q.trim()) { setHits(null); return; }
    try { setHits(await api("/documents/search?q=" + encodeURIComponent(q))); }
    catch { setHits([]); }
  };

  const add = async () => {
    setAddErr("");
    if (!addForm.title.trim() || !addForm.content.trim()) { setAddErr("Judul dan isi wajib diisi."); return; }
    try {
      await api("/documents", { method: "POST", body: addForm });
      setAddForm({ title: "", category: "umum", content: "" }); await load();
    } catch (x) { setAddErr(errMsg(x)); }
  };

  const uploadFile = async () => {
    setUpErr("");
    if (!file) { setUpErr("Pilih file terlebih dahulu."); return; }
    if (!upForm.title.trim()) { setUpErr("Isi judul dokumen terlebih dahulu."); return; }
    const form = new FormData();
    form.append("title", upForm.title);
    form.append("category", upForm.category || "umum");
    form.append("file", file);
    try {
      await api("/documents/upload", { method: "POST", body: form });
      setFile(null); setUpForm({ title: "", category: "umum" }); await load();
    } catch (x) { setUpErr(errMsg(x)); }
  };

  return (
    <>
      <h1>Basis pengetahuan</h1>
      <p className="sub">Dokumen ini menjadi sumber jawaban asisten AI.</p>
      <div className="card row">
        <input value={q} onChange={e => setQ(e.target.value)}
          onKeyDown={e => e.key === "Enter" && find()}
          placeholder="Cari di dokumen kampus" aria-label="Cari" />
        <button className="btn" onClick={find}>Cari</button>
      </div>
      {hits && (
        <div className="list">
          {hits.length === 0
            ? <div className="card">Tidak ada hasil untuk pencarian ini.</div>
            : hits.map((h, i) => (
              <div key={i} className="card">
                <b>{h.title}</b> <span className="chip">skor {h.score}</span>
                <p>{h.text}</p>
              </div>
            ))}
        </div>
      )}
      {staff && (
        <>
          <div className="card grid" style={{ marginTop: 18 }}>
            <b style={{ marginBottom: -8 }}>Tambah dokumen teks</b>
            <div className="row">
              <input value={addForm.title} onChange={e => setAddForm({ ...addForm, title: e.target.value })} placeholder="Judul dokumen" />
              <input value={addForm.category} onChange={e => setAddForm({ ...addForm, category: e.target.value })} placeholder="Kategori" />
            </div>
            <textarea rows={4} value={addForm.content} onChange={e => setAddForm({ ...addForm, content: e.target.value })} placeholder="Isi dokumen" />
            {addErr && <div className="err">{addErr}</div>}
            <div><button className="btn gold" onClick={add}>Tambah dokumen</button></div>
          </div>
          <div className="card grid" style={{ marginTop: 18 }}>
            <b style={{ marginBottom: -8 }}>Upload file dokumen</b>
            <div className="row">
              <input value={upForm.title} onChange={e => setUpForm({ ...upForm, title: e.target.value })} placeholder="Judul file" />
              <input value={upForm.category} onChange={e => setUpForm({ ...upForm, category: e.target.value })} placeholder="Kategori" />
            </div>
            <input type="file" accept=".txt,.md,.csv,.pdf,.docx" onChange={e => setFile(e.target.files?.[0] || null)} />
            {upErr && <div className="err">{upErr}</div>}
            <div><button className="btn" onClick={uploadFile}>Upload file dokumen</button></div>
          </div>
        </>
      )}
      {loadErr && <div className="err" style={{ marginTop: 12 }}>{loadErr}</div>}
      <div className="list">
        {docs.length === 0 && !loadErr && <div className="card" style={{ color: "var(--muted)" }}>Belum ada dokumen.</div>}
        {docs.map(d => (
          <div key={d.id} className="card row" style={{ justifyContent: "space-between" }}>
            <div>
              <b>{d.title}</b>
              <span className="pill" style={{ marginLeft: 10 }}>{d.category}</span>
            </div>
            {staff && (
              <button
                className="btn-delete"
                onClick={() => deleteDoc(d.id, d.title)}
                aria-label={`Hapus dokumen ${d.title}`}
                title="Hapus dokumen"
              >
                🗑 Hapus
              </button>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

// ── Analytics ─────────────────────────────────────────────────────────────────
function Bars({ title, data }: { title: string; data: Record<string, number> }) {
  const max = Math.max(1, ...Object.values(data));
  return (
    <div className="card">
      <b>{title}</b>
      {Object.entries(data).map(([k, v]) => (
        <div key={k} className="bar">
          <span>{k}</span>
          <i style={{ width: `${(v / max) * 100}%` }} />
          <b>{v}</b>
        </div>
      ))}
    </div>
  );
}

function Analytics() {
  const [d, setD]     = useState<any>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    async function fetchAnalytics() {
      try { setD(await api("/analytics")); }
      catch (x) { setErr(errMsg(x)); }
    }
    fetchAnalytics();
  }, []);

  if (err) return <div className="card" style={{ color: "var(--bad)", marginTop: 16 }}>{err}</div>;
  if (!d)  return <p className="sub">Memuat data…</p>;

  const labels: Record<string, string> = {
    tickets: "Tiket", chats: "Percakapan", letters: "Surat", students: "Mahasiswa",
  };
  return (
    <>
      <h1>Analitik layanan</h1>
      <p className="sub">Ringkasan beban layanan kampus saat ini.</p>
      <div className="grid g4">
        {Object.entries(labels).map(([k, v]) => (
          <div key={k} className="card stat"><b>{d.totals[k]}</b><span>{v}</span></div>
        ))}
      </div>
      <div className="grid g2" style={{ marginTop: 16 }}>
        <Bars title="Tiket per kategori" data={d.tickets_by_category} />
        <Bars title="Status tiket"       data={d.tickets_by_status} />
        <Bars title="Topik percakapan"   data={d.chats_by_intent} />
      </div>
    </>
  );
}
