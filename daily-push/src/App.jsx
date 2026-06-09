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

const GROQ_MODELS = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "gemma2-9b-it", "compound-beta"];
const STORAGE_KEY = "daily_push_config";
const TEMPLATES_KEY = "daily_push_custom_templates";

const EMOJI_OPTIONS = ["📝","🚀","💡","🎯","🔥","⚡","🛠️","📊","🎨","💬","🧠","✅","📌","🔔","💎","🌟"];

function loadConfig() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { return {}; }
}
function saveConfig(cfg) { localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg)); }
function loadCustomTemplates() {
  try { return JSON.parse(localStorage.getItem(TEMPLATES_KEY) || "[]"); } catch { return []; }
}
function saveCustomTemplates(t) { localStorage.setItem(TEMPLATES_KEY, JSON.stringify(t)); }

function buildPrompt(template, formData) {
  let prompt = template.aiPrompt || "";
  template.fields.forEach(f => {
    prompt = prompt.replace(new RegExp(`{{${f.key}}}`, "g"), formData[f.key] || "N/A");
  });
  return prompt;
}

// Email chip input component
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
      <label style={{ fontSize: 13, color: "#64748b", fontWeight: 500, display: "block", marginBottom: 8 }}>{label}</label>
      <div style={{ background: "#13131f", border: "1.5px solid #1e2235", borderRadius: 8, padding: "8px 12px", minHeight: 46, display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", cursor: "text" }}
        onClick={e => e.currentTarget.querySelector("input")?.focus()}>
        {chips.map((chip, i) => (
          <span key={i} style={{ background: "#1e1b4b", border: "1px solid #3730a3", borderRadius: 5, padding: "3px 8px", fontSize: 12, color: "#a5b4fc", display: "flex", alignItems: "center", gap: 5 }}>
            {chip}
            <span onClick={() => removeChip(i)} style={{ cursor: "pointer", color: "#6366f1", fontSize: 14, lineHeight: 1 }}>×</span>
          </span>
        ))}
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (["Enter", ",", ";", "Tab"].includes(e.key)) { e.preventDefault(); addChip(input); } if (e.key === "Backspace" && !input && chips.length) removeChip(chips.length - 1); }}
          onBlur={() => input && addChip(input)}
          onPaste={e => { e.preventDefault(); addChip(e.clipboardData.getData("text")); }}
          placeholder={chips.length === 0 ? placeholder : ""}
          style={{ border: "none", outline: "none", background: "transparent", color: "#e2e8f0", fontSize: 14, fontFamily: "Inter, sans-serif", flex: 1, minWidth: 140 }}
        />
      </div>
      <p style={{ fontSize: 11, color: "#2a2d40", marginTop: 5 }}>Type and press Enter or comma. Paste multiple emails at once.</p>
    </div>
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
  const [showSettings, setShowSettings] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showTemplateBuilder, setShowTemplateBuilder] = useState(false);
  const [customTemplates, setCustomTemplates] = useState([]);

  // Config
  const [webhookUrl, setWebhookUrl] = useState("");
  const [groqKey, setGroqKey] = useState("");
  const [groqModel, setGroqModel] = useState("llama-3.3-70b-versatile");
  const [fromEmail, setFromEmail] = useState("");
  const [configSaved, setConfigSaved] = useState(false);

  // Template builder state
  const [tb, setTb] = useState({ name: "", icon: "📝", rawText: "", fields: [], aiPrompt: "" });
  const [tbParsed, setTbParsed] = useState(false);

  const parseTemplate = (raw) => {
    const lines = raw.split("\n").map(l => l.trim()).filter(Boolean);
    const fields = [];
    lines.forEach(line => {
      const match = line.match(/^(.+?)\s*:\s*(.*)$/);
      if (match) {
        const label = match[1].trim();
        const key = label.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
        if (label && key) fields.push({ key, label, placeholder: match[2].trim() || "" });
      }
    });
    return fields;
  };

  const tbParse = () => {
    const fields = parseTemplate(tb.rawText);
    if (!fields.length) return;
    const vars = fields.map(f => `${f.label}: {{${f.key}}}`).join("\n");
    const prompt = `Refine this ${tb.name || "update"} into a concise, professional format.\n\n${vars}`;
    setTb(p => ({ ...p, fields, aiPrompt: prompt }));
    setTbParsed(true);
  };

  useEffect(() => {
    const cfg = loadConfig();
    if (cfg.webhookUrl) setWebhookUrl(cfg.webhookUrl);
    if (cfg.groqKey) setGroqKey(cfg.groqKey);
    if (cfg.groqModel) setGroqModel(cfg.groqModel);
    if (cfg.fromEmail) setFromEmail(cfg.fromEmail);
    setCustomTemplates(loadCustomTemplates());
  }, []);

  const allTemplates = [...DEFAULT_TEMPLATES, ...customTemplates];
  const template = allTemplates.find(t => t.id === selectedTemplate);
  const defaultSubject = `Daily Update — ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`;
  const isConfigured = groqKey && webhookUrl;

  const handleSaveConfig = () => {
    saveConfig({ webhookUrl, groqKey, groqModel, fromEmail });
    setConfigSaved(true);
    setTimeout(() => setConfigSaved(false), 2000);
  };

  const handleFieldChange = (key, value) => setFormData(prev => ({ ...prev, [key]: value }));

  const tbSave = () => {
    if (!tb.name || !tb.fields.length) return;
    const newT = { ...tb, id: `custom_${Date.now()}`, isDefault: false };
    const updated = [...customTemplates, newT];
    setCustomTemplates(updated);
    saveCustomTemplates(updated);
    setShowTemplateBuilder(false);
    setTb({ name: "", icon: "📝", rawText: "", fields: [], aiPrompt: "" });
    setTbParsed(false);
  };
  const deleteCustomTemplate = (id) => {
    const updated = customTemplates.filter(t => t.id !== id);
    setCustomTemplates(updated);
    saveCustomTemplates(updated);
    if (selectedTemplate === id) setSelectedTemplate(null);
  };

  const refineWithGroq = async () => {
    if (!groqKey) { setErrorMsg("Add your Groq API key in ⚙ config first."); setStatus("error"); return; }
    if (!formData[template.fields[0].key]) { setErrorMsg("Fill in at least the first field."); setStatus("error"); return; }
    setStatus("refining"); setErrorMsg("");
    try {
      const prompt = buildPrompt(template, formData);
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${groqKey}` },
        body: JSON.stringify({
          model: groqModel,
          messages: [
            { role: "system", content: `You are a professional writing assistant. Refine and polish work updates. Be concise, clear, and professional. Return only plain text — no markdown, no bullet symbols, no ** bold **, no # headers, no formatting of any kind. Just clean readable text. Always preserve field labels in the output formatted as "Label: value" on separate lines.` },
            { role: "user", content: prompt },
          ],
          max_tokens: 600,
        }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error?.message || "Groq API error"); }
      const data = await res.json();
      const raw = data.choices[0].message.content.trim();
      const clean = raw.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1').replace(/^#+\s/gm, '').replace(/^[-*]\s/gm, '');
      setRefinedContent(clean);
      setStatus("refined"); setStep(3);
    } catch (e) { setErrorMsg(e.message); setStatus("error"); }
  };

  const sendViaWebhook = async () => {
    if (!webhookUrl) { setErrorMsg("Add your n8n webhook URL in ⚙ config."); setStatus("error"); return; }
    if (toEmails.length === 0) { setErrorMsg("Add at least one recipient email."); setStatus("error"); return; }
    setStatus("sending"); setErrorMsg("");
    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: toEmails.join(","),
          cc: ccEmails.join(",") || undefined,
          bcc: bccEmails.join(",") || undefined,
          from: fromEmail || undefined,
          subject: subject || defaultSubject,
          body: refinedContent,
          template: selectedTemplate,
          timestamp: new Date().toISOString(),
        }),
      });
      if (!res.ok) throw new Error(`Webhook responded with ${res.status}`);
      setStatus("sent"); setStep(4);
    } catch (e) { setErrorMsg(e.message); setStatus("error"); }
  };

  const reset = () => {
    setStep(1); setSelectedTemplate(null); setFormData({});
    setRefinedContent(""); setStatus(null); setErrorMsg("");
    setToEmails([]); setCcEmails([]); setBccEmails([]);
    setSubject(""); setShowPreview(false); setShowCcBcc(false);
  };

  const accent = "#6366f1";

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
        .btn-primary {
          background: #6366f1; color: #fff; border: none; padding: 12px 28px;
          font-family: 'Inter', sans-serif; font-size: 15px; font-weight: 500;
          cursor: pointer; border-radius: 8px; transition: all 0.2s ease; display: inline-flex; align-items: center; gap: 6px;
        }
        .btn-primary:hover { background: #818cf8; transform: translateY(-1px); box-shadow: 0 4px 20px rgba(99,102,241,0.35); }
        .btn-primary:disabled { opacity: 0.35; cursor: not-allowed; transform: none; box-shadow: none; }
        .btn-ghost {
          background: transparent; color: #94a3b8; border: 1px solid #1e2235;
          padding: 11px 22px; font-family: 'Inter', sans-serif; font-size: 14px;
          cursor: pointer; border-radius: 8px; transition: all 0.2s ease;
        }
        .btn-ghost:hover { border-color: #6366f1; color: #a5b4fc; background: rgba(99,102,241,0.06); }
        .btn-outline-accent {
          background: rgba(99,102,241,0.08); color: #a5b4fc; border: 1px solid #3730a3;
          padding: 10px 18px; font-family: 'Inter', sans-serif; font-size: 13px;
          cursor: pointer; border-radius: 8px; transition: all 0.2s ease;
        }
        .btn-outline-accent:hover { background: rgba(99,102,241,0.15); border-color: #6366f1; }
        .btn-danger {
          background: transparent; color: #f87171; border: 1px solid #3a1010;
          padding: 5px 12px; font-family: 'Inter', sans-serif; font-size: 12px;
          cursor: pointer; border-radius: 6px; transition: all 0.2s ease;
        }
        .btn-danger:hover { background: #1a0808; border-color: #f87171; }
        .input-field {
          width: 100%; background: #13131f; border: 1.5px solid #1e2235; color: #e2e8f0;
          padding: 12px 16px; border-radius: 8px; font-size: 15px; outline: none;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .input-field:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.12); }
        .input-field::placeholder { color: #2a2d40; }
        textarea.input-field { resize: vertical; line-height: 1.75; }
        select.input-field { appearance: none; cursor: pointer; }
        .template-card {
          background: #13131f; border: 1.5px solid #1a1a2e; border-radius: 12px;
          padding: 20px 22px; cursor: pointer; transition: all 0.2s ease; position: relative;
        }
        .template-card:hover { border-color: #4338ca; background: #161625; transform: translateY(-2px); box-shadow: 0 4px 24px rgba(99,102,241,0.1); }
        .template-card.active { border-color: #6366f1; background: #161625; box-shadow: 0 0 0 1px #6366f1, 0 4px 24px rgba(99,102,241,0.15); }
        .step-dot { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 600; flex-shrink: 0; transition: all 0.3s ease; }
        .pulse { animation: pulse 1.5s infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        .panel {
          position: fixed; top: 0; right: 0; height: 100vh; width: 380px;
          background: #0f0f1a; border-left: 1px solid #1a1a2e; padding: 32px 28px;
          z-index: 100; overflow-y: auto; transform: translateX(100%);
          transition: transform 0.3s cubic-bezier(0.4,0,0.2,1);
        }
        .panel.open { transform: translateX(0); }
        .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 99; opacity: 0; pointer-events: none; transition: opacity 0.3s; backdrop-filter: blur(2px); }
        .overlay.open { opacity: 1; pointer-events: all; }
        .modal { position: fixed; inset: 0; z-index: 200; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.85); padding: 24px; backdrop-filter: blur(4px); }
        .modal-inner { background: #0f0f1a; border: 1px solid #1a1a2e; border-radius: 14px; width: 100%; max-width: 600px; max-height: 88vh; overflow-y: auto; padding: 32px; }
        .preview-inner { background: #fff; border-radius: 12px; width: 100%; max-width: 580px; max-height: 82vh; overflow-y: auto; font-family: 'Inter', sans-serif; box-shadow: 0 24px 80px rgba(0,0,0,0.5); }
        .tag { background: #1a1a2e; border: 1px solid #2a2a42; border-radius: 5px; padding: 3px 10px; font-size: 12px; color: #64748b; }
        .config-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
        .section-label { font-size: 11px; color: #4a5568; letter-spacing: 0.08em; font-weight: 500; text-transform: uppercase; }
        .card-box { background: #13131f; border: 1px solid #1a1a2e; border-radius: 10px; padding: 18px; }
        .error-box { padding: 12px 16px; background: #1a0808; border: 1px solid #3a1010; border-radius: 8px; }
        .emoji-btn { background: #13131f; border: 1.5px solid #1e2235; border-radius: 6px; padding: 6px 8px; cursor: pointer; font-size: 16px; transition: all 0.15s; }
        .emoji-btn:hover { border-color: #6366f1; background: #1e1b4b; }
        .emoji-btn.selected { border-color: #6366f1; background: #1e1b4b; box-shadow: 0 0 8px rgba(99,102,241,0.3); }
        .field-row { display: flex; gap: 10px; align-items: flex-start; }
        .remove-btn { background: #1a0a0a; border: 1px solid #3a1010; color: #f87171; border-radius: 6px; padding: 8px 10px; cursor: pointer; font-size: 14px; flex-shrink: 0; margin-top: 0; transition: all 0.15s; }
        .remove-btn:hover { background: #2a0808; }
        .divider { height: 1px; background: #1a1a2e; margin: 20px 0; }
      `}</style>

      {/* Header */}
      <header style={{ borderBottom: "1px solid #131320", padding: "16px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0d0d14" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 8, height: 8, background: isConfigured ? "#6366f1" : "#f59e0b", borderRadius: "50%", boxShadow: isConfigured ? "0 0 8px rgba(99,102,241,0.6)" : "0 0 8px rgba(245,158,11,0.6)" }} />
          <span style={{ fontSize: 15, fontFamily: "'Sora', sans-serif", fontWeight: 600, color: "#c7d2fe", letterSpacing: "0.04em" }}>daily push</span>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 13, color: "#2a2d40" }}>{new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}</span>
          {!isConfigured && <span style={{ fontSize: 12, color: "#f59e0b", background: "#1e1500", border: "1px solid #3a2e00", borderRadius: 5, padding: "3px 10px" }}>setup needed</span>}
          <button className="btn-ghost" onClick={() => setShowSettings(true)} style={{ padding: "7px 16px", fontSize: 13 }}>⚙ config</button>
        </div>
      </header>

      {/* Overlay */}
      <div className={`overlay ${showSettings || showTemplateBuilder ? "open" : ""}`} onClick={() => { setShowSettings(false); setShowTemplateBuilder(false); }} />

      {/* Settings Panel */}
      <div className={`panel ${showSettings ? "open" : ""}`}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
          <span style={{ fontSize: 16, fontFamily: "'Sora', sans-serif", fontWeight: 600, color: "#a5b4fc" }}>Configuration</span>
          <button className="btn-ghost" onClick={() => setShowSettings(false)} style={{ padding: "5px 12px", fontSize: 13 }}>✕</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div className="card-box">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <div className="config-dot" style={{ background: groqKey ? "#6366f1" : "#2a2a3d", boxShadow: groqKey ? "0 0 6px rgba(99,102,241,0.5)" : "none" }} />
              <span className="section-label">Groq — AI Refinement</span>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, color: "#64748b", display: "block", marginBottom: 7 }}>API Key</label>
              <input className="input-field" type="password" placeholder="gsk_..." value={groqKey} onChange={e => setGroqKey(e.target.value)} />
              <p style={{ fontSize: 12, color: "#2a2d40", marginTop: 5 }}>console.groq.com → free tier</p>
            </div>
            <div>
              <label style={{ fontSize: 13, color: "#64748b", display: "block", marginBottom: 7 }}>Model</label>
              <select className="input-field" value={groqModel} onChange={e => setGroqModel(e.target.value)}>
                {GROQ_MODELS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <div className="card-box">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <div className="config-dot" style={{ background: webhookUrl ? "#6366f1" : "#2a2a3d", boxShadow: webhookUrl ? "0 0 6px rgba(99,102,241,0.5)" : "none" }} />
              <span className="section-label">n8n + Resend — Email</span>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, color: "#64748b", display: "block", marginBottom: 7 }}>Webhook URL</label>
              <input className="input-field" type="url" placeholder="https://your-app.onrender.com/webhook/..." value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} style={{ fontSize: 13 }} />
            </div>
            <div>
              <label style={{ fontSize: 13, color: "#64748b", display: "block", marginBottom: 7 }}>From Email <span style={{ color: "#2a2d40" }}>(optional)</span></label>
              <input className="input-field" type="email" placeholder="you@yourdomain.com" value={fromEmail} onChange={e => setFromEmail(e.target.value)} />
            </div>
          </div>
          <button className="btn-primary" onClick={handleSaveConfig} style={{ width: "100%", justifyContent: "center" }}>
            {configSaved ? "✓ Saved" : "Save Config"}
          </button>
        </div>
      </div>

      {/* Template Builder Panel */}
      <div className={`panel ${showTemplateBuilder ? "open" : ""}`} style={{ width: 420 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
          <span style={{ fontSize: 16, fontFamily: "'Sora', sans-serif", fontWeight: 600, color: "#a5b4fc" }}>New Template</span>
          <button className="btn-ghost" onClick={() => setShowTemplateBuilder(false)} style={{ padding: "5px 12px", fontSize: 13 }}>✕</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Step 1 — Name + Icon */}
          <div>
            <label style={{ fontSize: 13, color: "#64748b", fontWeight: 500, display: "block", marginBottom: 8 }}>Template Name *</label>
            <input className="input-field" placeholder="e.g. Weekly Review" value={tb.name} onChange={e => setTb(p => ({ ...p, name: e.target.value }))} />
          </div>
          <div>
            <label style={{ fontSize: 13, color: "#64748b", fontWeight: 500, display: "block", marginBottom: 10 }}>Icon</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {EMOJI_OPTIONS.map(e => (
                <button key={e} className={`emoji-btn ${tb.icon === e ? "selected" : ""}`} onClick={() => setTb(p => ({ ...p, icon: e }))}>{e}</button>
              ))}
            </div>
          </div>

          {/* Step 2 — Paste template structure */}
          <div>
            <label style={{ fontSize: 13, color: "#64748b", fontWeight: 500, display: "block", marginBottom: 6 }}>Paste your template structure *</label>
            <p style={{ fontSize: 12, color: "#4a5568", marginBottom: 10, lineHeight: 1.6 }}>
              Write each field on its own line as <span style={{ color: "#a5b4fc" }}>Field Name :</span> — the app will auto-detect all fields.
            </p>
            <textarea
              className="input-field"
              placeholder={"Name :\nDate :\nProject :\nCompleted Tasks :\nIn Progress Tasks :\nBlockers :\nTomorrow Plan :"}
              value={tb.rawText}
              onChange={e => { setTb(p => ({ ...p, rawText: e.target.value })); setTbParsed(false); }}
              rows={8}
              style={{ fontSize: 13, lineHeight: 1.8 }}
            />
            <button className="btn-outline-accent" onClick={tbParse} disabled={!tb.rawText.trim()} style={{ marginTop: 10, width: "100%", justifyContent: "center" }}>
              Detect Fields →
            </button>
          </div>

          {/* Step 3 — Detected fields preview */}
          {tbParsed && tb.fields.length > 0 && (
            <div>
              <label style={{ fontSize: 13, color: "#64748b", fontWeight: 500, display: "block", marginBottom: 10 }}>
                Detected {tb.fields.length} fields ✓
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {tb.fields.map((f, i) => (
                  <div key={i} style={{ background: "#13131f", border: "1px solid #1a1a2e", borderRadius: 7, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 14, color: "#c7d2fe" }}>{f.label}</span>
                    <span style={{ fontSize: 11, color: "#3a3a5a", fontFamily: "monospace" }}>{`{{${f.key}}}`}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 4 — AI Prompt (auto-generated, editable) */}
          {tbParsed && (
            <div>
              <label style={{ fontSize: 13, color: "#64748b", fontWeight: 500, display: "block", marginBottom: 8 }}>AI Prompt (auto-generated, editable)</label>
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
        <div className="modal" onClick={() => setShowPreview(false)}>
          <div className="preview-inner" onClick={e => e.stopPropagation()}>
            <div style={{ background: "#f8fafc", borderRadius: "12px 12px 0 0", padding: "18px 24px", borderBottom: "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <span style={{ fontSize: 12, color: "#94a3b8", letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 500 }}>Email Preview</span>
                <button onClick={() => setShowPreview(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#94a3b8" }}>✕</button>
              </div>
              <div style={{ fontSize: 13, color: "#64748b", display: "flex", flexDirection: "column", gap: 5 }}>
                <div><span style={{ color: "#94a3b8", display: "inline-block", width: 44 }}>From:</span>{fromEmail || "onboarding@resend.dev"}</div>
                <div><span style={{ color: "#94a3b8", display: "inline-block", width: 44 }}>To:</span>{toEmails.join(", ") || "—"}</div>
                {ccEmails.length > 0 && <div><span style={{ color: "#94a3b8", display: "inline-block", width: 44 }}>CC:</span>{ccEmails.join(", ")}</div>}
                {bccEmails.length > 0 && <div><span style={{ color: "#94a3b8", display: "inline-block", width: 44 }}>BCC:</span>{bccEmails.join(", ")}</div>}
                <div><span style={{ color: "#94a3b8", display: "inline-block", width: 44 }}>Sub:</span>{subject || defaultSubject}</div>
              </div>
            </div>
            <div style={{ padding: "32px 28px" }}>
              <p style={{ fontSize: 15, color: "#1e293b", lineHeight: 1.85, whiteSpace: "pre-wrap" }}>{refinedContent}</p>
              <div style={{ marginTop: 36, paddingTop: 20, borderTop: "1px solid #f1f5f9" }}>
                <p style={{ fontSize: 12, color: "#cbd5e1" }}>Sent via Daily Push · {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main */}
      <main style={{ maxWidth: 660, margin: "0 auto", padding: "52px 24px" }}>

        {/* Progress */}
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

        {/* STEP 1 */}
        {step === 1 && (
          <div className="fade-in">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <div>
                <h1 style={{ fontSize: 26, fontWeight: 600, fontFamily: "'Sora', sans-serif", color: "#e2e8f0" }}>Choose a template</h1>
                <p style={{ fontSize: 15, color: "#4a5568", marginTop: 6 }}>Pick the format that fits today's update.</p>
              </div>
              <button className="btn-outline-accent" onClick={() => setShowTemplateBuilder(true)} style={{ flexShrink: 0, marginLeft: 16 }}>
                + New Template
              </button>
            </div>

            {/* Default templates */}
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

            {/* Custom templates */}
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
                            <span style={{ fontSize: 10, color: "#4a5568", background: "#1a1a2e", border: "1px solid #2a2a42", borderRadius: 4, padding: "1px 7px" }}>custom</span>
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

        {/* STEP 2 */}
        {step === 2 && template && (
          <div className="fade-in">
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <span style={{ fontSize: 22 }}>{template.icon}</span>
              <h1 style={{ fontSize: 26, fontWeight: 600, fontFamily: "'Sora', sans-serif", color: "#e2e8f0" }}>{template.name}</h1>
            </div>
            <p style={{ fontSize: 15, color: "#4a5568", marginBottom: 36 }}>Dump your raw notes — AI will polish them.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
              {template.fields.map((f, idx) => (
                <div key={f.key}>
                  <label style={{ fontSize: 13, color: "#64748b", fontWeight: 500, display: "block", marginBottom: 8 }}>
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

        {/* STEP 3 */}
        {step === 3 && (
          <div className="fade-in">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <h1 style={{ fontSize: 26, fontWeight: 600, fontFamily: "'Sora', sans-serif", color: "#e2e8f0" }}>Review & Send</h1>
              <button className="btn-outline-accent" onClick={() => setShowPreview(true)}>Preview ↗</button>
            </div>
            <p style={{ fontSize: 15, color: "#4a5568", marginBottom: 28 }}>Edit if needed, then send it off.</p>

            <div style={{ marginBottom: 22 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <label style={{ fontSize: 13, color: "#64748b", fontWeight: 500 }}>Refined Update</label>
                <span style={{ fontSize: 12, color: "#2a2d40" }}>{refinedContent.length} chars</span>
              </div>
              <textarea className="input-field" value={refinedContent} onChange={e => setRefinedContent(e.target.value)} rows={7} style={{ lineHeight: 1.8, color: "#94a3b8", fontSize: 14 }} />
            </div>

            {/* Recipients */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 18 }}>
              <EmailChipInput label={<>To <span style={{ color: "#6366f1" }}>*</span></>} chips={toEmails} onChange={setToEmails} placeholder="Add recipient emails..." />

              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn-ghost" onClick={() => setShowCcBcc(!showCcBcc)} style={{ fontSize: 12, padding: "6px 14px" }}>
                  {showCcBcc ? "Hide" : "+"} CC / BCC
                </button>
              </div>

              {showCcBcc && (
                <>
                  <EmailChipInput label="CC" chips={ccEmails} onChange={setCcEmails} placeholder="Add CC emails..." />
                  <EmailChipInput label="BCC" chips={bccEmails} onChange={setBccEmails} placeholder="Add BCC emails..." />
                </>
              )}

              <div>
                <label style={{ fontSize: 13, color: "#64748b", fontWeight: 500, display: "block", marginBottom: 8 }}>Subject</label>
                <input className="input-field" type="text" placeholder={defaultSubject} value={subject} onChange={e => setSubject(e.target.value)} />
              </div>
            </div>

            {status === "error" && <div className="error-box" style={{ marginBottom: 18 }}><p style={{ fontSize: 13, color: "#f87171" }}>⚠ {errorMsg}</p></div>}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button className="btn-ghost" onClick={() => { setStep(2); setStatus("refined"); }}>← Back</button>
              <div style={{ display: "flex", gap: 10 }}>
                <button className="btn-ghost" onClick={() => setShowPreview(true)} style={{ fontSize: 13 }}>Preview</button>
                <button className="btn-primary" disabled={toEmails.length === 0 || status === "sending"} onClick={sendViaWebhook}>
                  {status === "sending" ? <span className="pulse">Sending...</span> : `Send to ${toEmails.length > 0 ? toEmails.length : ""} ${toEmails.length === 1 ? "recipient" : toEmails.length > 1 ? "recipients" : "..."} →`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4 */}
        {step === 4 && (
          <div className="fade-in" style={{ textAlign: "center", padding: "56px 0" }}>
            <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#1e1b4b", border: "1.5px solid #3730a3", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 28px", fontSize: 30, boxShadow: "0 0 32px rgba(99,102,241,0.2)" }}>✉</div>
            <h1 style={{ fontSize: 28, fontWeight: 600, fontFamily: "'Sora', sans-serif", marginBottom: 12, color: "#a5b4fc" }}>Update Sent!</h1>
            <p style={{ fontSize: 15, color: "#4a5568", marginBottom: 6 }}>
              Delivered to <span style={{ color: "#6366f1" }}>{toEmails.length} recipient{toEmails.length !== 1 ? "s" : ""}</span>
              {ccEmails.length > 0 && <span style={{ color: "#4a5568" }}> · {ccEmails.length} CC</span>}
              {bccEmails.length > 0 && <span style={{ color: "#4a5568" }}> · {bccEmails.length} BCC</span>}
            </p>
            <p style={{ fontSize: 13, color: "#2a2d40", marginBottom: 48 }}>
              {new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} · {template?.name} template
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button className="btn-ghost" onClick={() => { setStep(3); setStatus("sent"); }}>View Details</button>
              <button className="btn-primary" onClick={reset}>Send Another →</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}