import {
  Cpu,
  Zap,
  Activity,
  Radio,
  HardDrive,
  Search,
  Layers,
  DatabaseZap,
} from "lucide-react";
import { useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useI18n } from "../i18n";

const TRUSTEDPARTS_COMPANY_ID_KEY = "AHA_TRUSTEDPARTS_COMPANY_ID";
const TRUSTEDPARTS_API_KEY_KEY = "AHA_TRUSTEDPARTS_API_KEY";

type DragPayload = {
  ahaDrag: true;
  type: string;
  label: string;
  tdp: number;
  mfg?: string;
  package?: string;
  mpn?: string;
  description?: string;
  datasheetUrl?: string;
  buyUrl?: string;
  stock?: number;
};

type LibraryItem = {
  type: string;
  label: string;
  mfg: string;
  icon: JSX.Element;
  tdp: number;
  package: string;
};

type LiveOffer = {
  distributor: string;
  sku?: string | null;
  stock?: number | null;
  moq?: number | null;
  currency?: string | null;
  unitPrice?: number | null;
  buyUrl?: string | null;
  datasheetUrl?: string | null;
};

type LivePart = {
  mpn: string;
  manufacturer?: string | null;
  description?: string | null;
  lifecycleStatus?: string | null;
  categoryHint: string;
  offers: LiveOffer[];
};

const LIBRARY_ITEM: LibraryItem[] = [
  {
    type: "SoC",
    label: "Jetson Orin NX (16GB)",
    mfg: "NVIDIA",
    icon: <Cpu strokeWidth={1.5} />,
    tdp: 15,
    package: "260-pin SO-DIMM",
  },
  {
    type: "SoC",
    label: "Jetson AGX Orin",
    mfg: "NVIDIA",
    icon: <Cpu strokeWidth={1.5} />,
    tdp: 60,
    package: "Custom Module",
  },
  {
    type: "SoC",
    label: "Snapdragon 8 Gen 3",
    mfg: "Qualcomm",
    icon: <Cpu strokeWidth={1.5} />,
    tdp: 12,
    package: "FCBGA",
  },
  {
    type: "MCU",
    label: "STM32G474VET6",
    mfg: "STMicroelectronics",
    icon: <Cpu strokeWidth={1.5} />,
    tdp: 0.5,
    package: "LQFP-100",
  },
  {
    type: "MCU",
    label: "RP2040",
    mfg: "Raspberry Pi",
    icon: <Cpu strokeWidth={1.5} />,
    tdp: 0.3,
    package: "QFN-56",
  },
  {
    type: "MCU",
    label: "ESP32-S3-WROOM-1",
    mfg: "Espressif",
    icon: <Radio strokeWidth={1.5} />,
    tdp: 1.2,
    package: "Module",
  },
  {
    type: "Sensor",
    label: "IMX219 8MP Camera",
    mfg: "Sony",
    icon: <Activity strokeWidth={1.5} />,
    tdp: 1.5,
    package: "MIPI CSI-2 Module",
  },
  {
    type: "Sensor",
    label: "BME680 Env",
    mfg: "Bosch",
    icon: <Activity strokeWidth={1.5} />,
    tdp: 0.05,
    package: "LGA-8",
  },
  {
    type: "PMIC",
    label: "TPS65219",
    mfg: "Texas Instruments",
    icon: <Zap strokeWidth={1.5} />,
    tdp: 0.8,
    package: "VQFN-32",
  },
  {
    type: "Memory",
    label: "16GB DDR4",
    mfg: "Samsung",
    icon: <Layers strokeWidth={1.5} />,
    tdp: 3.5,
    package: "FBGA",
  },
  {
    type: "Storage",
    label: "980 PRO 1TB NVMe",
    mfg: "Samsung",
    icon: <HardDrive strokeWidth={1.5} />,
    tdp: 6.5,
    package: "M.2 2280",
  },
];

function normalizeCategory(raw?: string | null) {
  const category = (raw || "Component").toLowerCase();
  if (category.includes("soc") || category.includes("processor")) return "SoC";
  if (category.includes("mcu") || category.includes("microcontroller")) return "MCU";
  if (category.includes("sensor")) return "Sensor";
  if (category.includes("pmic") || category.includes("power")) return "PMIC";
  if (category.includes("memory") || category.includes("ram")) return "Memory";
  if (category.includes("storage") || category.includes("flash") || category.includes("ssd")) return "Storage";
  if (category.includes("rf") || category.includes("wireless")) return "RF";
  return "Component";
}

