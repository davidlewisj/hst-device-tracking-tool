import { useState, useRef, useEffect, useCallback } from "react";

const C = {
  bg: "#04101e",
  surface: "#091828",
  card: "#0e2035",
  cardHi: "#122540",
  border: "rgba(45,200,185,0.14)",
  borderHi: "rgba(45,200,185,0.38)",
  accent: "#2dc8b9",
  accentBg: "rgba(45,200,185,0.10)",
  accentGlow: "rgba(45,200,185,0.06)",
  blue: "#5b8fff",
  blueBg: "rgba(91,143,255,0.10)",
  text: "#d4e8f8",
  muted: "#476070",
  faint: "#1a3048",
  ok: "#2dc8b9",
  warn: "#ffa040",
  err: "#ff5568",
  errBg: "rgba(255,85,104,0.10)",
};

const ACK = `By signing below, I acknowledge receipt of the following home sleep testing (HST) equipment from our practice:

  • HST Recording Device (serial number assigned below)
  • Device Charger
  • Finger Pulse Oximeter / Sensor

I agree that:
1. I will return all equipment by my scheduled drop-off date in the same condition as received.
2. I accept financial responsibility for any equipment that is lost, stolen, or damaged.
3. I will follow all setup and usage instructions provided by clinical staff at time of pickup.
4. I authorize the practice to collect and use my sleep study data for diagnostic and clinical purposes only.

I confirm I have received instructions for proper device use and understand the return process.`;

const uid = () => Math.random().toString(36).slice(2, 9).toUpperCase();
const todayISO = () => new Date().toISOString().slice(0, 10);
const fmtDate = (d) =>
  d
    ? new Date(d + "T12:00:00").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";

// ── Signature Pad ─────────────────────────────────────────────
function SignaturePad({ onSigned }) {
  const ref = useRef(null);
  const drawing = useRef(false);
  const [signed, setSigned] = useState(false);

  const xy = (e) => {
    const c = ref.current, r = c.getBoundingClientRect();
    const s = e.touches ? e.touches[0] : e;
    return [(s.clientX - r.left) * (c.width / r.width), (s.clientY - r.top) * (c.height / r.height)];
  };

  const start = (e) => {
    e.preventDefault();
    drawing.current = true;
    const [x, y] = xy(e);
    const ctx = ref.current.getContext("2d");
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const move = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const [x, y] = xy(e);
    const ctx = ref.current.getContext("2d");
    ctx.lineTo(x, y);
    ctx.strokeStyle = C.accent;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    if (!signed) setSigned(true);
  };

  const stop = () => {
    drawing.current = false;
    if (signed) onSigned(ref.current.toDataURL());
  };

  const clear = () => {
    ref.current.getContext("2d").clearRect(0, 0, ref.current.width, ref.current.height);
    setSigned(false);
    onSigned(null);
  };

  return (
    <div>
      <div style={{ position: "relative", borderRadius: 10, overflow: "hidden", border: `1.5px solid ${signed ? C.accent : C.border}`, background: C.card, transition: "border-color 0.25s" }}>
        <canvas
          ref={ref}
          width={580}
          height={150}
          style={{ display: "block", width: "100%", cursor: "crosshair", touchAction: "none" }}
          onMouseDown={start} onMouseMove={move} onMouseUp={stop} onMouseLeave={stop}
          onTouchStart={start} onTouchMove={move} onTouchEnd={stop}
        />
        {!signed && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: C.muted, fontSize: 13, pointerEvents: "none", fontFamily: "Sora, sans-serif", letterSpacing: "0.08em" }}>
            Sign here with mouse or touch
          </div>
        )}
      </div>
      {signed && (
        <button onClick={clear} style={ghostBtn}>↺ Clear</button>
      )}
    </div>
  );
}

// ── Barcode Scanner ───────────────────────────────────────────
function BarcodeScanner({ onScanned }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);
  const [scanning, setScanning] = useState(false);
  const [manual, setManual] = useState("");
  const [camErr, setCamErr] = useState("");
  const [noDetector, setNoDetector] = useState(false);

  const stop = useCallback(() => {
    clearInterval(intervalRef.current);
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    if (videoRef.current) videoRef.current.srcObject = null;
    setScanning(false);
  }, []);

  useEffect(() => () => stop(), [stop]);

  const startScan = async () => {
    setCamErr("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setScanning(true);
      if ("BarcodeDetector" in window) {
        const det = new window.BarcodeDetector({ formats: ["code_128", "code_39", "qr_code", "ean_13", "upc_a"] });
        intervalRef.current = setInterval(async () => {
          try {
            const barcodes = await det.detect(videoRef.current);
            if (barcodes.length) { stop(); onScanned(barcodes[0].rawValue); }
          } catch {}
        }, 300);
      } else {
        setNoDetector(true);
      }
    } catch {
      setCamErr("Camera unavailable — please enter the serial number manually below.");
    }
  };

  return (
    <div>
      {scanning ? (
        <div>
          <div style={{ borderRadius: 12, overflow: "hidden", border: `2px solid ${C.accent}`, position: "relative", marginBottom: 12 }}>
            <video ref={videoRef} style={{ display: "block", width: "100%", maxHeight: 260, objectFit: "cover" }} />
            <div style={{ position: "absolute", top: "50%", left: "15%", right: "15%", height: 2, background: C.accent, transform: "translateY(-50%)", opacity: 0.6 }} />
          </div>
          <div style={{ textAlign: "center", color: C.muted, fontSize: 13, fontFamily: "Sora, sans-serif", marginBottom: 10 }}>
            {noDetector ? "Camera active — BarcodeDetector not supported in this browser. Use manual entry below." : "Scanning for barcode…"}
          </div>
          <div style={{ textAlign: "center" }}><button onClick={stop} style={ghostBtn}>Cancel</button></div>
        </div>
      ) : (
        <div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
            <button onClick={startScan} style={{ ...secondaryBtn, whiteSpace: "nowrap" }}>📷 Scan Barcode</button>
            <span style={{ color: C.muted, fontSize: 13, fontFamily: "Sora, sans-serif" }}>or enter manually</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              style={{ ...inputStyle, flex: 1, fontFamily: "JetBrains Mono, monospace", letterSpacing: "0.05em" }}
              placeholder="Type device serial number…"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && manual.trim()) { onScanned(manual.trim()); setManual(""); } }}
            />
            <button onClick={() => { if (manual.trim()) { onScanned(manual.trim()); setManual(""); } }} style={primaryBtn}>→</button>
          </div>
        </div>
      )}
      {camErr && <div style={{ color: C.err, fontSize: 13, fontFamily: "Sora, sans-serif", marginTop: 10, padding: "10px 14px", background: C.errBg, borderRadius: 8 }}>{camErr}</div>}
    </div>
  );
}

