import { useState } from "react";
import { MessageContent } from "./MessageContent";
import { ChevronDown, MoreHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";

export function RoundCard({ roundNumber, messages }: { roundNumber: number, messages: any[] }) {
  const [showLogs, setShowLogs] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  const visionaryMsgs = messages.filter(m => m.agent_name === "Visionary" && m.type === "agent_response");
  const architectMsgs = messages.filter(m => m.agent_name === "Architect" && m.type === "agent_response");
  const systemMsgs = messages.filter(m => m.type === "status");
  
  // A round is active if Visionary has spoken but Architect hasn't finished,
  // or if we're just waiting for the next step.
  const isArchitectThinking = visionaryMsgs.length > 0 && architectMsgs.length === 0;

  return (
    <div className="bg-card border border-border rounded-xl shadow-sm mb-6 overflow-hidden">
      <div className="bg-muted/30 px-6 py-3 border-b border-border flex justify-between items-center">
        <h2 className="text-sm font-semibold text-foreground tracking-tight">Round {roundNumber}</h2>
        
        <DropdownMenu>
          <DropdownMenuTrigger className="p-1 rounded hover:bg-muted text-muted-foreground transition-colors focus:outline-none">
            <MoreHorizontal className="w-4 h-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 bg-card border-border">
            <DropdownMenuItem onClick={() => setShowRaw(!showRaw)} className="cursor-pointer text-xs text-foreground focus:bg-muted">
              {showRaw ? "Hide Raw JSON" : "View Raw JSON"}
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer text-xs text-foreground focus:bg-muted">
              Copy Round Data
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      <div className="p-6 space-y-6">
        {/* Visionary Section */}
        {visionaryMsgs.map((msg, i) => (
          <div key={`vis-${i}`} className="relative">
             <MessageContent msg={msg} showRawOverride={showRaw} hideContainer />
          </div>
        ))}

        {/* Divider if both exist */}
        {visionaryMsgs.length > 0 && architectMsgs.length > 0 && (
          <div className="h-px w-full bg-border" />
        )}

        {/* Architect Section */}
        {architectMsgs.map((msg, i) => (
          <div key={`arch-${i}`} className="relative">
             <MessageContent msg={msg} showRawOverride={showRaw} hideContainer />
          </div>
        ))}

        {/* Skeleton Loader for Architect */}
        {isArchitectThinking && (
          <div className="pt-2">
            <div className="h-px w-full bg-border mb-6" />
            <div className="animate-pulse flex space-x-4">
              <div className="flex-1 space-y-4 py-1">
                <div className="flex justify-between">
                  <div className="h-4 bg-muted rounded w-1/4"></div>
                  <div className="h-4 bg-muted rounded w-16"></div>
                </div>
                <div className="space-y-2">
                  <div className="h-3 bg-muted rounded"></div>
                  <div className="h-3 bg-muted rounded w-5/6"></div>
                  <div className="h-3 bg-muted rounded w-4/6"></div>
                </div>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground uppercase tracking-widest mt-4 flex items-center gap-2 font-semibold">
              <span className="flex h-1.5 w-1.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
              </span>
              Architect is Analyzing...
            </p>
          </div>
        )}
      </div>

      {/* System Logs Accordion */}
      {systemMsgs.length > 0 && (
        <div className="border-t border-border bg-muted/10">
          <button 
            onClick={() => setShowLogs(!showLogs)}
            className="w-full flex items-center gap-2 px-6 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors"
          >
            <ChevronDown className={`w-3 h-3 transition-transform ${showLogs ? 'rotate-180' : ''}`} />
            Process Log ({systemMsgs.length})
          </button>
          
          {showLogs && (
            <div className="px-6 pb-4 pt-1 space-y-2">
              {systemMsgs.map((msg, i) => (
                <div key={`sys-${i}`} className="text-[11px] font-mono text-muted-foreground flex items-start gap-2">
                  <span className="opacity-50 mt-0.5">&gt;</span>
                  <span className="leading-relaxed">{msg.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
