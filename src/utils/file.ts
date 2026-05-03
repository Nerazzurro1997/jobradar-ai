export function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const [, base64 = ""] = result.split(",");

      if (!base64) {
        reject(new Error("Could not convert file to base64."));
        return;
      }

      resolve(base64);
    };

    reader.onerror = () => {
      reject(reader.error || new Error("Could not read file."));
    };

    reader.onabort = () => {
      reject(new Error("File reading was aborted."));
    };

    reader.readAsDataURL(file);
  });
}
