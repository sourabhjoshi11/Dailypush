import { useState, useEffect, useRef, useCallback } from "react";

// ── Constants ──────────────────────────────────────────────────────
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

// ── Utilities ─────────────────────────────────────────────────────
const buildPrompt = (template, formData) => {
  let prompt = template.aiPrompt || "";
  template.fields.forEach(f => {
    prompt = prompt.replace(new RegExp(`{{${f.key}}}`, "g"), formData[f.key] || "N/A");
  });
  return prompt;
};

const parseTemplate = (raw) => {
  const lines = raw.replace(/\r\n/g,"\n").replace(/\r/g,"\n").split("\n").map(l=>l.trim()).filter(Boolean);
  const fields = [];
  const seenKeys = new Set();
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
};

// ── Components ─────────────────────────────────────────────────────
const ThreeDotMenu = ({ onEdit, onDelete }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  
  useEffect(() => {
    const handler = (e) => { 
      if (ref.current && !ref.current.contains(e.target)) setOpen(false); 
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
  
  return (
    <div ref={ref} className="relative">
      <button
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-700 text-gray-400 hover:border-indigo-500 hover:text-indigo-400 transition-all duration-200"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="8" cy="3" r="1.5"/>
          <circle cx="8" cy="8" r="1.5"/>
          <circle cx="8" cy="13" r="1.5"/>
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 bg-gray-900 border border-gray-700 rounded-lg shadow-xl min-w-[140px] z-50 overflow-hidden">
          <button 
            onClick={e => { e.stopPropagation(); setOpen(false); onEdit(); }}
            className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-800 transition-colors"
          >
            Edit template
          </button>
          <button 
            onClick={e => { e.stopPropagation(); setOpen(false); onDelete(); }}
            className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-red-900/20 transition-colors"
          >
            Delete template
          </button>
        </div>
      )}
    </div>
  );
};

const EmailChipInput = ({ label, chips, onChange, placeholder }) => {
  const [input, setInput] = useState("");
  
  const addChip = useCallback((val) => {
    const emails = val.split(/[,;\s]+/).map(e => e.trim()).filter(e => e && e.includes("@"));
    if (emails.length) onChange([...chips, ...emails.filter(e => !chips.includes(e))]);
    setInput("");
  }, [chips, onChange]);
  
  const removeChip = useCallback((i) => {
    onChange(chips.filter((_, idx) => idx !== i));
  }, [chips, onChange]);
  
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-300 mb-2 uppercase tracking-wider">{label}</label>
      <div 
        className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 min-h-[44px] flex flex-wrap gap-2 items-center cursor-text hover:border-gray-600 transition-colors"
        onClick={e => e.currentTarget.querySelector("input")?.focus()}
      >
        {chips.map((chip, i) => (
          <span key={i} className="bg-indigo-900/30 border border-indigo-700/50 rounded-md px-2.5 py-1 text-xs text-indigo-300 flex items-center gap-2">
            {chip}
            <button 
              onClick={() => removeChip(i)} 
              className="text-indigo-400 hover:text-indigo-200 transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                <path d="M9 3L3 9M3 3l6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </span>
        ))}
        <input 
          value={input} 
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { 
            if (["Enter",",",";","Tab"].includes(e.key)) { 
              e.preventDefault(); 
              addChip(input); 
            } 
            if (e.key==="Backspace"&&!input&&chips.length) removeChip(chips.length-1); 
          }}
          onBlur={() => input && addChip(input)}
          onPaste={e => { e.preventDefault(); addChip(e.clipboardData.getData("text")); }}
          placeholder={chips.length === 0 ? placeholder : ""}
          className="border-none outline-none bg-transparent text-gray-200 text-sm flex-1 min-w-[140px] placeholder-gray-600"
        />
      </div>
      <p className="text-xs text-gray-500 mt-1.5">Press Enter or comma to add. Paste multiple addresses.</p>
    </div>
  );
};

