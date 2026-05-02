type SidebarProps = {
  cvFile: File | null;
  cvProfile: unknown;
  profileLoading: boolean;
  savedJobsCount: number;
  showSavedJobs: boolean;
  onToggleSavedJobs: () => void;
};

export function Sidebar({
  cvFile,
  cvProfile,
  profileLoading,
  savedJobsCount,
  showSavedJobs,
  onToggleSavedJobs,
}: SidebarProps) {
  return (
    <aside
      style={{
        width: 240,
        background: "rgba(2, 6, 23, 0.86)",
        color: "white",
        padding: 26,
        position: "fixed",
        top: 0,
        bottom: 0,
        left: 0,
        borderRight: "1px solid rgba(148, 163, 184, 0.16)",
        boxSizing: "border-box",
        overflowY: "auto",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div
            style={{
              width: 44,
              height: 44,
              minWidth: 44,
              borderRadius: 14,
              background: "linear-gradient(135deg, #2563eb, #15803d)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 900,
              boxShadow: "0 18px 35px rgba(37,99,235,0.22)",
            }}
          >
            JR
          </div>

          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 22, lineHeight: 1.08 }}>
              JobRadar AI
            </h2>
            <p
              style={{
                margin: "5px 0 0",
                fontSize: 12,
                lineHeight: 1.35,
                color: "#94a3b8",
              }}
            >
              Dein persönlicher Job Scout
            </p>
          </div>
        </div>

        <div
          style={{
            paddingTop: 14,
            borderTop: "1px solid rgba(148, 163, 184, 0.14)",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 9,
              color: "#64748b",
              letterSpacing: 1.2,
              textTransform: "uppercase",
              fontWeight: 800,
            }}
          >
            Created by
          </p>

          <p
            style={{
              margin: "5px 0 0",
              fontSize: 15,
              lineHeight: 1.1,
              color: "#e2e8f0",
              fontWeight: 900,
              fontFamily: "Georgia, serif",
              fontStyle: "italic",
              letterSpacing: 0.2,
            }}
          >
            Francesco Molea
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gap: 12, marginTop: 34 }}>
        <button
          className="premium-btn"
          style={{
            padding: "13px 14px",
            background: "linear-gradient(135deg, #15803d, #166534)",
            color: "white",
            border: "none",
            borderRadius: 14,
            fontWeight: 900,
            textAlign: "left",
            boxShadow: "0 12px 25px rgba(21,128,61,0.18)",
          }}
        >
          📊 Dashboard
        </button>

        <button
          className="premium-btn"
          onClick={onToggleSavedJobs}
          style={{
            padding: "13px 14px",
            background: showSavedJobs
              ? "linear-gradient(135deg, #2563eb, #1d4ed8)"
              : "rgba(30, 41, 59, 0.8)",
            color: "#e2e8f0",
            border: "1px solid rgba(148, 163, 184, 0.14)",
            borderRadius: 14,
            fontWeight: 900,
            textAlign: "left",
            cursor: "pointer",
          }}
        >
          💾 Gespeichert ({savedJobsCount})
        </button>
      </div>

      <div
        style={{
          marginTop: 34,
          padding: 18,
          borderRadius: 18,
          background: "rgba(15, 23, 42, 0.85)",
          border: "1px solid rgba(148, 163, 184, 0.14)",
        }}
      >
        <p style={{ margin: 0, color: "#94a3b8", fontSize: 12 }}>Status</p>
        <p
          style={{
            margin: "8px 0 0",
            fontWeight: 900,
            color: cvFile ? "#bbf7d0" : "#fca5a5",
          }}
        >
          {cvFile ? "CV geladen" : "CV fehlt"}
        </p>

        <p
          style={{
            margin: "8px 0 0",
            fontWeight: 900,
            color: cvProfile ? "#bfdbfe" : "#94a3b8",
            fontSize: 13,
          }}
        >
          {profileLoading
            ? "Profil wird analysiert..."
            : cvProfile
            ? "Profil analysiert"
            : "Profil noch nicht analysiert"}
        </p>

        {savedJobsCount > 0 && (
          <p
            style={{
              margin: "8px 0 0",
              color: "#94a3b8",
              fontSize: 12,
            }}
          >
            {savedJobsCount} Jobs im Speicher
          </p>
        )}
      </div>
    </aside>
  );
}