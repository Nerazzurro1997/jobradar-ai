import { useState } from "react";

type Job = {
  id: number;
  title: string;
  company: string;
  location: string;
};

const SUPABASE_FUNCTION_URL =
  "https://splummvxjbyubbtiebl.supabase.co/functions/v1/match-job";

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

  // 🔥 CONVERTE PDF IN BASE64
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

  // 🔥 CHIAMATA ALLA EDGE FUNCTION
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

      console.log("RISPOSTA AI:", data);

      const raw =
  data?.output?.[0]?.content?.[0]?.text ||
  data?.error ||
  "Nessuna risposta";

// pulizia base
const formatted = raw
  .replace(/\*\*/g, "") // rimuove markdown **
  .replace(/\n/g, "\n");

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

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      {/* SIDEBAR */}
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

      {/* MAIN */}
      <div style={{ flex: 1, padding: 30 }}>
        <h1>Dashboard</h1>

        {/* CV UPLOAD */}
        <div style={{ marginBottom: 20 }}>
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                setCvFile(file);
              }
            }}
          />

          <p>
            CV Status:{" "}
            <strong>{cvFile ? "Geladen ✅" : "Nicht geladen ❌"}</strong>
          </p>
        </div>

        {/* JOBS */}
        {jobs.map((job) => (
          <div
            key={job.id}
            style={{
              background: "#f1f5f9",
              padding: 20,
              borderRadius: 12,
              marginBottom: 20,
            }}
          >
            <h3>{job.title}</h3>
            <p>
              {job.company} · {job.location}
            </p>

            <button
              onClick={() => analyzeJob(job)}
              style={{
                background: "#2563eb",
                color: "white",
                border: "none",
                padding: "8px 12px",
                borderRadius: 8,
                cursor: "pointer",
              }}
            >
              AI Analyse
            </button>

            {analysis[job.id] && (
              <div
                style={{
                  marginTop: 15,
                  padding: 10,
                  background: "#e2e8f0",
                  borderRadius: 8,
                  whiteSpace: "pre-wrap",
                }}
              >
                <strong>AI Analyse:</strong>
                <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit" }}>
  {analysis[job.id]}
</pre>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