// ── Shared Style Objects ──────────────────────────────────────
const inputStyle = {
  background: C.surface, border: `1.5px solid ${C.border}`, borderRadius: 9, padding: "10px 14px",
  color: C.text, fontSize: 14, fontFamily: "Sora, sans-serif", width: "100%", boxSizing: "border-box",
  outline: "none",
};

const primaryBtn = {
  background: `linear-gradient(135deg, ${C.accent}, #1a9e90)`, color: "#03100e", fontFamily: "Sora, sans-serif",
  fontWeight: 700, fontSize: 14, padding: "11px 22px", borderRadius: 10, border: "none", cursor: "pointer",
};

const secondaryBtn = {
  background: C.accentBg, color: C.accent, border: `1.5px solid ${C.borderHi}`, fontFamily: "Sora, sans-serif",
  fontWeight: 600, fontSize: 14, padding: "10px 20px", borderRadius: 10, cursor: "pointer",
};

const ghostBtn = {
  background: "none", color: C.muted, border: `1px solid ${C.faint}`, fontFamily: "Sora, sans-serif",
  fontSize: 12, padding: "5px 14px", borderRadius: 7, cursor: "pointer", marginTop: 8,
};

const cardStyle = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 28 };

// ── Field Wrapper ─────────────────────────────────────────────
const Field = ({ label, required, children }) => (
  <div style={{ marginBottom: 18 }}>
    <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 7, fontFamily: "Sora, sans-serif" }}>
      {label}{required && <span style={{ color: C.err }}> *</span>}
    </label>
    {children}
  </div>
);

// ── Progress Steps ────────────────────────────────────────────
const Progress = ({ step, labels }) => (
  <div style={{ display: "flex", gap: 6, marginBottom: 32 }}>
    {labels.map((l, i) => (
      <div key={i} style={{ flex: 1 }}>
        <div style={{ height: 3, borderRadius: 3, background: i <= step ? C.accent : C.faint, transition: "background 0.4s", marginBottom: 6 }} />
        <div style={{ fontSize: 10, color: i === step ? C.accent : C.muted, fontFamily: "Sora, sans-serif", fontWeight: i === step ? 700 : 400, letterSpacing: "0.08em", textTransform: "uppercase", textAlign: "center" }}>
          {l}
        </div>
      </div>
    ))}
  </div>
);

// ── Record Summary ────────────────────────────────────────────
function RecordSummary({ rec, compact = false }) {
  const fields = [
    ["Patient", rec.patientName],
    ["Date of Birth", fmtDate(rec.dob)],
    ["Device Serial", rec.deviceSerial],
    ["Charger #", rec.chargerNumber],
    ["Pick-Up", fmtDate(rec.pickupDate)],
    ["Drop-Off", fmtDate(rec.dropoffDate)],
    ["Follow-Up", fmtDate(rec.followupDate)],
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: compact ? "1fr 1fr" : "1fr 1fr 1fr", gap: 14, fontFamily: "Sora, sans-serif" }}>
      {fields.map(([l, v]) => (
        <div key={l}>
          <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 5 }}>{l}</div>
          <div style={{ fontSize: 13, color: C.text, fontFamily: l.includes("Serial") || l.includes("#") ? "JetBrains Mono, monospace" : "Sora, sans-serif", fontWeight: l === "Patient" ? 600 : 400 }}>{v}</div>
        </div>
      ))}
    </div>
  );
}

// ── Section Title ─────────────────────────────────────────────
const SectionTitle = ({ children }) => (
  <div style={{ fontSize: 11, fontWeight: 700, color: C.accent, letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: "Sora, sans-serif", borderBottom: `1px solid ${C.border}`, paddingBottom: 12, marginBottom: 22 }}>
    {children}
  </div>
);

// ── Screen Wrapper ────────────────────────────────────────────
function Screen({ title, onBack, children }) {
  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "24px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 30 }}>
        <button onClick={onBack} style={{ ...ghostBtn, marginTop: 0 }}>← Home</button>
        <h2 style={{ color: C.text, fontSize: 22, fontWeight: 700, fontFamily: "Sora, sans-serif", margin: 0 }}>{title}</h2>
      </div>
      {children}
    </div>
  );
}

