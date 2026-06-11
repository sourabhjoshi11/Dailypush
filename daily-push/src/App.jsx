import { useState, useEffect } from "react";

const DEFAULT_TEMPLATES = [
  {
    id: "standup",
    name: "Daily Standup",
    icon: "☀️",
    isDefault: true,
    fields: [
      { key: "done", label: "What I did today", placeholder: "Completed the login page UI, fixed 3 bugs in auth flow..." },
      { key: "blockers", label: "Blockers / Issues", placeholder: "Waiting on API keys from backend team..." },
      { key: "tomorrow", label: "What I'll do tomorrow", placeholder: "Start working on dashboard charts..." },
    ],
    aiPrompt: "Refine this daily standup update into a concise, professional format. Keep it brief and to the point.\n\nDone: {{done}}\nBlockers: {{blockers}}\nTomorrow: {{tomorrow}}",
  },
  {
    id: "progress",
    name: "Progress Report",
    icon: "📈",
    isDefault: true,
    fields: [
      { key: "done", label: "Accomplishments", placeholder: "Shipped v2.1 with dark mode, reviewed 4 PRs..." },
      { key: "metrics", label: "Key Metrics / Numbers", placeholder: "Closed 7 tickets, 92% test coverage..." },
      { key: "learnings", label: "Learnings / Notes", placeholder: "Discovered a better way to handle state..." },
    ],
    aiPrompt: "Polish this progress report into a clear, professional summary. Make it engaging and highlight achievements.\n\nAccomplishments: {{done}}\nMetrics: {{metrics}}\nLearnings: {{learnings}}",
  },
  {
    id: "client",
    name: "Client Update",
    icon: "💼",
    isDefault: true,
    fields: [
      { key: "done", label: "Work Completed", placeholder: "Implemented the requested feature, tested on staging..." },
      { key: "status", label: "Project Status", placeholder: "On track for Friday deadline..." },
      { key: "next", label: "Next Steps", placeholder: "Deploy to production, gather feedback..." },
    ],
    aiPrompt: "Rewrite this as a polished, professional client-facing project update. Be reassuring and clear.\n\nWork Done: {{done}}\nStatus: {{status}}\nNext Steps: {{next}}",
  },
];

const STORAGE_KEY = "daily_push_config";
const TEMPLATES_KEY = "daily_push_custom_templates";
const EMOJI_OPTIONS = ["📝","🚀","💡","🎯","🔥","⚡","🛠️","📊","🎨","💬","🧠","✅","📌","🔔","💎","🌟"];
const API_URL = "https://dailypush-backend.onrender.com";

function loadConfig() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { return {}; }
}
function saveConfig(cfg) { localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg)); }

function buildPrompt(template, formData) {
  let prompt = template.aiPrompt || "";
  template.fields.forEach(f => {
    prompt = prompt.replace(new RegExp(`{{${f.key}}}`, "g"), formData[f.key] || "N/A");
  });
  return prompt;
}

function EmailChipInput({ label, chips, onChange, placeholder }) {
  const [input, setInput] = useState("");
  const addChip = (val) => {
    const emails = val.split(/[,;\s]+/).map(e => e.trim()).filter(e => e && e.includes("@"));
    if (emails.length) onChange([...chips, ...emails.filter(e => !chips.includes(e))]);
    setInput("");
  };
  const removeChip = (i) => onChange(chips.filter((_, idx) => idx !== i));
  return (
    <div>
      <label style={{ fontSize: 13, color: "#cbd5e1", fontWeight: 600, display: "block", marginBottom: 8 }}>{label}</label>
      <div
        style={{ background: "#13131f", border: "1.5px solid #1e2235", borderRadius: 8, padding: "8px 12px", minHeight: 46, display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", cursor: "text" }}
        onClick={e => e.currentTarget.querySelector("input")?.focus()}
      >
        {chips.map((chip, i) => (
          <span key={i} style={{ background: "#1e1b4b", border: "1px solid #3730a3", borderRadius: 5, padding: "3px 8px", fontSize: 12, color: "#a5b4fc", display: "flex", alignItems: "center", gap: 5 }}>
            {chip}
            <span onClick={() => removeChip(i)} style={{ cursor: "pointer", color: "#6366f1", fontSize: 14, lineHeight: 1 }}>×</span>
          </span>
        ))}
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (["Enter", ",", ";", "Tab"].includes(e.key)) { e.preventDefault(); addChip(input); }
            if (e.key === "Backspace" && !input && chips.length) removeChip(chips.length - 1);
          }}
          onBlur={() => input && addChip(input)}
          onPaste={e => { e.preventDefault(); addChip(e.clipboardData.getData("text")); }}
          placeholder={chips.length === 0 ? placeholder : ""}
          style={{ border: "none", outline: "none", background: "transparent", color: "#e2e8f0", fontSize: 14, fontFamily: "Inter, sans-serif", flex: 1, minWidth: 140 }}
        />
      </div>
      <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 5 }}>Type and press Enter or comma. Paste multiple emails at once.</p>
    </div>
  );
}

