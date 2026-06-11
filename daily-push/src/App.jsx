import { useState, useEffect, useRef, useCallback, useMemo } from "react";

const DEFAULT_TEMPLATES = [
  {
    id: "standup", name: "Daily Standup", isDefault: true,
    fields: [
      { key: "done", label: "What I accomplished", placeholder: "Completed the login page UI, fixed 3 bugs in auth flow..." },
      { key: "blockers", label: "Blockers / Issues", placeholder: "Waiting on API keys from backend team..." },
      { key: "tomorrow", label: "Upcoming tasks", placeholder: "Start working on dashboard charts..." },
    ],
    aiPrompt: "Refine this daily standup update into a concise, professional format. Keep it brief and to the point.\n\nDone: {{done}}\nBlockers: {{blockers}}\nTomorrow: {{tomorrow}}",
  },
  {
    id: "progress", name: "Progress Report", isDefault: true,
    fields: [
      { key: "done", label: "Accomplishments", placeholder: "Shipped v2.1 with dark mode, reviewed 4 PRs..." },
      { key: "metrics", label: "Key Metrics", placeholder: "Closed 7 tickets, 92% test coverage..." },
      { key: "learnings", label: "Key Learnings", placeholder: "Discovered a better way to handle state..." },
    ],
    aiPrompt: "Polish this progress report into a clear, professional summary. Make it engaging and highlight achievements.\n\nAccomplishments: {{done}}\nMetrics: {{metrics}}\nLearnings: {{learnings}}",
  },
  {
    id: "client", name: "Client Update", isDefault: true,
    fields: [
      { key: "done", label: "Work Completed", placeholder: "Implemented the requested feature, tested on staging..." },
      { key: "status", label: "Project Status", placeholder: "On track for Friday deadline..." },
      { key: "next", label: "Next Steps", placeholder: "Deploy to production, gather feedback..." },
    ],
    aiPrompt: "Rewrite this as a polished, professional client-facing project update. Be reassuring and clear.\n\nWork Done: {{done}}\nStatus: {{status}}\nNext Steps: {{next}}",
  },
];

const API_URL = "https://dailypush-backend.onrender.com";

function buildPrompt(template, formData) {
  let prompt = template.aiPrompt || "";
  template.fields.forEach(f => {
    prompt = prompt.replace(new RegExp(`{{${f.key}}}`, "g"), formData[f.key] || "N/A");
  });
  return prompt;
}

function parseTemplate(raw) {
  const lines = raw.replace(/\r\n/g,"\n").replace(/\r/g,"\n").split("\n").map(l=>l.trim()).filter(Boolean);
  const fields = []; const seenKeys = new Set();
  lines.forEach(line => {
    const colonIdx = line.indexOf(":");
    if (colonIdx < 1) return;
    const label = line.slice(0, colonIdx).trim();
    const placeholder = line.slice(colonIdx+1).trim();
    if (!label) return;
    let key = label.toLowerCase().replace(/\s+/g,"_").replace(/[^a-z0-9_]/g,"");
    if (!key) return;
    if (seenKeys.has(key)) key = `${key}_${seenKeys.size}`;
    seenKeys.add(key);
    fields.push({ key, label, placeholder });
  });
  return fields;
}

// ── Three-dot menu ──────────────────────────────────────────────────
function ThreeDotMenu({ onEdit, onDelete }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        style={{ 
          width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
          background: "transparent", border: "1px solid #2a2a42", borderRadius: 8, color: "#94a3b8", 
          cursor: "pointer", transition: "all .15s", padding: 0
        }}
        onMouseOver={e => { e.currentTarget.style.borderColor = "#6366f1"; e.currentTarget.style.color = "#a5b4fc"; }}
        onMouseOut={e => { e.currentTarget.style.borderColor = "#2a2a42"; e.currentTarget.style.color = "#94a3b8"; }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
          <circle cx="7" cy="2" r="1.5"/>
          <circle cx="7" cy="7" r="1.5"/>
          <circle cx="7" cy="12" r="1.5"/>
        </svg>
      </button>
      {open && (
        <div style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", background: "#1a1a2e", border: "1px solid #2a2a42", borderRadius: 8, minWidth: 150, zIndex: 50, overflow: "hidden", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
          <button onClick={e => { e.stopPropagation(); setOpen(false); onEdit(); }} style={{ display: "block", width: "100%", background: "none", border: "none", color: "#cbd5e1", padding: "10px 16px", textAlign: "left", cursor: "pointer", fontSize: 13 }}
            onMouseOver={e => e.currentTarget.style.background = "#252540"}
            onMouseOut={e => e.currentTarget.style.background = "none"}
          >Edit template</button>
          <button onClick={e => { e.stopPropagation(); setOpen(false); onDelete(); }} style={{ display: "block", width: "100%", background: "none", border: "none", color: "#f87171", padding: "10px 16px", textAlign: "left", cursor: "pointer", fontSize: 13 }}
            onMouseOver={e => e.currentTarget.style.background = "#1a0808"}
            onMouseOut={e => e.currentTarget.style.background = "none"}
          >Delete template</button>
        </div>
      )}
    </div>
  );
}

