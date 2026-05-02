export function renderAnalysis(text: string) {
  if (text === "⏳ Analisi in corso...") {
    return (
      <p style={{ fontWeight: 800, color: "#0f172a" }}>
        ⏳ Analisi in corso...
      </p>
    );
  }

  return (
    <div style={{ lineHeight: 1.7 }}>
      {text.split("\n").map((line, i) => {
        const cleanLine = line.trim();
        if (!cleanLine) return null;

        if (cleanLine.toLowerCase().includes("match score")) {
          return (
            <h2
              key={i}
              style={{
                color: "#166534",
                marginTop: 12,
                marginBottom: 14,
                fontSize: 28,
              }}
            >
              {cleanLine}
            </h2>
          );
        }

        if (cleanLine.toLowerCase().includes("warum")) {
          return (
            <h3 key={i} style={{ color: "#2563eb", marginTop: 24 }}>
              💡 {cleanLine}
            </h3>
          );
        }

        if (cleanLine.toLowerCase().includes("risiken")) {
          return (
            <h3 key={i} style={{ color: "#dc2626", marginTop: 24 }}>
              ⚠️ {cleanLine}
            </h3>
          );
        }

        if (cleanLine.toLowerCase().includes("empfehlung")) {
          return (
            <h3 key={i} style={{ color: "#7c3aed", marginTop: 24 }}>
              🎯 {cleanLine}
            </h3>
          );
        }

        if (cleanLine.startsWith("-")) {
          return (
            <p key={i} style={{ marginLeft: 18, color: "#334155" }}>
              • {cleanLine.replace("-", "").trim()}
            </p>
          );
        }

        return (
          <p key={i} style={{ marginBottom: 10, color: "#1e293b" }}>
            {cleanLine}
          </p>
        );
      })}
    </div>
  );
}