import { useState, useEffect } from "react";

const TEMPLATES = [
  {
    id: "standup",
    name: "Daily Standup",
    icon: "☀️",
    fields: [
      { key: "done", label: "What I did today", placeholder: "Completed the login page UI, fixed 3 bugs in auth flow..." },
      { key: "blockers", label: "Blockers / Issues", placeholder: "Waiting on API keys from backend team..." },
      { key: "tomorrow", label: "What I'll do tomorrow", placeholder: "Start working on dashboard charts..." },
    ],
    prompt: (data) =>
      `Refine this daily standup update into a concise, professional format. Keep it brief and to the point:\n\nDone: ${data.done}\nBlockers: ${data.blockers || "None"}\nTomorrow: ${data.tomorrow}`,
  },
  {
    id: "progress",
    name: "Progress Report",
    icon: "📈",
    fields: [
      { key: "done", label: "Accomplishments", placeholder: "Shipped v2.1 with dark mode, reviewed 4 PRs..." },
      { key: "metrics", label: "Key Metrics / Numbers", placeholder: "Closed 7 tickets, 92% test coverage..." },
      { key: "learnings", label: "Learnings / Notes", placeholder: "Discovered a better way to handle state..." },
    ],
    prompt: (data) =>
      `Polish this progress report into a clear, professional summary. Make it engaging and highlight achievements:\n\nAccomplishments: ${data.done}\nMetrics: ${data.metrics || "N/A"}\nLearnings: ${data.learnings || "N/A"}`,
  },
  {
    id: "client",
    name: "Client Update",
    icon: "💼",
    fields: [
      { key: "done", label: "Work Completed", placeholder: "Implemented the requested feature, tested on staging..." },
      { key: "status", label: "Project Status", placeholder: "On track for Friday deadline..." },
      { key: "next", label: "Next Steps", placeholder: "Deploy to production, gather feedback..." },
    ],
    prompt: (data) =>
      `Rewrite this as a polished, professional client-facing project update. Be reassuring and clear:\n\nWork Done: ${data.done}\nStatus: ${data.status || "On track"}\nNext Steps: ${data.next}`,
  },
];

const GROQ_MODELS = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "gemma2-9b-it", "compound-beta"];

const STORAGE_KEY = "daily_push_config";

function loadConfig() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch { return {}; }
}

function saveConfig(cfg) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
}