function HistoryPage({ apiUrl }) {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("dp_token");
    fetch(`${apiUrl}/emails/history`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => { setEmails(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [apiUrl]);

  return (
    <main style={{ maxWidth: 660, margin: "0 auto", padding: "48px 24px" }}>
      <h1 style={{ fontSize: 24, fontFamily: "'Sora', sans-serif", fontWeight: 600, color: "#e2e8f0", marginBottom: 8 }}>Email History</h1>
      <p style={{ fontSize: 14, color: "#cbd5e1", marginBottom: 32 }}>Last 5 days of sent updates.</p>
      {loading && <p style={{ color: "#cbd5e1" }}>Loading...</p>}
      {!loading && emails.length === 0 && (
        <div style={{ textAlign: "center", padding: "48px 0", color: "#94a3b8" }}>
          <p style={{ fontSize: 32, marginBottom: 12 }}>📭</p>
          <p>No emails sent in the last 5 days.</p>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {emails.map(e => (
          <div key={e.id} style={{ background: "#13131f", border: "1px solid #1a1a2e", borderRadius: 10, padding: "18px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
              <div>
                <p style={{ fontSize: 15, color: "#c7d2fe", fontWeight: 500, marginBottom: 4 }}>{e.subject}</p>
                <p style={{ fontSize: 12, color: "#cbd5e1" }}>To: {e.to_emails?.join(", ")}</p>
                {e.cc_emails?.length > 0 && <p style={{ fontSize: 12, color: "#cbd5e1" }}>CC: {e.cc_emails.join(", ")}</p>}
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                <span style={{ fontSize: 11, color: e.status === "sent" ? "#4ade80" : "#f87171", background: e.status === "sent" ? "#0d2018" : "#1a0808", border: `1px solid ${e.status === "sent" ? "#1a3a25" : "#3a1010"}`, borderRadius: 4, padding: "2px 8px" }}>
                  {e.status}
                </span>
                <span style={{ fontSize: 11, color: "#94a3b8" }}>
                  {new Date(e.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            </div>
            <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6, whiteSpace: "pre-wrap", maxHeight: 80, overflow: "hidden" }}>{e.body}</p>
            {e.template_name && <span style={{ fontSize: 11, color: "#cbd5e1", marginTop: 8, display: "block" }}>Template: {e.template_name}</span>}
          </div>
        ))}
      </div>
    </main>
  );
}

export default function App() {
  const [step, setStep] = useState(1);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [formData, setFormData] = useState({});
  const [toEmails, setToEmails] = useState([]);
  const [ccEmails, setCcEmails] = useState([]);
  const [bccEmails, setBccEmails] = useState([]);
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [subject, setSubject] = useState("");
  const [refinedContent, setRefinedContent] = useState("");
  const [status, setStatus] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [showTemplateBuilder, setShowTemplateBuilder] = useState(false);
  const [customTemplates, setCustomTemplates] = useState([]);

  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [page, setPage] = useState("app");

  const [tb, setTb] = useState({ name: "", icon: "📝", rawText: "", fields: [], aiPrompt: "" });
  const [tbParsed, setTbParsed] = useState(false);

  const parseTemplate = (raw) => {
    // Normalize line endings (handles \r\n from Windows/paste)
    const lines = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").map(l => l.trim()).filter(Boolean);
    const fields = [];
    const seenKeys = new Set();
    lines.forEach(line => {
      // Match "Label :" or "Label : hint text" — colon required
      const colonIdx = line.indexOf(":");
      if (colonIdx < 1) return; // no colon or colon at start
      const label = line.slice(0, colonIdx).trim();
      const placeholder = line.slice(colonIdx + 1).trim();
      if (!label) return;
      let key = label.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
      if (!key) return;
      // Deduplicate keys
      if (seenKeys.has(key)) key = `${key}_${seenKeys.size}`;
      seenKeys.add(key);
      fields.push({ key, label, placeholder });
    });
    return fields;
  };

  const tbParse = () => {
    const fields = parseTemplate(tb.rawText);
    if (!fields.length) {
      alert("No fields detected. Make sure each line has a colon, e.g.:\nField Name :\nProject Status :");
      return;
    }
    const vars = fields.map(f => `${f.label}: {{${f.key}}}`).join("\n");
    const prompt = `Refine this ${tb.name || "update"} into a concise, professional format.\n\n${vars}`;
    setTb(p => ({ ...p, fields, aiPrompt: prompt }));
    setTbParsed(true);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (token) {
      localStorage.setItem("dp_token", token);
      window.history.replaceState({}, "", "/");
    }
    const savedToken = token || localStorage.getItem("dp_token");
    if (savedToken) {
      fetch(`${API_URL}/me`, { headers: { Authorization: `Bearer ${savedToken}` } })
        .then(r => r.ok ? r.json() : null)
        .then(u => { setUser(u); setAuthLoading(false); })
        .catch(() => setAuthLoading(false));
    } else {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem("dp_token");
    fetch(`${API_URL}/templates`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => setCustomTemplates(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [user]);

  const allTemplates = [...DEFAULT_TEMPLATES, ...customTemplates];
  const template = allTemplates.find(t => t.id === selectedTemplate);
  const defaultSubject = `Daily Update — ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`;

  const handleLogout = () => {
    localStorage.removeItem("dp_token");
    setUser(null);
  };

  const handleFieldChange = (key, value) => setFormData(prev => ({ ...prev, [key]: value }));

  const tbSave = async () => {
    if (!tb.name || !tb.fields.length) return;
    const token = localStorage.getItem("dp_token");
    try {
      const res = await fetch(`${API_URL}/templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: tb.name, icon: tb.icon, raw_text: tb.rawText, fields: tb.fields, ai_prompt: tb.aiPrompt }),
      });
      const saved = await res.json();
      setCustomTemplates(prev => [...prev, { ...saved, aiPrompt: saved.ai_prompt, isDefault: false }]);
      setShowTemplateBuilder(false);
      setTb({ name: "", icon: "📝", rawText: "", fields: [], aiPrompt: "" });
      setTbParsed(false);
    } catch (e) {
      alert("Failed to save template");
    }
  };

  const deleteCustomTemplate = async (id) => {
    const token = localStorage.getItem("dp_token");
    await fetch(`${API_URL}/templates/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    setCustomTemplates(prev => prev.filter(t => t.id !== id));
    if (selectedTemplate === id) setSelectedTemplate(null);
  };

  const refineWithGroq = async () => {
    if (!formData[template.fields[0].key]) { setErrorMsg("Fill in at least the first field."); setStatus("error"); return; }
    setStatus("refining"); setErrorMsg("");
    const token = localStorage.getItem("dp_token");
    try {
      const prompt = buildPrompt(template, formData);
      const res = await fetch(`${API_URL}/refine`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ prompt }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || "Refine failed"); }
      const data = await res.json();
      setRefinedContent(data.refined);
      setStatus("refined");
      setStep(3);
    } catch (e) {
      setErrorMsg(e.message);
      setStatus("error");
    }
  };

  const sendEmail = async () => {
    if (toEmails.length === 0) { setErrorMsg("Add at least one recipient email."); setStatus("error"); return; }
    setStatus("sending"); setErrorMsg("");
    const token = localStorage.getItem("dp_token");
    try {
      const res = await fetch(`${API_URL}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          to: toEmails,
          cc: ccEmails,
          bcc: bccEmails,
          subject: subject || defaultSubject,
          body: refinedContent,
          template_name: template?.name || selectedTemplate,
        }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || "Send failed"); }
      setStatus("sent");
      setStep(4);
    } catch (e) {
      setErrorMsg(e.message);
      setStatus("error");
    }
  };

  const reset = () => {
    setStep(1); setSelectedTemplate(null); setFormData({});
    setRefinedContent(""); setStatus(null); setErrorMsg("");
    setToEmails([]); setCcEmails([]); setBccEmails([]);
    setSubject(""); setShowPreview(false); setShowCcBcc(false);
  };

  const accent = "#6366f1";

  // ── Loading screen ──────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0d0d14", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 16 }}>⚡</div>
          <p style={{ color: "#cbd5e1", fontSize: 14 }}>Loading...</p>
        </div>
      </div>
    );
  }

  // ── Landing / login screen ──────────────────────────────────────────
  if (!user) {
    return (
      <div style={{ minHeight: "100vh", background: "#0d0d14", fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Sora:wght@300;400;600&display=swap'); * { box-sizing: border-box; margin: 0; padding: 0; }`}</style>
        <div style={{ textAlign: "center", maxWidth: 440 }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#1e1b4b", border: "1.5px solid #3730a3", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", fontSize: 28, boxShadow: "0 0 32px rgba(99,102,241,0.2)" }}>✉</div>
          <h1 style={{ fontSize: 32, fontFamily: "'Sora', sans-serif", fontWeight: 600, color: "#e2e8f0", marginBottom: 12 }}>daily push</h1>
          <p style={{ fontSize: 16, color: "#cbd5e1", lineHeight: 1.7, marginBottom: 40 }}>Write your daily update, let AI refine it, send it from your own Gmail — in under 2 minutes.</p>
          <a href={`${API_URL}/auth/google`} style={{ display: "inline-flex", alignItems: "center", gap: 12, background: "#fff", color: "#1a1a2e", padding: "14px 28px", borderRadius: 8, fontSize: 15, fontWeight: 500, textDecoration: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
            <img src="https://www.google.com/favicon.ico" width={18} height={18} alt="Google" />
            Continue with Google
          </a>
          <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 20 }}>No password needed · Sends from your Gmail</p>
        </div>
      </div>
    );
  }

  // ── Authenticated app ───────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "#0d0d14", fontFamily: "'Inter', sans-serif", color: "#e2e8f0" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Sora:wght@300;400;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: #13131f; }
        ::-webkit-scrollbar-thumb { background: #2a2a3d; border-radius: 3px; }
        textarea, input, select { font-family: 'Inter', sans-serif !important; }
        .fade-in { animation: fadeIn 0.4s ease forwards; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .btn-primary { background: #6366f1; color: #fff; border: none; padding: 12px 28px; font-family: 'Inter', sans-serif; font-size: 15px; font-weight: 500; cursor: pointer; border-radius: 8px; transition: all 0.2s ease; display: inline-flex; align-items: center; gap: 6px; }
        .btn-primary:hover { background: #818cf8; transform: translateY(-1px); box-shadow: 0 4px 20px rgba(99,102,241,0.35); }
        .btn-primary:disabled { opacity: 0.35; cursor: not-allowed; transform: none; box-shadow: none; }
        .btn-ghost { background: transparent; color: #cbd5e1; border: 1px solid #1e2235; padding: 11px 22px; font-family: 'Inter', sans-serif; font-size: 14px; cursor: pointer; border-radius: 8px; transition: all 0.2s ease; }
        .btn-ghost:hover { border-color: #6366f1; color: #a5b4fc; background: rgba(99,102,241,0.06); }
        .btn-outline-accent { background: rgba(99,102,241,0.08); color: #a5b4fc; border: 1px solid #3730a3; padding: 10px 18px; font-family: 'Inter', sans-serif; font-size: 13px; cursor: pointer; border-radius: 8px; transition: all 0.2s ease; }
        .btn-outline-accent:hover { background: rgba(99,102,241,0.15); border-color: #6366f1; }
        .btn-danger { background: transparent; color: #f87171; border: 1px solid #3a1010; padding: 5px 12px; font-family: 'Inter', sans-serif; font-size: 12px; cursor: pointer; border-radius: 6px; transition: all 0.2s ease; }
        .btn-danger:hover { background: #1a0808; border-color: #f87171; }
        .input-field { width: 100%; background: #13131f; border: 1.5px solid #1e2235; color: #e2e8f0; padding: 12px 16px; border-radius: 8px; font-size: 15px; outline: none; transition: border-color 0.2s ease, box-shadow 0.2s ease; }
        .input-field:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.12); }
        .input-field::placeholder { color: #2a2d40; }
        textarea.input-field { resize: vertical; line-height: 1.75; }
        .template-card { background: #13131f; border: 1.5px solid #1a1a2e; border-radius: 12px; padding: 20px 22px; cursor: pointer; transition: all 0.2s ease; position: relative; }
        .template-card:hover { border-color: #4338ca; background: #161625; transform: translateY(-2px); box-shadow: 0 4px 24px rgba(99,102,241,0.1); }
        .template-card.active { border-color: #6366f1; background: #161625; box-shadow: 0 0 0 1px #6366f1, 0 4px 24px rgba(99,102,241,0.15); }
        .step-dot { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 600; flex-shrink: 0; transition: all 0.3s ease; }
        .pulse { animation: pulse 1.5s infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        .panel { position: fixed; top: 0; right: 0; height: 100vh; width: 420px; background: #0f0f1a; border-left: 1px solid #1a1a2e; padding: 32px 28px; z-index: 100; overflow-y: auto; transform: translateX(100%); transition: transform 0.3s cubic-bezier(0.4,0,0.2,1); }
        .panel.open { transform: translateX(0); }
        .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 99; opacity: 0; pointer-events: none; transition: opacity 0.3s; backdrop-filter: blur(2px); }
        .overlay.open { opacity: 1; pointer-events: all; }
        .emoji-btn { background: #13131f; border: 1.5px solid #1e2235; border-radius: 6px; padding: 6px 8px; cursor: pointer; font-size: 16px; transition: all 0.15s; }
        .emoji-btn:hover { border-color: #6366f1; background: #1e1b4b; }
        .emoji-btn.selected { border-color: #6366f1; background: #1e1b4b; box-shadow: 0 0 8px rgba(99,102,241,0.3); }
        .section-label { font-size: 11px; color: #4a5568; letter-spacing: 0.08em; font-weight: 500; text-transform: uppercase; }
        .tag { background: #1a1a2e; border: 1px solid #2a2a42; border-radius: 5px; padding: 3px 10px; font-size: 12px; color: #94a3b8; }
        .error-box { padding: 12px 16px; background: #1a0808; border: 1px solid #3a1010; border-radius: 8px; }
        .divider { height: 1px; background: #1a1a2e; margin: 20px 0; }
      `}</style>

      {/* Overlay for template builder panel */}
      <div className={`overlay ${showTemplateBuilder ? "open" : ""}`} onClick={() => setShowTemplateBuilder(false)} />

      {/* Header */}
      <header style={{ borderBottom: "1px solid #131320", padding: "16px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0d0d14" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 8, height: 8, background: "#6366f1", borderRadius: "50%", boxShadow: "0 0 8px rgba(99,102,241,0.6)" }} />
          <span style={{ fontSize: 15, fontFamily: "'Sora', sans-serif", fontWeight: 600, color: "#c7d2fe", letterSpacing: "0.04em" }}>daily push</span>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 13, color: "#94a3b8" }}>{new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}</span>
          <button className="btn-ghost" onClick={() => setPage(page === "history" ? "app" : "history")} style={{ padding: "7px 16px", fontSize: 13 }}>
            {page === "history" ? "← compose" : "history"}
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#13131f", border: "1px solid #1e2235", borderRadius: 8, padding: "6px 12px" }}>
            {user.picture && <img src={user.picture} width={22} height={22} style={{ borderRadius: "50%" }} alt="" />}
            <span style={{ fontSize: 13, color: "#cbd5e1" }}>{user.name?.split(" ")[0]}</span>
            <button onClick={handleLogout} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 12 }}>logout</button>
          </div>
        </div>
      </header>

      {/* Template Builder Panel */}
      <div className={`panel ${showTemplateBuilder ? "open" : ""}`}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
          <span style={{ fontSize: 16, fontFamily: "'Sora', sans-serif", fontWeight: 600, color: "#a5b4fc" }}>New Template</span>
          <button className="btn-ghost" onClick={() => setShowTemplateBuilder(false)} style={{ padding: "5px 12px", fontSize: 13 }}>✕</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <label style={{ fontSize: 13, color: "#cbd5e1", fontWeight: 600, display: "block", marginBottom: 8 }}>Template Name *</label>
            <input className="input-field" placeholder="e.g. Weekly Review" value={tb.name} onChange={e => setTb(p => ({ ...p, name: e.target.value }))} />
          </div>
          <div>
            <label style={{ fontSize: 13, color: "#cbd5e1", fontWeight: 600, display: "block", marginBottom: 10 }}>Icon</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {EMOJI_OPTIONS.map(e => (
                <button key={e} className={`emoji-btn ${tb.icon === e ? "selected" : ""}`} onClick={() => setTb(p => ({ ...p, icon: e }))}>{e}</button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ fontSize: 13, color: "#cbd5e1", fontWeight: 600, display: "block", marginBottom: 6 }}>Paste your template structure *</label>
            <p style={{ fontSize: 12, color: "#94a3b8", marginBottom: 10, lineHeight: 1.6 }}>
              Write each field on its own line as <span style={{ color: "#a5b4fc" }}>Field Name :</span> — the app will auto-detect all fields.
            </p>
            <textarea
              className="input-field"
              placeholder={"Name :\nDate :\nProject :\nCompleted Tasks :\nBlockers :\nTomorrow Plan :"}
              value={tb.rawText}
              onChange={e => { setTb(p => ({ ...p, rawText: e.target.value })); setTbParsed(false); }}
              rows={8}
              style={{ fontSize: 13, lineHeight: 1.8 }}
            />
            <button className="btn-outline-accent" onClick={tbParse} disabled={!tb.rawText.trim()} style={{ marginTop: 10, width: "100%", justifyContent: "center", display: "flex" }}>
              Detect Fields →
            </button>
          </div>

          {tbParsed && tb.fields.length > 0 && (
            <div>
              <label style={{ fontSize: 13, color: "#4ade80", fontWeight: 600, display: "block", marginBottom: 10 }}>
                ✓ Detected {tb.fields.length} fields
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {tb.fields.map((f, i) => (
                  <div key={i} style={{ background: "#13131f", border: "1px solid #1a1a2e", borderRadius: 7, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 14, color: "#c7d2fe" }}>{f.label}</span>
                    <span style={{ fontSize: 11, color: "#94a3b8", fontFamily: "monospace" }}>{`{{${f.key}}}`}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tbParsed && (
            <div>
              <label style={{ fontSize: 13, color: "#cbd5e1", fontWeight: 600, display: "block", marginBottom: 8 }}>AI Prompt (auto-generated, editable)</label>
              <textarea className="input-field" value={tb.aiPrompt} onChange={e => setTb(p => ({ ...p, aiPrompt: e.target.value }))} rows={5} style={{ fontSize: 13 }} />
            </div>
          )}

          <button className="btn-primary" onClick={tbSave} disabled={!tb.name || !tbParsed || !tb.fields.length} style={{ width: "100%", justifyContent: "center" }}>
            Save Template
          </button>
        </div>
      </div>

      {/* Email Preview Modal */}
      {showPreview && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.85)", padding: 24, backdropFilter: "blur(4px)" }}
          onClick={() => setShowPreview(false)}
        >
          <div
            style={{ background: "#fff", borderRadius: 12, width: "100%", maxWidth: 580, maxHeight: "82vh", overflowY: "auto", fontFamily: "Inter, sans-serif", boxShadow: "0 24px 80px rgba(0,0,0,0.5)" }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ background: "#f8fafc", borderRadius: "12px 12px 0 0", padding: "18px 24px", borderBottom: "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <span style={{ fontSize: 12, color: "#64748b", letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 500 }}>Email Preview</span>
                <button onClick={() => setShowPreview(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#64748b" }}>✕</button>
              </div>
              <div style={{ fontSize: 13, color: "#475569", display: "flex", flexDirection: "column", gap: 5 }}>
                <div><span style={{ color: "#94a3b8", display: "inline-block", width: 52 }}>From:</span><span style={{ color: "#1e293b" }}>{user?.email || "your@gmail.com"}</span></div>
                <div><span style={{ color: "#94a3b8", display: "inline-block", width: 52 }}>To:</span><span style={{ color: "#1e293b" }}>{toEmails.join(", ") || "—"}</span></div>
                {ccEmails.length > 0 && <div><span style={{ color: "#94a3b8", display: "inline-block", width: 52 }}>CC:</span><span style={{ color: "#1e293b" }}>{ccEmails.join(", ")}</span></div>}
                {bccEmails.length > 0 && <div><span style={{ color: "#94a3b8", display: "inline-block", width: 52 }}>BCC:</span><span style={{ color: "#1e293b" }}>{bccEmails.join(", ")}</span></div>}
                <div><span style={{ color: "#94a3b8", display: "inline-block", width: 52 }}>Subject:</span><span style={{ color: "#1e293b", fontWeight: 600 }}>{subject || defaultSubject}</span></div>
              </div>
            </div>
            <div style={{ padding: "32px 28px" }}>
              <p style={{ fontSize: 15, color: "#1e293b", lineHeight: 1.85, whiteSpace: "pre-wrap" }}>{refinedContent || "(no content yet)"}</p>
              <div style={{ marginTop: 36, paddingTop: 20, borderTop: "1px solid #f1f5f9" }}>
                <p style={{ fontSize: 12, color: "#94a3b8" }}>Sent via Daily Push · {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History page */}
      {page === "history" && <HistoryPage apiUrl={API_URL} />}

      {/* Main app */}
      {page === "app" && (
        <main style={{ maxWidth: 660, margin: "0 auto", padding: "52px 24px" }}>

          {/* Progress steps */}
          <div style={{ display: "flex", alignItems: "center", marginBottom: 56 }}>
            {["Template", "Compose", "Review", "Done"].map((label, i) => {
              const n = i + 1, active = step === n, done = step > n;
              return (
                <div key={n} style={{ display: "flex", alignItems: "center", flex: i < 3 ? 1 : "none" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7 }}>
                    <div className="step-dot" style={{ background: done || active ? accent : "#13131f", color: done || active ? "#fff" : "#2a2d40", border: active || done ? "none" : "1.5px solid #1e2235", boxShadow: active ? "0 0 16px rgba(99,102,241,0.4)" : "none" }}>
                      {done ? "✓" : n}
                    </div>
                    <span style={{ fontSize: 11, color: active ? "#a5b4fc" : done ? "#6366f1" : "#2a2d40", fontWeight: active ? 500 : 400 }}>{label}</span>
                  </div>
                  {i < 3 && <div style={{ flex: 1, height: 1.5, background: done ? accent : "#1a1a2e", margin: "0 8px", marginBottom: 24, borderRadius: 1, transition: "background 0.4s ease" }} />}
                </div>
              );
            })}
          </div>

          {/* STEP 1 — Choose template */}
          {step === 1 && (
            <div className="fade-in">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div>
                  <h1 style={{ fontSize: 26, fontWeight: 600, fontFamily: "'Sora', sans-serif", color: "#e2e8f0" }}>Choose a template</h1>
                  <p style={{ fontSize: 15, color: "#cbd5e1", marginTop: 6 }}>Pick the format that fits today's update.</p>
                </div>
                <button className="btn-outline-accent" onClick={() => setShowTemplateBuilder(true)} style={{ flexShrink: 0, marginLeft: 16 }}>
                  + New Template
                </button>
              </div>

              <p className="section-label" style={{ margin: "28px 0 12px" }}>Built-in</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {DEFAULT_TEMPLATES.map(t => (
                  <div key={t.id} className={`template-card ${selectedTemplate === t.id ? "active" : ""}`} onClick={() => setSelectedTemplate(t.id)}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                          <span style={{ fontSize: 20 }}>{t.icon}</span>
                          <span style={{ fontSize: 15, fontFamily: "'Sora', sans-serif", fontWeight: 500, color: selectedTemplate === t.id ? "#a5b4fc" : "#cbd5e1" }}>{t.name}</span>
                        </div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {t.fields.map(f => <span key={f.key} className="tag">{f.label}</span>)}
                        </div>
                      </div>
                      <div style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, marginLeft: 20, border: `2px solid ${selectedTemplate === t.id ? accent : "#1e2235"}`, background: selectedTemplate === t.id ? accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s ease" }}>
                        {selectedTemplate === t.id && <span style={{ color: "#fff", fontSize: 11, fontWeight: 700 }}>✓</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {customTemplates.length > 0 && (
                <>
                  <p className="section-label" style={{ margin: "24px 0 12px" }}>My Templates</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {customTemplates.map(t => (
                      <div key={t.id} className={`template-card ${selectedTemplate === t.id ? "active" : ""}`} onClick={() => setSelectedTemplate(t.id)}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                              <span style={{ fontSize: 20 }}>{t.icon}</span>
                              <span style={{ fontSize: 15, fontFamily: "'Sora', sans-serif", fontWeight: 500, color: selectedTemplate === t.id ? "#a5b4fc" : "#cbd5e1" }}>{t.name}</span>
                              <span style={{ fontSize: 10, color: "#94a3b8", background: "#1a1a2e", border: "1px solid #2a2a42", borderRadius: 4, padding: "1px 7px" }}>custom</span>
                            </div>
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                              {t.fields.map(f => <span key={f.key} className="tag">{f.label}</span>)}
                            </div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: 16 }}>
                            <button className="btn-danger" onClick={e => { e.stopPropagation(); deleteCustomTemplate(t.id); }}>Delete</button>
                            <div style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, border: `2px solid ${selectedTemplate === t.id ? accent : "#1e2235"}`, background: selectedTemplate === t.id ? accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s ease" }}>
                              {selectedTemplate === t.id && <span style={{ color: "#fff", fontSize: 11, fontWeight: 700 }}>✓</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div style={{ marginTop: 36, display: "flex", justifyContent: "flex-end" }}>
                <button className="btn-primary" disabled={!selectedTemplate} onClick={() => setStep(2)}>Continue →</button>
              </div>
            </div>
          )}

          {/* STEP 2 — Fill fields */}
          {step === 2 && template && (
            <div className="fade-in">
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                <span style={{ fontSize: 22 }}>{template.icon}</span>
                <h1 style={{ fontSize: 26, fontWeight: 600, fontFamily: "'Sora', sans-serif", color: "#e2e8f0" }}>{template.name}</h1>
              </div>
              <p style={{ fontSize: 15, color: "#cbd5e1", marginBottom: 36 }}>Dump your raw notes — AI will polish them.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
                {template.fields.map((f, idx) => (
                  <div key={f.key}>
                    <label style={{ fontSize: 13, color: "#cbd5e1", fontWeight: 600, display: "block", marginBottom: 8 }}>
                      {f.label} {idx === 0 && <span style={{ color: "#6366f1" }}>*</span>}
                    </label>
                    <textarea className="input-field" placeholder={f.placeholder} value={formData[f.key] || ""} onChange={e => handleFieldChange(f.key, e.target.value)} rows={3} />
                  </div>
                ))}
              </div>
              {status === "error" && <div className="error-box" style={{ marginTop: 18 }}><p style={{ fontSize: 13, color: "#f87171" }}>⚠ {errorMsg}</p></div>}
              <div style={{ marginTop: 32, display: "flex", justifyContent: "space-between" }}>
                <button className="btn-ghost" onClick={() => { setStep(1); setStatus(null); }}>← Back</button>
                <button className="btn-primary" disabled={!formData[template.fields[0].key] || status === "refining"} onClick={refineWithGroq}>
                  {status === "refining" ? <span className="pulse">Refining with AI...</span> : "Refine with AI →"}
                </button>
              </div>
            </div>
          )}

          {/* STEP 3 — Review & send */}
          {step === 3 && (
            <div className="fade-in">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <h1 style={{ fontSize: 26, fontWeight: 600, fontFamily: "'Sora', sans-serif", color: "#e2e8f0" }}>Review & Send</h1>
                <button className="btn-outline-accent" onClick={() => setShowPreview(true)}>Preview ↗</button>
              </div>
              <p style={{ fontSize: 15, color: "#cbd5e1", marginBottom: 28 }}>Edit if needed, then send it off.</p>

              <div style={{ marginBottom: 22 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <label style={{ fontSize: 13, color: "#cbd5e1", fontWeight: 600 }}>Refined Update</label>
                  <span style={{ fontSize: 12, color: "#94a3b8" }}>{refinedContent.length} chars</span>
                </div>
                <textarea className="input-field" value={refinedContent} onChange={e => setRefinedContent(e.target.value)} rows={7} style={{ lineHeight: 1.8, color: "#cbd5e1", fontSize: 14 }} />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 18 }}>
                <EmailChipInput label={<>To <span style={{ color: "#6366f1" }}>*</span></>} chips={toEmails} onChange={setToEmails} placeholder="Add recipient emails..." />

                <div>
                  <button className="btn-ghost" onClick={() => setShowCcBcc(!showCcBcc)} style={{ fontSize: 12, padding: "6px 14px" }}>
                    {showCcBcc ? "Hide CC / BCC" : "+ CC / BCC"}
                  </button>
                </div>

                {showCcBcc && (
                  <>
                    <EmailChipInput label="CC" chips={ccEmails} onChange={setCcEmails} placeholder="Add CC emails..." />
                    <EmailChipInput label="BCC" chips={bccEmails} onChange={setBccEmails} placeholder="Add BCC emails..." />
                  </>
                )}

                <div>
                  <label style={{ fontSize: 13, color: "#cbd5e1", fontWeight: 600, display: "block", marginBottom: 8 }}>Subject</label>
                  <input className="input-field" type="text" placeholder={defaultSubject} value={subject} onChange={e => setSubject(e.target.value)} />
                </div>
              </div>

              {status === "error" && <div className="error-box" style={{ marginBottom: 18 }}><p style={{ fontSize: 13, color: "#f87171" }}>⚠ {errorMsg}</p></div>}

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <button className="btn-ghost" onClick={() => { setStep(2); setStatus("refined"); }}>← Back</button>
                <div style={{ display: "flex", gap: 10 }}>
                  <button className="btn-ghost" onClick={() => setShowPreview(true)} style={{ fontSize: 13 }}>Preview</button>
                  <button className="btn-primary" disabled={toEmails.length === 0 || status === "sending"} onClick={sendEmail}>
                    {status === "sending"
                      ? <span className="pulse">Sending...</span>
                      : `Send to ${toEmails.length > 0 ? toEmails.length : ""} ${toEmails.length === 1 ? "recipient" : toEmails.length > 1 ? "recipients" : "..."} →`}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4 — Done */}
          {step === 4 && (
            <div className="fade-in" style={{ textAlign: "center", padding: "56px 0" }}>
              <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#1e1b4b", border: "1.5px solid #3730a3", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 28px", fontSize: 30, boxShadow: "0 0 32px rgba(99,102,241,0.2)" }}>✉</div>
              <h1 style={{ fontSize: 28, fontWeight: 600, fontFamily: "'Sora', sans-serif", marginBottom: 12, color: "#a5b4fc" }}>Update Sent!</h1>
              <p style={{ fontSize: 15, color: "#cbd5e1", marginBottom: 6 }}>
                Delivered to <span style={{ color: "#6366f1" }}>{toEmails.length} recipient{toEmails.length !== 1 ? "s" : ""}</span>
                {ccEmails.length > 0 && <span style={{ color: "#94a3b8" }}> · {ccEmails.length} CC</span>}
                {bccEmails.length > 0 && <span style={{ color: "#94a3b8" }}> · {bccEmails.length} BCC</span>}
              </p>
              <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 48 }}>
                {new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} · {template?.name} template
              </p>
              <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                <button className="btn-ghost" onClick={() => { setStep(3); setStatus("sent"); }}>View Details</button>
                <button className="btn-primary" onClick={reset}>Send Another →</button>
              </div>
            </div>
          )}
        </main>
      )}
    </div>
  );
}