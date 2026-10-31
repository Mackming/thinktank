import { useState, useRef, useEffect } from "react";
import { useWebSocket } from "./hooks/useWebSocket";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { MessageContent } from "./components/MessageContent";
import { Loader2, Square, Send, Archive, Target, Lightbulb, Hammer, BookOpen, Swords, Network, Sparkles, Brain } from "lucide-react";
import { HistorySidebar } from "./components/HistorySidebar";
import { KnowledgeLibraryModal } from "./components/KnowledgeLibraryModal";
import { CreateSpaceModal } from "./components/CreateSpaceModal";
import { Library, Plus } from "lucide-react";
export default function App() {
  const { messages, status, sendMessage } = useWebSocket("ws://localhost:8001/ws");
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState("debate");
  const [activeModels, setActiveModels] = useState<Record<string, boolean>>({
    deepseek: true,
    qwen: true,
    glm: true,
  });
  
  const activeModelsList = Object.keys(activeModels).filter(m => activeModels[m]);
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);
  const [isSetupLoading, setIsSetupLoading] = useState(false);
  const [agentsReady, setAgentsReady] = useState(false);
  const [isDebateActive, setIsDebateActive] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [currentRound, setCurrentRound] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const [isArchiveMode, setIsArchiveMode] = useState(false);
  const [interjectText, setInterjectText] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Keep original messages or archive messages
  const [archiveMessages, setArchiveMessages] = useState<any[]>([]);
  const displayMessages = isArchiveMode ? archiveMessages : messages;

  const [spaces, setSpaces] = useState<any[]>([]);
  const [activeSpaceId, setActiveSpaceId] = useState<number | null>(null);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isCreateSpaceOpen, setIsCreateSpaceOpen] = useState(false);
  
  const [isCoPilotMode, setIsCoPilotMode] = useState(false);
  const [isAwaitingReview, setIsAwaitingReview] = useState(false);
  const [reviewText, setReviewText] = useState("");

  useEffect(() => {
    fetchSpaces();
  }, []);

  const fetchSpaces = async () => {
    try {
      const res = await fetch("/api/spaces");
      if (res.ok) {
        const data = await res.json();
        setSpaces(data);
        if (data.length > 0 && !activeSpaceId) {
          setActiveSpaceId(data[0].id);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateSpace = () => {
    setIsCreateSpaceOpen(true);
  };

  const handleSpaceCreated = (newSpace: any) => {
    setSpaces(prev => [...prev, newSpace]);
    setActiveSpaceId(newSpace.id);
  };

  // Watch for backend confirmation that browser opened and track workflow
  useEffect(() => {
    if (messages.length === 0) return;
    const last = messages[messages.length - 1];
    
    if (isSetupLoading) {
      if (last.message?.includes("Browser opened")) {
        setIsSetupLoading(false);
        setIsSetupModalOpen(true); // Only open modal AFTER backend confirms
      } else if (last.type === "error") {
        setIsSetupLoading(false); // Stop loading on error
      }
    }

    if (last.type === "round_update" && last.content) {
      setCurrentRound(`Round ${last.content.round}/${last.content.max}`);
    }

    if (last.message === "Awaiting CEO Review...") {
      setIsAwaitingReview(true);
    }

    if (last.message?.includes("✅ Workflow complete.") || last.type === "error") {
      setIsDebateActive(false);
      setIsSynthesizing(false);
      setCurrentRound(null);
    }
  }, [messages, isSetupLoading]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSetupAgents = () => {
    if (activeModelsList.length === 0) return alert("Please enable at least one model.");
    setIsSetupLoading(true);
    sendMessage({ action: "setup_agents", active_models: activeModelsList });
    // Modal will open only when backend confirms via WebSocket message
  };

  const handleConfirmLogin = () => {
    sendMessage({ action: "confirm_login" });
    setIsSetupModalOpen(false);
    setAgentsReady(true);
  };

  const handleInitialize = () => {
    if (!agentsReady) return;
    if (activeModelsList.length === 0) return alert("Please enable at least one model.");
    setIsDebateActive(true);
    setIsArchiveMode(false);
    setCurrentRound("Round 1");
    sendMessage({
      action: "run_workflow",
      mode: mode,
      co_pilot_mode: isCoPilotMode,
      master_prompt: prompt || 'Design a gamified loyalty program for a shoe store.',
      active_models: activeModelsList,
      space_id: activeSpaceId
    });
  };

  const handleStopDebate = () => {
    setIsSynthesizing(true);
    sendMessage({ action: "stop_workflow" });
  };

  const handleInterject = () => {
    if (!interjectText.trim()) return;
    sendMessage({ action: "interject", message: interjectText });
    setInterjectText("");
  };

  const handleContinueTurn = (skip: boolean = false) => {
    setIsAwaitingReview(false);
    sendMessage({ action: "continue_turn", feedback: skip ? null : reviewText });
    setReviewText("");
  };

  const handleSelectSession = async (id: number) => {
    try {
      const res = await fetch(`/api/sessions/${id}`);
      if (res.ok) {
        const data = await res.json();
        const newMsgs = [];
        // Reconstruct messages for UI
        data.transcript.forEach((t: any) => {
          newMsgs.push({
            type: 'status',
            agent_name: t.role,
            message: 'Historical Record',
            content: t.content
          });
        });
        if (data.synthesis) {
          newMsgs.push({
            type: 'status',
            agent_name: 'Synthesizer',
            message: 'Final Report',
            content: data.synthesis
          });
        }
        setArchiveMessages(newMsgs);
        setPrompt(data.master_prompt);
        setIsArchiveMode(true);
        setIsDebateActive(false);
        setIsSidebarOpen(false);
      }
    } catch(e) {
      console.error(e);
    }
  };

  const filteredMessages = displayMessages.filter(msg => {
    // Purge intermediate system messages as requested
    if (msg.agent_name === "System") {
      // Keep synthesis reports from archive which are sent as System
      if (msg.message === "Final Report" || msg.content?.executive_summary) return true;
      return false;
    }
    return true;
  });

  return (
    <div className="dark flex h-screen w-full bg-[#050505] text-zinc-400 overflow-hidden font-sans antialiased selection:bg-zinc-800 selection:text-zinc-100">
      
      {/* LEFT PANEL: Control Room */}
      <div className="w-[380px] flex-shrink-0 border-r border-border bg-card flex flex-col relative z-10 shadow-[4px_0_24px_rgba(0,0,0,0.5)]">
        
        {/* Header */}
        <div className="p-8 pb-6 border-b border-border">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-tr from-muted-foreground to-muted shadow-sm flex items-center justify-center border border-border">
              <div className="w-2 h-2 rounded-full bg-foreground"></div>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">ThinkTank</h1>
          </div>
          <p className="text-xs text-muted-foreground font-medium tracking-wide">MULTI-AGENT ORCHESTRATION</p>
        </div>

        {/* Configuration */}
        <div className="px-8 py-4 flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <label className="text-[11px] uppercase tracking-widest font-semibold text-muted-foreground">
              Execution Strategy
            </label>
            <Tabs value={mode} onValueChange={setMode} className="w-full">
              <TabsList className="grid w-full grid-cols-4 bg-muted/50 border border-border p-1 rounded-lg h-auto">
                <TabsTrigger value="debate" className="text-xs data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-md transition-all flex flex-col items-center gap-1 py-2">
                  <Swords className="w-4 h-4" /> Debate
                </TabsTrigger>
                <TabsTrigger value="collaborate" className="text-xs data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-md transition-all flex flex-col items-center gap-1 py-2">
                  <Network className="w-4 h-4" /> Collaborate
                </TabsTrigger>
                <TabsTrigger value="refine" className="text-xs data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-md transition-all flex flex-col items-center gap-1 py-2">
                  <Sparkles className="w-4 h-4" /> Refine
                </TabsTrigger>
                <TabsTrigger value="coach" className="text-xs data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-md transition-all flex flex-col items-center gap-1 py-2">
                  <Brain className="w-4 h-4" /> Coach
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          
          {/* Active Space */}
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <label className="text-[11px] uppercase tracking-widest font-semibold text-muted-foreground">
                Knowledge Space
              </label>
              <div className="flex gap-2">
                <button onClick={handleCreateSpace} className="text-muted-foreground hover:text-foreground transition-colors" title="Create Space">
                  <Plus className="w-4 h-4" />
                </button>
                {activeSpaceId && (
                  <button onClick={() => setIsLibraryOpen(true)} className="text-muted-foreground hover:text-foreground transition-colors" title="Open Library">
                    <Library className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            {spaces.length === 0 ? (
              <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded-lg border border-border text-center">No spaces created.</div>
            ) : (
              <select 
                className="w-full bg-background border border-border p-2 rounded-lg text-xs text-foreground focus:outline-none focus:border-ring"
                value={activeSpaceId || ''}
                onChange={(e) => setActiveSpaceId(Number(e.target.value))}
              >
                {spaces.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            )}
          </div>
          
          {/* Co-Pilot Mode Toggle */}
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center bg-muted/30 p-3 rounded-lg border border-border">
              <div className="flex flex-col">
                <span className="text-[11px] font-semibold text-foreground">Co-Pilot Mode</span>
                <span className="text-[10px] text-muted-foreground">Pause for CEO review after each turn</span>
              </div>
              <Switch 
                checked={isCoPilotMode}
                onCheckedChange={setIsCoPilotMode}
                disabled={isDebateActive}
              />
            </div>
          </div>
          
          <div className="flex flex-col gap-3">
            <label className="text-[11px] uppercase tracking-widest font-semibold text-muted-foreground">
              Active Agents
            </label>
            <div className="flex gap-2">
              {['deepseek', 'qwen', 'glm'].map(modelId => {
                const label = modelId === 'deepseek' ? 'DeepSeek' : modelId === 'qwen' ? 'Qwen' : 'GLM';
                return (
                <Button
                  key={modelId}
                  variant="outline"
                  onClick={() => setActiveModels(prev => ({ ...prev, [modelId]: !prev[modelId] }))}
                  className={`flex-1 text-xs h-8 border-border transition-all ${
                    activeModels[modelId] 
                      ? "bg-foreground text-background hover:bg-foreground/90 hover:text-background shadow-sm" 
                      : "bg-transparent text-muted-foreground hover:text-foreground opacity-50"
                  }`}
                >
                  {label}
                </Button>
              )})}
            </div>
          </div>
        </div>

        {/* Master Prompt */}
        <div className="px-8 py-4 flex-1 flex flex-col gap-3">
          <label className="text-[11px] uppercase tracking-widest font-semibold text-muted-foreground flex justify-between items-center">
            <span>Master Prompt</span>
            <span className="bg-muted border border-border px-2 py-0.5 rounded text-[9px] text-muted-foreground font-mono">JSON</span>
          </label>
          <div className="flex-1 relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-b from-border to-transparent opacity-0 group-focus-within:opacity-100 rounded-xl transition-opacity blur-sm"></div>
            <Textarea 
              placeholder="Enter instruction set..." 
              className="relative h-full resize-none font-sans text-[13px] leading-relaxed bg-background border border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:border-ring rounded-xl p-5 shadow-inner"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </div>
        </div>

        {/* Footer / Actions */}
        <div className="p-8 pt-4 border-t border-border bg-card">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-medium text-muted-foreground">Engine Status</span>
            <div className="flex items-center gap-2">
              {status === 'open' ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="text-xs font-mono text-emerald-500">
                    {agentsReady ? "AGENTS READY" : "CONNECTED"}
                  </span>
                </>
              ) : (
                <>
                  <span className="h-2 w-2 rounded-full bg-red-500/50"></span>
                  <span className="text-xs font-mono text-red-500/80">DISCONNECTED</span>
                </>
              )}
            </div>
          </div>
          
          <div className="flex flex-col gap-3">
            {!agentsReady && (
              <Button 
                variant="outline"
                className="w-full h-11 font-medium text-[13px] border-border hover:bg-muted hover:text-foreground transition-all disabled:opacity-50"
                onClick={handleSetupAgents}
                disabled={isSetupLoading || status !== 'open'}
              >
                {isSetupLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3 h-3 border border-zinc-500 border-t-zinc-200 rounded-full animate-spin"/>
                    Opening Browsers...
                  </span>
                ) : "Setup Agents"}
              </Button>
            )}
            
            
            {!isDebateActive ? (
              <Button 
                className="w-full h-11 font-medium text-[13px] bg-foreground text-background hover:bg-foreground/90 hover:shadow-[0_0_20px_rgba(255,255,255,0.05)] border border-transparent rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleInitialize}
                disabled={!agentsReady}
              >
                Deploy ThinkTank
              </Button>
            ) : (
              <Button 
                variant="destructive"
                className="w-full h-11 font-medium text-[13px] bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/20 rounded-lg transition-all duration-300"
                onClick={handleStopDebate}
                disabled={isArchiveMode || isSynthesizing}
              >
                {isSynthesizing ? (
                  <span className="flex items-center">
                    <span className="w-4 h-4 border-2 border-red-500 border-t-white rounded-full animate-spin mr-2" />
                    Synthesizing...
                  </span>
                ) : (
                  <>
                    <Square className="w-4 h-4 mr-2 fill-current" />
                    Stop Debate & Synthesize
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* History Sidebar */}
      <HistorySidebar 
        isOpen={isSidebarOpen} 
        setIsOpen={setIsSidebarOpen} 
        onSelectSession={handleSelectSession} 
      />

      {/* RIGHT PANEL: Live Arena */}
      <div className="flex-1 flex flex-col relative overflow-hidden bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-muted/20 via-background to-background">
        
        {/* Subtle top glare */}
        <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-border to-transparent"></div>

        <div className="px-10 py-8 border-b border-border flex items-center justify-between z-10 bg-background/50 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <h2 className="text-sm font-semibold tracking-tight text-foreground">
              {isArchiveMode ? "Vault Archive Viewer" : "Live Telemetry Feed"}
            </h2>
            {isArchiveMode && (
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20">
                <Archive className="w-3 h-3 text-blue-400" />
                <span className="text-[10px] font-mono font-semibold text-blue-400 tracking-widest uppercase">
                  Read-Only
                </span>
              </div>
            )}
            {isDebateActive && !isArchiveMode && (
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                <Loader2 className="w-3 h-3 text-emerald-400 animate-spin" />
                <span className="text-[10px] font-mono font-semibold text-emerald-400 tracking-widest uppercase">
                  {currentRound || "Processing"}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[11px] font-mono text-zinc-600">ID: RUN-77A9</span>
          </div>
        </div>
        
        <ScrollArea className="flex-1 p-10 z-10">
          <div className="max-w-4xl mx-auto flex flex-col gap-8 pb-10">
            {(!isDebateActive && filteredMessages.length === 0 && !isArchiveMode) ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-8 mt-10">
                <div className="flex flex-col items-center text-center gap-3">
                  <div className="w-16 h-16 rounded-2xl border border-border flex items-center justify-center bg-card shadow-sm mb-2">
                    <Target className="w-8 h-8 text-foreground opacity-80" />
                  </div>
                  <h2 className="text-xl font-bold tracking-tight text-foreground">Your Business Council is Ready</h2>
                  <p className="text-sm text-muted-foreground max-w-md">Enter a prompt or select a starter below to initiate the multi-agent analysis.</p>
                </div>
                <div className="flex flex-wrap justify-center gap-3 max-w-2xl">
                  {["Analyze my Q3 growth strategy", "Critique my morning routine", "Design a gamified loyalty program"].map((starter, i) => (
                    <button 
                      key={i}
                      onClick={() => setPrompt(starter)}
                      className="px-4 py-2 rounded-full border border-border bg-muted/20 hover:bg-muted/50 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {starter}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-6 relative before:absolute before:inset-y-0 before:left-[27px] before:w-px before:bg-white/10 before:z-0">
                {filteredMessages.map((msg, i) => {
                  let AvatarIcon = Target;
                  let avatarBg = "bg-zinc-800 border-zinc-700";
                  let avatarColor = "text-zinc-400";
                  
                  if (msg.agent_name.toLowerCase() === "deepseek") {
                    AvatarIcon = Lightbulb;
                    avatarBg = "bg-emerald-500/10 border-emerald-500/20";
                    avatarColor = "text-emerald-400";
                  } else if (msg.agent_name.toLowerCase() === "qwen") {
                    AvatarIcon = Hammer;
                    avatarBg = "bg-red-500/10 border-red-500/20";
                    avatarColor = "text-red-400";
                  } else if (msg.agent_name.toLowerCase() === "glm") {
                    AvatarIcon = BookOpen;
                    avatarBg = "bg-blue-500/10 border-blue-500/20";
                    avatarColor = "text-blue-400";
                  }

                  return (
                    <div key={i} className="flex gap-6 relative z-10 w-full group">
                      <div className="flex-shrink-0 flex flex-col items-center mt-3">
                        <div className={`w-14 h-14 rounded-full border-2 flex items-center justify-center shadow-lg relative overflow-hidden transition-all duration-300 group-hover:shadow-xl group-hover:scale-105 ${avatarBg}`}>
                          <AvatarIcon className={`w-6 h-6 ${avatarColor}`} />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <MessageContent msg={msg} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div ref={scrollRef} className="h-4" />
          </div>
        </ScrollArea>

        {/* Review & Direct Box (Co-Pilot) Bottom Sheet */}
        <div className={`fixed bottom-0 inset-x-0 ml-[380px] transition-transform duration-300 ease-out z-50 ${isAwaitingReview && isCoPilotMode ? 'translate-y-0' : 'translate-y-full'}`}>
          <div className="p-6 border-t border-border bg-card shadow-[0_-20px_40px_rgba(0,0,0,0.5)]">
            <div className="max-w-4xl mx-auto flex flex-col gap-3 relative">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold tracking-widest text-blue-400 uppercase">Co-Pilot Review</span>
              </div>
              <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500/10 to-blue-400/10 rounded-lg blur opacity-50 group-focus-within:opacity-100 transition duration-1000 group-focus-within:duration-200 animate-pulse"></div>
                <textarea 
                  placeholder="Add your feedback, critique, or directive for the next agent..."
                  className="relative w-full bg-background border border-border rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-blue-500 transition-colors min-h-[80px]"
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-3 mt-1">
                <Button 
                  variant="outline"
                  className="bg-transparent border-blue-500/30 text-blue-400 hover:bg-blue-500/10 hover:text-blue-300 px-6 h-auto"
                  onClick={() => handleContinueTurn(true)}
                >
                  Skip ➔
                </Button>
                <Button 
                  className="bg-blue-600 text-white hover:bg-blue-500 px-6 h-auto disabled:opacity-50"
                  onClick={() => handleContinueTurn(false)}
                  disabled={!reviewText.trim()}
                >
                  Submit Feedback & Continue ➔
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Standard Interject Bar */}
        {!isCoPilotMode && isDebateActive && !isArchiveMode && (
            <div className="p-6 border-t border-border bg-card">
              <div className="max-w-4xl mx-auto flex gap-3 relative">
                <input 
                  type="text"
                  placeholder="CEO Override: Interject or steer the debate..."
                  className="flex-1 bg-background border border-border rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-border transition-colors"
                  value={interjectText}
                  onChange={(e) => setInterjectText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleInterject()}
                />
                <Button 
                  className="bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground px-6 h-auto"
                  onClick={handleInterject}
                  disabled={!interjectText.trim()}
                >
                  <Send className="w-4 h-4 mr-2" />
                  Interject
                </Button>
              </div>
            </div>
        )}
      </div>

      {/* Setup Modal */}
      {isSetupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0c0c0c] border border-white/10 rounded-xl p-8 max-w-md w-full shadow-2xl flex flex-col gap-6">
            <div>
              <h3 className="text-lg font-semibold text-zinc-100 mb-2">Agent Initialization</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                A browser window has opened. Please log in to DeepSeek, Qwen, and GLM manually in the respective tabs. 
                This establishes the persistent session for the Orchestrator.
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setIsSetupModalOpen(false)}>Cancel</Button>
              <Button className="bg-white text-black hover:bg-zinc-200" onClick={handleConfirmLogin}>Confirm Login</Button>
            </div>
          </div>
        </div>
      )}

      {/* Knowledge Library Modal */}
      <KnowledgeLibraryModal 
        isOpen={isLibraryOpen} 
        onClose={() => setIsLibraryOpen(false)} 
        spaceId={activeSpaceId} 
        spaceName={spaces.find(s => s.id === activeSpaceId)?.name || "Space"} 
      />

      {/* Create Space Modal */}
      <CreateSpaceModal
        isOpen={isCreateSpaceOpen}
        onClose={() => setIsCreateSpaceOpen(false)}
        onSpaceCreated={handleSpaceCreated}
      />

    </div>
  );
}