function defaultTdpForCategory(category: string) {
  switch (category) {
    case "SoC":
      return 15;
    case "MCU":
      return 1.2;
    case "Sensor":
      return 0.8;
    case "PMIC":
      return 1;
    case "Memory":
      return 2.5;
    case "Storage":
      return 4;
    default:
      return 2;
  }
}

export default function LeftPanel() {
  const { t } = useI18n();

  const [activeTab, setActiveTab] = useState<"library" | "live">("library");
  const [searchQuery, setSearchQuery] = useState("");

  const [liveCompanyId, setLiveCompanyId] = useState(
    () => localStorage.getItem(TRUSTEDPARTS_COMPANY_ID_KEY) || "",
  );
  const [liveApiKey, setLiveApiKey] = useState(
    () => localStorage.getItem(TRUSTEDPARTS_API_KEY_KEY) || "",
  );
  const [liveQuery, setLiveQuery] = useState("");
  const [liveExactMatch, setLiveExactMatch] = useState(false);
  const [liveInStockOnly, setLiveInStockOnly] = useState(true);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveResults, setLiveResults] = useState<LivePart[]>([]);
  const [liveError, setLiveError] = useState<string | null>(null);

  const filteredLibs = useMemo(
    () =>
      LIBRARY_ITEM.filter(
        (item) =>
          item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.mfg.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.type.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    [searchQuery],
  );

  const onDragStart = (event: React.DragEvent, payload: DragPayload) => {
    const serialized = JSON.stringify(payload);
    event.dataTransfer.setData("application/aha-node", serialized);
    // `text/plain` is required for some WebView engines to keep drag payload.
    event.dataTransfer.setData("text/plain", serialized);
    event.dataTransfer.setData("application/reactflow", payload.type);
    event.dataTransfer.setData("application/reactflow-label", payload.label);
    event.dataTransfer.effectAllowed = "copyMove";

    if (event.dataTransfer.setDragImage) {
      const dragImage = new Image();
      dragImage.src =
        "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
      event.dataTransfer.setDragImage(dragImage, 0, 0);
    }
  };

  const saveTrustedPartsCredentials = (companyId: string, apiKey: string) => {
    localStorage.setItem(TRUSTEDPARTS_COMPANY_ID_KEY, companyId);
    localStorage.setItem(TRUSTEDPARTS_API_KEY_KEY, apiKey);
  };

  const handleLiveSearch = async () => {
    const companyId = liveCompanyId.trim();
    const apiKey = liveApiKey.trim();
    const query = liveQuery.trim();
    if (!companyId || !apiKey) {
      setLiveError(t("left.liveAuthHint"));
      return;
    }
    if (!query) {
      return;
    }

    setLiveLoading(true);
    setLiveError(null);
    saveTrustedPartsCredentials(companyId, apiKey);
    try {
      const response = await invoke<LivePart[]>("search_trustedparts_inventory", {
        query: {
          companyId,
          apiKey,
          searchToken: query,
          exactMatch: liveExactMatch,
          inStockOnly: liveInStockOnly,
          maxResults: 20,
          countryCode: "US",
        },
      });
      setLiveResults(response);
    } catch (error) {
      setLiveResults([]);
      setLiveError(String(error));
    } finally {
      setLiveLoading(false);
    }
  };

  return (
    <aside className="side-panel">
      <div className="panel-header" style={{ paddingBottom: "16px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "12px",
          }}
        >
          <Layers size={18} color="var(--accent-primary)" />
          <span style={{ fontWeight: 600 }}>{t("left.libraryExplorer")}</span>
        </div>

        <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
          <button
            className="btn"
            style={{
              flex: 1,
              justifyContent: "center",
              background: activeTab === "library" ? "var(--accent-soft)" : undefined,
            }}
            onClick={() => setActiveTab("library")}
          >
            <Layers size={14} /> {t("left.tabLibrary")}
          </button>
          <button
            className="btn"
            style={{
              flex: 1,
              justifyContent: "center",
              background: activeTab === "live" ? "var(--accent-soft)" : undefined,
            }}
            onClick={() => setActiveTab("live")}
          >
            <DatabaseZap size={14} /> {t("left.tabLive")}
          </button>
        </div>

        {activeTab === "library" ? (
          <div style={{ position: "relative", width: "100%" }}>
            <Search
              size={14}
              style={{
                position: "absolute",
                left: "10px",
                top: "8px",
                color: "var(--text-muted)",
              }}
            />
            <input
              type="text"
              placeholder={t("left.searchPlaceholder")}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              style={{
                width: "100%",
                background: "var(--input-bg)",
                border: "1px solid var(--input-border)",
                color: "var(--text-primary)",
                padding: "6px 10px 6px 30px",
                borderRadius: "6px",
                fontSize: "12px",
              }}
            />
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div
              style={{
                fontSize: "11px",
                color: "var(--text-muted)",
              }}
            >
              {t("left.liveTitle")}
            </div>
            <input
              type="text"
              placeholder={t("left.liveCompanyId")}
              value={liveCompanyId}
              onChange={(event) => setLiveCompanyId(event.target.value)}
              style={{
                background: "var(--input-bg)",
                border: "1px solid var(--input-border)",
                color: "var(--text-primary)",
                padding: "6px 8px",
                borderRadius: "6px",
                fontSize: "12px",
              }}
            />
            <input
              type="password"
              placeholder={t("left.liveApiKey")}
              value={liveApiKey}
              onChange={(event) => setLiveApiKey(event.target.value)}
              style={{
                background: "var(--input-bg)",
                border: "1px solid var(--input-border)",
                color: "var(--text-primary)",
                padding: "6px 8px",
                borderRadius: "6px",
                fontSize: "12px",
              }}
            />
            <input
              type="text"
              placeholder={t("left.liveQueryPlaceholder")}
              value={liveQuery}
              onChange={(event) => setLiveQuery(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && void handleLiveSearch()}
              style={{
                background: "var(--input-bg)",
                border: "1px solid var(--input-border)",
                color: "var(--text-primary)",
                padding: "6px 8px",
                borderRadius: "6px",
                fontSize: "12px",
              }}
            />
            <label style={{ display: "flex", gap: "6px", fontSize: "11px", color: "var(--text-secondary)" }}>
              <input
                type="checkbox"
                checked={liveExactMatch}
                onChange={(event) => setLiveExactMatch(event.target.checked)}
              />
              {t("left.liveExactMatch")}
            </label>
            <label style={{ display: "flex", gap: "6px", fontSize: "11px", color: "var(--text-secondary)" }}>
              <input
                type="checkbox"
                checked={liveInStockOnly}
                onChange={(event) => setLiveInStockOnly(event.target.checked)}
              />
              {t("left.liveInStockOnly")}
            </label>
            <button
              className="btn primary"
              style={{ justifyContent: "center" }}
              onClick={() => void handleLiveSearch()}
              disabled={liveLoading}
            >
              {t("left.liveSearch")}
            </button>
          </div>
        )}
      </div>

      <div className="panel-content" style={{ padding: "0 12px 12px 12px" }}>
        <p
          style={{
            fontSize: "11px",
            color: "var(--text-muted)",
            marginBottom: "12px",
            textAlign: "center",
          }}
        >
          {t("left.dragHint")}
        </p>

        {activeTab === "library" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {filteredLibs.map((item, idx) => (
              <div
                key={idx}
                className="lib-item"
                draggable
                  onDragStart={(event) =>
                    onDragStart(event, {
                      ahaDrag: true,
                      type: item.type,
                      label: item.label,
                      tdp: item.tdp,
                    mfg: item.mfg,
                    package: item.package,
                  })
                }
                style={{
                  background:
                    "linear-gradient(145deg, var(--surface-soft) 0%, var(--surface-subtle) 100%)",
                  border: "1px solid var(--surface-border)",
                  borderRadius: "8px",
                  padding: "12px",
                  cursor: "grab",
                  transition: "all 0.2s ease",
                  display: "flex",
                  gap: "12px",
                  alignItems: "center",
                }}
                onMouseOver={(event) =>
                  (event.currentTarget.style.borderColor = "var(--accent-primary)")
                }
                onMouseOut={(event) =>
                  (event.currentTarget.style.borderColor = "var(--surface-border)")
                }
              >
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    background: "var(--surface-elevated)",
                    borderRadius: "6px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    border: "1px solid var(--surface-border)",
                  }}
                >
                  <span style={{ color: "var(--accent-primary)" }}>{item.icon}</span>
                </div>

                <div
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                  }}
                >
                  <h4
                    style={{
                      margin: 0,
                      fontSize: "13px",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      fontWeight: 500,
                      color: "var(--text-primary)",
                    }}
                    title={item.label}
                  >
                    {item.label}
                  </h4>
                  <div style={{ display: "flex", gap: "6px", fontSize: "10px" }}>
                    <span
                      style={{
                        color: "#60a5fa",
                        background: "rgba(96, 165, 250, 0.1)",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        border: "1px solid rgba(96, 165, 250, 0.2)",
                      }}
                    >
                      {item.mfg}
                    </span>
                    <span
                      style={{
                        color: "var(--text-secondary)",
                        background: "var(--surface-soft)",
                        padding: "2px 6px",
                        borderRadius: "4px",
                      }}
                    >
                      {item.type}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: "10px",
                      color: "var(--text-muted)",
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>
                      {t("left.tdp")}:{" "}
                      <strong style={{ color: "var(--text-primary)" }}>{item.tdp}W</strong>
                    </span>
                    <span>
                      {t("left.pkg")}: {item.package}
                    </span>
                  </div>
                </div>
              </div>
            ))}

            {filteredLibs.length === 0 && (
              <div
                style={{
                  textAlign: "center",
                  padding: "20px",
                  color: "var(--text-muted)",
                  fontSize: "12px",
                }}
              >
                {t("left.noComponent", { query: searchQuery })}
                <br />
                <span
                  style={{ color: "var(--accent-primary)", cursor: "pointer" }}
                  onClick={() => {
                    const event = new CustomEvent("open-ai-panel", {
                      detail: {
                        prompt: `Generate a component for: ${searchQuery}`,
                      },
                    });
                    window.dispatchEvent(event);
                  }}
                >
                  {t("left.askAi")}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {liveLoading && (
              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                {t("left.liveSearching")}
              </div>
            )}
            {liveError && (
              <div
                style={{
                  background: "rgba(239, 68, 68, 0.12)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  borderRadius: "8px",
                  padding: "10px",
                  color: "#fca5a5",
                  fontSize: "12px",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {liveError}
              </div>
            )}

            {!liveLoading && !liveError && liveResults.length === 0 && liveQuery.trim() && (
              <div style={{ color: "var(--text-muted)", fontSize: "12px" }}>
                {t("left.liveNoResult")}
              </div>
            )}

            {liveResults.map((part) => {
              const category = normalizeCategory(part.categoryHint);
              const topOffer = part.offers[0];
              const stock = topOffer?.stock;
              const price =
                topOffer?.unitPrice != null
                  ? `${topOffer.currency || "USD"} ${topOffer.unitPrice.toFixed(4)}`
                  : null;

              return (
                <div
                  key={`${part.manufacturer || "unknown"}-${part.mpn}`}
                  className="lib-item"
                  draggable
                  onDragStart={(event) =>
                    onDragStart(event, {
                      ahaDrag: true,
                      type: category,
                      label: part.mpn,
                      tdp: defaultTdpForCategory(category),
                      mfg: part.manufacturer || undefined,
                      mpn: part.mpn,
                      description: part.description || undefined,
                      datasheetUrl: topOffer?.datasheetUrl || undefined,
                      buyUrl: topOffer?.buyUrl || undefined,
                      stock: stock || undefined,
                    })
                  }
                  style={{
                    borderRadius: "10px",
                    border: "1px solid var(--surface-border)",
                    background:
                      "linear-gradient(165deg, var(--surface-elevated) 0%, var(--surface-soft) 100%)",
                    cursor: "grab",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: "6px",
                      gap: "8px",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: "13px",
                          color: "var(--text-primary)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                        title={part.mpn}
                      >
                        {part.mpn}
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                        {part.manufacturer || "Unknown Manufacturer"}
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: "10px",
                        color: "var(--accent-primary)",
                        border: "1px solid var(--accent-primary)",
                        borderRadius: "999px",
                        padding: "2px 6px",
                      }}
                    >
                      {category}
                    </span>
                  </div>

                  {part.description && (
                    <div
                      style={{
                        fontSize: "11px",
                        color: "var(--text-muted)",
                        marginBottom: "8px",
                        lineHeight: 1.35,
                        maxHeight: "32px",
                        overflow: "hidden",
                      }}
                    >
                      {part.description}
                    </div>
                  )}

                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    <span
                      style={{
                        fontSize: "10px",
                        color: "var(--text-secondary)",
                        background: "var(--surface-soft)",
                        padding: "2px 6px",
                        borderRadius: "6px",
                      }}
                    >
                      {part.offers.length} {t("left.liveOffers")}
                    </span>
                    {typeof stock === "number" && (
                      <span
                        style={{
                          fontSize: "10px",
                          color: "var(--text-secondary)",
                          background: "var(--surface-soft)",
                          padding: "2px 6px",
                          borderRadius: "6px",
                        }}
                      >
                        {t("left.liveStock")}: {stock.toLocaleString()}
                      </span>
                    )}
                    {price && (
                      <span
                        style={{
                          fontSize: "10px",
                          color: "var(--text-secondary)",
                          background: "var(--surface-soft)",
                          padding: "2px 6px",
                          borderRadius: "6px",
                        }}
                      >
                        {t("left.livePrice")}: {price}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