// ── SUCCESS ICON ──────────────────────────────────────────────
const SuccessIcon = () => (
  <div style={{ width: 72, height: 72, borderRadius: "50%", background: C.accentBg, border: `2px solid ${C.accent}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px", fontSize: 28, color: C.accent }}>
    ✓
  </div>
);

// ── PATIENT SIGNING KIOSK ─────────────────────────────────────
function PatientSigningKiosk({ patientName, onSigned, onCancel }) {
  const [sig, setSig] = useState(null);
  const [confirmed, setConfirmed] = useState(false);

  const confirm = () => {
    if (!sig) return;
    setConfirmed(true);
    setTimeout(() => onSigned(sig), 1800);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#020c18", zIndex: 999, display: "flex", flexDirection: "column", overflowY: "auto" }}>
      {confirmed ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 40 }}>
          <div style={{ width: 88, height: 88, borderRadius: "50%", background: "rgba(45,200,185,0.12)", border: `2px solid ${C.accent}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, color: C.accent, marginBottom: 24 }}>✓</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: C.text, fontFamily: "Sora, sans-serif", marginBottom: 10 }}>Thank you, {patientName.split(" ")[0]}.</div>
          <div style={{ fontSize: 15, color: C.muted, fontFamily: "Sora, sans-serif" }}>Your acknowledgment has been recorded.</div>
        </div>
      ) : (
        <div style={{ maxWidth: 680, width: "100%", margin: "0 auto", padding: "48px 28px 40px" }}>
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <div style={{ fontSize: 10, letterSpacing: "0.35em", textTransform: "uppercase", color: C.accent, fontFamily: "Sora, sans-serif", marginBottom: 12 }}>
              Sleep Medicine · Home Sleep Test
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, color: C.text, fontFamily: "Sora, sans-serif", marginBottom: 8 }}>
              Patient Acknowledgment
            </div>
            <div style={{ fontSize: 14, color: C.muted, fontFamily: "Sora, sans-serif" }}>
              Please read the following carefully, then sign below.
            </div>
          </div>

          <div style={{ background: "#091828", border: `1px solid rgba(45,200,185,0.12)`, borderRadius: 14, padding: "24px 28px", marginBottom: 32, fontSize: 14, lineHeight: 2, color: C.text, fontFamily: "Sora, sans-serif", whiteSpace: "pre-line" }}>
            {ACK}
          </div>

          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: "Sora, sans-serif", marginBottom: 10 }}>
              Sign below to acknowledge
            </div>
            <SignaturePad onSigned={setSig} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
            <button onClick={confirm} style={{ ...primaryBtn, fontSize: 16, padding: "14px 40px", opacity: sig ? 1 : 0.35, pointerEvents: sig ? "auto" : "none", width: "100%", maxWidth: 360 }}>
              I agree — submit signature ✓
            </button>
            <button onClick={onCancel}
              style={{ background: "none", border: "none", color: C.muted, fontFamily: "Sora, sans-serif", fontSize: 12, cursor: "pointer", padding: "6px 12px", letterSpacing: "0.04em" }}>
              ← Return to staff view
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── PRINT LABEL ───────────────────────────────────────────────
function printLabel(r) {
  const id = "hst-print-label-" + Date.now();
  const div = document.createElement("div");
  div.id = id;
  div.innerHTML = `
    <div style="width:3.5in;height:2in;background:#000;color:#fff;font-family:Arial,sans-serif;display:flex;flex-direction:column;justify-content:space-between;padding:0.18in 0.2in;box-sizing:border-box;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:0.5pt solid rgba(255,255,255,0.25);padding-bottom:0.1in;margin-bottom:0.1in;">
        <div>
          <div style="font-size:13pt;font-weight:700;">${r.patientName}</div>
          <div style="font-size:7pt;color:rgba(255,255,255,0.5);margin-top:2pt;letter-spacing:0.06em;text-transform:uppercase;">DOB: ${fmtDate(r.dob)}</div>
        </div>
        <div style="background:rgba(255,255,255,0.08);border:0.5pt solid rgba(255,255,255,0.2);border-radius:4pt;padding:3pt 7pt;text-align:right;">
          <div style="font-size:6pt;color:rgba(255,255,255,0.45);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:2pt;">Device Serial</div>
          <div style="font-family:monospace;font-size:11pt;font-weight:700;color:#2dc8b9;">${r.deviceSerial}</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0 0.1in;">
        <div><div style="font-size:6pt;color:rgba(255,255,255,0.45);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:2pt;">Pick-Up</div><div style="font-size:8pt;font-weight:600;">${fmtDate(r.pickupDate)}</div></div>
        <div><div style="font-size:6pt;color:rgba(255,255,255,0.45);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:2pt;">Drop-Off</div><div style="font-size:8pt;font-weight:600;">${fmtDate(r.dropoffDate)}</div></div>
        <div><div style="font-size:6pt;color:rgba(255,255,255,0.45);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:2pt;">Follow-Up</div><div style="font-size:8pt;font-weight:600;">${fmtDate(r.followupDate)}</div></div>
      </div>
      <div style="margin-top:0.06in;">
        <div style="font-size:6pt;color:rgba(255,255,255,0.45);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:2pt;">Charger #</div>
        <div style="font-family:monospace;font-size:8pt;font-weight:600;">${r.chargerNumber}</div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;border-top:0.5pt solid rgba(255,255,255,0.1);padding-top:0.07in;margin-top:0.07in;">
        <div style="font-family:monospace;font-size:6pt;color:rgba(255,255,255,0.3);">ID: ${r.id}</div>
        <div style="font-size:6pt;color:rgba(255,255,255,0.2);letter-spacing:0.08em;text-transform:uppercase;">Sleep Medicine Solutions · HST</div>
      </div>
    </div>`;
  div.style.cssText = "position:fixed;top:0;left:0;z-index:99999;display:none;";
  document.body.appendChild(div);

  const style = document.createElement("style");
  style.id = id + "-style";
  style.textContent = `
    @media print {
      @page { size: 3.5in 2in; margin: 0; }
      body > *:not(#${id}) { display: none !important; visibility: hidden !important; }
      #${id} { display: block !important; position: fixed !important; top: 0 !important; left: 0 !important; }
      #${id} * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    }`;
  document.head.appendChild(style);

  setTimeout(() => {
    window.print();
    setTimeout(() => {
      document.body.removeChild(div);
      document.head.removeChild(style);
    }, 500);
  }, 100);
}

