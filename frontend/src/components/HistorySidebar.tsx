import { useState, useEffect } from 'react';
import { History, Clock, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';

interface Session {
  id: number;
  timestamp: string;
  master_prompt: string;
}

interface HistorySidebarProps {
  onSelectSession: (id: number) => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export function HistorySidebar({ onSelectSession, isOpen, setIsOpen }: HistorySidebarProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetchSessions();
    }
  }, [isOpen]);

  const fetchSessions = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/sessions');
      if (response.ok) {
        const data = await response.json();
        setSessions(data);
      }
    } catch (error) {
      console.error("Failed to fetch sessions", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed left-0 top-1/2 -translate-y-1/2 bg-zinc-900 border border-white/10 p-2 rounded-r-lg text-zinc-400 hover:text-white transition-colors z-50"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    );
  }

  return (
    <div className="w-80 h-full border-r border-white/10 bg-zinc-900/50 flex flex-col transition-all duration-300">
      <div className="p-4 border-b border-white/10 flex justify-between items-center bg-zinc-900/80 sticky top-0 backdrop-blur-sm z-10">
        <div className="flex items-center gap-2 text-white font-medium">
          <History className="w-4 h-4 text-emerald-400" />
          History Vault
        </div>
        <button 
          onClick={() => setIsOpen(false)}
          className="text-zinc-500 hover:text-zinc-300 p-1 rounded-md hover:bg-white/5 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
        {isLoading ? (
          <div className="text-center text-zinc-500 py-8 text-sm">Loading vault...</div>
        ) : sessions.length === 0 ? (
          <div className="text-center text-zinc-500 py-8 text-sm">No past sessions found.</div>
        ) : (
          sessions.map(session => (
            <button
              key={session.id}
              onClick={() => onSelectSession(session.id)}
              className="w-full text-left bg-zinc-900/80 border border-white/5 p-3 rounded-lg hover:border-white/20 hover:bg-zinc-800 transition-all group"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-zinc-500 flex items-center gap-1 font-mono">
                  <Clock className="w-3 h-3" />
                  {new Date(session.timestamp).toLocaleDateString()} {new Date(session.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </span>
                <CheckCircle2 className="w-3 h-3 text-emerald-500/50 group-hover:text-emerald-500 transition-colors" />
              </div>
              <p className="text-sm text-zinc-300 line-clamp-2 leading-relaxed">
                {session.master_prompt}
              </p>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