// ── Email chip input ────────────────────────────────────────────────
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
      <label style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, display: "block", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</label>
      <div style={{ background: "#13131f", border: "1.5px solid #1e2235", borderRadius: 8, padding: "8px 12px", minHeight: 46, display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", cursor: "text", transition: "border-color .2s" }}
        onClick={e => e.currentTarget.querySelector("input")?.focus()}>
        {chips.map((chip, i) => (
          <span key={i} style={{ background: "#1e1b4b", border: "1px solid #3730a3", borderRadius: 5, padding: "3px 8px", fontSize: 12, color: "#a5b4fc", display: "flex", alignItems: "center", gap: 5 }}>
            {chip}
            <span onClick={() => removeChip(i)} style={{ cursor: "pointer", color: "#6366f1", fontSize: 14, lineHeight: 1, fontWeight: 600 }}>×</span>
          </span>
        ))}
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (["Enter",",",";","Tab"].includes(e.key)) { e.preventDefault(); addChip(input); } if (e.key==="Backspace"&&!input&&chips.length) removeChip(chips.length-1); }}
          onBlur={() => input && addChip(input)}
          onPaste={e => { e.preventDefault(); addChip(e.clipboardData.getData("text")); }}
          placeholder={chips.length === 0 ? placeholder : ""}
          style={{ border:"none", outline:"none", background:"transparent", color:"#e2e8f0", fontSize:14, fontFamily:"Inter,sans-serif", flex:1, minWidth:140 }}
        />
      </div>
      <p style={{ fontSize: 11, color: "#64748b", marginTop: 5 }}>Press Enter or comma to add. Paste multiple at once.</p>
    </div>
  );
}