// ── CHECK-OUT FLOW ────────────────────────────────────────────
function CheckOutFlow({ records, saveRecords, onBack }) {
  const [step, setStep] = useState(0);
  const [sig, setSig] = useState(null);
  const [rec, setRec] = useState(null);
  const [kioskOpen, setKioskOpen] = useState(false);
  const [f, setF] = useState({
    patientName: "", dob: "",
    deviceSerial: "", chargerNumber: "",
    pickupDate: todayISO(), dropoffDate: "", followupDate: "",
  });

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const ok0 = f.patientName.trim() && f.dob;
  const ok2 = f.deviceSerial.trim() && f.chargerNumber.trim() && f.pickupDate && f.dropoffDate && f.followupDate;

  const submit = () => {
    const newRec = { id: uid(), ...f, signature: sig, signedAt: new Date().toISOString(), returned: false, returnedAt: null, returnedItems: { device: false, charger: false, sensor: false } };
    saveRecords([...records, newRec]);
    setRec(newRec);
    setStep(3);
  };

  if (step === 3 && rec) return (
    <Screen title="Device Check-Out" onBack={onBack}>
      <Progress step={3} labels={["Patient", "Signature", "Device", "Done"]} />
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <SuccessIcon />
        <div style={{ color: C.accent, fontSize: 20, fontWeight: 700, fontFamily: "Sora, sans-serif", marginBottom: 6 }}>Device Issued Successfully</div>
        <div style={{ color: C.muted, fontSize: 14, fontFamily: "Sora, sans-serif" }}>Record ID: <span style={{ fontFamily: "JetBrains Mono, monospace", color: C.text }}>{rec.id}</span></div>
      </div>
      <div style={{ ...cardStyle, marginBottom: 16 }}><RecordSummary rec={rec} /></div>
      <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 24, flexWrap: "wrap" }}>
        <button onClick={onBack} style={secondaryBtn}>← Home</button>
        <button onClick={() => printLabel(rec)} style={{ ...secondaryBtn, color: C.blue, border: `1.5px solid rgba(91,143,255,0.4)`, background: "rgba(91,143,255,0.08)" }}>
          🖨 Print Label
        </button>
        <button onClick={() => { setStep(0); setF({ patientName: "", dob: "", deviceSerial: "", chargerNumber: "", pickupDate: todayISO(), dropoffDate: "", followupDate: "" }); setSig(null); setRec(null); }} style={primaryBtn}>+ New Checkout</button>
      </div>
      <div style={{ textAlign: "center", marginTop: 10, fontSize: 11, color: C.muted, fontFamily: "Sora, sans-serif" }}>
        Label formatted for Avery Presta® 94237 (3.5" × 2")
      </div>
    </Screen>
  );

  return (
    <>
      {kioskOpen && (
        <PatientSigningKiosk
          patientName={f.patientName}
          onSigned={(s) => { setSig(s); setKioskOpen(false); setStep(2); }}
          onCancel={() => setKioskOpen(false)}
        />
      )}

      <Screen title="Device Check-Out" onBack={onBack}>
        <Progress step={step} labels={["Patient", "Signature", "Device", "Done"]} />

        {step === 0 && (
          <div style={cardStyle}>
            <SectionTitle>Patient Information</SectionTitle>
            <Field label="Full Name" required>
              <input style={inputStyle} value={f.patientName} onChange={(e) => set("patientName", e.target.value)} placeholder="Patient's full name" />
            </Field>
            <Field label="Date of Birth" required>
              <input style={inputStyle} type="date" value={f.dob} onChange={(e) => set("dob", e.target.value)} />
            </Field>
            <div style={{ textAlign: "right", marginTop: 8 }}>
              <button onClick={() => setStep(1)} style={{ ...primaryBtn, opacity: ok0 ? 1 : 0.4, pointerEvents: ok0 ? "auto" : "none" }}>Next →</button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div style={cardStyle}>
            <SectionTitle>Patient Signature</SectionTitle>
            <div style={{ marginBottom: 22 }}>
              <div style={{ fontSize: 14, color: C.text, fontFamily: "Sora, sans-serif", marginBottom: 6 }}>
                Ready to collect acknowledgment from <strong>{f.patientName}</strong>.
              </div>
              <div style={{ fontSize: 13, color: C.muted, fontFamily: "Sora, sans-serif", lineHeight: 1.7 }}>
                Hand the device to the patient and tap the button below to launch the patient signing screen. The portal will be hidden until they complete their signature.
              </div>
            </div>

            {sig ? (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.accent, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "Sora, sans-serif", marginBottom: 10 }}>Signature captured</div>
                <div style={{ background: C.card, border: `1.5px solid ${C.accent}`, borderRadius: 10, overflow: "hidden", marginBottom: 10 }}>
                  <img src={sig} style={{ display: "block", width: "100%", maxHeight: 100, objectFit: "contain" }} alt="Captured signature" />
                </div>
                <button onClick={() => setSig(null)} style={ghostBtn}>↺ Re-collect signature</button>
              </div>
            ) : (
              <button onClick={() => setKioskOpen(true)} style={{ ...primaryBtn, width: "100%", fontSize: 15, padding: "14px 0", marginBottom: 4, textAlign: "center" }}>
                Hand to Patient — Launch Signing Screen →
              </button>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
              <button onClick={() => setStep(0)} style={ghostBtn}>← Back</button>
              <button onClick={() => setStep(2)} style={{ ...primaryBtn, opacity: sig ? 1 : 0.35, pointerEvents: sig ? "auto" : "none" }}>Next →</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div style={cardStyle}>
            <SectionTitle>Device Assignment</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Field label="Device Serial Number" required>
                <input style={{ ...inputStyle, fontFamily: "JetBrains Mono, monospace", letterSpacing: "0.06em" }} value={f.deviceSerial} onChange={(e) => set("deviceSerial", e.target.value)} placeholder="e.g. WD-240892" />
              </Field>
              <Field label="Charger Number" required>
                <input style={{ ...inputStyle, fontFamily: "JetBrains Mono, monospace", letterSpacing: "0.06em" }} value={f.chargerNumber} onChange={(e) => set("chargerNumber", e.target.value)} placeholder="e.g. CHG-4821" />
              </Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
              <Field label="Pick-Up Date" required>
                <input style={inputStyle} type="date" value={f.pickupDate} onChange={(e) => set("pickupDate", e.target.value)} />
              </Field>
              <Field label="Drop-Off Date" required>
                <input style={inputStyle} type="date" value={f.dropoffDate} onChange={(e) => set("dropoffDate", e.target.value)} />
              </Field>
              <Field label="Follow-Up Date" required>
                <input style={inputStyle} type="date" value={f.followupDate} onChange={(e) => set("followupDate", e.target.value)} />
              </Field>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
              <button onClick={() => setStep(1)} style={ghostBtn}>← Back</button>
              <button onClick={submit} style={{ ...primaryBtn, opacity: ok2 ? 1 : 0.4, pointerEvents: ok2 ? "auto" : "none" }}>Complete Checkout ✓</button>
            </div>
          </div>
        )}
      </Screen>
    </>
  );
}

