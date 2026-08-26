import { useMutation } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronRight,
  Contrast,
  Download,
  Eye,
  EyeOff,
  Lock,
  Radio,
  Shield,
  ShieldOff,
  Sparkles,
  Upload,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { queryClient } from "@/src/lib/queryClient";
import { useCommandCenter } from "@/src/hooks/use-command-center";

// ── Design tokens ──────────────────────────────────────────────────────────
const C = {
  bg:         "#09090e",
  bgTile:     "#0d0d12",
  bgTileOn:   "rgba(57,255,20,0.13)",
  border:     "#1e1e1e",
  borderOn:   "#39ff14",
  borderDim:  "#333",
  green:      "#39ff14",
  greenLo:    "rgba(57,255,20,0.45)",
  dim:        "#555",
  dimmer:     "#444",
  dimmest:    "#252525",
  text:       "#ccc",
  danger:     "#ff5555",
  dangerBg:   "rgba(255,60,60,0.08)",
  dangerBdr:  "rgba(255,60,60,0.3)",
  amber:      "#f5a623",
  amberBg:    "rgba(245,166,35,0.1)",
  amberBdr:   "rgba(245,166,35,0.35)",
} as const;

const mono: React.CSSProperties = { fontFamily: "monospace" };

// ── Primitives ─────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase",
      color: C.dimmer, marginBottom: "12px", ...mono }}>
      {children}
    </div>
  );
}

function Tile({
  id, label, active, icon: Icon, ariaLabel, onClick, disabled, danger, amber,
}: {
  id: string; label: string; active: boolean;
  icon: React.ComponentType<{ style?: React.CSSProperties }>;
  ariaLabel: string; onClick: () => void; disabled?: boolean; danger?: boolean; amber?: boolean;
}) {
  const dotColor  = danger ? (active ? C.danger : C.dimmer)
    : amber ? (active ? C.amber : C.dimmer)
    : (active ? C.green : C.dimmer);
  const dotShadow = active
    ? `0 0 4px ${danger ? C.danger : amber ? C.amber : C.green}`
    : "none";
  const textColor = danger ? (active ? C.danger : C.dim)
    : amber ? (active ? C.amber : C.dim)
    : (active ? C.greenLo : C.dim);
  return (
    <button className="min-h-[44px]"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-pressed={active}
      data-testid={`cc-tile-${id}`}
      onClick={onClick}
      disabled={disabled}
      style={{
        background: C.bgTile,
        border: `1px solid ${C.dimmest}`,
        borderRadius: "6px", padding: "14px 8px 12px", color: textColor,
        display: "flex", flexDirection: "column", alignItems: "center", gap: "7px",
        cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
        transition: "color 0.15s",
        minHeight: "80px", textAlign: "center", width: "100%", ...mono,
      }}
    >
      {/* Status dot — only visual that changes on active */}
      <div style={{
        width: "5px", height: "5px", borderRadius: "50%",
        background: dotColor, boxShadow: dotShadow, flexShrink: 0,
        transition: "background 0.15s, box-shadow 0.15s",
      }} />
      <Icon style={{ width: "20px", height: "20px", flexShrink: 0 }} />
      <span style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.06em",
        textTransform: "uppercase", lineHeight: 1.3 }}>
        {label}
      </span>
    </button>
  );
}

function SegBtn({ label, active, onClick, "data-testid": testId }: {
  label: string; active: boolean; onClick: () => void; "data-testid"?: string;
}) {
  return (
    <button className="min-h-[44px]"
      onClick={onClick}
      aria-pressed={active}
      data-testid={testId}
      style={{
        flex: 1, padding: "5px 4px", fontSize: "9px",
        fontWeight: active ? 700 : 400,
        letterSpacing: "0.09em", textTransform: "uppercase", ...mono,
        background: C.bgTile,
        borderTop: `1px solid ${C.dimmest}`,
        borderLeft: `1px solid ${C.dimmest}`,
        borderRight: `1px solid ${C.dimmest}`,
        borderBottom: `1px solid ${active ? C.greenLo : C.dimmest}`,
        borderRadius: "4px", color: active ? C.greenLo : C.dim,
        cursor: "pointer", transition: "color 0.12s, border-bottom-color 0.12s",
        minHeight: "44px", minWidth: "44px",
      }}
    >
      {label}
    </button>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "14px" }}>
      <div style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.08em",
        textTransform: "uppercase", color: C.dim, marginBottom: "8px", ...mono }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function NumInput({ value, onChange, min, max, step = 1, testId }: {
  value: number; onChange: (v: number) => void; min: number; max: number; step?: number; testId?: string;
}) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      step={step}
      data-testid={testId}
      onChange={(e) => {
        const v = parseInt(e.target.value, 10);
        if (!isNaN(v)) onChange(Math.max(min, Math.min(max, v)));
      }}
      style={{
        width: "100%", padding: "6px 10px", ...mono, fontSize: "12px",
        background: "#0d0d12", border: "1px solid #333", borderRadius: "4px",
        color: C.text, outline: "none",
      }}
    />
  );
}

