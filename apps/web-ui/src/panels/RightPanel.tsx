import { useGraphStore } from "../store/useGraphStore";
import {
  Settings,
  Bot,
  PlayCircle,
  GitBranch,
  RefreshCw,
  TerminalSquare,
  Flame,
  Gauge,
  CircuitBoard,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { synthesizeArchitecture } from "./aiService";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useI18n } from "../i18n";

export default function RightPanel() {
  const { t } = useI18n();
  const { nodes, selectedNodeId, updateNodeData, setGraph } = useGraphStore();
  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  const metrics = useMemo(() => {
    const totalNodes = nodes.length;
    const totalPower = nodes.reduce((acc, node) => acc + (node.data?.tdp_w || 0), 0);
    const avgPower = totalNodes ? totalPower / totalNodes : 0;
    const highPowerNodes = nodes.filter((node) => (node.data?.tdp_w || 0) >= 10).length;

    const distributionMap = nodes.reduce<Record<string, number>>((acc, node) => {
      const category = String(node.data?.category || "Unknown");
      acc[category] = (acc[category] || 0) + (node.data?.tdp_w || 0);
      return acc;
    }, {});
    const distribution = Object.entries(distributionMap)
      .sort(([, a], [, b]) => b - a)
      .map(([category, power]) => ({
        category,
        power,
        ratio: totalPower > 0 ? (power / totalPower) * 100 : 0,
      }));

    const topConsumers = [...nodes]
      .sort((a, b) => (b.data?.tdp_w || 0) - (a.data?.tdp_w || 0))
      .slice(0, 3)
      .map((node) => ({
        id: node.id,
        label: String(node.data?.label || node.id),
        category: String(node.data?.category || "Unknown"),
        power: node.data?.tdp_w || 0,
      }));

    return {
      totalNodes,
      totalPower,
      avgPower,
      highPowerNodes,
      distribution,
      topConsumers,
    };
  }, [nodes]);

  const inputStyle = {
    background: "var(--input-bg)",
    border: "1px solid var(--input-border)",
    color: "var(--text-primary)",
    padding: "6px",
    borderRadius: "4px",
  };

  const [activeTab, setActiveTab] = useState<"properties" | "ai" | "git">(
    "properties",
  );
  const [simulationResult, setSimulationResult] = useState<any>(null);

  // Git State
  const [gitOutput, setGitOutput] = useState<string>("");
  const [gitCommand, setGitCommand] = useState<string>("");
  const [isGitRunning, setIsGitRunning] = useState(false);

  const runGitCommand = async (args: string[]) => {
    setIsGitRunning(true);
    try {
      const res: string = await invoke("execute_git_command", { args });
      setGitOutput(res || t("right.commandExecuted"));
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
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  const fetchModels = async (
    currentBaseUrl: string,
    currentApiKey: string,
    currentProvider: string,
  ) => {
    if (!currentBaseUrl) return;
    if (currentProvider !== "ollama" && !currentApiKey) return;

    setIsLoadingModels(true);
    try {
      const endpoint = currentBaseUrl.replace(/\/$/, "") + "/models";
      const res = await fetch(endpoint, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(currentApiKey
            ? { Authorization: `Bearer ${currentApiKey}` }
            : {}),
        },
      });

      if (res.ok) {
        const data = await res.json();
        if (data && data.data && Array.isArray(data.data)) {
          const models = data.data.map((m: any) => m.id);
          setAvailableModels(models);
          if (models.length > 0 && !models.includes(modelName)) {
            setModelName(models[0]);
            localStorage.setItem("AI_MODEL", models[0]);
          }
        } else if (data && data.models && Array.isArray(data.models)) {
          // Ollama format
          const models = data.models.map((m: any) => m.name);
          setAvailableModels(models);
          if (models.length > 0 && !models.includes(modelName)) {
            setModelName(models[0]);
            localStorage.setItem("AI_MODEL", models[0]);
          }
        }
      }
    } catch (e) {
      console.error("Failed to fetch models:", e);
    } finally {
      setIsLoadingModels(false);
    }
  };

  useEffect(() => {
    // Fetch models when provider, baseUrl, or apiKey changes
    fetchModels(baseUrl, apiKey, provider);
  }, [baseUrl, apiKey, provider]);

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const p = e.target.value;
    setProvider(p);
    localStorage.setItem("AI_PROVIDER", p);

    let newBaseUrl = "";
    let newModelName = "";

    if (p === "openai") {
      newBaseUrl = "https://api.openai.com/v1";
      newModelName = "gpt-4o";
    } else if (p === "deepseek") {
      newBaseUrl = "https://api.deepseek.com/v1";
      newModelName = "deepseek-chat";
    } else if (p === "qwen") {
      newBaseUrl = "https://dashscope.aliyuncs.com/compatible-mode/v1";
      newModelName = "qwen-plus";
    } else if (p === "ollama") {
      newBaseUrl = "http://localhost:11434/v1";
      newModelName = "llama3";
    }

    setBaseUrl(newBaseUrl);
    localStorage.setItem("AI_BASE_URL", newBaseUrl);
    setModelName(newModelName);
    localStorage.setItem("AI_MODEL", newModelName);
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
        { role: "ai", text: t("right.aiMissing") },
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
            {t("right.tab.properties")}
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
            {t("right.tab.ai")}
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
            {t("right.tab.git")}
          </button>
        </div>
      </div>

      <div className="panel-content">
        {activeTab === "properties" ? (
          <div>
            {!selectedNode ? (
              <div className="overview-stack">
                <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                  {t("right.selectNode")}
                </p>

                <div className="overview-card">
                  <div className="overview-header">
                    <div>
                      <h4>{t("right.systemOverview")}</h4>
                      <p>
                        {simulationResult
                          ? simulationResult.status === "success"
                            ? t("right.validationHealthy")
                            : t("right.validationIssues")
                          : t("right.validationHealthy")}
                      </p>
                    </div>
                    <div className="overview-badge">
                      <CircuitBoard size={14} />
                      AHA
                    </div>
                  </div>

                  <div className="overview-kpis">
                    <div className="overview-kpi">
                      <div className="overview-kpi-label">
                        <CircuitBoard size={13} />
                        {t("right.totalNodes")}
                      </div>
                      <div className="overview-kpi-value">{metrics.totalNodes}</div>
                    </div>
                    <div className="overview-kpi">
                      <div className="overview-kpi-label">
                        <Flame size={13} />
                        {t("right.totalPower")}
                      </div>
                      <div className="overview-kpi-value">
                        {metrics.totalPower.toFixed(1)} W
                      </div>
                    </div>
                    <div className="overview-kpi">
                      <div className="overview-kpi-label">
                        <Gauge size={13} />
                        {t("right.avgPower")}
                      </div>
                      <div className="overview-kpi-value">
                        {metrics.avgPower.toFixed(2)} W
                      </div>
                    </div>
                    <div className="overview-kpi">
                      <div className="overview-kpi-label">
                        <Flame size={13} />
                        {t("right.hotspots")}
                      </div>
                      <div className="overview-kpi-value">{metrics.highPowerNodes}</div>
                    </div>
                  </div>

                  <div className="overview-section">
                    <div className="overview-section-title">
                      {t("right.energyDistribution")}
                    </div>
                    {metrics.distribution.length === 0 ? (
                      <p className="overview-empty">{t("right.emptyPowerData")}</p>
                    ) : (
                      metrics.distribution.map((entry) => (
                        <div key={entry.category} className="overview-row">
                          <div className="overview-row-title">
                            <span>{entry.category}</span>
                            <span>{entry.power.toFixed(1)} W</span>
                          </div>
                          <div className="overview-bar-track">
                            <div
                              className="overview-bar-fill"
                              style={{ width: `${Math.max(6, entry.ratio)}%` }}
                            />
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="overview-section">
                    <div className="overview-section-title">{t("right.topConsumers")}</div>
                    {metrics.topConsumers.length === 0 ? (
                      <p className="overview-empty">{t("right.emptyPowerData")}</p>
                    ) : (
                      <div className="overview-list">
                        {metrics.topConsumers.map((consumer) => (
                          <div key={consumer.id} className="overview-list-item">
                            <div>
                              <div className="overview-list-title">{consumer.label}</div>
                              <div className="overview-list-meta">{consumer.category}</div>
                            </div>
                            <div className="overview-list-value">
                              {consumer.power.toFixed(1)} W
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    className="btn primary"
                    style={{
                      width: "100%",
                      marginTop: "8px",
                      justifyContent: "center",
                    }}
                    onClick={runSimulation}
                  >
                    <PlayCircle size={16} /> {t("right.runValidation")}
                  </button>

                  {simulationResult && (
                    <div
                      style={{
                        marginTop: "14px",
                        fontSize: "12px",
                        color:
                          simulationResult.status === "success"
                            ? "var(--success-color)"
                            : "var(--danger-color)",
                      }}
                    >
                      <p>
                        {t("right.status")}: {simulationResult.status}
                      </p>
                      <pre
                        style={{
                          overflowX: "auto",
                          background: "var(--input-bg)",
                          border: "1px solid var(--input-border)",
                          padding: "8px",
                          borderRadius: "6px",
                          marginTop: "6px",
                          color: "var(--text-primary)",
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
                <h4 style={{ marginBottom: "8px" }}>
                  {t("right.componentInstance")}
                </h4>

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
                    {t("right.designator")}
                  </label>
                  <input
                    type="text"
                    value={selectedNode.data.label}
                    onChange={(e) =>
                      updateNodeData(selectedNode.id, "label", e.target.value)
                    }
                    style={inputStyle}
                  />
                </div>

                {selectedNode.data.manufacturer && (
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
                      {t("right.manufacturer")}
                    </label>
                    <input
                      type="text"
                      value={selectedNode.data.manufacturer}
                      disabled
                      style={{
                        background: "var(--surface-soft)",
                        border: "1px solid transparent",
                        color: "var(--text-muted)",
                        padding: "6px",
                        borderRadius: "4px",
                      }}
                    />
                  </div>
                )}

                {selectedNode.data.mpn && (
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
                      {t("right.mpn")}
                    </label>
                    <input
                      type="text"
                      value={selectedNode.data.mpn}
                      disabled
                      style={{
                        background: "var(--surface-soft)",
                        border: "1px solid transparent",
                        color: "var(--text-muted)",
                        padding: "6px",
                        borderRadius: "4px",
                      }}
                    />
                  </div>
                )}

                {selectedNode.data.datasheet_url && (
                  <a
                    href={selectedNode.data.datasheet_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      color: "var(--accent-primary)",
                      fontSize: "12px",
                      textDecoration: "none",
                    }}
                  >
                    {t("right.openDatasheet")}
                  </a>
                )}

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
                    {t("right.category")}
                  </label>
                  <input
                    type="text"
                    value={selectedNode.data.category}
                    disabled
                    style={{
                      background: "var(--surface-soft)",
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
                    {t("right.maxTdp")}
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
                    style={inputStyle}
                  />
                </div>
              </div>
            )}
          </div>
        ) : activeTab === "ai" ? (
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
                {t("right.aiProvider")}
              </label>
              <select
                value={provider}
                onChange={handleProviderChange}
                style={{
                  background: "var(--input-bg)",
                  border: "1px solid var(--border-color)",
                  color: "var(--text-primary)",
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
                  {t("right.baseUrl")}
                </label>
                <input
                  type="text"
                  value={baseUrl}
                  onChange={handleBaseUrlChange}
                  style={{
                    background: "var(--input-bg)",
                    border: "1px solid var(--border-color)",
                    color: "var(--text-primary)",
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
                  {t("right.model")}{" "}
                  {isLoadingModels && (
                    <span
                      style={{
                        fontSize: "10px",
                        color: "var(--accent-primary)",
                      }}
                    >
                      ({t("right.loading")})
                    </span>
                  )}
                </label>
                {availableModels.length > 0 ? (
                  <select
                    value={modelName}
                    onChange={(e) => {
                      setModelName(e.target.value);
                      localStorage.setItem("AI_MODEL", e.target.value);
                    }}
                    style={{
                      background: "var(--input-bg)",
                      border: "1px solid var(--border-color)",
                      color: "var(--text-primary)",
                      padding: "6px",
                      borderRadius: "4px",
                    }}
                  >
                    {availableModels.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={modelName}
                    onChange={handleModelChange}
                    style={{
                      background: "var(--input-bg)",
                      border: "1px solid var(--border-color)",
                      color: "var(--text-primary)",
                      padding: "6px",
                      borderRadius: "4px",
                    }}
                  />
                )}
              </div>
            </div>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "4px" }}
            >
              <label
                style={{ fontSize: "12px", color: "var(--text-secondary)" }}
              >
                {t("right.apiKey")}{" "}
                {provider === "ollama" && `(${t("right.optional")})`}
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={handleKeyChange}
                placeholder={
                  provider === "ollama" ? t("right.notRequiredLocal") : "sk-..."
                }
                style={{
                  background: "var(--input-bg)",
                  border: "1px solid var(--border-color)",
                  color: "var(--text-primary)",
                  padding: "6px",
                  borderRadius: "4px",
                }}
              />
            </div>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
              {t("right.aiDesc")}
            </p>
            <div
              style={{
                flex: 1,
                border: "1px solid var(--border-color)",
                borderRadius: "6px",
                background: "var(--surface-soft)",
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
                          ? "var(--accent-soft)"
                          : "var(--surface-soft)",
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
                    {t("right.aiSynthesizing")}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAISubmit()}
                  placeholder={t("right.aiPlaceholder")}
                  style={{
                    flex: 1,
                    background: "var(--input-bg)",
                    border: "1px solid var(--border-color)",
                    color: "var(--text-primary)",
                    padding: "6px",
                    borderRadius: "4px",
                  }}
                />
                <button
                  className="btn primary"
                  onClick={handleAISubmit}
                  disabled={isSynthesizing}
                >
                  {t("right.send")}
                </button>
              </div>
            </div>
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
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h4 style={{ margin: 0, fontSize: "14px" }}>
                {t("right.gitIntegration")}
              </h4>
              <button
                className="btn"
                onClick={() => runGitCommand(["status"])}
                style={{ padding: "4px 8px" }}
              >
                <RefreshCw size={14} /> {t("right.gitStatus")}
              </button>
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              <button
                className="btn"
                onClick={() => runGitCommand(["add", "."])}
                style={{ flex: 1 }}
              >
                {t("right.gitAddAll")}
              </button>
              <button
                className="btn"
                onClick={() => runGitCommand(["pull"])}
                style={{ flex: 1 }}
              >
                {t("right.gitPull")}
              </button>
              <button
                className="btn"
                onClick={() => runGitCommand(["push"])}
                style={{ flex: 1 }}
              >
                {t("right.gitPush")}
              </button>
            </div>

            <div
              style={{ display: "flex", flexDirection: "column", gap: "4px" }}
            >
              <label
                style={{ fontSize: "12px", color: "var(--text-secondary)" }}
              >
                {t("right.executeCommand")}
              </label>
              <div style={{ display: "flex", gap: "8px" }}>
                <div style={{ position: "relative", flex: 1 }}>
                  <span
                    style={{
                      position: "absolute",
                      left: "8px",
                      top: "8px",
                      color: "var(--text-muted)",
                      fontSize: "12px",
                      fontFamily: "monospace",
                    }}
                  >
                    git
                  </span>
                  <input
                    type="text"
                    value={gitCommand}
                    onChange={(e) => setGitCommand(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleGitSubmit()}
                    placeholder="commit -m 'update'"
                    style={{
                      width: "100%",
                      background: "var(--input-bg)",
                      border: "1px solid var(--border-color)",
                      color: "var(--text-primary)",
                      padding: "6px 8px 6px 32px",
                      borderRadius: "4px",
                      fontFamily: "monospace",
                      fontSize: "12px",
                    }}
                  />
                </div>
                <button
                  className="btn primary"
                  onClick={handleGitSubmit}
                  disabled={isGitRunning}
                >
                  <TerminalSquare size={14} /> {t("right.run")}
                </button>
              </div>
            </div>

            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                minHeight: 0,
              }}
            >
              <label
                style={{ fontSize: "12px", color: "var(--text-secondary)" }}
              >
                {t("right.output")}
              </label>
              <div
                style={{
                  flex: 1,
                  background: "var(--input-bg)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "6px",
                  padding: "8px",
                  overflowY: "auto",
                  fontFamily: "monospace",
                  fontSize: "11px",
                  color: "var(--text-primary)",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                }}
              >
                {isGitRunning ? (
                  <span style={{ color: "var(--text-muted)" }}>
                    {t("right.executing")}
                  </span>
                ) : (
                  gitOutput || (
                    <span style={{ color: "var(--text-muted)" }}>
                      {t("right.noOutput")}
                    </span>
                  )
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
