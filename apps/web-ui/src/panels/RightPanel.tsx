import { useGraphStore } from "../store/useGraphStore";
import { Settings, Bot, PlayCircle, GitBranch, RefreshCw, Check, TerminalSquare } from "lucide-react";
import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { synthesizeArchitecture } from "./aiService";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function RightPanel() {
  const { nodes, selectedNodeId, updateNodeData, setGraph } = useGraphStore();
  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  const [activeTab, setActiveTab] = useState<"properties" | "ai" | "git">("properties");
  const [simulationResult, setSimulationResult] = useState<any>(null);

  // Git State
  const [gitOutput, setGitOutput] = useState<string>("");
  const [gitCommand, setGitCommand] = useState<string>("");
  const [isGitRunning, setIsGitRunning] = useState(false);

  const runGitCommand = async (args: string[]) => {
    setIsGitRunning(true);
    try {
      const res: string = await invoke("execute_git_command", { args });
      setGitOutput(res || "Command executed successfully (no output).");
    } catch (e) {
      setGitOutput(`Error:\n${e}`);
    } finally {
      setIsGitRunning(false);
    }
  };

  const handleGitSubmit = () => {
    if (!gitCommand.trim()) return;
    const args = gitCommand.trim().split(" ").filter(Boolean);
    if (args[0] === "git") args.shift(); // Remove 'git' if user typed it
    runGitCommand(args);
    setGitCommand("");
  };

  const [chatInput, setChatInput] = useState("");
  const [chatLog, setChatLog] = useState<
    { role: "user" | "ai"; text: string }[]
  >([]);
  const [isSynthesizing, setIsSynthesizing] = useState(false);

  const [provider, setProvider] = useState(
    localStorage.getItem("AI_PROVIDER") || "openai",
  );
  const [baseUrl, setBaseUrl] = useState(
    localStorage.getItem("AI_BASE_URL") || "https://api.openai.com/v1",
  );
  const [modelName, setModelName] = useState(
    localStorage.getItem("AI_MODEL") || "gpt-4o",
  );
  const [apiKey, setApiKey] = useState(
    localStorage.getItem("OPENAI_API_KEY") || "",
  );

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const p = e.target.value;
    setProvider(p);
    localStorage.setItem("AI_PROVIDER", p);
    if (p === "openai") {
      setBaseUrl("https://api.openai.com/v1");
      setModelName("gpt-4o");
    } else if (p === "deepseek") {
      setBaseUrl("https://api.deepseek.com/v1");
      setModelName("deepseek-chat");
    } else if (p === "qwen") {
      setBaseUrl("https://dashscope.aliyuncs.com/compatible-mode/v1");
      setModelName("qwen-plus");
    } else if (p === "ollama") {
      setBaseUrl("http://localhost:11434/v1");
      setModelName("llama3");
    }
  };

  const handleBaseUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBaseUrl(e.target.value);
    localStorage.setItem("AI_BASE_URL", e.target.value);
  };

  const handleModelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setModelName(e.target.value);
    localStorage.setItem("AI_MODEL", e.target.value);
  };

  const handleKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setApiKey(e.target.value);
    localStorage.setItem("OPENAI_API_KEY", e.target.value);
  };

  useEffect(() => {
    const handleOpenAIPanel = (e: Event) => {
      const customEvent = e as CustomEvent;
      setActiveTab("ai");
      if (customEvent.detail?.prompt) {
        setChatInput(customEvent.detail.prompt);
      }
    };

    window.addEventListener("open-ai-panel", handleOpenAIPanel);
    return () => window.removeEventListener("open-ai-panel", handleOpenAIPanel);
  }, []);

  const runSimulation = async () => {
    try {
      const graph_json = JSON.stringify({ nodes });
      const res: string = await invoke("run_thermal_simulation", {
        graphJson: graph_json,
        profile: "max_load",
      });
      setSimulationResult(JSON.parse(res));
    } catch (e) {
      console.error(e);
      setSimulationResult({ status: "error", issues: [String(e)] });
    }
  };

  const handleAISubmit = async () => {
    if (!chatInput.trim() || (provider !== "ollama" && !apiKey)) {
      setChatLog((prev) => [
        ...prev,
        { role: "ai", text: "Please check your API Key and enter a prompt." },
      ]);
      return;
    }

    const prompt = chatInput.trim();
    setChatLog((prev) => [...prev, { role: "user", text: prompt }]);
    setChatInput("");
    setIsSynthesizing(true);

    try {
      const result = await synthesizeArchitecture(prompt, {
        provider,
        baseUrl,
        modelName,
        apiKey,
      });
      setGraph(result.nodes, result.edges);
      setChatLog((prev) => [...prev, { role: "ai", text: result.explanation }]);
    } catch (err: any) {
      setChatLog((prev) => [
        ...prev,
        { role: "ai", text: `Error: ${err.message}` },
      ]);
    } finally {
      setIsSynthesizing(false);
    }
  };

  return (
    <aside
      className="side-panel"
      style={{
        borderLeft: "1px solid var(--border-color)",
        borderRight: "none",
      }}
    >
      <div className="panel-header" style={{ justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={() => setActiveTab("properties")}
            style={{
              background: "none",
              border: "none",
              color:
                activeTab === "properties"
                  ? "var(--accent-primary)"
                  : "var(--text-secondary)",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            <Settings
              size={18}
              style={{ verticalAlign: "middle", marginRight: "4px" }}
            />{" "}
            Properties
          </button>
          <button
            onClick={() => setActiveTab("ai")}
            style={{
              background: "none",
              border: "none",
              color:
                activeTab === "ai"
                  ? "var(--accent-primary)"
                  : "var(--text-secondary)",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            <Bot
              size={18}
              style={{ verticalAlign: "middle", marginRight: "4px" }}
            />{" "}
            Copilot
          </button>
          <button
            onClick={() => setActiveTab("git")}
            style={{
              background: "none",
              border: "none",
              color:
                activeTab === "git"
                  ? "var(--accent-primary)"
                  : "var(--text-secondary)",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            <GitBranch
              size={18}
              style={{ verticalAlign: "middle", marginRight: "4px" }}
            />{" "}
            Git
          </button>
        </div>
      </div>

      <div className="panel-content">
        {activeTab === "properties" ? (
          <div>
            {!selectedNode ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                }}
              >
                <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                  Select a node on the canvas to edit its properties.
                </p>

                <div
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    padding: "12px",
                    borderRadius: "6px",
                    border: "1px solid var(--border-color)",
                  }}
                >
                  <h4 style={{ marginBottom: "8px", fontSize: "13px" }}>
                    System Overview
                  </h4>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "var(--text-secondary)",
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "8px",
                    }}
                  >
                    <span>Total Nodes:</span> <span>{nodes.length}</span>
                    <span>Est. Power:</span>{" "}
                    <span>
                      {nodes
                        .reduce((acc, n) => acc + (n.data?.tdp_w || 0), 0)
                        .toFixed(1)}{" "}
                      W
                    </span>
                  </div>

                  <button
                    className="btn primary"
                    style={{
                      width: "100%",
                      marginTop: "16px",
                      justifyContent: "center",
                    }}
                    onClick={runSimulation}
                  >
                    <PlayCircle size={16} /> Run Validation Loop
                  </button>

                  {simulationResult && (
                    <div
                      style={{
                        marginTop: "16px",
                        fontSize: "12px",
                        color:
                          simulationResult.status === "success"
                            ? "#10b981"
                            : "#ef4444",
                      }}
                    >
                      <p>Status: {simulationResult.status}</p>
                      <pre
                        style={{
                          overflowX: "auto",
                          background: "#000",
                          padding: "8px",
                          borderRadius: "4px",
                          marginTop: "4px",
                        }}
                      >
                        {JSON.stringify(simulationResult, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                <h4 style={{ marginBottom: "8px" }}>Component Instance</h4>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                  }}
                >
                  <label
                    style={{ fontSize: "12px", color: "var(--text-secondary)" }}
                  >
                    Designator / Label
                  </label>
                  <input
                    type="text"
                    value={selectedNode.data.label}
                    onChange={(e) =>
                      updateNodeData(selectedNode.id, "label", e.target.value)
                    }
                    style={{
                      background: "#000",
                      border: "1px solid var(--border-color)",
                      color: "#fff",
                      padding: "6px",
                      borderRadius: "4px",
                    }}
                  />
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                  }}
                >
                  <label
                    style={{ fontSize: "12px", color: "var(--text-secondary)" }}
                  >
                    Category
                  </label>
                  <input
                    type="text"
                    value={selectedNode.data.category}
                    disabled
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid transparent",
                      color: "var(--text-muted)",
                      padding: "6px",
                      borderRadius: "4px",
                    }}
                  />
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                  }}
                >
                  <label
                    style={{ fontSize: "12px", color: "var(--text-secondary)" }}
                  >
                    Max TDP (Watts)
                  </label>
                  <input
                    type="number"
                    value={selectedNode.data.tdp_w || 0}
                    onChange={(e) =>
                      updateNodeData(
                        selectedNode.id,
                        "tdp_w",
                        parseFloat(e.target.value),
                      )
                    }
                    style={{
                      background: "#000",
                      border: "1px solid var(--border-color)",
                      color: "#fff",
                      padding: "6px",
                      borderRadius: "4px",
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              height: "100%",
            }}
          >
            <div
              style={{ display: "flex", flexDirection: "column", gap: "4px" }}
            >
              <label
                style={{ fontSize: "12px", color: "var(--text-secondary)" }}
              >
                AI Provider
              </label>
              <select
                value={provider}
                onChange={handleProviderChange}
                style={{
                  background: "#000",
                  border: "1px solid var(--border-color)",
                  color: "#fff",
                  padding: "6px",
                  borderRadius: "4px",
                }}
              >
                <option value="openai">OpenAI</option>
                <option value="deepseek">DeepSeek</option>
                <option value="qwen">Qwen (Aliyun)</option>
                <option value="ollama">Ollama (Local)</option>
              </select>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                  flex: 1,
                }}
              >
                <label
                  style={{ fontSize: "12px", color: "var(--text-secondary)" }}
                >
                  Base URL
                </label>
                <input
                  type="text"
                  value={baseUrl}
                  onChange={handleBaseUrlChange}
                  style={{
                    background: "#000",
                    border: "1px solid var(--border-color)",
                    color: "#fff",
                    padding: "6px",
                    borderRadius: "4px",
                  }}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                  flex: 1,
                }}
              >
                <label
                  style={{ fontSize: "12px", color: "var(--text-secondary)" }}
                >
                  Model
                </label>
                <input
                  type="text"
                  value={modelName}
                  onChange={handleModelChange}
                  style={{
                    background: "#000",
                    border: "1px solid var(--border-color)",
                    color: "#fff",
                    padding: "6px",
                    borderRadius: "4px",
                  }}
                />
              </div>
            </div>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "4px" }}
            >
              <label
                style={{ fontSize: "12px", color: "var(--text-secondary)" }}
              >
                API Key {provider === "ollama" && "(Optional)"}
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={handleKeyChange}
                placeholder={
                  provider === "ollama" ? "Not required for local" : "sk-..."
                }
                style={{
                  background: "#000",
                  border: "1px solid var(--border-color)",
                  color: "#fff",
                  padding: "6px",
                  borderRadius: "4px",
                }}
              />
            </div>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
              Describe your hardware requirements here. The AI will synthesize a
              draft architecture layout.
            </p>
            <div
              style={{
                flex: 1,
                border: "1px solid var(--border-color)",
                borderRadius: "6px",
                background: "rgba(0,0,0,0.3)",
                padding: "8px",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                {chatLog.map((log, i) => (
                  <div
                    key={i}
                    style={{
                      background:
                        log.role === "user"
                          ? "rgba(59, 130, 246, 0.2)"
                          : "rgba(255, 255, 255, 0.05)",
                      alignSelf:
                        log.role === "user" ? "flex-end" : "flex-start",
                      padding: "12px",
                      borderRadius: "8px",
                      fontSize: "13px",
                      maxWidth: "90%",
                      lineHeight: "1.5",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                    }}
                  >
                    {log.role === "ai" ? (
                      <div
                        className="markdown-body"
                        style={{ color: "var(--text-primary)" }}
                      >
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {log.text}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      log.text
                    )}
                  </div>
                ))}
                {isSynthesizing && (
                  <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                    AI is synthesizing architecture...
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAISubmit()}
                  placeholder="I need an Edge AI grading system..."
                  style={{
                    flex: 1,
                    background: "#000",
                    border: "1px solid var(--border-color)",
                    color: "#fff",
                    padding: "6px",
                    borderRadius: "4px",
                  }}
                />
                <button
                  className="btn primary"
                  onClick={handleAISubmit}
                  disabled={isSynthesizing}
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", height: "100%" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h4 style={{ margin: 0, fontSize: "14px" }}>Git Integration</h4>
              <button 
                className="btn" 
                onClick={() => runGitCommand(["status"])}
                style={{ padding: "4px 8px" }}
              >
                <RefreshCw size={14} /> Status
              </button>
            </div>
            
            <div style={{ display: "flex", gap: "8px" }}>
              <button className="btn" onClick={() => runGitCommand(["add", "."])} style={{ flex: 1 }}>
                Add All
              </button>
              <button className="btn" onClick={() => runGitCommand(["pull"])} style={{ flex: 1 }}>
                Pull
              </button>
              <button className="btn" onClick={() => runGitCommand(["push"])} style={{ flex: 1 }}>
                Push
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Execute Command</label>
              <div style={{ display: "flex", gap: "8px" }}>
                <div style={{ position: "relative", flex: 1 }}>
                  <span style={{ position: "absolute", left: "8px", top: "8px", color: "var(--text-muted)", fontSize: "12px", fontFamily: "monospace" }}>git</span>
                  <input
                    type="text"
                    value={gitCommand}
                    onChange={(e) => setGitCommand(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleGitSubmit()}
                    placeholder="commit -m 'update'"
                    style={{
                      width: "100%",
                      background: "#000",
                      border: "1px solid var(--border-color)",
                      color: "#fff",
                      padding: "6px 8px 6px 32px",
                      borderRadius: "4px",
                      fontFamily: "monospace",
                      fontSize: "12px"
                    }}
                  />
                </div>
                <button 
                  className="btn primary" 
                  onClick={handleGitSubmit}
                  disabled={isGitRunning}
                >
                  <TerminalSquare size={14} /> Run
                </button>
              </div>
            </div>

            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px", minHeight: 0 }}>
              <label style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Output</label>
              <div style={{ 
                flex: 1, 
                background: "#000", 
                border: "1px solid var(--border-color)", 
                borderRadius: "6px", 
                padding: "8px",
                overflowY: "auto",
                fontFamily: "monospace",
                fontSize: "11px",
                color: "var(--text-primary)",
                whiteSpace: "pre-wrap",
                wordBreak: "break-all"
              }}>
                {isGitRunning ? (
                  <span style={{ color: "var(--text-muted)" }}>Executing...</span>
                ) : (
                  gitOutput || <span style={{ color: "var(--text-muted)" }}>No output yet. Run a command to see results.</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