// ── CHECK-IN FLOW ─────────────────────────────────────────────
function CheckInFlow({ records, saveRecords, onBack }) {
  const [step, setStep] = useState(0);
  const [found, setFound] = useState(null);
  const [notFound, setNotFound] = useState(null);
  const [items, setItems] = useState({ device: false, charger: false, sensor: false });
  const [notes, setNotes] = useState("");

  const lookup = (serial) => {
    const match = records.find((r) => r.deviceSerial.toLowerCase().trim() === serial.toLowerCase().trim() && !r.returned);
    if (match) { setFound(match); setNotFound(null); setStep(1); }
    else { setNotFound(serial); }
  };

  const confirmReturn = () => {
    const updated = records.map((r) =>
      r.id === found.id ? { ...r, returned: true, returnedAt: new Date().toISOString(), returnedItems: items, returnNotes: notes } : r
    );
    saveRecords(updated);
    setStep(2);
  };

  const toggle = (k) => setItems((i) => ({ ...i, [k]: !i[k] }));

  const CheckRow = ({ label, itemKey, icon }) => (
    <div onClick={() => toggle(itemKey)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", borderRadius: 10, cursor: "pointer", border: `1.5px solid ${items[itemKey] ? C.accent : C.border}`, background: items[itemKey] ? C.accentBg : C.card, transition: "all 0.2s", marginBottom: 10 }}>
      <div style={{ width: 26, height: 26, borderRadius: 6, border: `2px solid ${items[itemKey] ? C.accent : C.faint}`, background: items[itemKey] ? C.accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#03100e", flexShrink: 0, fontWeight: 700, transition: "all 0.2s" }}>
        {items[itemKey] ? "✓" : ""}
      </div>
      <div style={{ fontSize: 14, color: C.text, fontFamily: "Sora, sans-serif", fontWeight: 500 }}>{icon} {label}</div>
    </div>
  );

  return (
    <Screen title="Device Check-In" onBack={onBack}>
      <Progress step={step} labels={["Scan", "Checklist", "Done"]} />

      {step === 0 && (
        <div style={cardStyle}>
          <SectionTitle>Scan or Enter Device Serial Number</SectionTitle>
          <BarcodeScanner onScanned={lookup} />
          {notFound && (
            <div style={{ marginTop: 14, padding: "12px 16px", background: C.errBg, border: `1px solid rgba(255,85,104,0.25)`, borderRadius: 9, color: C.err, fontSize: 13, fontFamily: "Sora, sans-serif" }}>
              No active checkout found for serial <strong style={{ fontFamily: "JetBrains Mono, monospace" }}>{notFound}</strong>. Please verify and try again.
            </div>
          )}
        </div>
      )}

      {step === 1 && found && (
        <div>
          <div style={{ ...cardStyle, marginBottom: 14 }}>
            <SectionTitle>Checkout Record</SectionTitle>
            <RecordSummary rec={found} compact />
          </div>
          <div style={cardStyle}>
            <SectionTitle>Return Checklist</SectionTitle>
            <div style={{ color: C.muted, fontSize: 13, fontFamily: "Sora, sans-serif", marginBottom: 16 }}>Select each item the patient returned:</div>
            <CheckRow label="HST Recording Device" itemKey="device" icon="📟" />
            <CheckRow label="Device Charger" itemKey="charger" icon="🔌" />
            <CheckRow label="Finger Pulse Oximeter / Sensor" itemKey="sensor" icon="🩺" />
            <Field label="Notes (optional)">
              <textarea
                style={{ ...inputStyle, resize: "vertical", minHeight: 72, lineHeight: 1.6 }}
                placeholder="Device condition, missing items, patient comments…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </Field>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
              <button onClick={() => { setStep(0); setFound(null); setNotFound(null); }} style={ghostBtn}>← Back</button>
              <button onClick={confirmReturn} style={primaryBtn}>Confirm Return ✓</button>
            </div>
          </div>
        </div>
      )}

      {step === 2 && found && (
        <div>
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <SuccessIcon />
            <div style={{ color: C.accent, fontSize: 20, fontWeight: 700, fontFamily: "Sora, sans-serif", marginBottom: 6 }}>Return Recorded</div>
            <div style={{ color: C.muted, fontSize: 14, fontFamily: "Sora, sans-serif" }}>
              Device <span style={{ fontFamily: "JetBrains Mono, monospace", color: C.text }}>{found.deviceSerial}</span> checked in for <strong style={{ color: C.text }}>{found.patientName}</strong>
            </div>
          </div>
          <div style={cardStyle}>
            <SectionTitle>Items Returned</SectionTitle>
            {[["device", "HST Recording Device"], ["charger", "Device Charger"], ["sensor", "Finger Pulse Oximeter / Sensor"]].map(([k, label]) => (
              <div key={k} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: `1px solid ${C.faint}` }}>
                <span style={{ color: items[k] ? C.ok : C.err, fontSize: 18, width: 24, textAlign: "center" }}>{items[k] ? "✓" : "✗"}</span>
                <span style={{ fontSize: 14, color: items[k] ? C.text : C.err, fontFamily: "Sora, sans-serif" }}>{label}</span>
                {!items[k] && <span style={{ marginLeft: "auto", fontSize: 11, background: C.errBg, color: C.err, padding: "3px 8px", borderRadius: 6, fontFamily: "Sora, sans-serif", fontWeight: 600 }}>NOT RETURNED</span>}
              </div>
            ))}
            {notes && (
              <div style={{ marginTop: 14, padding: "10px 14px", background: C.card, borderRadius: 8, fontSize: 13, color: C.text, fontFamily: "Sora, sans-serif", lineHeight: 1.6 }}>
                <span style={{ color: C.muted, display: "block", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Notes</span>
                {notes}
              </div>
            )}
          </div>
          <div style={{ textAlign: "center", marginTop: 24 }}>
            <button onClick={onBack} style={primaryBtn}>← Back to Home</button>
          </div>
        </div>
      )}
    </Screen>
  );
}

// ── RECORD DETAIL MODAL ───────────────────────────────────────
function RecordDetail({ rec, onClose, onSave }) {
  const isOd = !rec.returned && rec.dropoffDate && new Date(rec.dropoffDate + "T23:59:59") < new Date();
  const statusColor = rec.returned ? C.muted : isOd ? C.err : C.accent;
  const statusBg = rec.returned ? C.faint : isOd ? C.errBg : C.accentBg;
  const statusLabel = rec.returned ? "Returned" : isOd ? "Overdue" : "Out";

  const [items, setItems] = useState(rec.returnedItems || { device: false, charger: false, sensor: false });
  const [saved, setSaved] = useState(false);

  const ITEM_LABELS = [["device", "HST Recording Device"], ["charger", "Device Charger"], ["sensor", "Finger Pulse Oximeter / Sensor"]];
  const dirty = rec.returned && ITEM_LABELS.some(([k]) => items[k] !== (rec.returnedItems?.[k] ?? false));

  const toggle = (k) => {
    if (!rec.returned) return;
    setItems((prev) => ({ ...prev, [k]: !prev[k] }));
    setSaved(false);
  };

  const handleSave = () => {
    onSave({ ...rec, returnedItems: items });
    setSaved(true);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(2,10,20,0.82)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}
      onClick={onClose}>
      <div style={{ background: C.surface, border: `1px solid ${C.borderHi}`, borderRadius: 18, padding: 28, maxWidth: 560, width: "100%", maxHeight: "90vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.text, fontFamily: "Sora, sans-serif", marginBottom: 4 }}>{rec.patientName}</div>
            <div style={{ fontSize: 12, color: C.muted, fontFamily: "Sora, sans-serif" }}>ID: <span style={{ fontFamily: "JetBrains Mono, monospace", color: C.text }}>{rec.id}</span></div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "Sora, sans-serif", letterSpacing: "0.08em", textTransform: "uppercase", padding: "4px 10px", borderRadius: 7, background: statusBg, color: statusColor }}>{statusLabel}</span>
            <button onClick={() => printLabel(rec)} style={{ ...ghostBtn, marginTop: 0, padding: "5px 12px", color: C.blue, borderColor: "rgba(91,143,255,0.3)" }}>🖨 Print</button>
            <button onClick={onClose} style={{ ...ghostBtn, marginTop: 0, padding: "5px 10px" }}>✕</button>
          </div>
        </div>

        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.accent, letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: "Sora, sans-serif", marginBottom: 14 }}>Patient & Device</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {[["Patient", rec.patientName], ["Date of Birth", fmtDate(rec.dob)], ["Device Serial", rec.deviceSerial], ["Charger #", rec.chargerNumber]].map(([l, v]) => (
              <div key={l}>
                <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 5, fontFamily: "Sora, sans-serif" }}>{l}</div>
                <div style={{ fontSize: 13, color: C.text, fontFamily: l.includes("Serial") || l.includes("#") ? "JetBrains Mono, monospace" : "Sora, sans-serif", fontWeight: l === "Patient" ? 600 : 400 }}>{v}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.accent, letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: "Sora, sans-serif", marginBottom: 14 }}>Dates</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
            {[["Pick-Up", rec.pickupDate], ["Drop-Off", rec.dropoffDate], ["Follow-Up", rec.followupDate]].map(([l, v]) => (
              <div key={l}>
                <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 5, fontFamily: "Sora, sans-serif" }}>{l}</div>
                <div style={{ fontSize: 13, color: (!rec.returned && l === "Drop-Off" && isOd) ? C.err : C.text, fontFamily: "Sora, sans-serif" }}>{fmtDate(v)}</div>
              </div>
            ))}
          </div>
        </div>

        {rec.returned && (
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 20, marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.accent, letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: "Sora, sans-serif" }}>Return Details</div>
              <div style={{ fontSize: 10, color: C.muted, fontFamily: "Sora, sans-serif", fontStyle: "italic" }}>Click items to update</div>
            </div>
            <div style={{ fontSize: 12, color: C.muted, fontFamily: "Sora, sans-serif", marginBottom: 12 }}>
              Returned on {new Date(rec.returnedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </div>
            {ITEM_LABELS.map(([k, label]) => (
              <div key={k} onClick={() => toggle(k)}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 12px", borderRadius: 8, marginBottom: 6, cursor: "pointer", border: `1.5px solid ${items[k] ? C.borderHi : "rgba(255,85,104,0.2)"}`, background: items[k] ? C.accentBg : C.errBg, transition: "all 0.18s" }}>
                <div style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${items[k] ? C.accent : C.err}`, background: items[k] ? C.accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#03100e", flexShrink: 0, fontWeight: 700, transition: "all 0.18s" }}>
                  {items[k] ? "✓" : ""}
                </div>
                <span style={{ fontSize: 13, color: items[k] ? C.text : C.err, fontFamily: "Sora, sans-serif", flex: 1 }}>{label}</span>
                {!items[k] && <span style={{ fontSize: 10, background: "rgba(255,85,104,0.15)", color: C.err, padding: "2px 7px", borderRadius: 5, fontFamily: "Sora, sans-serif", fontWeight: 700, flexShrink: 0 }}>NOT RETURNED</span>}
                {items[k] && !rec.returnedItems?.[k] && <span style={{ fontSize: 10, background: C.accentBg, color: C.accent, padding: "2px 7px", borderRadius: 5, fontFamily: "Sora, sans-serif", fontWeight: 700, flexShrink: 0 }}>UPDATED</span>}
              </div>
            ))}
            {(dirty || saved) && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
                {dirty && <button onClick={handleSave} style={primaryBtn}>Save Changes ✓</button>}
                {saved && !dirty && <div style={{ fontSize: 13, color: C.ok, fontFamily: "Sora, sans-serif", fontWeight: 600 }}>✓ Changes saved</div>}
              </div>
            )}
            {rec.returnNotes && (
              <div style={{ marginTop: 12, padding: "10px 14px", background: C.card, borderRadius: 8, fontSize: 13, color: C.text, fontFamily: "Sora, sans-serif", lineHeight: 1.6 }}>
                <span style={{ color: C.muted, display: "block", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Notes</span>
                {rec.returnNotes}
              </div>
            )}
          </div>
        )}

        {rec.signature && (
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.accent, letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: "Sora, sans-serif", marginBottom: 12 }}>Signature on file</div>
            <div style={{ background: C.card, borderRadius: 8, border: `1px solid ${C.border}`, overflow: "hidden" }}>
              <img src={rec.signature} style={{ display: "block", width: "100%", maxHeight: 100, objectFit: "contain" }} alt="Patient signature" />
            </div>
            <div style={{ fontSize: 11, color: C.muted, fontFamily: "Sora, sans-serif", marginTop: 6 }}>
              Signed {new Date(rec.signedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── RECORDS VIEW ──────────────────────────────────────────────
function RecordsView({ records, saveRecords }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);

  const handleSave = (updated) => {
    saveRecords(records.map((r) => r.id === updated.id ? updated : r));
    setSelected(updated);
  };

  const filtered = records
    .filter((r) => {
      if (filter === "active") return !r.returned;
      if (filter === "returned") return r.returned;
      if (filter === "overdue") return !r.returned && r.dropoffDate && new Date(r.dropoffDate + "T23:59:59") < new Date();
      return true;
    })
    .filter((r) => {
      const q = search.toLowerCase();
      return !q || r.patientName.toLowerCase().includes(q) || r.deviceSerial.toLowerCase().includes(q) || r.chargerNumber.toLowerCase().includes(q);
    })
    .sort((a, b) => new Date(b.signedAt) - new Date(a.signedAt));

  const StatusBadge = ({ rec }) => {
    const isOd = !rec.returned && rec.dropoffDate && new Date(rec.dropoffDate + "T23:59:59") < new Date();
    const color = rec.returned ? C.muted : isOd ? C.err : C.accent;
    const bg = rec.returned ? C.faint : isOd ? C.errBg : C.accentBg;
    const label = rec.returned ? "Returned" : isOd ? "Overdue" : "Out";
    return <span style={{ fontSize: 10, fontWeight: 700, fontFamily: "Sora, sans-serif", letterSpacing: "0.06em", textTransform: "uppercase", padding: "3px 9px", borderRadius: 6, background: bg, color }}>{label}</span>;
  };

  const DOT_LABELS = { device: "HST Device", charger: "Charger", sensor: "Finger Sensor" };
  const ItemDots = ({ rec }) => {
    const [tip, setTip] = useState(null);
    if (!rec.returned) return <span style={{ fontSize: 12, color: C.muted, fontFamily: "Sora, sans-serif" }}>—</span>;
    return (
      <div style={{ display: "flex", gap: 5, position: "relative" }}>
        {Object.entries(DOT_LABELS).map(([k, label]) => (
          <div key={k} style={{ position: "relative" }}
            onMouseEnter={() => setTip(k)} onMouseLeave={() => setTip(null)}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: rec.returnedItems?.[k] ? C.ok : C.err, cursor: "default" }} />
            {tip === k && (
              <div style={{ position: "absolute", bottom: 14, left: "50%", transform: "translateX(-50%)", background: C.card, border: `1px solid ${C.borderHi}`, borderRadius: 6, padding: "4px 9px", whiteSpace: "nowrap", fontSize: 11, fontFamily: "Sora, sans-serif", color: rec.returnedItems?.[k] ? C.ok : C.err, fontWeight: 600, pointerEvents: "none", zIndex: 10, letterSpacing: "0.02em" }}>
                {rec.returnedItems?.[k] ? "✓" : "✗"} {label}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        <input
          style={{ ...inputStyle, flex: 1, minWidth: 180 }}
          placeholder="Search by patient name or serial #…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div style={{ display: "flex", gap: 6 }}>
          {[["all", "All"], ["active", "Active"], ["overdue", "Overdue"], ["returned", "Returned"]].map(([val, label]) => (
            <button key={val} onClick={() => setFilter(val)}
              style={{ fontFamily: "Sora, sans-serif", fontSize: 12, fontWeight: 600, padding: "8px 14px", borderRadius: 8, cursor: "pointer", border: `1.5px solid ${filter === val ? C.accent : C.border}`, background: filter === val ? C.accentBg : "transparent", color: filter === val ? C.accent : C.muted, transition: "all 0.15s" }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 20px", color: C.muted, fontFamily: "Sora, sans-serif", fontSize: 14 }}>
          {records.length === 0 ? "No records yet — check out a device to get started." : "No records match your search."}
        </div>
      ) : (
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1.4fr 1.1fr 1.1fr 80px 60px", gap: "0 8px", padding: "10px 16px", background: C.card, borderBottom: `1px solid ${C.border}` }}>
            {["Patient", "Serial #", "Drop-Off", "Follow-Up", "Status", "Items"].map((h) => (
              <div key={h} style={{ fontSize: 10, color: C.muted, fontFamily: "Sora, sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>{h}</div>
            ))}
          </div>
          {filtered.map((r, i) => (
            <div key={r.id} onClick={() => setSelected(r)}
              style={{ display: "grid", gridTemplateColumns: "2fr 1.4fr 1.1fr 1.1fr 80px 60px", gap: "0 8px", padding: "13px 16px", borderBottom: i < filtered.length - 1 ? `1px solid ${C.faint}` : "none", cursor: "pointer", background: C.surface, transition: "background 0.15s" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = C.card)}
              onMouseLeave={(e) => (e.currentTarget.style.background = C.surface)}>
              <div style={{ fontSize: 13, color: C.text, fontFamily: "Sora, sans-serif", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.patientName}</div>
              <div style={{ fontSize: 12, color: C.text, fontFamily: "JetBrains Mono, monospace" }}>{r.deviceSerial}</div>
              <div style={{ fontSize: 12, color: C.text, fontFamily: "Sora, sans-serif" }}>{fmtDate(r.dropoffDate)}</div>
              <div style={{ fontSize: 12, color: C.text, fontFamily: "Sora, sans-serif" }}>{fmtDate(r.followupDate)}</div>
              <div><StatusBadge rec={r} /></div>
              <div style={{ display: "flex", alignItems: "center" }}><ItemDots rec={r} /></div>
            </div>
          ))}
        </div>
      )}
      <div style={{ fontSize: 12, color: C.muted, fontFamily: "Sora, sans-serif", marginTop: 12, textAlign: "right" }}>
        {filtered.length} record{filtered.length !== 1 ? "s" : ""}
        {filtered.length !== records.length ? ` of ${records.length} total` : ""}
      </div>
      {selected && <RecordDetail rec={selected} onClose={() => setSelected(null)} onSave={handleSave} />}
    </div>
  );
}

// ── HOME SCREEN ───────────────────────────────────────────────
function HomeScreen({ onSelect, records, saveRecords }) {
  const [tab, setTab] = useState("home");
  const active = records.filter((r) => !r.returned);
  const overdue = active.filter((r) => r.dropoffDate && new Date(r.dropoffDate + "T23:59:59") < new Date());

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "36px 20px" }}>
      <div style={{ marginBottom: 32, textAlign: "center" }}>
        <div style={{ fontSize: 10, letterSpacing: "0.35em", textTransform: "uppercase", color: C.accent, fontFamily: "Sora, sans-serif", marginBottom: 12 }}>
          Sleep Medicine · HST Workflow
        </div>
        <h1 style={{ fontSize: 30, fontWeight: 700, color: C.text, fontFamily: "Sora, sans-serif", margin: "0 0 8px", lineHeight: 1.18 }}>
          Device Check-Out System
        </h1>
        <p style={{ color: C.muted, fontSize: 14, fontFamily: "Sora, sans-serif", margin: 0 }}>
          Home sleep test device loans, acknowledgments & returns
        </p>
      </div>

      <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 28 }}>
        {[
          ["Active Loans", active.length, C.accent],
          ["Overdue", overdue.length, overdue.length ? C.err : C.muted],
          ["Total Records", records.length, C.blue],
        ].map(([label, val, color]) => (
          <div key={label} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 22px", textAlign: "center", minWidth: 110 }}>
            <div style={{ fontSize: 26, fontWeight: 700, color, fontFamily: "Sora, sans-serif" }}>{val}</div>
            <div style={{ fontSize: 10, color: C.muted, fontFamily: "Sora, sans-serif", letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 4 }}>{label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", borderBottom: `1px solid ${C.border}`, marginBottom: 28, gap: 4 }}>
        {[["home", "Dashboard"], ["records", "All Records"]].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            style={{ fontFamily: "Sora, sans-serif", fontSize: 13, fontWeight: tab === key ? 700 : 400, color: tab === key ? C.accent : C.muted, background: "none", border: "none", borderBottom: `2px solid ${tab === key ? C.accent : "transparent"}`, padding: "10px 18px", cursor: "pointer", marginBottom: -1, transition: "all 0.15s" }}>
            {label}
            {key === "records" && records.length > 0 && <span style={{ marginLeft: 6, fontSize: 10, background: C.accentBg, color: C.accent, padding: "2px 7px", borderRadius: 10, fontWeight: 700 }}>{records.length}</span>}
          </button>
        ))}
      </div>

      {tab === "home" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 32 }}>
            {[
              { key: "checkout", icon: "📋", label: "Check Out Device", desc: "Issue device, collect signature & assign serial number", color: C.accent },
              { key: "checkin", icon: "📬", label: "Check In Device", desc: "Process return, scan barcode & verify equipment", color: C.blue },
            ].map(({ key, icon, label, desc, color }) => (
              <div key={key} onClick={() => onSelect(key)}
                style={{ background: C.surface, border: `1.5px solid ${C.border}`, borderRadius: 16, padding: "24px 20px", cursor: "pointer", transition: "all 0.18s" }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = color; e.currentTarget.style.background = C.card; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.surface; }}
              >
                <div style={{ fontSize: 28, marginBottom: 12 }}>{icon}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.text, fontFamily: "Sora, sans-serif", marginBottom: 6 }}>{label}</div>
                <div style={{ fontSize: 13, color: C.muted, fontFamily: "Sora, sans-serif", lineHeight: 1.6 }}>{desc}</div>
              </div>
            ))}
          </div>

          {active.length > 0 && (
            <div style={{ ...cardStyle }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <SectionTitle>Active Loans</SectionTitle>
                <button onClick={() => setTab("records")} style={{ ...ghostBtn, marginTop: 0, fontSize: 11 }}>View all →</button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 1.2fr 1.2fr auto", gap: "0 10px" }}>
                {["Patient", "Serial #", "Drop-Off", "Follow-Up", "Status"].map((h) => (
                  <div key={h} style={{ fontSize: 10, color: C.muted, fontFamily: "Sora, sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", paddingBottom: 10, borderBottom: `1px solid ${C.faint}` }}>{h}</div>
                ))}
                {active.map((r) => {
                  const od = r.dropoffDate && new Date(r.dropoffDate + "T23:59:59") < new Date();
                  return [
                    <div key={r.id + "n"} style={{ fontSize: 13, color: C.text, fontFamily: "Sora, sans-serif", fontWeight: 600, paddingTop: 12, paddingBottom: 12, borderBottom: `1px solid ${C.faint}` }}>{r.patientName}</div>,
                    <div key={r.id + "s"} style={{ fontSize: 12, color: C.text, fontFamily: "JetBrains Mono, monospace", paddingTop: 12, paddingBottom: 12, borderBottom: `1px solid ${C.faint}` }}>{r.deviceSerial}</div>,
                    <div key={r.id + "d"} style={{ fontSize: 12, color: od ? C.err : C.text, fontFamily: "Sora, sans-serif", paddingTop: 12, paddingBottom: 12, borderBottom: `1px solid ${C.faint}` }}>{fmtDate(r.dropoffDate)}</div>,
                    <div key={r.id + "f"} style={{ fontSize: 12, color: C.text, fontFamily: "Sora, sans-serif", paddingTop: 12, paddingBottom: 12, borderBottom: `1px solid ${C.faint}` }}>{fmtDate(r.followupDate)}</div>,
                    <div key={r.id + "st"} style={{ paddingTop: 12, paddingBottom: 12, borderBottom: `1px solid ${C.faint}` }}>
                      <span style={{ fontSize: 10, fontWeight: 700, fontFamily: "Sora, sans-serif", letterSpacing: "0.06em", textTransform: "uppercase", padding: "3px 9px", borderRadius: 6, background: od ? C.errBg : C.accentBg, color: od ? C.err : C.accent }}>
                        {od ? "Overdue" : "Out"}
                      </span>
                    </div>,
                  ];
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "records" && <RecordsView records={records} saveRecords={saveRecords} />}
    </div>
  );
}

// ── APP ROOT ──────────────────────────────────────────────────
export default function App() {
  const [mode, setMode] = useState(null);
  const [records, setRecords] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
      *, *::before, *::after { box-sizing: border-box; }
      body { background: #04101e !important; margin: 0; }
      input:focus, textarea:focus { border-color: rgba(45,200,185,0.5) !important; box-shadow: 0 0 0 3px rgba(45,200,185,0.08); }
      input[type=date]::-webkit-calendar-picker-indicator { filter: invert(0.5) brightness(1.5); cursor: pointer; }
      textarea { font-family: Sora, sans-serif; }
    `;
    document.head.appendChild(style);
    (async () => {
      try { const r = await window.storage.get("hst:records"); if (r) setRecords(JSON.parse(r.value)); } catch {}
      setLoaded(true);
    })();
  }, []);

  const saveRecords = async (recs) => {
    setRecords(recs);
    try { await window.storage.set("hst:records", JSON.stringify(recs)); } catch {}
  };

  if (!loaded) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: C.bg, color: C.muted, fontFamily: "Sora, sans-serif", fontSize: 14 }}>
      Loading…
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: C.bg }}>
      {!mode && <HomeScreen onSelect={setMode} records={records} saveRecords={saveRecords} />}
      {mode === "checkout" && <CheckOutFlow records={records} saveRecords={saveRecords} onBack={() => setMode(null)} />}
      {mode === "checkin" && <CheckInFlow records={records} saveRecords={saveRecords} onBack={() => setMode(null)} />}
    </div>
  );
}
