import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Key,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  RefreshCw,
  Globe,
  ShieldCheck,
} from "lucide-react";

interface ApiKeyConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved?: (status: any) => void;
}

export function ApiKeyConfigModal({ isOpen, onClose, onConfigSaved }: ApiKeyConfigModalProps) {
  const [activeTab, setActiveTab] = useState("direct");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testingAgent, setTestingAgent] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, any>>({});
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

  // Form states
  const [deepseekKey, setDeepseekKey] = useState("");
  const [deepseekBase, setDeepseekBase] = useState("https://api.deepseek.com");
  const [deepseekModel, setDeepseekModel] = useState("deepseek-chat");

  const [qwenKey, setQwenKey] = useState("");
  const [qwenBase, setQwenBase] = useState("https://dashscope-intl.aliyuncs.com/compatible-mode/v1");
  const [qwenModel, setQwenModel] = useState("qwen-plus");

  const [glmKey, setGlmKey] = useState("");
  const [glmBase, setGlmBase] = useState("https://open.bigmodel.cn/api/paas/v4");
  const [glmModel, setGlmModel] = useState("glm-4-flash");

  const [openrouterKey, setOpenrouterKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");

  const [currentStatus, setCurrentStatus] = useState<any>(null);

  useEffect(() => {
    if (isOpen) {
      loadConfig();
    }
  }, [isOpen]);

  const loadConfig = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/config/api-keys");
      if (res.ok) {
        const data = await res.json();
        setCurrentStatus(data);

        // Prepopulate models and base URLs if returned
        if (data.agents?.deepseek) {
          if (data.agents.deepseek.base_url) setDeepseekBase(data.agents.deepseek.base_url);
          if (data.agents.deepseek.model) setDeepseekModel(data.agents.deepseek.model);
        }
        if (data.agents?.qwen) {
          if (data.agents.qwen.base_url) setQwenBase(data.agents.qwen.base_url);
          if (data.agents.qwen.model) setQwenModel(data.agents.qwen.model);
        }
        if (data.agents?.glm) {
          if (data.agents.glm.base_url) setGlmBase(data.agents.glm.base_url);
          if (data.agents.glm.model) setGlmModel(data.agents.glm.model);
        }
      }
    } catch (e) {
      console.error("Failed to load API keys config", e);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleShowKey = (name: string) => {
    setShowKeys((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const handleTestKey = async (agentName: string) => {
    setTestingAgent(agentName);
    try {
      const res = await fetch("/api/config/verify-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent: agentName }),
      });
      if (res.ok) {
        const data = await res.json();
        const result = data.results?.[0];
        setTestResults((prev) => ({ ...prev, [agentName]: result }));
      } else {
        setTestResults((prev) => ({
          ...prev,
          [agentName]: { success: false, error: `HTTP ${res.status}` },
        }));
      }
    } catch (e: any) {
      setTestResults((prev) => ({
        ...prev,
        [agentName]: { success: false, error: e.message },
      }));
    } finally {
      setTestingAgent(null);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload: Record<string, any> = {};

      if (deepseekKey.trim()) {
        payload.deepseek = {
          api_key: deepseekKey.trim(),
          base_url: deepseekBase.trim(),
          model: deepseekModel.trim(),
        };
      } else if (deepseekBase || deepseekModel) {
        payload.deepseek = {
          base_url: deepseekBase.trim(),
          model: deepseekModel.trim(),
        };
      }

      if (qwenKey.trim()) {
        payload.qwen = {
          api_key: qwenKey.trim(),
          base_url: qwenBase.trim(),
          model: qwenModel.trim(),
        };
      } else if (qwenBase || qwenModel) {
        payload.qwen = {
          base_url: qwenBase.trim(),
          model: qwenModel.trim(),
        };
      }

      if (glmKey.trim()) {
        payload.glm = {
          api_key: glmKey.trim(),
          base_url: glmBase.trim(),
          model: glmModel.trim(),
        };
      } else if (glmBase || glmModel) {
        payload.glm = {
          base_url: glmBase.trim(),
          model: glmModel.trim(),
        };
      }

      if (openrouterKey.trim()) {
        payload.openrouter = { api_key: openrouterKey.trim() };
      }

      if (openaiKey.trim()) {
        payload.openai = { api_key: openaiKey.trim() };
      }

      const res = await fetch("/api/config/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        setCurrentStatus(data.config);
        if (onConfigSaved) {
          onConfigSaved(data.config);
        }
        onClose();
      } else {
        alert("Failed to save settings: " + (await res.text()));
      }
    } catch (e: any) {
      alert("Error saving API keys: " + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl bg-[#0a0a0a] border border-white/10 text-zinc-100 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Key className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">API Mode Configuration</DialogTitle>
              <DialogDescription className="text-zinc-400 text-xs">
                Configure direct API keys for high-speed, headless multi-agent reasoning.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12 gap-3 text-zinc-400 text-sm">
            <Loader2 className="w-5 h-5 animate-spin" />
            Loading configuration...
          </div>
        ) : (
          <div className="flex flex-col gap-6 py-2">
            {/* Status bar */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10 text-xs">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span className="text-zinc-300 font-medium">Active Fleet Status:</span>
              </div>
              <div className="flex items-center gap-2">
                {["deepseek", "qwen", "glm"].map((a) => {
                  const isReady = currentStatus?.agents?.[a]?.configured;
                  return (
                    <Badge
                      key={a}
                      variant="outline"
                      className={`text-[10px] px-2 py-0.5 uppercase font-mono ${
                        isReady
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                          : "bg-zinc-800 text-zinc-500 border-zinc-700"
                      }`}
                    >
                      {a}: {isReady ? "READY" : "MISSING"}
                    </Badge>
                  );
                })}
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-zinc-900 border border-white/10 p-1 rounded-lg">
                <TabsTrigger
                  value="direct"
                  className="text-xs data-[state=active]:bg-zinc-800 data-[state=active]:text-white py-1.5"
                >
                  Direct Frontier Keys
                </TabsTrigger>
                <TabsTrigger
                  value="universal"
                  className="text-xs data-[state=active]:bg-zinc-800 data-[state=active]:text-white py-1.5"
                >
                  Universal Fallbacks (OpenRouter / OpenAI)
                </TabsTrigger>
              </TabsList>

              {/* DIRECT AGENT KEYS TAB */}
              <TabsContent value="direct" className="space-y-4 pt-3">
                {/* DEEPSEEK */}
                <div className="p-4 rounded-xl border border-white/10 bg-zinc-950/50 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span className="text-sm font-semibold text-zinc-200">DeepSeek API</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {currentStatus?.agents?.deepseek?.configured && (
                        <span className="text-[11px] font-mono text-zinc-500">
                          {currentStatus.agents.deepseek.masked_key}
                        </span>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs border-white/10 hover:bg-white/5"
                        onClick={() => handleTestKey("deepseek")}
                        disabled={testingAgent === "deepseek"}
                      >
                        {testingAgent === "deepseek" ? (
                          <Loader2 className="w-3 h-3 animate-spin mr-1" />
                        ) : (
                          <RefreshCw className="w-3 h-3 mr-1" />
                        )}
                        Test
                      </Button>
                    </div>
                  </div>

                  {testResults.deepseek && (
                    <div
                      className={`text-[11px] px-3 py-1.5 rounded-md flex items-center gap-2 ${
                        testResults.deepseek.success
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-red-500/10 text-red-400 border border-red-500/20"
                      }`}
                    >
                      {testResults.deepseek.success ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Connected successfully ({testResults.deepseek.latency_ms}ms)
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-3.5 h-3.5" />
                          {testResults.deepseek.error}
                        </>
                      )}
                    </div>
                  )}

                  <div className="relative">
                    <Input
                      type={showKeys.deepseek ? "text" : "password"}
                      placeholder={
                        currentStatus?.agents?.deepseek?.configured
                          ? "Key is configured (enter new key to replace)"
                          : "Paste DEEPSEEK_API_KEY (sk-...)"
                      }
                      value={deepseekKey}
                      onChange={(e) => setDeepseekKey(e.target.value)}
                      className="bg-black/40 border-white/10 text-xs pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => toggleShowKey("deepseek")}
                      className="absolute right-3 top-2.5 text-zinc-400 hover:text-white"
                    >
                      {showKeys.deepseek ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-zinc-400 uppercase font-mono block mb-1">
                        Model ID
                      </label>
                      <Input
                        value={deepseekModel}
                        onChange={(e) => setDeepseekModel(e.target.value)}
                        placeholder="deepseek-chat or deepseek-reasoner"
                        className="bg-black/40 border-white/10 text-xs h-8"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-400 uppercase font-mono block mb-1">
                        Base URL
                      </label>
                      <Input
                        value={deepseekBase}
                        onChange={(e) => setDeepseekBase(e.target.value)}
                        placeholder="https://api.deepseek.com"
                        className="bg-black/40 border-white/10 text-xs h-8"
                      />
                    </div>
                  </div>
                </div>

                {/* QWEN */}
                <div className="p-4 rounded-xl border border-white/10 bg-zinc-950/50 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-red-400" />
                      <span className="text-sm font-semibold text-zinc-200">
                        Qwen (Alibaba DashScope)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {currentStatus?.agents?.qwen?.configured && (
                        <span className="text-[11px] font-mono text-zinc-500">
                          {currentStatus.agents.qwen.masked_key}
                        </span>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs border-white/10 hover:bg-white/5"
                        onClick={() => handleTestKey("qwen")}
                        disabled={testingAgent === "qwen"}
                      >
                        {testingAgent === "qwen" ? (
                          <Loader2 className="w-3 h-3 animate-spin mr-1" />
                        ) : (
                          <RefreshCw className="w-3 h-3 mr-1" />
                        )}
                        Test
                      </Button>
                    </div>
                  </div>

                  {testResults.qwen && (
                    <div
                      className={`text-[11px] px-3 py-1.5 rounded-md flex items-center gap-2 ${
                        testResults.qwen.success
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-red-500/10 text-red-400 border border-red-500/20"
                      }`}
                    >
                      {testResults.qwen.success ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Connected successfully ({testResults.qwen.latency_ms}ms)
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-3.5 h-3.5" />
                          {testResults.qwen.error}
                        </>
                      )}
                    </div>
                  )}

                  <div className="relative">
                    <Input
                      type={showKeys.qwen ? "text" : "password"}
                      placeholder={
                        currentStatus?.agents?.qwen?.configured
                          ? "Key is configured (enter new key to replace)"
                          : "Paste DASHSCOPE_API_KEY / QWEN_API_KEY"
                      }
                      value={qwenKey}
                      onChange={(e) => setQwenKey(e.target.value)}
                      className="bg-black/40 border-white/10 text-xs pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => toggleShowKey("qwen")}
                      className="absolute right-3 top-2.5 text-zinc-400 hover:text-white"
                    >
                      {showKeys.qwen ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-zinc-400 uppercase font-mono block mb-1">
                        Model ID
                      </label>
                      <Input
                        value={qwenModel}
                        onChange={(e) => setQwenModel(e.target.value)}
                        placeholder="qwen-plus, qwen-turbo, or qwen-max"
                        className="bg-black/40 border-white/10 text-xs h-8"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-400 uppercase font-mono block mb-1">
                        Base URL
                      </label>
                      <Input
                        value={qwenBase}
                        onChange={(e) => setQwenBase(e.target.value)}
                        placeholder="https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
                        className="bg-black/40 border-white/10 text-xs h-8"
                      />
                    </div>
                  </div>
                </div>

                {/* GLM / ZHIPU AI */}
                <div className="p-4 rounded-xl border border-white/10 bg-zinc-950/50 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-400" />
                      <span className="text-sm font-semibold text-zinc-200">
                        GLM (Zhipu AI BigModel)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {currentStatus?.agents?.glm?.configured && (
                        <span className="text-[11px] font-mono text-zinc-500">
                          {currentStatus.agents.glm.masked_key}
                        </span>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs border-white/10 hover:bg-white/5"
                        onClick={() => handleTestKey("glm")}
                        disabled={testingAgent === "glm"}
                      >
                        {testingAgent === "glm" ? (
                          <Loader2 className="w-3 h-3 animate-spin mr-1" />
                        ) : (
                          <RefreshCw className="w-3 h-3 mr-1" />
                        )}
                        Test
                      </Button>
                    </div>
                  </div>

                  {testResults.glm && (
                    <div
                      className={`text-[11px] px-3 py-1.5 rounded-md flex items-center gap-2 ${
                        testResults.glm.success
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-red-500/10 text-red-400 border border-red-500/20"
                      }`}
                    >
                      {testResults.glm.success ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Connected successfully ({testResults.glm.latency_ms}ms)
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-3.5 h-3.5" />
                          {testResults.glm.error}
                        </>
                      )}
                    </div>
                  )}

                  <div className="relative">
                    <Input
                      type={showKeys.glm ? "text" : "password"}
                      placeholder={
                        currentStatus?.agents?.glm?.configured
                          ? "Key is configured (enter new key to replace)"
                          : "Paste ZHIPUAI_API_KEY / GLM_API_KEY"
                      }
                      value={glmKey}
                      onChange={(e) => setGlmKey(e.target.value)}
                      className="bg-black/40 border-white/10 text-xs pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => toggleShowKey("glm")}
                      className="absolute right-3 top-2.5 text-zinc-400 hover:text-white"
                    >
                      {showKeys.glm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-zinc-400 uppercase font-mono block mb-1">
                        Model ID
                      </label>
                      <Input
                        value={glmModel}
                        onChange={(e) => setGlmModel(e.target.value)}
                        placeholder="glm-4-flash, glm-4, or glm-4-plus"
                        className="bg-black/40 border-white/10 text-xs h-8"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-400 uppercase font-mono block mb-1">
                        Base URL
                      </label>
                      <Input
                        value={glmBase}
                        onChange={(e) => setGlmBase(e.target.value)}
                        placeholder="https://open.bigmodel.cn/api/paas/v4"
                        className="bg-black/40 border-white/10 text-xs h-8"
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* UNIVERSAL FALLBACK TAB */}
              <TabsContent value="universal" className="space-y-4 pt-3">
                <div className="p-4 rounded-xl border border-white/10 bg-zinc-950/50 flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-purple-400" />
                    <span className="text-sm font-semibold text-zinc-200">
                      OpenRouter (One Key For All Agents)
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Provide an OpenRouter API key to automatically route DeepSeek, Qwen, and GLM
                    requests through a single unified API balance.
                  </p>
                  <div className="relative">
                    <Input
                      type={showKeys.openrouter ? "text" : "password"}
                      placeholder={
                        currentStatus?.universal?.openrouter_configured
                          ? "OpenRouter key is configured (enter new to replace)"
                          : "Paste OPENROUTER_API_KEY (sk-or-...)"
                      }
                      value={openrouterKey}
                      onChange={(e) => setOpenrouterKey(e.target.value)}
                      className="bg-black/40 border-white/10 text-xs pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => toggleShowKey("openrouter")}
                      className="absolute right-3 top-2.5 text-zinc-400 hover:text-white"
                    >
                      {showKeys.openrouter ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-white/10 bg-zinc-950/50 flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm font-semibold text-zinc-200">
                      OpenAI Fallback
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Use your OpenAI API key as a fallback to substitute models if frontier keys are unavailable.
                  </p>
                  <div className="relative">
                    <Input
                      type={showKeys.openai ? "text" : "password"}
                      placeholder={
                        currentStatus?.universal?.openai_configured
                          ? "OpenAI key is configured (enter new to replace)"
                          : "Paste OPENAI_API_KEY (sk-...)"
                      }
                      value={openaiKey}
                      onChange={(e) => setOpenaiKey(e.target.value)}
                      className="bg-black/40 border-white/10 text-xs pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => toggleShowKey("openai")}
                      className="absolute right-3 top-2.5 text-zinc-400 hover:text-white"
                    >
                      {showKeys.openai ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}

        <DialogFooter className="border-t border-white/10 pt-4 flex sm:justify-between items-center w-full">
          <p className="text-[11px] text-zinc-500 hidden sm:block">
            Keys are stored in your local <code className="text-zinc-300">.env</code> file.
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={isSaving}
              className="text-xs hover:bg-white/5"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="bg-white text-black hover:bg-zinc-200 text-xs font-semibold"
            >
              {isSaving ? "Saving..." : "Save & Apply"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
