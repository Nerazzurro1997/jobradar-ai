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
        width: 260,
        background: "rgba(2,6,23,0.92)",
        backdropFilter: "blur(14px)",
        color: "white",
        padding: 28,
        position: "fixed",
        top: 0,
        bottom: 0,
        left: 0,
        borderRight: "1px solid rgba(148,163,184,0.15)",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        overflowY: "auto",
      }}
    >
      <div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 16,
              background: "linear-gradient(135deg, #2563eb, #22c55e)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 950,
              fontSize: 16,
              boxShadow: "0 14px 32px rgba(37,99,235,0.35)",
            }}
          >
            JR
          </div>

          <div>
            <h2 style={{ margin: 0, fontSize: 20, letterSpacing: -0.3 }}>
              JobRadar AI
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#94a3b8" }}>
              Your AI Job Scout
            </p>
          </div>
        </div>

        <div style={{ marginTop: 36, display: "grid", gap: 12 }}>
          <button className="btn btn-primary" style={{ textAlign: "left" }}>
            📊 Dashboard
          </button>

          <button
            className={showSavedJobs ? "btn btn-blue" : "btn btn-dark"}
            onClick={onToggleSavedJobs}
            style={{ textAlign: "left" }}
          >
            💾 Saved Jobs ({savedJobsCount})
          </button>
        </div>

        <div
          className="card"
          style={{
            marginTop: 36,
            padding: 18,
          }}
        >
          <p style={{ margin: 0, fontSize: 12, color: "#94a3b8" }}>Status</p>

          <p
            style={{
              marginTop: 10,
              fontWeight: 800,
              color: cvFile ? "#22c55e" : "#ef4444",
            }}
          >
            {cvFile ? "CV uploaded" : "No CV uploaded"}
          </p>

          <p
            style={{
              marginTop: 8,
              fontSize: 13,
              fontWeight: 700,
              color: profileLoading
                ? "#facc15"
                : cvProfile
                ? "#60a5fa"
                : "#64748b",
            }}
          >
            {profileLoading
              ? "Analyzing profile..."
              : cvProfile
              ? "Profile ready"
              : "Profile not analyzed"}
          </p>

          {savedJobsCount > 0 && (
            <p style={{ marginTop: 10, fontSize: 12, color: "#94a3b8" }}>
              {savedJobsCount} saved jobs
            </p>
          )}
        </div>
      </div>

      <div
        style={{
          paddingTop: 22,
          borderTop: "1px solid rgba(148,163,184,0.12)",
          fontSize: 12,
          color: "#64748b",
          textAlign: "center",
        }}
      >
        <p style={{ margin: 0 }}>Created by</p>
        <strong style={{ color: "#e2e8f0" }}>Francesco Molea</strong>
      </div>
    </aside>
  );
}