export default function App() {
  const [step, setStep] = useState(1);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [formData, setFormData] = useState({});
  const [recipientEmail, setRecipientEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [refinedContent, setRefinedContent] = useState("");
  const [status, setStatus] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Config (persisted)
  const [webhookUrl, setWebhookUrl] = useState("");
  const [groqKey, setGroqKey] = useState("");
  const [groqModel, setGroqModel] = useState("llama-3.3-70b-versatile");
  const [fromEmail, setFromEmail] = useState("");
  const [configSaved, setConfigSaved] = useState(false);

  useEffect(() => {
    const cfg = loadConfig();
    if (cfg.webhookUrl) setWebhookUrl(cfg.webhookUrl);
    if (cfg.groqKey) setGroqKey(cfg.groqKey);
    if (cfg.groqModel) setGroqModel(cfg.groqModel);
    if (cfg.fromEmail) setFromEmail(cfg.fromEmail);
  }, []);

  const handleSaveConfig = () => {
    saveConfig({ webhookUrl, groqKey, groqModel, fromEmail });
    setConfigSaved(true);
    setTimeout(() => setConfigSaved(false), 2000);
  };

  const template = TEMPLATES.find((t) => t.id === selectedTemplate);
  const defaultSubject = `Daily Update — ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`;

  const handleFieldChange = (key, value) => setFormData((prev) => ({ ...prev, [key]: value }));

  const refineWithGroq = async () => {
    if (!groqKey) { setErrorMsg("Add your Groq API key in ⚙ config first."); setStatus("error"); return; }
    if (!formData.done) { setErrorMsg("Fill in at least the main field."); setStatus("error"); return; }
    setStatus("refining"); setErrorMsg("");
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${groqKey}` },
        body: JSON.stringify({
          model: groqModel,
          messages: [
            { role: "system", content: "You are a professional writing assistant. Refine and polish daily work updates. Be concise, clear, and professional. Return only the refined text, no explanations or preamble." },
            { role: "user", content: template.prompt(formData) },
          ],
          max_tokens: 500,
        }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error?.message || "Groq API error"); }
      const data = await res.json();
      setRefinedContent(data.choices[0].message.content.trim());
      setStatus("refined");
      setStep(3);
    } catch (e) { setErrorMsg(e.message); setStatus("error"); }
  };

  const sendViaWebhook = async () => {
    if (!webhookUrl) { setErrorMsg("Add your n8n webhook URL in ⚙ config."); setStatus("error"); return; }
    if (!recipientEmail) { setErrorMsg("Enter a recipient email."); setStatus("error"); return; }
    setStatus("sending"); setErrorMsg("");
    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: recipientEmail,
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
    setRecipientEmail(""); setSubject(""); setShowPreview(false);
  };

  const isConfigured = groqKey && webhookUrl;

  return (
    <div style={{ minHeight: "100vh", background: "#0f0f0f", fontFamily: "'DM Mono', monospace", color: "#e8e3d9" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300&family=DM+Sans:wght@300;400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #1a1a1a; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
        textarea, input, select { font-family: 'DM Mono', monospace !important; }
        .fade-in { animation: fadeIn 0.35s ease forwards; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .btn-primary {
          background: #e8e3d9; color: #0f0f0f; border: none; padding: 10px 24px;
          font-family: 'DM Mono', monospace; font-size: 13px; font-weight: 500;
          cursor: pointer; border-radius: 6px; transition: all 0.15s ease; letter-spacing: 0.03em;
        }
        .btn-primary:hover { background: #fff; transform: translateY(-1px); }
        .btn-primary:disabled { opacity: 0.35; cursor: not-allowed; transform: none; }
        .btn-ghost {
          background: transparent; color: #888; border: 1px solid #2a2a2a; padding: 9px 20px;
          font-family: 'DM Mono', monospace; font-size: 12px; cursor: pointer;
          border-radius: 6px; transition: all 0.15s ease;
        }
        .btn-ghost:hover { border-color: #444; color: #ccc; }
        .btn-green {
          background: transparent; color: #4ade80; border: 1px solid #1a3a25; padding: 9px 20px;
          font-family: 'DM Mono', monospace; font-size: 12px; cursor: pointer;
          border-radius: 6px; transition: all 0.15s ease;
        }
        .btn-green:hover { background: #0d2018; border-color: #4ade80; }
        .input-field {
          width: 100%; background: #1a1a1a; border: 1px solid #2a2a2a; color: #e8e3d9;
          padding: 10px 14px; border-radius: 6px; font-size: 13px; outline: none;
          transition: border-color 0.15s ease;
        }
        .input-field:focus { border-color: #555; }
        .input-field::placeholder { color: #333; }
        textarea.input-field { resize: vertical; line-height: 1.7; }
        select.input-field { appearance: none; cursor: pointer; }
        .template-card {
          background: #161616; border: 1px solid #222; border-radius: 10px;
          padding: 20px 22px; cursor: pointer; transition: all 0.2s ease;
        }
        .template-card:hover { border-color: #3a3a3a; background: #1c1c1c; transform: translateY(-1px); }
        .template-card.active { border-color: #e8e3d9; background: #1c1c1c; }
        .step-dot {
          width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center;
          justify-content: center; font-size: 11px; font-weight: 500; flex-shrink: 0;
        }
        .pulse { animation: pulse 1.5s infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        .settings-panel {
          position: fixed; top: 0; right: 0; height: 100vh; width: 340px;
          background: #111; border-left: 1px solid #1e1e1e; padding: 28px 24px;
          z-index: 100; overflow-y: auto; transform: translateX(100%);
          transition: transform 0.25s ease;
        }
        .settings-panel.open { transform: translateX(0); }
        .overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.65); z-index: 99;
          opacity: 0; pointer-events: none; transition: opacity 0.25s;
        }
        .overlay.open { opacity: 1; pointer-events: all; }
        .preview-modal {
          position: fixed; inset: 0; z-index: 200; display: flex; align-items: center;
          justify-content: center; background: rgba(0,0,0,0.8); padding: 24px;
        }
        .preview-inner {
          background: #fff; border-radius: 8px; width: 100%; max-width: 560px;
          max-height: 80vh; overflow-y: auto; padding: 0; font-family: 'DM Sans', sans-serif;
        }
        .tag { background: #1e1e1e; border: 1px solid #2a2a2a; border-radius: 4px; padding: 2px 8px; font-size: 11px; color: #555; }
        .config-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
        .divider { height: 1px; background: #1e1e1e; margin: 24px 0; }
      `}</style>

      {/* Header */}
      <header style={{ borderBottom: "1px solid #1a1a1a", padding: "14px 28px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 7, height: 7, background: isConfigured ? "#4ade80" : "#f59e0b", borderRadius: "50%" }} />
          <span style={{ fontSize: 12, letterSpacing: "0.1em", color: "#666" }}>DAILY_PUSH</span>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "#3a3a3a" }}>
            {new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
          </span>
          {!isConfigured && (
            <span style={{ fontSize: 10, color: "#f59e0b", background: "#1e1800", border: "1px solid #3a2e00", borderRadius: 4, padding: "2px 8px" }}>
              setup needed
            </span>
          )}
          <button className="btn-ghost" onClick={() => setShowSettings(true)} style={{ padding: "5px 14px", fontSize: 11 }}>
            ⚙ config
          </button>
        </div>
      </header>

      {/* Settings Panel */}
      <div className={`overlay ${showSettings ? "open" : ""}`} onClick={() => setShowSettings(false)} />
      <div className={`settings-panel ${showSettings ? "open" : ""}`}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
          <span style={{ fontSize: 12, letterSpacing: "0.08em", color: "#666" }}>CONFIGURATION</span>
          <button className="btn-ghost" onClick={() => setShowSettings(false)} style={{ padding: "4px 10px", fontSize: 11 }}>✕</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Groq */}
          <div style={{ background: "#161616", border: "1px solid #1e1e1e", borderRadius: 8, padding: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <div className="config-dot" style={{ background: groqKey ? "#4ade80" : "#444" }} />
              <span style={{ fontSize: 11, color: "#666", letterSpacing: "0.06em" }}>GROQ (AI REFINEMENT)</span>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 10, color: "#444", display: "block", marginBottom: 6 }}>API KEY</label>
              <input className="input-field" type="password" placeholder="gsk_..." value={groqKey} onChange={(e) => setGroqKey(e.target.value)} style={{ fontSize: 12 }} />
              <p style={{ fontSize: 10, color: "#333", marginTop: 5 }}>console.groq.com → free tier</p>
            </div>
            <div>
              <label style={{ fontSize: 10, color: "#444", display: "block", marginBottom: 6 }}>MODEL</label>
              <select className="input-field" value={groqModel} onChange={(e) => setGroqModel(e.target.value)} style={{ fontSize: 12 }}>
                {GROQ_MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          {/* n8n + Resend */}
          <div style={{ background: "#161616", border: "1px solid #1e1e1e", borderRadius: 8, padding: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <div className="config-dot" style={{ background: webhookUrl ? "#4ade80" : "#444" }} />
              <span style={{ fontSize: 11, color: "#666", letterSpacing: "0.06em" }}>N8N + RESEND (EMAIL)</span>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 10, color: "#444", display: "block", marginBottom: 6 }}>WEBHOOK URL</label>
              <input className="input-field" type="url" placeholder="https://your-app.onrender.com/webhook/..." value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} style={{ fontSize: 11 }} />
              <p style={{ fontSize: 10, color: "#333", marginTop: 5 }}>From n8n Webhook node → Production URL</p>
            </div>
            <div>
              <label style={{ fontSize: 10, color: "#444", display: "block", marginBottom: 6 }}>FROM EMAIL (optional)</label>
              <input className="input-field" type="email" placeholder="you@yourdomain.com" value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} style={{ fontSize: 12 }} />
              <p style={{ fontSize: 10, color: "#333", marginTop: 5 }}>Must be verified in Resend dashboard</p>
            </div>
          </div>

          <button className="btn-primary" onClick={handleSaveConfig} style={{ width: "100%" }}>
            {configSaved ? "✓ saved" : "save config"}
          </button>

          <div className="divider" />
          <div style={{ fontSize: 11, color: "#333", lineHeight: 1.8 }}>
            <p style={{ marginBottom: 8, color: "#555" }}>Flow:</p>
            <p>① React → Groq (AI refines)</p>
            <p>② React → n8n webhook</p>
            <p>③ n8n Code node extracts fields</p>
            <p>④ n8n HTTP Request → Resend API</p>
            <p>⑤ Resend delivers email</p>
          </div>
        </div>
      </div>

      {/* Email Preview Modal */}
      {showPreview && (
        <div className="preview-modal" onClick={() => setShowPreview(false)}>
          <div className="preview-inner" onClick={(e) => e.stopPropagation()}>
            {/* Email chrome */}
            <div style={{ background: "#f5f5f5", borderRadius: "8px 8px 0 0", padding: "16px 20px", borderBottom: "1px solid #e0e0e0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontSize: 11, color: "#999", letterSpacing: "0.06em" }}>EMAIL PREVIEW</span>
                <button onClick={() => setShowPreview(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#999" }}>✕</button>
              </div>
              <div style={{ fontSize: 12, color: "#666", display: "flex", flexDirection: "column", gap: 4 }}>
                <div><span style={{ color: "#aaa", display: "inline-block", width: 52 }}>From:</span> {fromEmail || "your-verified@email.com"}</div>
                <div><span style={{ color: "#aaa", display: "inline-block", width: 52 }}>To:</span> {recipientEmail || "recipient@email.com"}</div>
                <div><span style={{ color: "#aaa", display: "inline-block", width: 52 }}>Subject:</span> {subject || defaultSubject}</div>
              </div>
            </div>
            <div style={{ padding: "28px 24px" }}>
              <p style={{ fontSize: 14, color: "#111", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{refinedContent}</p>
              <div style={{ marginTop: 32, paddingTop: 20, borderTop: "1px solid #eee" }}>
                <p style={{ fontSize: 11, color: "#bbb" }}>Sent via Daily Push · {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main */}
      <main style={{ maxWidth: 620, margin: "0 auto", padding: "44px 24px" }}>
        {/* Progress bar */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: 52 }}>
          {["template", "compose", "review", "done"].map((label, i) => {
            const n = i + 1;
            const active = step === n, done = step > n;
            return (
              <div key={n} style={{ display: "flex", alignItems: "center", flex: i < 3 ? 1 : "none" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  <div className="step-dot" style={{
                    background: done ? "#4ade80" : active ? "#e8e3d9" : "#161616",
                    color: done ? "#0a2016" : active ? "#0f0f0f" : "#333",
                    border: active || done ? "none" : "1px solid #222",
                  }}>
                    {done ? "✓" : n}
                  </div>
                  <span style={{ fontSize: 9, color: active ? "#666" : "#2a2a2a", letterSpacing: "0.08em" }}>{label.toUpperCase()}</span>
                </div>
                {i < 3 && <div style={{ flex: 1, height: 1, background: done ? "#4ade80" : "#1a1a1a", margin: "0 6px", marginBottom: 22 }} />}
              </div>
            );
          })}
        </div>

        {/* STEP 1 */}
        {step === 1 && (
          <div className="fade-in">
            <h1 style={{ fontSize: 20, fontWeight: 300, fontFamily: "'DM Sans', sans-serif", marginBottom: 6, color: "#e8e3d9" }}>
              Choose a template
            </h1>
            <p style={{ fontSize: 12, color: "#444", marginBottom: 32 }}>Pick the format for today's update.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {TEMPLATES.map((t) => (
                <div key={t.id} className={`template-card ${selectedTemplate === t.id ? "active" : ""}`} onClick={() => setSelectedTemplate(t.id)}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                        <span style={{ fontSize: 16 }}>{t.icon}</span>
                        <span style={{ fontSize: 13, fontFamily: "'DM Sans', sans-serif", color: "#ccc" }}>{t.name}</span>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {t.fields.map((f) => <span key={f.key} className="tag">{f.label}</span>)}
                      </div>
                    </div>
                    <div style={{ width: 20, height: 20, borderRadius: "50%", border: `1px solid ${selectedTemplate === t.id ? "#4ade80" : "#2a2a2a"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginLeft: 16 }}>
                      {selectedTemplate === t.id && <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#4ade80" }} />}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 28, display: "flex", justifyContent: "flex-end" }}>
              <button className="btn-primary" disabled={!selectedTemplate} onClick={() => setStep(2)}>continue →</button>
            </div>
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && template && (
          <div className="fade-in">
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <span>{template.icon}</span>
              <h1 style={{ fontSize: 20, fontWeight: 300, fontFamily: "'DM Sans', sans-serif", color: "#e8e3d9" }}>{template.name}</h1>
            </div>
            <p style={{ fontSize: 12, color: "#444", marginBottom: 32 }}>Dump your raw notes — AI will polish them.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {template.fields.map((f, idx) => (
                <div key={f.key}>
                  <label style={{ fontSize: 10, color: "#444", letterSpacing: "0.07em", display: "block", marginBottom: 7 }}>
                    {f.label.toUpperCase()} {idx === 0 && <span style={{ color: "#333" }}>*</span>}
                  </label>
                  <textarea className="input-field" placeholder={f.placeholder} value={formData[f.key] || ""} onChange={(e) => handleFieldChange(f.key, e.target.value)} rows={3} />
                </div>
              ))}
            </div>
            {status === "error" && (
              <div style={{ marginTop: 16, padding: "10px 14px", background: "#160808", border: "1px solid #2e1010", borderRadius: 6 }}>
                <p style={{ fontSize: 12, color: "#f87171" }}>⚠ {errorMsg}</p>
              </div>
            )}
            <div style={{ marginTop: 28, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button className="btn-ghost" onClick={() => { setStep(1); setStatus(null); }}>← back</button>
              <button className="btn-primary" disabled={!formData.done || status === "refining"} onClick={refineWithGroq}>
                {status === "refining" ? <span className="pulse">refining with AI...</span> : "refine with AI →"}
              </button>
            </div>
          </div>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <div className="fade-in">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
              <h1 style={{ fontSize: 20, fontWeight: 300, fontFamily: "'DM Sans', sans-serif", color: "#e8e3d9" }}>Review & send</h1>
              <button className="btn-green" onClick={() => setShowPreview(true)} style={{ fontSize: 11, padding: "5px 14px" }}>
                preview email ↗
              </button>
            </div>
            <p style={{ fontSize: 12, color: "#444", marginBottom: 28 }}>Edit if needed, then fire it off.</p>

            {/* Refined content */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
                <label style={{ fontSize: 10, color: "#444", letterSpacing: "0.07em" }}>REFINED UPDATE</label>
                <span style={{ fontSize: 10, color: "#3a3a3a" }}>{refinedContent.length} chars</span>
              </div>
              <textarea
                className="input-field"
                value={refinedContent}
                onChange={(e) => setRefinedContent(e.target.value)}
                rows={8}
                style={{ lineHeight: 1.8, color: "#b8b4ac", fontSize: 13 }}
              />
              <p style={{ fontSize: 10, color: "#333", marginTop: 5 }}>Editable — changes are reflected in the email preview.</p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
              <div>
                <label style={{ fontSize: 10, color: "#444", letterSpacing: "0.07em", display: "block", marginBottom: 7 }}>RECIPIENT EMAIL *</label>
                <input className="input-field" type="email" placeholder="team@company.com" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} style={{ fontSize: 12 }} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: "#444", letterSpacing: "0.07em", display: "block", marginBottom: 7 }}>SUBJECT</label>
                <input className="input-field" type="text" placeholder={defaultSubject} value={subject} onChange={(e) => setSubject(e.target.value)} style={{ fontSize: 12 }} />
              </div>
            </div>

            {/* n8n payload preview */}
            <div style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: 6, padding: "12px 14px", marginBottom: 18 }}>
              <p style={{ fontSize: 10, color: "#333", letterSpacing: "0.06em", marginBottom: 8 }}>WEBHOOK PAYLOAD PREVIEW</p>
              <pre style={{ fontSize: 10, color: "#3a3a3a", lineHeight: 1.6, overflow: "hidden", textOverflow: "ellipsis" }}>
{`{
  "to": "${recipientEmail || "..."}",
  "subject": "${subject || defaultSubject}",
  "body": "${refinedContent.slice(0, 60).replace(/\n/g, "\\n")}${refinedContent.length > 60 ? "..." : ""}",
  "template": "${selectedTemplate}"
}`}
              </pre>
            </div>

            {status === "error" && (
              <div style={{ marginBottom: 16, padding: "10px 14px", background: "#160808", border: "1px solid #2e1010", borderRadius: 6 }}>
                <p style={{ fontSize: 12, color: "#f87171" }}>⚠ {errorMsg}</p>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button className="btn-ghost" onClick={() => { setStep(2); setStatus("refined"); }}>← back</button>
              <div style={{ display: "flex", gap: 10 }}>
                <button className="btn-ghost" onClick={() => setShowPreview(true)} style={{ fontSize: 11 }}>preview</button>
                <button className="btn-primary" disabled={!recipientEmail || status === "sending"} onClick={sendViaWebhook}>
                  {status === "sending" ? <span className="pulse">sending...</span> : "send via n8n →"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4 */}
        {step === 4 && (
          <div className="fade-in" style={{ textAlign: "center", padding: "48px 0" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#0d2018", border: "1px solid #1a3a25", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", fontSize: 28 }}>
              ✉
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 300, fontFamily: "'DM Sans', sans-serif", marginBottom: 10, color: "#4ade80" }}>
              Update sent
            </h1>
            <p style={{ fontSize: 13, color: "#444", marginBottom: 4 }}>
              Delivered via Resend to <span style={{ color: "#666" }}>{recipientEmail}</span>
            </p>
            <p style={{ fontSize: 11, color: "#2a2a2a", marginBottom: 44 }}>
              {new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} · {selectedTemplate} template
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button className="btn-ghost" onClick={() => { setStep(3); setStatus("sent"); }}>view details</button>
              <button className="btn-primary" onClick={reset}>send another →</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}