// ── History page ────────────────────────────────────────────────────
function HistoryPage({ apiUrl, user }) {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [detailView, setDetailView] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("dp_token");
    fetch(`${apiUrl}/emails/history`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => { setEmails(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [apiUrl]);

  const fmt = (d) => new Date(d).toLocaleDateString("en-IN", { day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" });

  if (loading) {
    return (
      <main style={{ maxWidth: 760, margin: "0 auto", padding: "48px 24px" }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 22, fontFamily: "'Sora',sans-serif", fontWeight: 600, color: "#e2e8f0", marginBottom: 4 }}>Email History</h1>
          <p style={{ fontSize: 13, color: "#94a3b8" }}>Loading your sent updates...</p>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {[1,2,3].map(i => <div key={i} style={{ background:"#13131f", border:"1px solid #1a1a2e", borderRadius:12, height:88, animation:"pulse 1.5s infinite" }} />)}
        </div>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "48px 24px" }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 22, fontFamily: "'Sora',sans-serif", fontWeight: 600, color: "#e2e8f0", marginBottom: 4 }}>Email History</h1>
        <p style={{ fontSize: 13, color: "#94a3b8" }}>
          {emails.length > 0 ? `${emails.length} update${emails.length !== 1 ? 's' : ''} from the last 5 days` : 'Your sent updates will appear here'}
        </p>
      </div>

      {emails.length === 0 ? (
        <div style={{ textAlign:"center", padding:"72px 0" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#1a1a2e", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4a4a6a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
          </div>
          <p style={{ fontSize:16, color:"#cbd5e1", marginBottom:8 }}>No emails sent yet</p>
          <p style={{ fontSize:13, color:"#94a3b8" }}>Start sending updates to see them here</p>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {emails.map(e => {
            const isOpen = expandedId === e.id;
            return (
              <div key={e.id} style={{ 
                background:"#13131f", 
                border:`1px solid ${isOpen?"#3730a3":"#1a1a2e"}`, 
                borderRadius:12, 
                overflow:"hidden", 
                transition:"border-color .2s"
              }}>
                {/* Row header */}
                <div style={{ padding:"16px 20px", cursor:"pointer", display:"flex", alignItems:"center", gap:14 }}
                  onClick={() => setExpandedId(isOpen ? null : e.id)}>
                  {/* Status dot */}
                  <div style={{ 
                    width:10, height:10, borderRadius:"50%", 
                    background: e.status==="sent"?"#4ade80":"#f87171", flexShrink:0, 
                    boxShadow: e.status==="sent"?"0 0 6px rgba(74,222,128,.5)":"0 0 6px rgba(248,113,113,.5)" 
                  }} />
                  {/* Main info */}
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontSize:14, color:"#e2e8f0", fontWeight:500, marginBottom:4, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{e.subject}</p>
                    <div style={{ display:"flex", gap:12, flexWrap:"wrap", alignItems:"center" }}>
                      <span style={{ fontSize:12, color:"#94a3b8" }}>To: <span style={{ color:"#cbd5e1" }}>{e.to_emails?.slice(0,2).join(", ")}{e.to_emails?.length>2?` +${e.to_emails.length-2} more`:""}</span></span>
                      {e.template_name && <span style={{ fontSize:11, color:"#a5b4fc", background:"rgba(99,102,241,.1)", border:"1px solid rgba(99,102,241,.2)", borderRadius:4, padding:"1px 6px" }}>{e.template_name}</span>}
                    </div>
                  </div>
                  {/* Time + chevron */}
                  <div style={{ display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
                    <span style={{ fontSize:11, color:"#94a3b8" }}>{fmt(e.created_at)}</span>
                    <span style={{ color:"#94a3b8", fontSize:12, transition:"transform .2s", transform: isOpen?"rotate(180deg)":"rotate(0deg)", display:"inline-block" }}>▾</span>
                  </div>
                </div>

                {/* Expanded body */}
                {isOpen && (
                  <div style={{ borderTop:"1px solid #1a1a2e", padding:"20px 20px 24px" }}>
                    {/* Recipients section */}
                    <div style={{ marginBottom:18 }}>
                      <p style={{ fontSize:11, color:"#94a3b8", fontWeight:600, marginBottom:10, textTransform:"uppercase", letterSpacing:"0.06em" }}>Recipients</p>
                      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                        {e.to_emails?.length > 0 && (
                          <div style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
                            <span style={{ fontSize:11, color:"#6366f1", fontWeight:600, minWidth:40, textTransform:"uppercase" }}>To</span>
                            <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
                              {e.to_emails.map((em,i) => (
                                <span key={i} style={{ fontSize:12, color:"#cbd5e1", background:"#0f0f1a", border:"1px solid #1e2235", borderRadius:4, padding:"2px 8px" }}>{em}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {e.cc_emails?.length > 0 && (
                          <div style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
                            <span style={{ fontSize:11, color:"#6366f1", fontWeight:600, minWidth:40, textTransform:"uppercase" }}>CC</span>
                            <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
                              {e.cc_emails.map((em,i) => (
                                <span key={i} style={{ fontSize:12, color:"#cbd5e1", background:"#0f0f1a", border:"1px solid #1e2235", borderRadius:4, padding:"2px 8px" }}>{em}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {e.bcc_emails?.length > 0 && (
                          <div style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
                            <span style={{ fontSize:11, color:"#6366f1", fontWeight:600, minWidth:40, textTransform:"uppercase" }}>BCC</span>
                            <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
                              {e.bcc_emails.map((em,i) => (
                                <span key={i} style={{ fontSize:12, color:"#cbd5e1", background:"#0f0f1a", border:"1px solid #1e2235", borderRadius:4, padding:"2px 8px" }}>{em}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Body */}
                    <div style={{ background:"#0f0f1a", border:"1px solid #1e2235", borderRadius:10, padding:"20px" }}>
                      <p style={{ fontSize:11, color:"#94a3b8", fontWeight:600, marginBottom:14, textTransform:"uppercase", letterSpacing:"0.06em" }}>Message Content</p>
                      <div style={{ fontSize:14, color:"#cbd5e1", lineHeight:1.8, whiteSpace:"pre-wrap" }}>
                        {e.body}
                      </div>
                    </div>

                    {/* Footer meta */}
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:16, paddingTop:14, borderTop:"1px solid #1a1a2e" }}>
                      <div style={{ display:"flex", gap:16, alignItems:"center" }}>
                        <span style={{ fontSize:11, color:"#94a3b8" }}>Sent by <span style={{ color:"#cbd5e1" }}>{user?.email}</span></span>
                        <span style={{ fontSize:11, color: e.status==="sent"?"#4ade80":"#f87171", display:"flex", alignItems:"center", gap:4 }}>
                          <span style={{ width:6, height:6, borderRadius:"50%", background: e.status==="sent"?"#4ade80":"#f87171", display:"inline-block" }}></span>
                          {e.status==="sent"?"Delivered":"Failed"}
                        </span>
                      </div>
                      <span style={{ fontSize:11, color:"#64748b" }}>{fmt(e.created_at)}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

// ── Main App ────────────────────────────────────────────────────────
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
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [customTemplates, setCustomTemplates] = useState([]);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [page, setPage] = useState("app");

  // Template builder state
  const [tb, setTb] = useState({ name:"", rawText:"", fields:[], aiPrompt:"" });
  const [tbParsed, setTbParsed] = useState(false);

  const allTemplates = useMemo(() => [...DEFAULT_TEMPLATES, ...customTemplates], [customTemplates]);
  const template = allTemplates.find(t => t.id === selectedTemplate);
  const defaultSubject = `Daily Update — ${new Date().toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" })}`;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (token) { localStorage.setItem("dp_token", token); window.history.replaceState({}, "", "/"); }
    const savedToken = token || localStorage.getItem("dp_token");
    if (savedToken) {
      fetch(`${API_URL}/me`, { headers: { Authorization: `Bearer ${savedToken}` } })
        .then(r => r.ok ? r.json() : null)
        .then(u => { setUser(u); setAuthLoading(false); })
        .catch(() => setAuthLoading(false));
    } else { setAuthLoading(false); }
  }, []);

  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem("dp_token");
    fetch(`${API_URL}/templates`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => setCustomTemplates(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [user]);

  const handleLogout = () => { localStorage.removeItem("dp_token"); setUser(null); };
  const handleFieldChange = (key, val) => setFormData(prev => ({ ...prev, [key]: val }));
  const selectTemplate = (id) => { setSelectedTemplate(id); setFormData({}); setRefinedContent(""); setStep(2); };

  const tbParse = () => {
    const fields = parseTemplate(tb.rawText);
    if (!fields.length) { alert("No fields detected. Each line needs a colon:\nField Name: placeholder text"); return; }
    const vars = fields.map(f => `${f.label}: {{${f.key}}}`).join("\n");
    const prompt = `Refine this ${tb.name||"update"} into a concise, professional format.\n\n${vars}`;
    setTb(p => ({ ...p, fields, aiPrompt: prompt }));
    setTbParsed(true);
  };

  const openAddTemplate = () => { setEditingTemplate(null); setTb({ name:"", rawText:"", fields:[], aiPrompt:"" }); setTbParsed(false); setShowTemplateBuilder(true); };
  const openEditTemplate = (t) => { setEditingTemplate(t); setTb({ name:t.name, rawText:t.rawText||"", fields:t.fields, aiPrompt:t.aiPrompt }); setTbParsed(true); setShowTemplateBuilder(true); };

  const tbSave = async () => {
    if (!tb.name || !tb.fields.length) return;
    const token = localStorage.getItem("dp_token");
    try {
      if (editingTemplate) {
        const res = await fetch(`${API_URL}/templates/${editingTemplate.id}`, {
          method: "PUT",
          headers: { "Content-Type":"application/json", Authorization:`Bearer ${token}` },
          body: JSON.stringify({ name:tb.name, raw_text:tb.rawText, fields:tb.fields, ai_prompt:tb.aiPrompt }),
        });
        const saved = await res.json();
        setCustomTemplates(prev => prev.map(t => t.id===editingTemplate.id ? { ...saved, aiPrompt:saved.ai_prompt } : t));
      } else {
        const res = await fetch(`${API_URL}/templates`, {
          method: "POST",
          headers: { "Content-Type":"application/json", Authorization:`Bearer ${token}` },
          body: JSON.stringify({ name:tb.name, raw_text:tb.rawText, fields:tb.fields, ai_prompt:tb.aiPrompt }),
        });
        const saved = await res.json();
        setCustomTemplates(prev => [...prev, { ...saved, aiPrompt:saved.ai_prompt }]);
      }
      setShowTemplateBuilder(false);
      setEditingTemplate(null);
      setTb({ name:"", rawText:"", fields:[], aiPrompt:"" });
      setTbParsed(false);
    } catch { alert("Failed to save template"); }
  };

  const deleteCustomTemplate = async (id) => {
    if (!confirm("Delete this template? This action cannot be undone.")) return;
    const token = localStorage.getItem("dp_token");
    await fetch(`${API_URL}/templates/${id}`, { method:"DELETE", headers:{ Authorization:`Bearer ${token}` } });
    setCustomTemplates(prev => prev.filter(t => t.id !== id));
    if (selectedTemplate === id) { setSelectedTemplate(null); setStep(1); }
  };

  const refineWithGroq = async () => {
    if (!formData[template.fields[0].key]) { setErrorMsg("Fill in at least the first field."); setStatus("error"); return; }
    setStatus("refining"); setErrorMsg("");
    const token = localStorage.getItem("dp_token");
    try {
      const res = await fetch(`${API_URL}/refine`, {
        method:"POST", headers:{ "Content-Type":"application/json", Authorization:`Bearer ${token}` },
        body: JSON.stringify({ prompt: buildPrompt(template, formData) }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail||"Refine failed"); }
      const data = await res.json();
      setRefinedContent(data.refined); setStatus("refined"); setStep(3);
    } catch(e) { setErrorMsg(e.message); setStatus("error"); }
  };

  const sendEmail = async () => {
    if (!toEmails.length) { setErrorMsg("Add at least one recipient."); setStatus("error"); return; }
    setStatus("sending"); setErrorMsg("");
    const token = localStorage.getItem("dp_token");
    try {
      const res = await fetch(`${API_URL}/send`, {
        method:"POST", headers:{ "Content-Type":"application/json", Authorization:`Bearer ${token}` },
        body: JSON.stringify({ to:toEmails, cc:ccEmails, bcc:bccEmails, subject:subject||defaultSubject, body:refinedContent, template_name:template?.name||selectedTemplate }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail||"Send failed"); }
      setStatus("sent"); setStep(4);
    } catch(e) { setErrorMsg(e.message); setStatus("error"); }
  };

  const reset = () => {
    setStep(1); setSelectedTemplate(null); setFormData({}); setRefinedContent("");
    setStatus(null); setErrorMsg(""); setToEmails([]); setCcEmails([]); setBccEmails([]);
    setSubject(""); setShowPreview(false); setShowCcBcc(false);
  };

  const accent = "#6366f1";
  const accentHover = "#818cf8";
  const surface = "#13131f";
  const border = "#1e2235";
  const borderHover = "#2a2a42";

  if (authLoading) return (
    <div style={{ minHeight:"100vh", background:"#0d0d14", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Inter,sans-serif" }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ width:32, height:32, border:"2px solid #1e2235", borderTopColor:"#6366f1", borderRadius:"50%", animation:"spin .7s linear infinite", margin:"0 auto 16px" }} />
        <p style={{ color:"#94a3b8", fontSize:13 }}>Loading...</p>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (!user) return (
    <div style={{ minHeight:"100vh", background:"#0d0d14", fontFamily:"Inter,sans-serif", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:24 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Sora:wght@400;600&display=swap'); *{box-sizing:border-box;margin:0;padding:0}`}</style>
      <div style={{ textAlign:"center", maxWidth:400 }}>
        <div style={{ 
          width:64, height:64, borderRadius:16, 
          background: "linear-gradient(135deg, #6366f1, #8b5cf6)", 
          display:"flex", alignItems:"center", justifyContent:"center", 
          margin:"0 auto 24px", boxShadow:"0 8px 32px rgba(99,102,241,.25)"
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
        </div>
        <h1 style={{ fontSize:30, fontFamily:"'Sora',sans-serif", fontWeight:600, color:"#e2e8f0", marginBottom:12, letterSpacing:"-0.02em" }}>Daily Push</h1>
        <p style={{ fontSize:15, color:"#94a3b8", lineHeight:1.7, marginBottom:40 }}>Write your daily update, let AI refine it, send it from your Gmail — in under 2 minutes.</p>
        <a href={`${API_URL}/auth/google`} style={{ 
          display:"inline-flex", alignItems:"center", gap:12, background:"#fff", color:"#1a1a2e", 
          padding:"13px 28px", borderRadius:10, fontSize:14, fontWeight:500, textDecoration:"none", 
          boxShadow:"0 4px 20px rgba(0,0,0,.3)", transition:"all .2s"
        }}
        onMouseOver={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 6px 24px rgba(0,0,0,.4)"; }}
        onMouseOut={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,.3)"; }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </a>
        <p style={{ fontSize:12, color:"#64748b", marginTop:20 }}>No password needed · Sends from your Gmail</p>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:"#0d0d14", fontFamily:"'Inter',sans-serif", color:"#e2e8f0" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Sora:wght@300;400;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:5px} ::-webkit-scrollbar-track{background:#13131f} ::-webkit-scrollbar-thumb{background:#2a2a3d;border-radius:3px}
        textarea,input,select{font-family:'Inter',sans-serif!important}
        .fade-in{animation:fadeIn .35s ease forwards}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        .pulse{animation:pulse 1.5s infinite}
        .btn-primary{background:${accent};color:#fff;border:none;padding:11px 24px;font-family:'Inter',sans-serif;font-size:14px;font-weight:500;cursor:pointer;border-radius:10px;transition:all .2s;display:inline-flex;align-items:center;gap:6px}
        .btn-primary:hover{background:${accentHover};transform:translateY(-1px);box-shadow:0 4px 20px rgba(99,102,241,.35)}
        .btn-primary:disabled{opacity:.35;cursor:not-allowed;transform:none;box-shadow:none}
        .btn-ghost{background:transparent;color:#cbd5e1;border:1px solid ${border};padding:10px 20px;font-family:'Inter',sans-serif;font-size:13px;cursor:pointer;border-radius:10px;transition:all .2s}
        .btn-ghost:hover{border-color:${accent};color:#a5b4fc;background:rgba(99,102,241,.06)}
        .btn-outline-accent{background:rgba(99,102,241,.06);color:#a5b4fc;border:1px solid #3730a3;padding:9px 16px;font-family:'Inter',sans-serif;font-size:13px;cursor:pointer;border-radius:10px;transition:all .2s}
        .btn-outline-accent:hover{background:rgba(99,102,241,.12);border-color:${accent}}
        .input-field{width:100%;background:${surface};border:1.5px solid ${border};color:#e2e8f0;padding:12px 16px;border-radius:10px;font-size:14px;outline:none;transition:border-color .2s,box-shadow .2s}
        .input-field:focus{border-color:${accent};box-shadow:0 0 0 3px rgba(99,102,241,.1)}
        .input-field::placeholder{color:#2a2d40}
        textarea.input-field{resize:vertical;line-height:1.75}
        .tpl-card{background:${surface};border:1.5px solid #1a1a2e;border-radius:12px;padding:20px;cursor:pointer;transition:all .2s;position:relative}
        .tpl-card:hover{border-color:#4338ca;background:#161625;transform:translateY(-1px);box-shadow:0 4px 20px rgba(99,102,241,.08)}
        .step-dot{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;flex-shrink:0;transition:all .3s}
        .section-label{font-size:11px;color:#64748b;letter-spacing:.08em;font-weight:500;text-transform:uppercase}
        .tag{background:#1a1a2e;border:1px solid #252540;border-radius:5px;padding:3px 10px;font-size:12px;color:#94a3b8}
        .error-box{padding:12px 16px;background:#1a0808;border:1px solid #3a1010;border-radius:10px}
        .panel{position:fixed;top:0;right:0;height:100vh;width:440px;background:#0f0f1a;border-left:1px solid #1a1a2e;padding:32px;z-index:100;overflow-y:auto;transform:translateX(100%);transition:transform .3s cubic-bezier(.4,0,.2,1);box-shadow:-8px 0 32px rgba(0,0,0,.3)}
        .panel.open{transform:translateX(0)}
        .overlay{position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:99;opacity:0;pointer-events:none;transition:opacity .3s;backdrop-filter:blur(2px)}
        .overlay.open{opacity:1;pointer-events:all}
      `}</style>

      {/* Overlay */}
      <div className={`overlay ${showTemplateBuilder?"open":""}`} onClick={() => setShowTemplateBuilder(false)} />

      {/* Header */}
      <header style={{ borderBottom:"1px solid #131320", padding:"14px 28px", display:"flex", alignItems:"center", justifyContent:"space-between", background:"#0d0d14", position:"sticky", top:0, zIndex:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:8, height:8, background:"#6366f1", borderRadius:"50%", boxShadow:"0 0 8px rgba(99,102,241,.6)" }} />
          <span style={{ fontSize:14, fontFamily:"'Sora',sans-serif", fontWeight:600, color:"#c7d2fe", letterSpacing:".04em" }}>Daily Push</span>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <span style={{ fontSize:12, color:"#94a3b8" }}>{new Date().toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short"})}</span>
          <button className="btn-ghost" onClick={() => setPage(page==="history"?"app":"history")} style={{ padding:"6px 14px", fontSize:12 }}>
            {page==="history"?"← Compose":"History"}
          </button>
          <div style={{ display:"flex", alignItems:"center", gap:8, background:"#13131f", border:"1px solid #1e2235", borderRadius:8, padding:"5px 12px" }}>
            {user.picture && <img src={user.picture} width={20} height={20} style={{ borderRadius:"50%" }} alt="" />}
            <span style={{ fontSize:12, color:"#cbd5e1" }}>{user.name?.split(" ")[0]}</span>
            <button onClick={handleLogout} style={{ background:"none", border:"none", color:"#94a3b8", cursor:"pointer", fontSize:11 }}>Sign out</button>
          </div>
        </div>
      </header>

      {/* Template Builder Panel */}
      <div className={`panel ${showTemplateBuilder?"open":""}`}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:28 }}>
          <span style={{ fontSize:16, fontFamily:"'Sora',sans-serif", fontWeight:600, color:"#a5b4fc" }}>{editingTemplate?"Edit Template":"New Template"}</span>
          <button className="btn-ghost" onClick={() => setShowTemplateBuilder(false)} style={{ padding:"4px 10px", fontSize:13 }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
          <div>
            <label style={{ fontSize:11, color:"#94a3b8", fontWeight:600, display:"block", marginBottom:8, textTransform:"uppercase", letterSpacing:"0.05em" }}>Template Name *</label>
            <input className="input-field" placeholder="e.g. Weekly Review" value={tb.name} onChange={e=>setTb(p=>({...p,name:e.target.value}))} />
          </div>
          <div>
            <label style={{ fontSize:11, color:"#94a3b8", fontWeight:600, display:"block", marginBottom:8, textTransform:"uppercase", letterSpacing:"0.05em" }}>Template Structure *</label>
            <p style={{ fontSize:11, color:"#64748b", marginBottom:8, lineHeight:1.6 }}>Define fields — one per line as <span style={{ color:"#a5b4fc", background:"rgba(99,102,241,.1)", padding:"1px 4px", borderRadius:3, fontFamily:"monospace" }}>Field Name: placeholder</span></p>
            <textarea className="input-field" placeholder={"Accomplishments: What you achieved today\nBlockers: Any issues or delays\nNext Steps: What you'll work on next"} value={tb.rawText}
              onChange={e=>{setTb(p=>({...p,rawText:e.target.value}));setTbParsed(false);}} rows={8} style={{ fontSize:13, lineHeight:1.8 }} />
            <button className="btn-outline-accent" onClick={tbParse} disabled={!tb.rawText.trim()} style={{ marginTop:8, width:"100%", justifyContent:"center", display:"flex" }}>
              Detect Fields
            </button>
          </div>

          {tbParsed && tb.fields.length > 0 && (
            <div>
              <label style={{ fontSize:11, color:"#4ade80", fontWeight:600, display:"block", marginBottom:10, textTransform:"uppercase", letterSpacing:"0.05em" }}>✓ {tb.fields.length} field{tb.fields.length !== 1 ? 's' : ''} detected</label>
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                {tb.fields.map((f,i)=>(
                  <div key={i} style={{ background:"#13131f", border:"1px solid #1e2235", borderRadius:8, padding:"10px 14px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <span style={{ fontSize:13, color:"#c7d2fe" }}>{f.label}</span>
                    <span style={{ fontSize:11, color:"#64748b", fontFamily:"monospace" }}>{`{{${f.key}}}`}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tbParsed && (
            <div>
              <label style={{ fontSize:11, color:"#94a3b8", fontWeight:600, display:"block", marginBottom:8, textTransform:"uppercase", letterSpacing:"0.05em" }}>AI Prompt (editable)</label>
              <textarea className="input-field" value={tb.aiPrompt} onChange={e=>setTb(p=>({...p,aiPrompt:e.target.value}))} rows={5} style={{ fontSize:12 }} />
            </div>
          )}

          <button className="btn-primary" onClick={tbSave} disabled={!tb.name||!tbParsed||!tb.fields.length} style={{ width:"100%", justifyContent:"center", marginTop:8 }}>
            {editingTemplate?"Save Changes":"Create Template"}
          </button>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div style={{ position:"fixed", inset:0, zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(0,0,0,.85)", padding:24, backdropFilter:"blur(4px)" }}
          onClick={()=>setShowPreview(false)}>
          <div style={{ background:"#fff", borderRadius:14, width:"100%", maxWidth:560, maxHeight:"82vh", overflowY:"auto", boxShadow:"0 24px 80px rgba(0,0,0,.5)" }} onClick={e=>e.stopPropagation()}>
            <div style={{ background:"#f8fafc", borderRadius:"14px 14px 0 0", padding:"18px 24px", borderBottom:"1px solid #e2e8f0" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                <span style={{ fontSize:11, color:"#64748b", letterSpacing:".06em", textTransform:"uppercase", fontWeight:500 }}>Email Preview</span>
                <button onClick={()=>setShowPreview(false)} style={{ background:"none", border:"none", cursor:"pointer", fontSize:18, color:"#64748b" }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
              {[["From", user?.email||"your@gmail.com"],["To",toEmails.join(", ")||"—"],ccEmails.length?["CC",ccEmails.join(", ")]:null,bccEmails.length?["BCC",bccEmails.join(", ")]:null,["Subject",subject||defaultSubject]].filter(Boolean).map(([k,v])=>(
                <div key={k} style={{ display:"flex", gap:10, marginBottom:4, fontSize:13 }}>
                  <span style={{ color:"#94a3b8", minWidth:60 }}>{k}:</span>
                  <span style={{ color:"#1e293b", fontWeight:k==="Subject"?600:400 }}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{ padding:"28px 24px" }}>
              <p style={{ fontSize:14, color:"#1e293b", lineHeight:1.85, whiteSpace:"pre-wrap" }}>{refinedContent||"(No content yet)"}</p>
              <div style={{ marginTop:32, paddingTop:16, borderTop:"1px solid #f1f5f9" }}>
                <p style={{ fontSize:11, color:"#94a3b8" }}>Sent via Daily Push · {new Date().toLocaleDateString("en-IN",{day:"numeric",month:"long",year:"numeric"})}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History */}
      {page === "history" && <HistoryPage apiUrl={API_URL} user={user} />}

      {/* App */}
      {page === "app" && (
        <main style={{ maxWidth:640, margin:"0 auto", padding:"48px 24px" }}>

          {/* Steps */}
          <div style={{ display:"flex", alignItems:"center", marginBottom:48 }}>
            {["Template","Compose","Review","Done"].map((label,i)=>{
              const n=i+1, active=step===n, done=step>n;
              return (
                <div key={n} style={{ display:"flex", alignItems:"center", flex:i<3?1:"none" }}>
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6 }}>
                    <div className="step-dot" style={{ 
                      background:done||active?accent:surface, 
                      color:done||active?"#fff":"#2a2d40", 
                      border:active||done?"none":`1.5px solid ${border}`, 
                      boxShadow:active?`0 0 0 4px rgba(99,102,241,.15)`:done?"none":"none" 
                    }}>
                      {done?(
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      ):n}
                    </div>
                    <span style={{ fontSize:10, color:active?"#a5b4fc":done?"#6366f1":"#2a2d40", fontWeight:active?500:400, textTransform:"uppercase", letterSpacing:"0.05em" }}>{label}</span>
                  </div>
                  {i<3 && <div style={{ flex:1, height:1.5, background:done?accent:"#1a1a2e", margin:"0 8px", marginBottom:22, borderRadius:1, transition:"background .4s" }} />}
                </div>
              );
            })}
          </div>

          {/* STEP 1 */}
          {step === 1 && (
            <div className="fade-in">
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:32 }}>
                <div>
                  <h1 style={{ fontSize:24, fontWeight:600, fontFamily:"'Sora',sans-serif", color:"#e2e8f0", marginBottom:6 }}>Choose a template</h1>
                  <p style={{ fontSize:14, color:"#94a3b8" }}>Select a format for your update</p>
                </div>
                <button className="btn-outline-accent" onClick={openAddTemplate}>+ New Template</button>
              </div>

              <p className="section-label" style={{ marginBottom:12 }}>Default Templates</p>
              <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:32 }}>
                {DEFAULT_TEMPLATES.map(t => (
                  <div key={t.id} className="tpl-card" onClick={() => selectTemplate(t.id)}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <div style={{ flex:1 }}>
                        <p style={{ fontSize:14, fontFamily:"'Sora',sans-serif", fontWeight:500, color:"#e2e8f0", marginBottom:10 }}>{t.name}</p>
                        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                          {t.fields.map(f=><span key={f.key} className="tag">{f.label}</span>)}
                        </div>
                      </div>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3a3a58" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft:12, flexShrink:0 }}>
                        <polyline points="9 18 15 12 9 6"/>
                      </svg>
                    </div>
                  </div>
                ))}
              </div>

              {customTemplates.length > 0 && (
                <>
                  <p className="section-label" style={{ marginBottom:12 }}>Your Templates</p>
                  <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                    {customTemplates.map(t => (
                      <div key={t.id} className="tpl-card" onClick={() => selectTemplate(t.id)}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                              <p style={{ fontSize:14, fontFamily:"'Sora',sans-serif", fontWeight:500, color:"#e2e8f0" }}>{t.name}</p>
                              <span style={{ fontSize:10, color:"#a5b4fc", background:"rgba(99,102,241,.1)", border:"1px solid rgba(99,102,241,.2)", borderRadius:4, padding:"1px 6px", textTransform:"uppercase", letterSpacing:"0.05em" }}>Custom</span>
                            </div>
                            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                              {t.fields.map(f=><span key={f.key} className="tag">{f.label}</span>)}
                            </div>
                          </div>
                          <div style={{ display:"flex", alignItems:"center", gap:8, marginLeft:12 }} onClick={e=>e.stopPropagation()}>
                            <ThreeDotMenu onEdit={() => openEditTemplate(t)} onDelete={() => deleteCustomTemplate(t.id)} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && template && (
            <div className="fade-in">
              <div style={{ marginBottom:32 }}>
                <h1 style={{ fontSize:24, fontWeight:600, fontFamily:"'Sora',sans-serif", color:"#e2e8f0", marginBottom:6 }}>{template.name}</h1>
                <p style={{ fontSize:14, color:"#94a3b8" }}>Fill in your update — AI will polish it</p>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
                {template.fields.map((f,idx)=>(
                  <div key={f.key}>
                    <label style={{ fontSize:11, color:"#cbd5e1", fontWeight:600, display:"block", marginBottom:8, textTransform:"uppercase", letterSpacing:"0.05em" }}>
                      {f.label}{idx===0&&<span style={{ color:"#6366f1" }}> *</span>}
                    </label>
                    <textarea className="input-field" placeholder={f.placeholder} value={formData[f.key]||""} onChange={e=>handleFieldChange(f.key,e.target.value)} rows={4} />
                  </div>
                ))}
              </div>
              {status==="error" && <div className="error-box" style={{ marginTop:16 }}><p style={{ fontSize:13, color:"#f87171" }}>{errorMsg}</p></div>}
              <div style={{ marginTop:32, display:"flex", justifyContent:"space-between", paddingTop:20, borderTop:"1px solid #1a1a2e" }}>
                <button className="btn-ghost" onClick={()=>{setStep(1);setStatus(null);}}>← Back</button>
                <button className="btn-primary" disabled={!formData[template.fields[0].key]||status==="refining"} onClick={refineWithGroq}>
                  {status==="refining"?<><span style={{ width:16, height:16, border:"2px solid rgba(255,255,255,.3)", borderTopColor:"#fff", borderRadius:"50%", animation:"spin .7s linear infinite", display:"inline-block" }}></span> Refining...</>:"Refine with AI →"}
                </button>
              </div>
            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div className="fade-in">
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:28 }}>
                <div>
                  <h1 style={{ fontSize:24, fontWeight:600, fontFamily:"'Sora',sans-serif", color:"#e2e8f0", marginBottom:6 }}>Review & Send</h1>
                  <p style={{ fontSize:14, color:"#94a3b8" }}>Edit if needed, then send your update</p>
                </div>
                <button className="btn-outline-accent" onClick={()=>setShowPreview(true)}>Preview</button>
              </div>

              <div style={{ marginBottom:24 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                  <label style={{ fontSize:11, color:"#cbd5e1", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.05em" }}>Refined Update</label>
                  <span style={{ fontSize:11, color:"#64748b" }}>{refinedContent.length} characters</span>
                </div>
                <textarea className="input-field" value={refinedContent} onChange={e=>setRefinedContent(e.target.value)} rows={8} style={{ lineHeight:1.8, fontSize:14 }} />
              </div>

              <div style={{ display:"flex", flexDirection:"column", gap:16, marginBottom:20 }}>
                <EmailChipInput label={<>To <span style={{ color:"#6366f1" }}>*</span></>} chips={toEmails} onChange={setToEmails} placeholder="Add recipient emails..." />
                <button className="btn-ghost" onClick={()=>setShowCcBcc(!showCcBcc)} style={{ fontSize:12, padding:"5px 12px", alignSelf:"flex-start", display:"flex", alignItems:"center", gap:4 }}>
                  <span style={{ transition:"transform .2s", transform: showCcBcc?"rotate(90deg)":"rotate(0deg)", display:"inline-block" }}>›</span>
                  {showCcBcc?"Hide CC / BCC":"Add CC / BCC"}
                </button>
                {showCcBcc && <>
                  <EmailChipInput label="CC" chips={ccEmails} onChange={setCcEmails} placeholder="CC emails..." />
                  <EmailChipInput label="BCC" chips={bccEmails} onChange={setBccEmails} placeholder="BCC emails..." />
                </>}
                <div>
                  <label style={{ fontSize:11, color:"#cbd5e1", fontWeight:600, display:"block", marginBottom:8, textTransform:"uppercase", letterSpacing:"0.05em" }}>Subject</label>
                  <input className="input-field" placeholder={defaultSubject} value={subject} onChange={e=>setSubject(e.target.value)} />
                </div>
              </div>

              {status==="error" && <div className="error-box" style={{ marginBottom:16 }}><p style={{ fontSize:13, color:"#f87171" }}>{errorMsg}</p></div>}

              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", paddingTop:20, borderTop:"1px solid #1a1a2e" }}>
                <button className="btn-ghost" onClick={()=>{setStep(2);setStatus("refined");}}>← Back</button>
                <div style={{ display:"flex", gap:8 }}>
                  <button className="btn-ghost" onClick={()=>setShowPreview(true)} style={{ fontSize:13 }}>Preview</button>
                  <button className="btn-primary" disabled={!toEmails.length||status==="sending"} onClick={sendEmail}>
                    {status==="sending"?<><span style={{ width:16, height:16, border:"2px solid rgba(255,255,255,.3)", borderTopColor:"#fff", borderRadius:"50%", animation:"spin .7s linear infinite", display:"inline-block" }}></span> Sending...</>:`Send to ${toEmails.length} ${toEmails.length===1?"recipient":"recipients"} →`}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4 */}
          {step === 4 && (
            <div className="fade-in" style={{ textAlign:"center", padding:"64px 0" }}>
              <div style={{ 
                width:72, height:72, borderRadius:18, 
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)", 
                display:"flex", alignItems:"center", justifyContent:"center", 
                margin:"0 auto 24px", boxShadow:"0 8px 32px rgba(99,102,241,.25)"
              }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <h1 style={{ fontSize:26, fontWeight:600, fontFamily:"'Sora',sans-serif", marginBottom:8, color:"#a5b4fc" }}>Update Sent</h1>
              <p style={{ fontSize:14, color:"#cbd5e1", marginBottom:4 }}>
                Delivered to <span style={{ color:"#6366f1", fontWeight:500 }}>{toEmails.length} recipient{toEmails.length!==1?"s":""}</span>
                {ccEmails.length>0&&<span style={{ color:"#94a3b8" }}> · {ccEmails.length} CC</span>}
              </p>
              <p style={{ fontSize:12, color:"#64748b", marginBottom:48 }}>
                {new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})} · {template?.name}
              </p>
              <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
                <button className="btn-ghost" onClick={()=>{setStep(3);setStatus("sent");}}>View Details</button>
                <button className="btn-primary" onClick={reset}>Send Another Update →</button>
              </div>
            </div>
          )}
        </main>
      )}
    </div>
  );
}