// ── History Page ───────────────────────────────────────────────────
const HistoryPage = ({ apiUrl, user }) => {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [selectedEmail, setSelectedEmail] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("dp_token");
    fetch(`${apiUrl}/emails/history`, { 
      headers: { Authorization: `Bearer ${token}` } 
    })
      .then(r => r.json())
      .then(data => { 
        setEmails(Array.isArray(data) ? data : []); 
        setLoading(false); 
      })
      .catch(() => setLoading(false));
  }, [apiUrl]);

  const formatDate = (d) => new Date(d).toLocaleDateString("en-IN", { 
    day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" 
  });

  if (loading) {
    return (
      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-white mb-1">Email History</h1>
          <p className="text-sm text-gray-400">Loading your sent updates...</p>
        </div>
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl h-24 animate-pulse" />
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto px-6 py-12">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white mb-1">Email History</h1>
        <p className="text-sm text-gray-400">
          {emails.length > 0 
            ? `Showing ${emails.length} update${emails.length !== 1 ? 's' : ''} from the last 5 days`
            : 'Your sent updates will appear here'}
        </p>
      </div>

      {emails.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gray-800 flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-lg text-gray-300 mb-2">No emails sent yet</h3>
          <p className="text-sm text-gray-500">Start sending updates to see them here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {emails.map(email => {
            const isExpanded = expandedId === email.id;
            return (
              <div 
                key={email.id} 
                className={`bg-gray-900 border rounded-xl overflow-hidden transition-all duration-200 ${
                  isExpanded ? 'border-indigo-700/50 shadow-lg shadow-indigo-900/10' : 'border-gray-800 hover:border-gray-700'
                }`}
              >
                {/* Header */}
                <div 
                  className="p-5 cursor-pointer flex items-center gap-4 hover:bg-gray-850 transition-colors"
                  onClick={() => {
                    setExpandedId(isExpanded ? null : email.id);
                    setSelectedEmail(isExpanded ? null : email);
                  }}
                >
                  {/* Status indicator */}
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                    email.status === "sent" ? "bg-green-500 shadow-lg shadow-green-500/30" : "bg-red-500 shadow-lg shadow-red-500/30"
                  }`} />
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-white truncate mb-1">
                      {email.subject}
                    </h3>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span>To: {email.to_emails?.slice(0, 1).join(", ")}{email.to_emails?.length > 1 ? ` +${email.to_emails.length - 1}` : ""}</span>
                      {email.template_name && (
                        <span className="px-2 py-0.5 bg-indigo-900/30 border border-indigo-700/30 rounded text-indigo-400 text-xs">
                          {email.template_name}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Meta */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs text-gray-500">{formatDate(email.created_at)}</span>
                    <svg 
                      className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} 
                      fill="none" viewBox="0 0 24 24" stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="border-t border-gray-800">
                    {/* Recipients */}
                    <div className="p-5 pb-0 space-y-2">
                      {[
                        { label: "To", emails: email.to_emails },
                        { label: "CC", emails: email.cc_emails },
                        { label: "BCC", emails: email.bcc_emails }
                      ].map(({ label, emails }) => 
                        emails?.length > 0 && (
                          <div key={label} className="flex items-start gap-3">
                            <span className="text-xs font-semibold text-gray-500 uppercase w-10 pt-0.5">{label}</span>
                            <div className="flex flex-wrap gap-1.5">
                              {emails.map((em, i) => (
                                <span key={i} className="text-xs text-gray-300 bg-gray-800 px-2 py-0.5 rounded">
                                  {em}
                                </span>
                              ))}
                            </div>
                          </div>
                        )
                      )}
                    </div>

                    {/* Email Body */}
                    <div className="p-5">
                      <div className="bg-gray-950 border border-gray-800 rounded-lg p-5">
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Message Content</h4>
                        <div className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">
                          {email.body}
                        </div>
                      </div>

                      {/* Footer */}
                      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-800">
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span>Sent by {user?.email}</span>
                          <span className={`flex items-center gap-1.5 ${
                            email.status === "sent" ? "text-green-400" : "text-red-400"
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              email.status === "sent" ? "bg-green-400" : "bg-red-400"
                            }`} />
                            {email.status === "sent" ? "Delivered" : "Failed"}
                          </span>
                        </div>
                        <span className="text-xs text-gray-600">
                          {formatDate(email.created_at)}
                        </span>
                      </div>
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
};

// ── Main App ───────────────────────────────────────────────────────
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

  // Auth effect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (token) { 
      localStorage.setItem("dp_token", token); 
      window.history.replaceState({}, "", "/"); 
    }
    const savedToken = token || localStorage.getItem("dp_token");
    if (savedToken) {
      fetch(`${API_URL}/me`, { 
        headers: { Authorization: `Bearer ${savedToken}` } 
      })
        .then(r => r.ok ? r.json() : null)
        .then(u => { setUser(u); setAuthLoading(false); })
        .catch(() => setAuthLoading(false));
    } else { 
      setAuthLoading(false); 
    }
  }, []);

  // Fetch custom templates
  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem("dp_token");
    fetch(`${API_URL}/templates`, { 
      headers: { Authorization: `Bearer ${token}` } 
    })
      .then(r => r.json())
      .then(data => setCustomTemplates(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [user]);

  const handleLogout = () => { 
    localStorage.removeItem("dp_token"); 
    setUser(null); 
  };
  
  const handleFieldChange = (key, val) => setFormData(prev => ({ ...prev, [key]: val }));
  const selectTemplate = (id) => { 
    setSelectedTemplate(id); 
    setFormData({}); 
    setRefinedContent(""); 
    setStep(2); 
  };

  const tbParse = () => {
    const fields = parseTemplate(tb.rawText);
    if (!fields.length) { 
      alert("No fields detected. Each line needs a colon:\nField Name: placeholder text"); 
      return; 
    }
    const vars = fields.map(f => `${f.label}: {{${f.key}}}`).join("\n");
    const prompt = `Refine this ${tb.name||"update"} into a concise, professional format.\n\n${vars}`;
    setTb(p => ({ ...p, fields, aiPrompt: prompt }));
    setTbParsed(true);
  };

  const openAddTemplate = () => { 
    setEditingTemplate(null); 
    setTb({ name:"", rawText:"", fields:[], aiPrompt:"" }); 
    setTbParsed(false); 
    setShowTemplateBuilder(true); 
  };
  
  const openEditTemplate = (t) => { 
    setEditingTemplate(t); 
    setTb({ 
      name:t.name, 
      rawText:t.rawText||"", 
      fields:t.fields, 
      aiPrompt:t.aiPrompt 
    }); 
    setTbParsed(true); 
    setShowTemplateBuilder(true); 
  };

  const tbSave = async () => {
    if (!tb.name || !tb.fields.length) return;
    const token = localStorage.getItem("dp_token");
    try {
      if (editingTemplate) {
        const res = await fetch(`${API_URL}/templates/${editingTemplate.id}`, {
          method: "PUT",
          headers: { "Content-Type":"application/json", Authorization:`Bearer ${token}` },
          body: JSON.stringify({ 
            name:tb.name, 
            raw_text:tb.rawText, 
            fields:tb.fields, 
            ai_prompt:tb.aiPrompt 
          }),
        });
        const saved = await res.json();
        setCustomTemplates(prev => prev.map(t => 
          t.id===editingTemplate.id ? { ...saved, aiPrompt:saved.ai_prompt } : t
        ));
      } else {
        const res = await fetch(`${API_URL}/templates`, {
          method: "POST",
          headers: { "Content-Type":"application/json", Authorization:`Bearer ${token}` },
          body: JSON.stringify({ 
            name:tb.name, 
            raw_text:tb.rawText, 
            fields:tb.fields, 
            ai_prompt:tb.aiPrompt 
          }),
        });
        const saved = await res.json();
        setCustomTemplates(prev => [...prev, { ...saved, aiPrompt:saved.ai_prompt }]);
      }
      setShowTemplateBuilder(false);
      setEditingTemplate(null);
      setTb({ name:"", rawText:"", fields:[], aiPrompt:"" });
      setTbParsed(false);
    } catch { 
      alert("Failed to save template"); 
    }
  };

  const deleteCustomTemplate = async (id) => {
    if (!confirm("Delete this template? This action cannot be undone.")) return;
    const token = localStorage.getItem("dp_token");
    await fetch(`${API_URL}/templates/${id}`, { 
      method:"DELETE", 
      headers:{ Authorization:`Bearer ${token}` } 
    });
    setCustomTemplates(prev => prev.filter(t => t.id !== id));
    if (selectedTemplate === id) { 
      setSelectedTemplate(null); 
      setStep(1); 
    }
  };

  const refineWithGroq = async () => {
    if (!formData[template.fields[0].key]) { 
      setErrorMsg("Please fill in at least the first field."); 
      setStatus("error"); 
      return; 
    }
    setStatus("refining"); 
    setErrorMsg("");
    const token = localStorage.getItem("dp_token");
    try {
      const res = await fetch(`${API_URL}/refine`, {
        method:"POST", 
        headers:{ "Content-Type":"application/json", Authorization:`Bearer ${token}` },
        body: JSON.stringify({ prompt: buildPrompt(template, formData) }),
      });
      if (!res.ok) { 
        const e = await res.json(); 
        throw new Error(e.detail||"Refine failed"); 
      }
      const data = await res.json();
      setRefinedContent(data.refined); 
      setStatus("refined"); 
      setStep(3);
    } catch(e) { 
      setErrorMsg(e.message); 
      setStatus("error"); 
    }
  };

  const sendEmail = async () => {
    if (!toEmails.length) { 
      setErrorMsg("Add at least one recipient."); 
      setStatus("error"); 
      return; 
    }
    setStatus("sending"); 
    setErrorMsg("");
    const token = localStorage.getItem("dp_token");
    try {
      const res = await fetch(`${API_URL}/send`, {
        method:"POST", 
        headers:{ "Content-Type":"application/json", Authorization:`Bearer ${token}` },
        body: JSON.stringify({ 
          to:toEmails, 
          cc:ccEmails, 
          bcc:bccEmails, 
          subject:subject||defaultSubject, 
          body:refinedContent, 
          template_name:template?.name||selectedTemplate 
        }),
      });
      if (!res.ok) { 
        const e = await res.json(); 
        throw new Error(e.detail||"Send failed"); 
      }
      setStatus("sent"); 
      setStep(4);
    } catch(e) { 
      setErrorMsg(e.message); 
      setStatus("error"); 
    }
  };

  const reset = () => {
    setStep(1); 
    setSelectedTemplate(null); 
    setFormData({}); 
    setRefinedContent("");
    setStatus(null); 
    setErrorMsg(""); 
    setToEmails([]); 
    setCcEmails([]); 
    setBccEmails([]);
    setSubject(""); 
    setShowPreview(false); 
    setShowCcBcc(false);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gray-800 border-t-indigo-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-indigo-500/20">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-3xl font-semibold text-white mb-3 tracking-tight">Daily Push</h1>
          <p className="text-sm text-gray-400 leading-relaxed mb-10">
            Write your daily update, let AI refine it, and send from your Gmail — all under 2 minutes.
          </p>
          <a 
            href={`${API_URL}/auth/google`}
            className="inline-flex items-center gap-3 bg-white text-gray-900 px-8 py-3.5 rounded-xl font-medium text-sm hover:bg-gray-100 transition-all duration-200 hover:shadow-lg hover:shadow-white/10"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </a>
          <p className="text-xs text-gray-600 mt-6">No password needed · Sends from your Gmail</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-gray-100">
      {/* Header */}
      <header className="border-b border-gray-900 px-6 py-3.5 flex items-center justify-between sticky top-0 bg-black/80 backdrop-blur-xl z-50">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 bg-indigo-500 rounded-full shadow-lg shadow-indigo-500/50" />
          <span className="text-sm font-semibold text-gray-200 tracking-wide">Daily Push</span>
        </div>
        
        <div className="flex items-center gap-4">
          <span className="text-xs text-gray-500">
            {new Date().toLocaleDateString("en-IN", { weekday:"short", day:"numeric", month:"short" })}
          </span>
          
          <button 
            onClick={() => setPage(page==="history"?"app":"history")}
            className="text-xs text-gray-400 hover:text-gray-200 transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-900"
          >
            {page==="history"?"← Compose":"History"}
          </button>
          
          <div className="flex items-center gap-3 pl-4 border-l border-gray-800">
            {user.picture && (
              <img src={user.picture} className="w-6 h-6 rounded-full" alt="" />
            )}
            <span className="text-xs text-gray-400">{user.name?.split(" ")[0]}</span>
            <button 
              onClick={handleLogout} 
              className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Template Builder Panel */}
      {showTemplateBuilder && (
        <>
          <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40"
            onClick={() => setShowTemplateBuilder(false)} 
          />
          <div className="fixed right-0 top-0 h-full w-[440px] bg-gray-950 border-l border-gray-800 p-8 z-50 overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-lg font-semibold text-white">
                {editingTemplate ? "Edit Template" : "New Template"}
              </h2>
              <button 
                onClick={() => setShowTemplateBuilder(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-800 text-gray-400 transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-2 uppercase tracking-wider">
                  Template Name *
                </label>
                <input 
                  className="w-full bg-gray-900 border border-gray-800 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="e.g. Weekly Review"
                  value={tb.name}
                  onChange={e => setTb(p => ({...p, name: e.target.value}))}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-2 uppercase tracking-wider">
                  Template Structure *
                </label>
                <p className="text-xs text-gray-500 mb-3">
                  Define fields — one per line as <code className="text-indigo-400 bg-indigo-950/30 px-1.5 py-0.5 rounded">Field Name: placeholder</code>
                </p>
                <textarea 
                  className="w-full bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all resize-y"
                  placeholder={"Accomplishments: What you achieved today\nBlockers: Any issues or delays\nNext Steps: What you'll work on next"}
                  value={tb.rawText}
                  onChange={e => {
                    setTb(p => ({...p, rawText: e.target.value}));
                    setTbParsed(false);
                  }} 
                  rows={8}
                />
                <button 
                  className="mt-3 w-full bg-indigo-600/10 border border-indigo-700/50 text-indigo-400 rounded-lg py-2.5 text-sm font-medium hover:bg-indigo-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={tbParse} 
                  disabled={!tb.rawText.trim()}
                >
                  Detect Fields
                </button>
              </div>

              {tbParsed && tb.fields.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-green-400 mb-3 uppercase tracking-wider">
                    ✓ {tb.fields.length} field{tb.fields.length !== 1 ? 's' : ''} detected
                  </label>
                  <div className="space-y-2">
                    {tb.fields.map((f, i) => (
                      <div key={i} className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 flex items-center justify-between">
                        <span className="text-sm text-gray-200">{f.label}</span>
                        <code className="text-xs text-gray-500 font-mono">{`{{${f.key}}}`}</code>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {tbParsed && (
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-2 uppercase tracking-wider">
                    AI Prompt
                  </label>
                  <textarea 
                    className="w-full bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all resize-y"
                    value={tb.aiPrompt}
                    onChange={e => setTb(p => ({...p, aiPrompt: e.target.value}))} 
                    rows={6}
                  />
                </div>
              )}

              <button 
                className="w-full bg-indigo-600 text-white rounded-lg py-3 text-sm font-medium hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={tbSave} 
                disabled={!tb.name || !tbParsed || !tb.fields.length}
              >
                {editingTemplate ? "Save Changes" : "Create Template"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Preview Modal */}
      {showPreview && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-6"
          onClick={() => setShowPreview(false)}
        >
          <div 
            className="bg-white rounded-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="bg-gray-50 rounded-t-2xl px-6 py-5 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Email Preview</span>
                <button 
                  onClick={() => setShowPreview(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
              {[
                ["From", user?.email || "your@gmail.com"],
                ["To", toEmails.join(", ") || "—"],
                ccEmails.length > 0 && ["CC", ccEmails.join(", ")],
                bccEmails.length > 0 && ["BCC", bccEmails.join(", ")],
                ["Subject", subject || defaultSubject]
              ].filter(Boolean).map(([label, value]) => (
                <div key={label} className="flex gap-2 text-sm mb-1.5">
                  <span className="text-gray-400 min-w-[60px]">{label}:</span>
                  <span className={`${label === "Subject" ? "font-semibold text-gray-900" : "text-gray-700"}`}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
            <div className="p-6">
              <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                {refinedContent || "(No content yet)"}
              </div>
              <div className="mt-8 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-400">
                  Sent via Daily Push · {new Date().toLocaleDateString("en-IN", { day:"numeric", month:"long", year:"numeric" })}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History Page */}
      {page === "history" && <HistoryPage apiUrl={API_URL} user={user} />}

      {/* Main App */}
      {page === "app" && (
        <main className="max-w-2xl mx-auto px-6 py-12">
          {/* Progress Steps */}
          <div className="flex items-center mb-12">
            {["Template", "Compose", "Review", "Done"].map((label, i) => {
              const n = i + 1;
              const active = step === n;
              const done = step > n;
              return (
                <div key={n} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center gap-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-300 ${
                      done ? "bg-indigo-600 text-white" : 
                      active ? "bg-indigo-600 text-white ring-4 ring-indigo-500/20" : 
                      "bg-gray-900 text-gray-600 border border-gray-800"
                    }`}>
                      {done ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : n}
                    </div>
                    <span className={`text-[10px] font-medium uppercase tracking-wider ${
                      active ? "text-indigo-400" : done ? "text-indigo-500" : "text-gray-700"
                    }`}>
                      {label}
                    </span>
                  </div>
                  {i < 3 && (
                    <div className={`flex-1 h-px mx-3 mb-8 transition-colors duration-300 ${
                      done ? "bg-indigo-600" : "bg-gray-800"
                    }`} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Step 1: Template Selection */}
          {step === 1 && (
            <div className="animate-fadeIn">
              <div className="flex items-start justify-between mb-8">
                <div>
                  <h1 className="text-2xl font-semibold text-white mb-1">Select Template</h1>
                  <p className="text-sm text-gray-400">Choose a format for your update</p>
                </div>
                <button 
                  onClick={openAddTemplate}
                  className="px-4 py-2 bg-indigo-600/10 border border-indigo-700/50 text-indigo-400 rounded-lg text-sm font-medium hover:bg-indigo-600/20 transition-all"
                >
                  New Template
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Default Templates</h3>
                  <div className="space-y-2">
                    {DEFAULT_TEMPLATES.map(t => (
                      <div 
                        key={t.id}
                        onClick={() => selectTemplate(t.id)}
                        className="bg-gray-900 border border-gray-800 rounded-xl p-5 cursor-pointer hover:border-gray-700 hover:bg-gray-850 transition-all group"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <h4 className="text-sm font-medium text-white mb-2">{t.name}</h4>
                            <div className="flex gap-2 flex-wrap">
                              {t.fields.map(f => (
                                <span key={f.key} className="px-2.5 py-1 bg-gray-800 rounded-md text-xs text-gray-400">
                                  {f.label}
                                </span>
                              ))}
                            </div>
                          </div>
                          <svg className="w-5 h-5 text-gray-700 group-hover:text-gray-500 transition-colors ml-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {customTemplates.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Your Templates</h3>
                    <div className="space-y-2">
                      {customTemplates.map(t => (
                        <div 
                          key={t.id}
                          onClick={() => selectTemplate(t.id)}
                          className="bg-gray-900 border border-gray-800 rounded-xl p-5 cursor-pointer hover:border-gray-700 hover:bg-gray-850 transition-all group"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <h4 className="text-sm font-medium text-white">{t.name}</h4>
                                <span className="px-2 py-0.5 bg-indigo-900/20 border border-indigo-700/30 rounded text-[10px] text-indigo-400 uppercase tracking-wider">
                                  Custom
                                </span>
                              </div>
                              <div className="flex gap-2 flex-wrap">
                                {t.fields.map(f => (
                                  <span key={f.key} className="px-2.5 py-1 bg-gray-800 rounded-md text-xs text-gray-400">
                                    {f.label}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div className="flex items-center gap-3 ml-4" onClick={e => e.stopPropagation()}>
                              <ThreeDotMenu 
                                onEdit={() => openEditTemplate(t)} 
                                onDelete={() => deleteCustomTemplate(t.id)} 
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Compose */}
          {step === 2 && template && (
            <div className="animate-fadeIn">
              <div className="mb-8">
                <h1 className="text-2xl font-semibold text-white mb-1">{template.name}</h1>
                <p className="text-sm text-gray-400">Fill in your update — AI will polish it</p>
              </div>
              
              <div className="space-y-5">
                {template.fields.map((f, idx) => (
                  <div key={f.key}>
                    <label className="block text-xs font-semibold text-gray-300 mb-2 uppercase tracking-wider">
                      {f.label}
                      {idx === 0 && <span className="text-indigo-400 ml-1">*</span>}
                    </label>
                    <textarea 
                      className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all resize-y"
                      placeholder={f.placeholder}
                      value={formData[f.key] || ""}
                      onChange={e => handleFieldChange(f.key, e.target.value)} 
                      rows={4}
                    />
                  </div>
                ))}
              </div>
              
              {status === "error" && (
                <div className="mt-4 p-4 bg-red-900/20 border border-red-800/50 rounded-xl">
                  <p className="text-sm text-red-400 flex items-center gap-2">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {errorMsg}
                  </p>
                </div>
              )}
              
              <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-900">
                <button 
                  onClick={() => { setStep(1); setStatus(null); }}
                  className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
                >
                  ← Back
                </button>
                <button 
                  onClick={refineWithGroq}
                  disabled={!formData[template.fields[0].key] || status === "refining"}
                  className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {status === "refining" ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Refining...
                    </>
                  ) : (
                    <>
                      Refine with AI
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Review & Send */}
          {step === 3 && (
            <div className="animate-fadeIn">
              <div className="flex items-start justify-between mb-8">
                <div>
                  <h1 className="text-2xl font-semibold text-white mb-1">Review & Send</h1>
                  <p className="text-sm text-gray-400">Edit if needed, then send your update</p>
                </div>
                <button 
                  onClick={() => setShowPreview(true)}
                  className="px-4 py-2 bg-gray-900 border border-gray-800 text-gray-300 rounded-lg text-sm hover:border-gray-700 transition-all"
                >
                  Preview
                </button>
              </div>

              <div className="space-y-5">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Refined Update</label>
                    <span className="text-xs text-gray-600">{refinedContent.length} characters</span>
                  </div>
                  <textarea 
                    className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all resize-y"
                    value={refinedContent}
                    onChange={e => setRefinedContent(e.target.value)} 
                    rows={8}
                  />
                </div>

                <EmailChipInput 
                  label={<>To <span className="text-indigo-400">*</span></>}
                  chips={toEmails} 
                  onChange={setToEmails} 
                  placeholder="Add recipient emails..." 
                />
                
                <button 
                  onClick={() => setShowCcBcc(!showCcBcc)}
                  className="text-xs text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1.5"
                >
                  <svg className={`w-3 h-3 transition-transform ${showCcBcc ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  {showCcBcc ? "Hide CC / BCC" : "Add CC / BCC"}
                </button>
                
                {showCcBcc && (
                  <>
                    <EmailChipInput label="CC" chips={ccEmails} onChange={setCcEmails} placeholder="CC emails..." />
                    <EmailChipInput label="BCC" chips={bccEmails} onChange={setBccEmails} placeholder="BCC emails..." />
                  </>
                )}
                
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-2 uppercase tracking-wider">Subject</label>
                  <input 
                    className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                    placeholder={defaultSubject}
                    value={subject}
                    onChange={e => setSubject(e.target.value)} 
                  />
                </div>
              </div>

              {status === "error" && (
                <div className="mt-4 p-4 bg-red-900/20 border border-red-800/50 rounded-xl">
                  <p className="text-sm text-red-400 flex items-center gap-2">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {errorMsg}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-900">
                <button 
                  onClick={() => { setStep(2); setStatus("refined"); }}
                  className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
                >
                  ← Back
                </button>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setShowPreview(true)}
                    className="px-4 py-2 bg-gray-900 border border-gray-800 text-gray-300 rounded-xl text-sm hover:border-gray-700 transition-all"
                  >
                    Preview
                  </button>
                  <button 
                    onClick={sendEmail}
                    disabled={!toEmails.length || status === "sending"}
                    className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {status === "sending" ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        Send to {toEmails.length} {toEmails.length === 1 ? "recipient" : "recipients"}
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Success */}
          {step === 4 && (
            <div className="animate-fadeIn text-center py-16">
              <div className="w-20 h-20 mx-auto mb-8 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-2xl shadow-indigo-500/20">
                <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              
              <h1 className="text-2xl font-semibold text-white mb-2">Update Sent</h1>
              <p className="text-sm text-gray-400 mb-1">
                Delivered to {toEmails.length} recipient{toEmails.length !== 1 ? "s" : ""}
                {ccEmails.length > 0 && <span> · {ccEmails.length} CC</span>}
              </p>
              <p className="text-xs text-gray-600 mb-10">
                {new Date().toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit" })} · {template?.name}
              </p>
              
              <div className="flex gap-3 justify-center">
                <button 
                  onClick={() => { setStep(3); setStatus("sent"); }}
                  className="px-6 py-2.5 bg-gray-900 border border-gray-800 text-gray-300 rounded-xl text-sm hover:border-gray-700 transition-all"
                >
                  View Details
                </button>
                <button 
                  onClick={reset}
                  className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-all"
                >
                  Send Another Update
                </button>
              </div>
            </div>
          )}
        </main>
      )}
    </div>
  );
}