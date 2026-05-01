import { useState } from "react";

type Job = {
  id: number;
  title: string;
  company: string;
  location: string;
};

const SUPABASE_FUNCTION_URL =
  "https://splummvxjbyubbtiiebl.supabase.co/functions/v1/match-job";

const SUPABASE_ANON_KEY = "sb_publishable_Kc7qxUo7qpHaRz3w-wOCWg_rVqIeixX";

export default function App() {
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<{ [key: number]: string }>({});

  const jobs: Job[] = [
    {
      id: 1,
      title: "Sachbearbeiter Versicherung",
      company: "AXA",
      location: "Zürich",
    },
    {
      id: 2,
      title: "Kundenberater Innendienst",
      company: "Generali",
      location: "Adliswil",
    },
  ];

  const toBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64 = reader.result?.toString().split(",")[1];
        resolve(base64 || "");
      };
      reader.onerror = reject;
    });
  };

  async function analyzeJob(job: Job) {
    if (!cvFile) {
      alert("Carica prima il CV PDF");
      return;
    }

    setAnalysis((prev) => ({
      ...prev,
      [job.id]: "⏳ Analisi in corso...",
    }));

    try {
      const base64 = await toBase64(cvFile);

      const response = await fetch(SUPABASE_FUNCTION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          fileName: cvFile.name,
          fileBase64: base64,
          job,
        }),
      });

      const rawText = await response.text();

      let data;
      try {
        data = JSON.parse(rawText);
      } catch {
        throw new Error(rawText.slice(0, 300));
      }

      const raw =
        data?.output?.[0]?.content?.[0]?.text ||
        data?.error ||
        "Nessuna risposta";

      const formatted = raw
        .replace(/\*\*/g, "")
        .replace(/###/g, "")
        .replace(/---/g, "")
        .replace(/Vielen Dank.*?\./, "")
        .trim();

      setAnalysis((prev) => ({
        ...prev,
        [job.id]: formatted,
      }));
    } catch (error) {
      setAnalysis((prev) => ({
        ...prev,
        [job.id]: "Errore: " + String(error),
      }));
    }
  }

  function renderAnalysis(text: string) {
    if (text === "⏳ Analisi in corso...") {
      return <p style={{ fontWeight: "bold" }}>⏳ Analisi in corso...</p>;
    }

    return (
      <div style={{ lineHeight: 1.6 }}>
        {text.split("\n").map((line, i) => {
          const cleanLine = line.trim();

          if (!cleanLine) return null;

          if (cleanLine.toLowerCase().includes("match score")) {
            return (
              <h2 key={i} style={{ color: "#16a34a", marginTop: 10 }}>
                {cleanLine}
              </h2>
            );
          }

          if (cleanLine.toLowerCase().includes("warum")) {
            return (
              <h3 key={i} style={{ color: "#2563eb", marginTop: 22 }}>
                💡 {cleanLine}
              </h3>
            );
          }

          if (cleanLine.toLowerCase().includes("risiken")) {
            return (
              <h3 key={i} style={{ color: "#dc2626", marginTop: 22 }}>
                ⚠️ {cleanLine}
              </h3>
            );
          }

          if (cleanLine.toLowerCase().includes("empfehlung")) {
            return (
              <h3 key={i} style={{ color: "#7c3aed", marginTop: 22 }}>
                🎯 {cleanLine}
              </h3>
            );
          }

          if (cleanLine.startsWith("-")) {
            return (
              <p key={i} style={{ marginLeft: 18, marginBottom: 8 }}>
                • {cleanLine.replace("-", "").trim()}
              </p>
            );
          }

          return (
            <p key={i} style={{ marginBottom: 10 }}>
              {cleanLine}
            </p>
          );
        })}
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        background: "#111827",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          width: 220,
          background: "#0f172a",
          color: "white",
          padding: 20,
        }}
      >
        <h2>JobRadar AI</h2>
        <p style={{ fontSize: 12 }}>Dein persönlicher Job Scout</p>

        <button
          style={{
            width: "100%",
            marginTop: 20,
            padding: 10,
            background: "#2563eb",
            color: "white",
            border: "none",
            borderRadius: 8,
          }}
        >
          Dashboard
        </button>

        <button
          style={{
            width: "100%",
            marginTop: 10,
            padding: 10,
            background: "#1e293b",
            color: "white",
            border: "none",
            borderRadius: 8,
          }}
        >
          Mein CV
        </button>
      </div>

      <div
        style={{
          flex: 1,
          padding: 30,
          color: "#f8fafc",
          maxWidth: 900,
          margin: "0 auto",
        }}
      >
        <h1 style={{ fontSize: 48, marginBottom: 10 }}>Dashboard</h1>

        <div style={{ marginBottom: 24 }}>
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) setCvFile(file);
            }}
          />

          <p>
            CV Status:{" "}
            <strong>{cvFile ? "Geladen ✅" : "Nicht geladen ❌"}</strong>
          </p>
        </div>

        {jobs.map((job) => (
          <div
            key={job.id}
            style={{
              background: "#f1f5f9",
              color: "#334155",
              padding: 28,
              borderRadius: 16,
              marginBottom: 24,
              boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
            }}
          >
            <h2 style={{ margin: 0 }}>{job.title}</h2>
            <p style={{ marginTop: 8 }}>
              {job.company} · {job.location}
            </p>

            <button
              onClick={() => analyzeJob(job)}
              style={{
                background: "#2563eb",
                color: "white",
                border: "none",
                padding: "10px 16px",
                borderRadius: 8,
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              AI Analyse
            </button>

            {analysis[job.id] && (
              <div
                style={{
                  marginTop: 20,
                  padding: 20,
                  background: "#e2e8f0",
                  borderRadius: 12,
                }}
              >
                <strong>AI Analyse:</strong>
                {renderAnalysis(analysis[job.id])}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
