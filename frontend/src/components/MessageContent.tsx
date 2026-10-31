import { useState } from "react";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { ChevronRight, AlertTriangle, CheckCircle2, Brain, Copy, Download, Target } from "lucide-react";

export function MessageContent({ 
  msg, 
  showRawOverride, 
  hideContainer = false 
}: { 
  msg: any, 
  showRawOverride?: boolean, 
  hideContainer?: boolean 
}) {
  const [showRawState, setShowRawState] = useState(false);
  const isRawVisible = showRawOverride !== undefined ? showRawOverride : showRawState;

  if (!msg.content) return null;

  if (typeof msg.content === 'string') {
    if (hideContainer) {
      return <MarkdownRenderer content={msg.content} />;
    }
    return (
      <div className="mt-3 bg-card border border-border rounded-xl p-5 shadow-sm">
        <MarkdownRenderer content={msg.content} />
      </div>
    );
  }

  const content = msg.content;
  
  // Robust check for object properties
  if (typeof content !== 'object' || Array.isArray(content)) {
    const rawContent = (
      <pre className="text-[11px] font-mono text-muted-foreground overflow-x-auto">
        <code>{JSON.stringify(content, null, 2)}</code>
      </pre>
    );
    if (hideContainer) return rawContent;
    return (
      <div className="mt-3 flex flex-col gap-3">
        <div className="bg-muted/30 border border-border rounded-lg p-4">
          {rawContent}
        </div>
      </div>
    );
  }

  const isAgentThought = 'main_argument' in content;
  const isCritique = 'identified_flaws' in content;
  const isSynthesis = 'executive_summary' in content;
  const isCoachQuestion = 'probing_question' in content;

  const currentRole = content.current_role || (isAgentThought ? "Proposer" : isCritique ? "Critic" : isSynthesis ? "Synthesizer" : "Agent");

  // Safe extractors for arrays to prevent .map crashes if LLM hallucinates strings
  const safeArray = (val: any) => Array.isArray(val) ? val : (val ? [String(val)] : []);
  const flaws = safeArray(content.identified_flaws);
  const fixes = safeArray(content.suggested_fixes);
  const actionPlan = safeArray(content.action_plan);
  const caveats = safeArray(content.caveats_and_assumptions);

  const formatText = (text: any) => String(text || '').replace(/\\n/g, '\n');

  const getSynthesisMarkdown = () => {
    let md = `# Final Synthesis\n\n`;
    if (content.executive_summary) {
      md += `## Executive Summary\n${formatText(content.executive_summary)}\n\n`;
    }
    if (actionPlan.length > 0) {
      md += `## Action Plan\n`;
      actionPlan.forEach((step: any, i: number) => {
        md += `${i + 1}. ${formatText(step)}\n`;
      });
      md += `\n`;
    }
    if (caveats.length > 0) {
      md += `## Caveats & Assumptions\n`;
      caveats.forEach((c: any) => {
        md += `- ${String(c)}\n`;
      });
      md += `\n`;
    }
    return md;
  };

  const handleCopyMarkdown = () => {
    navigator.clipboard.writeText(getSynthesisMarkdown());
  };

  const handleDownloadMarkdown = () => {
    const blob = new Blob([getSynthesisMarkdown()], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Synthesis_Report.md";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const containerClass = hideContainer ? "" : "bg-card border border-border rounded-xl p-5 shadow-sm";

  return (
    <div className={hideContainer ? "" : "mt-3 flex flex-col gap-3"}>


      {isAgentThought && (
        <div className={containerClass}>
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-bold text-zinc-100">{msg.agent_name}</h3>
              <span className="text-[10px] uppercase tracking-widest text-zinc-500 bg-zinc-800/50 px-2 py-0.5 rounded-full border border-zinc-700/50">
                Role: {currentRole}
              </span>
            </div>
            <div className="flex items-center gap-2 bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-500/20">
              <span className="text-[10px] text-emerald-400 font-mono uppercase">Confidence</span>
              <span className="text-xs font-bold text-emerald-300">{content.confidence_score ?? '?'}{typeof content.confidence_score === 'number' ? '%' : ''}</span>
            </div>
          </div>
          {content.native_reasoning && (
            <div className="border-l-2 border-blue-500/50 bg-slate-900/30 p-4 mb-4 rounded-r-md">
              <div className="flex items-center gap-2 text-xs uppercase text-blue-400 font-bold mb-2 tracking-wider">
                <Brain className="w-4 h-4" />
                Native Model Reasoning
              </div>
              <div className="text-blue-100/80">
                <MarkdownRenderer content={formatText(content.native_reasoning)} />
              </div>
            </div>
          )}
          <div className="mb-4">
            <MarkdownRenderer content={formatText(content.main_argument)} />
          </div>
          <details className="group border border-white/5 rounded-lg bg-black/20">
            <summary className="flex items-center gap-2 px-4 py-2 cursor-pointer text-xs text-zinc-400 hover:text-zinc-200 list-none">
              <ChevronRight className="w-3 h-3 group-open:rotate-90 transition-transform" />
              Internal Monologue
            </summary>
            <div className="px-4 pb-4 pt-2 text-[13px] text-zinc-500 italic border-t border-white/5 mt-2 whitespace-pre-wrap">
              <MarkdownRenderer content={formatText(content.thought_process)} />
            </div>
          </details>
        </div>
      )}

      {isCritique && (
        <div className={containerClass}>
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-bold text-zinc-100">{msg.agent_name}</h3>
              <span className="text-[10px] uppercase tracking-widest text-zinc-500 bg-zinc-800/50 px-2 py-0.5 rounded-full border border-zinc-700/50">
                Role: {currentRole}
              </span>
            </div>
            <div className="flex items-center gap-2 bg-red-500/10 px-2 py-1 rounded-md border border-red-500/20">
              <span className="text-[10px] text-red-400 font-mono uppercase">Severity</span>
              <span className="text-xs font-bold text-red-300">{content.severity_score ?? '?'}/100</span>
            </div>
          </div>
          {content.native_reasoning && (
            <div className="border-l-2 border-blue-500/50 bg-slate-900/30 p-4 mb-4 rounded-r-md">
              <div className="flex items-center gap-2 text-xs uppercase text-blue-400 font-bold mb-2 tracking-wider">
                <Brain className="w-4 h-4" />
                Native Model Reasoning
              </div>
              <div className="text-blue-100/80">
                <MarkdownRenderer content={formatText(content.native_reasoning)} />
              </div>
            </div>
          )}
          <div className="flex flex-col gap-4">
            {flaws.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-3 h-3 text-red-400" />
                  Identified Flaws
                </h4>
                <ul className="space-y-2">
                  {flaws.map((flaw: any, i: number) => {
                    const flawText = String(flaw);
                    const isFallacy = flawText.includes("[FALLACY]");
                    const cleanText = flawText.replace("[FALLACY]", "").trim();

                    return (
                      <li key={i} className={`text-[13px] px-3 py-2 rounded border ${isFallacy ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-100' : 'text-zinc-300 bg-red-500/5 border-red-500/10'}`}>
                        {isFallacy && (
                          <span className="inline-flex items-center gap-1 font-bold text-yellow-500 mr-2 text-[10px] uppercase tracking-wider bg-yellow-500/20 px-1.5 py-0.5 rounded">
                            ⚠️ Fallacy
                          </span>
                        )}
                        <MarkdownRenderer content={cleanText} />
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {fixes.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  Suggested Fixes
                </h4>
                <ul className="space-y-2">
                  {fixes.map((fix: any, i: number) => (
                    <li key={i} className="text-[13px] text-zinc-300 bg-emerald-500/5 px-3 py-2 rounded border border-emerald-500/10">
                      <MarkdownRenderer content={String(fix)} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {isCoachQuestion && (
        <div className={containerClass}>
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-bold text-zinc-100">{msg.agent_name}</h3>
              <span className="text-[10px] uppercase tracking-widest text-zinc-500 bg-zinc-800/50 px-2 py-0.5 rounded-full border border-zinc-700/50">
                Role: {currentRole}
              </span>
            </div>
            {content.psychological_framework && (
              <div className="flex items-center gap-2 bg-purple-500/10 px-2 py-1 rounded-md border border-purple-500/20">
                <span className="text-[10px] text-purple-400 font-mono uppercase">Framework</span>
                <span className="text-xs font-bold text-purple-300">{content.psychological_framework}</span>
              </div>
            )}
          </div>
          {content.native_reasoning && (
            <div className="border-l-2 border-blue-500/50 bg-slate-900/30 p-4 mb-4 rounded-r-md">
              <div className="flex items-center gap-2 text-xs uppercase text-blue-400 font-bold mb-2 tracking-wider">
                <Brain className="w-4 h-4" />
                Native Model Reasoning
              </div>
              <div className="text-blue-100/80">
                <MarkdownRenderer content={formatText(content.native_reasoning)} />
              </div>
            </div>
          )}
          <div className="mb-4 text-lg font-medium text-zinc-200 border-l-4 border-zinc-500 pl-4 py-2">
            <MarkdownRenderer content={formatText(content.probing_question)} />
          </div>
          <div className="text-xs text-zinc-500 italic flex items-center gap-2">
            <Target className="w-3 h-3" />
            <MarkdownRenderer content={formatText(content.intent)} />
          </div>
        </div>
      )}

      {isSynthesis && (
        <div className="bg-slate-800/40 border border-white/5 rounded-xl p-6 shadow-lg relative overflow-hidden bg-gradient-to-br from-slate-800/40 to-zinc-900/60 ring-1 ring-white/5">
          <h3 className="text-lg font-bold text-zinc-100 mb-6 bg-gradient-to-r from-zinc-100 to-zinc-500 bg-clip-text text-transparent">
            Final Synthesis
          </h3>
          <div className="flex flex-col gap-6">
            <div>
              <h4 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest mb-3">Executive Summary</h4>
              <div className="mt-2 text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
                <MarkdownRenderer content={formatText(content.executive_summary)} />
              </div>
            </div>
            
            <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
            
            {actionPlan.length > 0 && (
              <div>
                <h4 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest mb-3">Action Plan</h4>
                <div className="flex flex-col gap-3">
                  {actionPlan.map((step: any, i: number) => (
                    <div key={i} className="flex gap-4 items-start">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center text-xs text-zinc-400 font-mono">
                        {i + 1}
                      </div>
                      <div className="pt-0.5 text-sm text-zinc-300 leading-relaxed w-full">
                        <MarkdownRenderer content={formatText(step)} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
            
            {caveats.length > 0 && (
              <div>
                <h4 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest mb-3">Caveats & Assumptions</h4>
                <ul className="list-disc list-inside space-y-1">
                  {caveats.map((caveat: any, i: number) => (
                    <li key={i} className="text-[13px] text-zinc-400 italic">
                      <MarkdownRenderer content={String(caveat)} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          
          <div className="mt-8 pt-4 border-t border-border flex justify-end gap-3">
            <button 
              onClick={handleCopyMarkdown}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground bg-muted/30 hover:bg-muted/50 rounded-lg transition-colors border border-border"
            >
              <Copy className="w-3.5 h-3.5" />
              Copy as Markdown
            </button>
            <button 
              onClick={handleDownloadMarkdown}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-primary-foreground bg-foreground hover:bg-foreground/90 rounded-lg transition-colors shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              Download Report
            </button>
          </div>
        </div>
      )}

      {/* Citations Badges */}
      {content.citations && Array.isArray(content.citations) && content.citations.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2 mb-4">
          {content.citations.map((cite: string, idx: number) => (
            <div key={idx} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-800 border border-white/10 text-xs text-zinc-300 shadow-sm hover:bg-zinc-700 transition-colors">
              <span className="text-[10px]">📖</span>
              {cite.replace(/^\[|\]$/g, '')}
            </div>
          ))}
        </div>
      )}

      {/* Raw JSON Debug View - Hidden if hideContainer is true as it's handled by parent */}
      {!hideContainer && (
        <div className="flex flex-col">
          <button 
            onClick={() => setShowRawState(!showRawState)}
            className="self-start text-[10px] uppercase tracking-widest font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors mt-2"
          >
            <ChevronRight className={`w-3 h-3 transition-transform ${isRawVisible ? 'rotate-90' : ''}`} />
            {isRawVisible ? 'Hide JSON' : 'View Raw JSON'}
          </button>
          {isRawVisible && (
            <div className="mt-2 bg-muted/30 border border-border rounded-lg p-4">
              <pre className="text-[11px] font-mono text-muted-foreground overflow-x-auto">
                <code>{JSON.stringify(content, null, 2)}</code>
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