// ── Confirmation Modal ────────────────────────────────────────────────────
function ConfirmModal({ title, description, confirmText, onConfirm, onCancel, testIdPrefix = "cc-confirm" }: { title: string; description: string; confirmText: string; onConfirm: () => void; onCancel: () => void; testIdPrefix?: string; }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 10001,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div onClick={onCancel} style={{
        position: "absolute", inset: 0, background: "rgba(0,0,0,0.7)",
      }} />
      <div style={{
        position: "relative", zIndex: 1,
        background: "#0d0d12", border: `1px solid ${C.dangerBdr}`,
        borderRadius: "8px", padding: "24px", width: "320px", ...mono,
      }}>
        <p style={{ color: C.danger, fontSize: "11px", fontWeight: 700,
          letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "12px" }}>
          {title}
        </p>
        <p style={{ color: C.text, fontSize: "12px", lineHeight: 1.6, marginBottom: "20px" }}>
          {description}
        </p>
        <div style={{ display: "flex", gap: "8px" }}>
          <button className="min-h-[44px]"
            onClick={onCancel}
            data-testid={`${testIdPrefix}-cancel`}
            style={{
              flex: 1, padding: "9px", fontSize: "11px", fontWeight: 700,
              letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer",
              background: "#161616", border: "1px solid #333", borderRadius: "5px",
              color: C.dim, ...mono,
              minHeight: "44px",
            }}
          >
            Cancel
          </button>
          <button className="min-h-[44px]"
            onClick={onConfirm}
            data-testid={`${testIdPrefix}-confirm`}
            style={{
              flex: 1, padding: "9px", fontSize: "11px", fontWeight: 700,
              letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer",
              background: C.dangerBg, border: `1px solid ${C.dangerBdr}`,
              borderRadius: "5px", color: C.danger, ...mono,
              minHeight: "44px",
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

import { useSwipeToClose } from '@/src/hooks/useSwipeToClose';

// ── Main component ─────────────────────────────────────────────────────────
export function CommandCenter() {
  const {
    isOpen, close,
    highContrast, toggleHighContrast,
    narratorEnabled, toggleNarrator,
    mustPlayFullActive, setMustPlayFullActive,
    announceText, announce,
    commandCenterNewsRatio, setCommandCenterNewsRatio,
    clockFaceMode, setClockFaceMode,
    triggerMediaEngineReset,
    // v3
    pacingPreset, setPacingPreset,
    watchdogEnabled, setWatchdogEnabled,
    showPlayerUI, setShowPlayerUI,
    applyToExport, setApplyToExport,
    stallTimeoutSecs, setStallTimeoutSecs,
    offlineRetryDelaySecs, setOfflineRetryDelaySecs,
    maxPlayedHistory, setMaxPlayedHistory,
    savedPresets, savePreset, loadPreset, deletePreset,
    guideTheme, setGuideTheme, triggerPreviewGuide,
    livePeekDurationMins, setLivePeekDurationMins,
    midRollCadenceMins, setMidRollCadenceMins,
    livePriorityActive, setLivePriorityActive,
    probesEnabled, setProbesEnabled,
    healthScore,
    scoreHistory,
    tierEnteredAt,
    autoCalibrateRemainingSecs,
    triggerAutoCalibrate,
    triggerExportLog,
    registerOpenDiagnosticsPanel,
    uiScale, setUiScale,
    ajBroadcastMode, setAjBroadcastMode,
    ajPipAutoResize, setAjPipAutoResize,
    ccMode, setCcMode,
  } = useCommandCenter();

  const { handlers: swipeHandlers, style: swipeStyle } = useSwipeToClose({
    onClose: close,
    direction: 'left',
  });

  // Local UI state
  const [advancedOpen,        setAdvancedOpen]        = useState(false);
  const [diagOpen,            setDiagOpen]             = useState(false);

  // Register handler so badge click can expand Advanced + Diagnostics panels
  const expandDiagPanel = useCallback(() => {
    setAdvancedOpen(true);
    setDiagOpen(true);
  }, []);
  useEffect(() => {
    registerOpenDiagnosticsPanel(expandDiagPanel);
  }, [registerOpenDiagnosticsPanel, expandDiagPanel]);
  const [presetName,          setPresetName]           = useState("");
  const [showUIConfirm,       setShowUIConfirm]        = useState(false);
  const [showRestartConfirm,  setShowRestartConfirm]   = useState(false);
  const [presetLoadTarget,    setPresetLoadTarget]     = useState("");

  const presetNames = Object.keys(savedPresets);

  // ── Must-Play-Full mutation ─────────────────────────────────────────────
  const mustPlayFullMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/episodes/batch-must-play-full", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: "movie", value: true }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<{ updated: number }>;
    },
    onSuccess: (data) => {
      setMustPlayFullActive(true);
      announce(`Must Play Full enabled for ${data.updated} movie${data.updated !== 1 ? "s" : ""}.`);
      queryClient.invalidateQueries({ queryKey: ["/api/episodes"] });
    },
    onError: () => announce("Failed to update movies. Please try again."),
  });

  // ── Auto-Set ─────────────────────────────────────────────────────────────
  const applySmartPreferences = async () => {
    if (!highContrast) toggleHighContrast();
    // Respect an explicit "news off" choice — don't silently re-enable news
    const newsOverlayPref = localStorage.getItem("tvnews-news-overlay");
    const newsOff = newsOverlayPref === "off" || commandCenterNewsRatio === 0;
    if (!newsOff) {
      setCommandCenterNewsRatio(0.5);
    }
    const mixLabel = newsOff ? "movies-only mix kept" : "50/50 mix";
    try {
      const data = await mustPlayFullMutation.mutateAsync();
      announce(`Smart Preferences applied: High Contrast on, ${mixLabel}, Must Play Full for ${data.updated} movie${data.updated !== 1 ? "s" : ""}.`);
    } catch {
      announce("Smart Preferences partially applied. Check network and retry.");
    }
  };

  // ── News ratio as 0–100 integer ──────────────────────────────────────────
  const ratioInt = Math.round((commandCenterNewsRatio ?? 0.5) * 100);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const handleSavePreset = () => {
    if (!presetName.trim()) return;
    savePreset(presetName.trim());
    announce(`Preset "${presetName.trim()}" saved.`);
    setPresetName("");
  };

  const handleLoadPreset = () => {
    if (!presetLoadTarget || !savedPresets[presetLoadTarget]) return;
    loadPreset(presetLoadTarget);
    announce(`Preset "${presetLoadTarget}" loaded.`);
  };

  const handleToggleShowUI = () => {
    if (showPlayerUI) {
      // About to disable — show confirmation
      setShowUIConfirm(true);
    } else {
      setShowPlayerUI(true);
      announce("Player UI enabled.");
    }
  };

  const confirmDisableUI = () => {
    setShowUIConfirm(false);
    setShowPlayerUI(false);
    announce("Player UI hidden. Re-enable it here to restore controls.");
  };

  const handleRestartEngine = () => {
    setShowRestartConfirm(true);
  };

  const confirmRestartEngine = () => {
    setShowRestartConfirm(false);
    localStorage.clear();
    window.location.reload();
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Confirmation modal — rendered outside the panel */}
      {showUIConfirm && (
        <ConfirmModal
          title="DISABLE PLAYER UI?"
          description="This will hide all on-player controls (menu, skip buttons, progress bar) while the player is live. You will not be able to interact with the player UI without enabling it again from here."
          confirmText="Disable UI"
          onConfirm={confirmDisableUI}
          onCancel={() => setShowUIConfirm(false)}
          testIdPrefix="cc-confirm-ui"
        />
      )}
      
      {showRestartConfirm && (
        <ConfirmModal
          title="RESTART MEDIA ENGINE?"
          description="This will permanently delete all saved presets and clear your configuration history. The page will reload immediately."
          confirmText="Restart"
          onConfirm={confirmRestartEngine}
          onCancel={() => setShowRestartConfirm(false)}
          testIdPrefix="cc-confirm-restart"
        />
      )}

      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={close}
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
          zIndex: 9998, opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? "auto" : "none",
          transition: "opacity 300ms",
        }}
      />

      {/* Panel */}
      <div
        id="command-center"
        role="dialog"
        aria-modal="true"
        aria-label="Command Center"
        aria-hidden={!isOpen}
        {...swipeHandlers}
        style={{
          position: "fixed", top: 0, left: 0, height: "100%",
          width: `calc(420px * var(--ui-scale))`,
          background: C.bg, borderLeft: `3px solid ${C.green}`,
          borderRight: "1px solid #1a1a1a", zIndex: 9999,
          display: "flex", flexDirection: "column",
          transform: isOpen ? (swipeStyle.transform !== 'none' ? swipeStyle.transform : "translateX(0)") : "translateX(-100%)",
          transition: isOpen && swipeStyle.transform !== 'none' ? swipeStyle.transition : "transform 300ms cubic-bezier(0.4,0,0.2,1), width 0.3s ease-out",
          willChange: "transform",
          fontSize: `calc(12px * var(--ui-scale))`,
          touchAction: swipeStyle.touchAction,
        }}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px", borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          <div>
            <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.18em",
              textTransform: "uppercase", color: C.green, ...mono }}>
              Command Center
            </span>
            <span style={{ fontSize: "9px", color: C.dimmer, marginLeft: "10px", letterSpacing: "0.06em", ...mono }}>
              SETTINGS MANAGER v3
            </span>
          </div>
          {/* EASY / ADVANCED mode toggle */}
          <div style={{ display: "flex", gap: "14px", marginRight: "auto", marginLeft: "14px" }}>
            {(["easy", "advanced"] as const).map((m) => (
              <button className="min-h-[44px]"
                key={m}
                data-testid={`cc-mode-${m}`}
                onClick={() => { setCcMode(m); announce(`${m === "easy" ? "Easy" : "Advanced"} mode.`); }}
                style={{
                  padding: "0 0 2px 0", fontSize: "9px",
                  fontWeight: ccMode === m ? 700 : 400,
                  letterSpacing: "0.1em", textTransform: "uppercase", ...mono,
                  background: "transparent",
                  border: "none",
                  borderBottom: `1px solid ${ccMode === m ? C.greenLo : "transparent"}`,
                  color: ccMode === m ? C.green : C.dim,
                  cursor: "pointer",
                  transition: "color 0.12s, border-bottom-color 0.12s",
                  minHeight: "44px", minWidth: "44px",
                }}
              >
                {m}
              </button>
            ))}
          </div>
          <button className="min-h-[44px]"
            tabIndex={0}
            aria-label="Close Command Center"
            data-testid="cc-close"
            onClick={close}
            style={{
              background: "none", border: "none", cursor: "pointer", color: "#666",
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: "4px", borderRadius: "4px", transition: "color 0.15s",
              minWidth: "44px", minHeight: "44px",
            }}
            onMouseEnter={(e) => ((e.currentTarget).style.color = "#aaa")}
            onMouseLeave={(e) => ((e.currentTarget).style.color = "#666")}
          >
            <X style={{ width: "16px", height: "16px" }} />
          </button>
        </div>

        {/* ── Scrollable Body ─────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>

          {/* ─ SETTINGS tiles ─ */}
          <SectionLabel>Settings</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "24px" }}>
            <Tile
              id="high-contrast" label="High Contrast" active={highContrast} icon={Contrast}
              ariaLabel={`Toggle High Contrast: ${highContrast ? "On" : "Off"}`}
              onClick={() => { toggleHighContrast(); announce(`High Contrast ${!highContrast ? "enabled" : "disabled"}.`); }}
            />
            <Tile
              id="narrator" label="Narrator" active={narratorEnabled}
              icon={narratorEnabled ? Volume2 : VolumeX}
              ariaLabel={`Toggle Narrator: ${narratorEnabled ? "On" : "Off"}`}
              onClick={() => { toggleNarrator(); announce(`Narrator ${!narratorEnabled ? "enabled" : "disabled"}.`); }}
            />
            {ccMode === "advanced" && (
              <>
                <Tile
                  id="must-play-full" label="Must Play Full" active={mustPlayFullActive} icon={Lock}
                  ariaLabel={`Must Play Full: ${mustPlayFullActive ? "On" : "Off"}`}
                  onClick={() => mustPlayFullMutation.mutate()}
                  disabled={mustPlayFullMutation.isPending}
                />
                <Tile
                  id="auto-set" label="Auto-Set" active={false} icon={Sparkles}
                  ariaLabel="Apply all Smart Preferences at once"
                  onClick={applySmartPreferences}
                  disabled={mustPlayFullMutation.isPending}
                />
              </>
            )}
          </div>

          {/* ─ PLAYBACK ─ */}
          <SectionLabel>Playback</SectionLabel>

          <Row label="Pacing Preset">
            <div style={{ display: "flex", gap: "6px" }} data-testid="cc-pacing-group">
              {(["rapid", "balanced", "dive"] as const).map((p) => (
                <SegBtn
                  key={p} label={p} active={pacingPreset === p}
                  data-testid={`cc-pacing-${p}`}
                  onClick={() => { setPacingPreset(p); announce(`Pacing set to ${p}.`); }}
                />
              ))}
            </div>
          </Row>

          <Row label={`News Ratio — ${ratioInt}%`}>
            <input
              type="range"
              min={0} max={100} step={5}
              value={ratioInt}
              data-testid="cc-news-ratio-slider"
              onChange={(e) => setCommandCenterNewsRatio(parseInt(e.target.value, 10) / 100)}
              style={{ width: "100%", accentColor: C.green, cursor: "pointer" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between",
              fontSize: "9px", color: C.dimmer, marginTop: "4px", ...mono }}>
              <span>Movies only</span>
              <span>50 / 50</span>
              <span>News only</span>
            </div>
          </Row>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "24px" }}>
            <Tile
              id="watchdog" label="Watchdog" active={watchdogEnabled} icon={watchdogEnabled ? Shield : ShieldOff}
              ariaLabel={`Marathon Watchdog: ${watchdogEnabled ? "Active" : "Disabled"}`}
              onClick={() => { setWatchdogEnabled(!watchdogEnabled); announce(`Watchdog ${!watchdogEnabled ? "armed" : "disarmed"}.`); }}
            />
            <Tile
              id="show-player-ui" label={showPlayerUI ? "UI Visible" : "UI Hidden"}
              active={showPlayerUI}
              icon={showPlayerUI ? Eye : EyeOff}
              ariaLabel={`Player UI: ${showPlayerUI ? "Visible" : "Hidden"}`}
              onClick={handleToggleShowUI}
            />
          </div>

          {ccMode === "advanced" && (<>
          {/* ─ UI SCALE ─ */}
          <SectionLabel>Display Scale</SectionLabel>

          <Row label={`Scale — ${uiScale.toFixed(2)}×`}>
            <input
              type="range"
              min={0.5} max={2.0} step={0.05}
              value={uiScale}
              data-testid="cc-ui-scale-slider"
              onChange={(e) => setUiScale(parseFloat(e.target.value))}
              style={{ width: "100%", accentColor: C.green, cursor: "pointer",
                transition: "all 0.3s ease-out" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between",
              fontSize: "9px", color: C.dimmer, marginTop: "4px", ...mono }}>
              <span>0.5× Compact</span>
              <span>1.0× Default</span>
              <span>2.0× Broadcast</span>
            </div>
          </Row>

          <Row label="Scale Presets">
            <div style={{ display: "flex", gap: "6px" }}>
              {([
                { label: "Laptop",    value: 1.0  },
                { label: "Monitor",   value: 1.2  },
                { label: "TV/Studio", value: 1.5  },
              ] as const).map(({ label, value }) => (
                <SegBtn
                  key={label}
                  label={label}
                  active={uiScale === value}
                  data-testid={`cc-scale-preset-${label.toLowerCase().replace("/", "-")}`}
                  onClick={() => {
                    setUiScale(value);
                    announce(`Display scale: ${label} (${value}×).`);
                  }}
                />
              ))}
            </div>
          </Row>

          </>)}

          {/* ─ PRESETS ─ */}
          <SectionLabel>Presets</SectionLabel>

          {/* Save preset */}
          <Row label="Save Current Settings">
            <div style={{ display: "flex", gap: "6px" }}>
              <input
                type="text"
                placeholder='e.g. "News Heavy"'
                value={presetName}
                data-testid="cc-preset-name-input"
                onChange={(e) => setPresetName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSavePreset(); }}
                style={{
                  flex: 1, padding: "7px 10px", ...mono, fontSize: "11px",
                  background: "#0d0d12", border: "1px solid #333", borderRadius: "4px",
                  color: C.text, outline: "none",
                }}
              />
              <button className="min-h-[44px]"
                onClick={handleSavePreset}
                disabled={!presetName.trim()}
                data-testid="cc-preset-save"
                style={{
                  padding: "7px 12px", minHeight: "44px", ...mono, fontSize: "10px", fontWeight: 600,
                  letterSpacing: "0.08em", textTransform: "uppercase",
                  background: "transparent", border: `1px solid rgba(57,255,20,0.25)`,
                  borderRadius: "4px", color: "rgba(57,255,20,0.55)",
                  cursor: presetName.trim() ? "pointer" : "not-allowed",
                  opacity: presetName.trim() ? 1 : 0.35, display: "flex", alignItems: "center", gap: "5px",
                  whiteSpace: "nowrap",
                }}
              >
                <Upload style={{ width: "12px", height: "12px" }} />
                Save
              </button>
            </div>
          </Row>

          {/* Load preset */}
          {presetNames.length > 0 && (
            <Row label="Load Preset">
              <div style={{ display: "flex", gap: "6px" }}>
                <select
                  value={presetLoadTarget}
                  data-testid="cc-preset-select"
                  onChange={(e) => setPresetLoadTarget(e.target.value)}
                  style={{
                    flex: 1, padding: "7px 10px", ...mono, fontSize: "11px",
                    background: "#0d0d12", border: "1px solid #333", borderRadius: "4px",
                    color: presetLoadTarget ? C.text : C.dim, outline: "none", cursor: "pointer",
                  }}
                >
                  <option value="">— Select preset —</option>
                  {presetNames.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
                <button className="min-h-[44px]"
                  onClick={handleLoadPreset}
                  disabled={!presetLoadTarget}
                  data-testid="cc-preset-load"
                  style={{
                    padding: "7px 12px", minHeight: "44px", ...mono, fontSize: "10px", fontWeight: 600,
                    letterSpacing: "0.08em", textTransform: "uppercase",
                    background: "transparent", border: `1px solid ${C.dimmest}`,
                    borderRadius: "4px", color: C.dim,
                    cursor: presetLoadTarget ? "pointer" : "not-allowed",
                    opacity: presetLoadTarget ? 1 : 0.35, display: "flex", alignItems: "center", gap: "5px",
                    whiteSpace: "nowrap",
                  }}
                >
                  <Download style={{ width: "12px", height: "12px" }} />
                  Load
                </button>
                <button className="min-h-[44px]"
                  onClick={() => { if (presetLoadTarget) { deletePreset(presetLoadTarget); setPresetLoadTarget(""); announce("Preset deleted."); } }}
                  disabled={!presetLoadTarget}
                  data-testid="cc-preset-delete"
                  title="Delete selected preset"
                  style={{
                    padding: "7px 10px", ...mono, fontSize: "10px",
                    background: C.dangerBg, border: `1px solid ${C.dangerBdr}`,
                    borderRadius: "4px", color: C.danger,
                    cursor: presetLoadTarget ? "pointer" : "not-allowed", opacity: presetLoadTarget ? 1 : 0.4,
                  }}
                >
                  <X style={{ width: "12px", height: "12px" }} />
                </button>
              </div>
            </Row>
          )}

          {presetNames.length === 0 && (
            <p style={{ fontSize: "10px", color: C.dimmer, ...mono, marginBottom: "20px", lineHeight: 1.5 }}>
              No presets saved yet. Enter a name above and click Save to create your first preset.
            </p>
          )}

          {ccMode === "advanced" && (<>
          {/* ─ EXPORT ─ */}
          <SectionLabel>Export</SectionLabel>

          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "8px", marginBottom: "8px" }}>
            <button className="min-h-[44px]"
              aria-pressed={applyToExport}
              data-testid="cc-apply-to-export"
              onClick={() => { setApplyToExport(!applyToExport); announce(`Apply to Export ${!applyToExport ? "enabled — settings will be hard-coded into exported files" : "disabled"}.`); }}
              style={{
                padding: "12px 16px", ...mono, fontSize: "10px", fontWeight: 700,
                letterSpacing: "0.08em", textTransform: "uppercase",
                background: applyToExport ? C.bgTileOn : C.bgTile,
                border: `1px solid ${applyToExport ? C.borderOn : C.dimmest}`,
                boxShadow: applyToExport ? `0 0 8px 1px rgba(57,255,20,0.25)` : "none",
                borderRadius: "6px", color: applyToExport ? C.green : C.dim, cursor: "pointer",
                display: "flex", alignItems: "center", gap: "8px",
                transition: "background 0.15s, border-color 0.15s, color 0.15s",
              }}
            >
              <Lock style={{ width: "14px", height: "14px", flexShrink: 0 }} />
              <span>Apply to Export {applyToExport ? "— ON" : "— OFF"}</span>
            </button>
          </div>
          {applyToExport && (
            <div style={{
              padding: "10px 12px", marginBottom: "20px",
              background: C.amberBg, border: `1px solid ${C.amberBdr}`,
              borderRadius: "5px", fontSize: "10px", lineHeight: 1.6, color: C.amber, ...mono,
            }}>
              Current pacing ({pacingPreset}), news ratio ({ratioInt}%), and watchdog setting will be
              hard-coded into the exported player's CONFIG block, overriding localStorage defaults.
            </div>
          )}

          {/* ─ PLAYER 2 ─ */}
          <SectionLabel>Player 2 — AJ Network</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "24px" }}>
            <Tile
              id="aj-broadcast" label={ajBroadcastMode ? "AJ ON" : "AJ OFF"} active={ajBroadcastMode}
              icon={Radio} amber
              ariaLabel={`AJ Broadcast Mode: ${ajBroadcastMode ? "On" : "Off"}`}
              onClick={() => {
                setAjBroadcastMode(!ajBroadcastMode);
                announce(`AJ Broadcast Mode ${!ajBroadcastMode ? "enabled" : "disabled"}.`);
              }}
            />
            <Tile
              id="aj-pip-auto-resize" label="PIP Auto-Resize" active={ajPipAutoResize}
              icon={Radio} amber
              ariaLabel={`AJ PIP Auto-Resize: ${ajPipAutoResize ? "On" : "Off"}`}
              onClick={() => {
                setAjPipAutoResize(!ajPipAutoResize);
                announce(`PIP Auto-Resize ${!ajPipAutoResize ? "enabled — PIP will expand on break start" : "disabled"}.`);
              }}
            />
          </div>

          {/* ─ SYSTEM CONTROLS ─ */}
          <SectionLabel>System Controls</SectionLabel>

          <Row label="Clock Face">
            <div style={{ display: "flex", gap: "6px" }}>
              {(["digital", "analog", "off"] as const).map((mode) => (
                <SegBtn
                  key={mode} label={mode} active={clockFaceMode === mode}
                  data-testid={`cc-clock-${mode}`}
                  onClick={() => { setClockFaceMode(mode); announce(`Clock Face set to ${mode}.`); }}
                />
              ))}
            </div>
          </Row>

          <button className="min-h-[44px]"
            onClick={handleRestartEngine}
            aria-label="Restart Media Engine — wipes all settings and reloads"
            data-testid="cc-emergency-reset"
            style={{
              width: "100%", padding: "10px", fontSize: "11px", fontWeight: 700,
              letterSpacing: "0.1em", textTransform: "uppercase", ...mono,
              background: C.dangerBg, border: `1px solid ${C.dangerBdr}`,
              borderRadius: "6px", color: C.danger, cursor: "pointer",
              transition: "background 0.15s, border-color 0.15s",
              marginBottom: "20px",
            }}
            onMouseEnter={(e) => { (e.currentTarget).style.background = "rgba(255,60,60,0.15)"; (e.currentTarget).style.borderColor = "rgba(255,60,60,0.5)"; }}
            onMouseLeave={(e) => { (e.currentTarget).style.background = C.dangerBg; (e.currentTarget).style.borderColor = C.dangerBdr; }}
          >
            Restart Media Engine
          </button>

          {/* ─ ADVANCED (collapsible) ─ */}
          <button className="min-h-[44px]"
            onClick={() => setAdvancedOpen((v) => !v)}
            data-testid="cc-advanced-toggle"
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
              background: "none", border: "none", cursor: "pointer", padding: "0 0 12px 0",
              color: C.dimmer, ...mono,
            }}
          >
            <span style={{ fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 700 }}>
              Advanced
            </span>
            {advancedOpen
              ? <ChevronDown style={{ width: "12px", height: "12px" }} />
              : <ChevronRight style={{ width: "12px", height: "12px" }} />
            }
          </button>

          {advancedOpen && (
            <div style={{
              padding: "16px", marginBottom: "16px",
              background: "#0a0a0f", border: "1px solid #222", borderRadius: "6px",
            }}>
              <p style={{ fontSize: "9px", color: C.dimmer, ...mono, marginBottom: "16px",
                letterSpacing: "0.06em", lineHeight: 1.5 }}>
                NETWORK &amp; MEMORY — changes apply immediately to the in-app player.
                Enable "Apply to Export" to bake stall timeout into exported files.
              </p>

              <Row label={`Stall Timeout — ${stallTimeoutSecs}s`}>
                <NumInput
                  value={stallTimeoutSecs} onChange={setStallTimeoutSecs}
                  min={5} max={120} testId="cc-stall-timeout"
                />
                <div style={{ fontSize: "9px", color: C.dimmer, marginTop: "4px", ...mono }}>
                  Seconds before frozen stream auto-skips (Watchdog tick interval)
                </div>
              </Row>

              <Row label={`Offline Retry — ${offlineRetryDelaySecs}s`}>
                <NumInput
                  value={offlineRetryDelaySecs} onChange={setOfflineRetryDelaySecs}
                  min={5} max={300} testId="cc-offline-retry"
                />
                <div style={{ fontSize: "9px", color: C.dimmer, marginTop: "4px", ...mono }}>
                  Seconds offline before the Emergency Loop activates
                </div>
              </Row>

              <Row label={`Max Played History — ${maxPlayedHistory}`}>
                <NumInput
                  value={maxPlayedHistory} onChange={setMaxPlayedHistory}
                  min={50} max={5000} step={50} testId="cc-max-history"
                />
                <div style={{ fontSize: "9px", color: C.dimmer, marginTop: "4px", ...mono }}>
                  Number of clip IDs remembered before repeats are allowed
                </div>
              </Row>

              {/* ── Live Peek Settings ────────────────────────────────────── */}
              <div style={{ borderTop: `1px solid #222`, marginTop: "20px", paddingTop: "16px" }}>
                <SectionLabel>Live Peek — RTÉ News Now</SectionLabel>
                <Row label={`Live Peek Duration — ${livePeekDurationMins} min`}>
                  <NumInput
                    value={livePeekDurationMins} onChange={setLivePeekDurationMins}
                    min={1} max={30} step={1} testId="cc-live-peek-mins"
                  />
                  <div style={{ fontSize: "9px", color: C.dimmer, marginTop: "4px", ...mono }}>
                    Seconds of live RTÉ DASH stream before auto-resuming regular schedule
                  </div>
                </Row>
                <div style={{ fontSize: "9px", color: C.dimmer, marginTop: "4px", lineHeight: 1.5, ...mono }}>
                  Scout runs every hour to capture fresh Akamai tokens.
                  Activate Live Peek via the LIVE option in the News Group selector
                  or the Live Peek button in the toolbar.
                </div>
              </div>

              {/* ── Mid-Roll Cadence ──────────────────────────────────────── */}
              <div style={{ borderTop: `1px solid #222`, marginTop: "20px", paddingTop: "16px" }}>
                <SectionLabel>Mid-Roll Cadence</SectionLabel>
                <div style={{ fontSize: "9px", color: C.dimmer, marginBottom: "10px", lineHeight: 1.5, ...mono }}>
                  How often a break fires during long-form content. Template N = 15 min (news-intensive). Template M = 50 min (movie anchor).
                </div>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button className="min-h-[44px]"
                    key={0}
                    data-testid="cc-midroll-cadence-0"
                    onClick={() => setMidRollCadenceMins(0)}
                    style={{
                      flex: 1,
                      padding: "6px 0",
                      fontSize: "10px",
                      fontWeight: 700,
                      fontFamily: "monospace",
                      letterSpacing: "0.08em",
                      border: `1px solid ${midRollCadenceMins === 0 ? "#ffd700" : "#333"}`,
                      borderRadius: "4px",
                      background: midRollCadenceMins === 0 ? "rgba(255,215,0,0.15)" : "transparent",
                      color: midRollCadenceMins === 0 ? "#ffd700" : C.dim,
                      cursor: "pointer",
                    }}
                  >
                    OFF
                  </button>
                  {([15, 30, 50] as const).map((mins) => (
                    <button className="min-h-[44px]"
                      key={mins}
                      data-testid={`cc-midroll-cadence-${mins}`}
                      onClick={() => setMidRollCadenceMins(mins)}
                      style={{
                        flex: 1,
                        padding: "6px 0",
                        fontSize: "10px",
                        fontWeight: 700,
                        fontFamily: "monospace",
                        letterSpacing: "0.08em",
                        border: `1px solid ${midRollCadenceMins === mins ? "#39ff14" : "#333"}`,
                        borderRadius: "4px",
                        background: midRollCadenceMins === mins ? "rgba(57,255,20,0.15)" : "transparent",
                        color: midRollCadenceMins === mins ? "#39ff14" : C.dim,
                        cursor: "pointer",
                      }}
                    >
                      {mins} MIN
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Live Priority / Derby Mode ─────────────────────────────── */}
              <div style={{ borderTop: `1px solid #222`, marginTop: "20px", paddingTop: "16px" }}>
                <SectionLabel>Live Priority — Derby Mode</SectionLabel>
                <div style={{ fontSize: "9px", color: C.dimmer, marginBottom: "10px", lineHeight: 1.5, ...mono }}>
                  When ON, the next episode boundary forces an NTD_Live handshake instead of queued content. Falls back to the 5-min news package if the live feed is dead.
                </div>
                <button className="min-h-[44px]"
                  data-testid="cc-live-priority-toggle"
                  onClick={() => setLivePriorityActive(!livePriorityActive)}
                  style={{
                    width: "100%",
                    padding: "8px 0",
                    fontSize: "10px",
                    fontWeight: 700,
                    fontFamily: "monospace",
                    letterSpacing: "0.1em",
                    border: `1px solid ${livePriorityActive ? "#ff6a00" : "#333"}`,
                    borderRadius: "4px",
                    background: livePriorityActive ? "rgba(255,106,0,0.18)" : "transparent",
                    color: livePriorityActive ? "#ff9440" : C.dim,
                    cursor: "pointer",
                  }}
                >
                  {livePriorityActive ? "LIVE PRIORITY — ON" : "LIVE PRIORITY — OFF"}
                </button>
              </div>

              {/* ── Guide Settings ────────────────────────────────────────── */}
              <div style={{ borderTop: `1px solid #222`, marginTop: "20px", paddingTop: "16px" }}>
                <SectionLabel>Guide — Program Guide Overlay</SectionLabel>

                {/* Theme selector */}
                <div style={{ marginBottom: "12px" }}>
                  <div style={{ fontSize: "10px", color: C.dim, ...mono, marginBottom: "8px" }}>
                    High-Contrast Theme
                  </div>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    {([
                      { id: "liberty-gold",    label: "Liberty Gold",    accent: "#FFD700" },
                      { id: "matrix-emerald",  label: "Matrix Emerald",  accent: "#00FF41" },
                      { id: "classic-network", label: "Classic Network", accent: "#CC0000" },
                    ] as { id: string; label: string; accent: string }[]).map(({ id, label, accent }) => {
                      const active = guideTheme === id;
                      return (
                        <button className="min-h-[44px]"
                          key={id}
                          data-testid={`cc-guide-theme-${id}`}
                          onClick={() => setGuideTheme(id as typeof guideTheme)}
                          style={{
                            padding: "5px 10px",
                            fontSize: "9px",
                            ...mono,
                            letterSpacing: "0.08em",
                            borderRadius: "4px",
                            border: `1px solid ${active ? accent : "#333"}`,
                            background: active ? `${accent}22` : "transparent",
                            color: active ? accent : C.dim,
                            cursor: "pointer",
                            transition: "all 0.15s",
                            display: "flex",
                            alignItems: "center",
                            gap: "5px",
                          }}
                        >
                          <span
                            style={{
                              display: "inline-block",
                              width: "7px",
                              height: "7px",
                              borderRadius: "50%",
                              background: accent,
                              flexShrink: 0,
                            }}
                          />
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Preview button */}
                <button className="min-h-[44px]"
                  data-testid="cc-preview-guide"
                  onClick={() => triggerPreviewGuide()}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "7px 14px",
                    fontSize: "10px",
                    ...mono,
                    letterSpacing: "0.08em",
                    borderRadius: "4px",
                    border: `1px solid #444`,
                    background: "rgba(255,255,255,0.04)",
                    color: C.text,
                    cursor: "pointer",
                  }}
                >
                  <span style={{ fontSize: "12px" }}>▶</span>
                  Preview Guide (10 s)
                </button>
              </div>

              {/* ── Matrix Diagnostics ─────────────────────────────────────── */}
              <div style={{
                marginTop: "18px",
                borderTop: "1px solid #1a1a1a",
                paddingTop: "14px",
              }}>
                {/* Collapsible header — always visible; shows live score */}
                <button className="min-h-[44px]"
                  data-testid="cc-diag-toggle-panel"
                  onClick={() => setDiagOpen(v => !v)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    width: "100%",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                    marginBottom: diagOpen ? "12px" : 0,
                  }}
                >
                  <span style={{ fontSize: "10px", ...mono, color: C.dim, letterSpacing: "0.1em" }}>
                    ◈ MATRIX DIAGNOSTICS
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    {/* Real-time health score — always visible in header; shows -- until first reading */}
                    <span
                      data-testid="cc-diag-health-score"
                      style={{
                        fontSize: "13px",
                        fontWeight: 700,
                        ...mono,
                        color: healthScore === null ? C.dimmer
                             : healthScore >= 80    ? "#39ff14"
                             : healthScore >= 50    ? "#f0a500"
                             : "#ff3b3b",
                        letterSpacing: "0.05em",
                      }}
                    >
                      {healthScore !== null ? healthScore : "--"}
                      <span style={{ fontSize: "9px", color: C.dim, marginLeft: "2px" }}>/ 100</span>
                    </span>
                    <span style={{ color: C.dimmer, fontSize: "11px" }}>
                      {diagOpen ? "▲" : "▼"}
                    </span>
                  </div>
                </button>

                {diagOpen && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>

                    {/* Score Summary Stats Row */}
                    {scoreHistory.length > 0 && (() => {
                      const scores = scoreHistory.map(e => e.score);
                      const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
                      const minScore = Math.min(...scores);
                      const maxScore = Math.max(...scores);

                      // STATUS is based on the latest individual reading so tier and duration
                      // are always sourced from the same data point (avg still shown in AVG col).
                      const latestScore = scoreHistory[scoreHistory.length - 1].score;
                      const status = latestScore >= 80 ? "OK" : latestScore >= 50 ? "WARN" : "CRIT";
                      const statusColor = latestScore >= 80 ? "#39ff14" : latestScore >= 50 ? "#f0a500" : "#ff3b3b";

                      // tierEnteredAt is tracked in state by use-command-center and resets
                      // whenever the tier changes, so it is not bounded by scoreHistory length.
                      const streakSecs = tierEnteredAt !== null
                        ? Math.floor((Date.now() - tierEnteredAt) / 1000)
                        : 0;
                      const streakLabel = streakSecs < 60
                        ? `${streakSecs}s`
                        : streakSecs % 60 === 0
                          ? `${Math.floor(streakSecs / 60)}m`
                          : `${Math.floor(streakSecs / 60)}m ${streakSecs % 60}s`;

                      return (
                        <div
                          data-testid="cc-diag-score-stats"
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "5px 8px",
                            border: "1px solid #1e1e1e",
                            borderRadius: "3px",
                            background: "rgba(255,255,255,0.02)",
                          }}
                        >
                          {[
                            { label: "AVG", value: avg, testId: "cc-diag-stat-avg" },
                            { label: "MIN", value: minScore, testId: "cc-diag-stat-min" },
                            { label: "MAX", value: maxScore, testId: "cc-diag-stat-max" },
                          ].map(({ label, value, testId }) => (
                            <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
                              <span style={{ fontSize: "8px", ...mono, color: C.dimmer, letterSpacing: "0.1em" }}>{label}</span>
                              <span data-testid={testId} style={{ fontSize: "11px", ...mono, color: C.text, fontWeight: 700 }}>{value}</span>
                            </div>
                          ))}
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
                            <span style={{ fontSize: "8px", ...mono, color: C.dimmer, letterSpacing: "0.1em" }}>STATUS</span>
                            <span
                              data-testid="cc-diag-stat-status"
                              style={{ fontSize: "11px", ...mono, color: statusColor, fontWeight: 700 }}
                            >
                              {status}
                            </span>
                            {tierEnteredAt !== null && (
                              <span
                                data-testid="cc-diag-stat-status-duration"
                                style={{ fontSize: "8px", ...mono, color: statusColor, opacity: 0.65, letterSpacing: "0.05em" }}
                              >
                                {streakLabel}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Master Toggle */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div>
                        <div style={{ fontSize: "10px", ...mono, color: C.dim, letterSpacing: "0.1em" }}>
                          TELEMETRIC PROBES
                        </div>
                        <div style={{ fontSize: "9px", color: C.dimmer, marginTop: "2px" }}>
                          Black frame · audio RMS · memory guard
                        </div>
                      </div>
                      <button className="min-h-[44px]"
                        data-testid="cc-diag-probes-toggle"
                        onClick={() => setProbesEnabled(!probesEnabled)}
                        style={{
                          padding: "5px 12px",
                          fontSize: "10px",
                          ...mono,
                          letterSpacing: "0.08em",
                          borderRadius: "4px",
                          border: `1px solid ${probesEnabled ? "#39ff14" : "#444"}`,
                          background: probesEnabled ? "rgba(57,255,20,0.1)" : "rgba(255,255,255,0.04)",
                          color: probesEnabled ? "#39ff14" : C.dim,
                          cursor: "pointer",
                          fontWeight: probesEnabled ? 700 : 400,
                        }}
                      >
                        {probesEnabled ? "● ON" : "○ OFF"}
                      </button>
                    </div>

                    {/* Auto-Calibrate + countdown */}
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <button className="min-h-[44px]"
                        data-testid="cc-diag-auto-calibrate"
                        onClick={() => {
                          setProbesEnabled(true); // ensure probes are active for the calibration run
                          triggerAutoCalibrate();
                        }}
                        disabled={autoCalibrateRemainingSecs !== null}
                        style={{
                          flex: 1,
                          padding: "6px 10px",
                          fontSize: "10px",
                          ...mono,
                          letterSpacing: "0.08em",
                          borderRadius: "4px",
                          border: "1px solid #444",
                          background: "rgba(255,255,255,0.04)",
                          color: autoCalibrateRemainingSecs !== null ? C.dimmer : C.text,
                          cursor: autoCalibrateRemainingSecs !== null ? "not-allowed" : "pointer",
                        }}
                      >
                        {autoCalibrateRemainingSecs !== null
                          ? `AUTO-CAL ${String(Math.floor(autoCalibrateRemainingSecs / 60)).padStart(2, "0")}:${String(autoCalibrateRemainingSecs % 60).padStart(2, "0")}`
                          : "AUTO-CALIBRATE  (15 min)"}
                      </button>
                    </div>

                    {/* Log Dump */}
                    <button className="min-h-[44px]"
                      data-testid="cc-diag-log-dump"
                      onClick={triggerExportLog}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "6px 12px",
                        fontSize: "10px",
                        ...mono,
                        letterSpacing: "0.08em",
                        borderRadius: "4px",
                        border: "1px solid #444",
                        background: "rgba(255,255,255,0.04)",
                        color: C.text,
                        cursor: "pointer",
                      }}
                    >
                      <Download size={11} />
                      LOG DUMP (.TXT)
                    </button>

                    {/* Probe indicators */}
                    {probesEnabled && (
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        {[
                          { label: "BLACK FRAME", note: "200ms" },
                          { label: "AUDIO RMS",   note: "500ms" },
                          { label: "MEM GUARD",   note: "950MB" },
                        ].map(({ label, note }) => (
                          <div
                            key={label}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "4px",
                              fontSize: "9px",
                              ...mono,
                              color: "#39ff14",
                              background: "rgba(57,255,20,0.07)",
                              border: "1px solid rgba(57,255,20,0.25)",
                              borderRadius: "3px",
                              padding: "2px 6px",
                            }}
                          >
                            <span style={{ fontSize: "7px" }}>●</span>
                            {label}
                            <span style={{ color: C.dimmer }}>{note}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          </>)}

        </div>

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <div style={{ padding: "14px 20px", borderTop: `1px solid #1a1a1a`,
          flexShrink: 0, textAlign: "center" }}>
          <p style={{ color: C.dimmer, fontSize: "11px", lineHeight: 1.5, margin: 0 }}>
            Press{" "}
            <kbd style={{ background: "#161616", border: "1px solid #333", borderRadius: "3px",
              padding: "1px 5px", ...mono, fontSize: "11px", color: "#888" }}>C</kbd>
            {" "}to open / close
          </p>
        </div>

        {/* aria-live region */}
        <div id="cc-live-region" role="status" aria-live="polite" aria-atomic="true"
          style={{ position: "absolute", width: "1px", height: "1px", padding: 0,
            margin: "-1px", overflow: "hidden", clip: "rect(0,0,0,0)",
            whiteSpace: "nowrap", border: 0 }}>
          {announceText}
        </div>
      </div>
    </>
  );
}
