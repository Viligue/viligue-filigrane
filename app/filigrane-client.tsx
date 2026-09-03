"use client";

import {
  Check,
  Download,
  FileText,
  FileUp,
  LockKeyhole,
  RotateCcw,
  ShieldCheck,
  WifiOff,
} from "lucide-react";
import { PDFDocument } from "pdf-lib";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import pdfWorkerSource from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?raw";
import { ChangeEvent, DragEvent, useCallback, useEffect, useRef, useState } from "react";

type Phase = "empty" | "ready" | "processing" | "done" | "error";

type GeneratedFile = {
  blob: Blob;
  downloadName: string;
  previewUrl: string;
  outputLabel: string;
};

const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_FILE_BYTES = 80 * 1024 * 1024;
const MAX_IMAGE_EDGE = 4600;
const MAX_IMAGE_PIXELS = 14_000_000;

const WATERMARK_COLORS = [
  "rgba(194, 24, 91, 0.34)",
  "rgba(21, 101, 192, 0.34)",
  "rgba(106, 27, 154, 0.32)",
  "rgba(0, 105, 92, 0.32)",
];

const VILIGUE_HEADS = [
  "head-00-ok.webp",
  "head-01-loul.webp",
  "head-02-gene.webp",
  "head-03-serieux.webp",
  "head-04-choque.webp",
  "head-05-deconcerte.webp",
  "head-06-chockbar.webp",
  "head-07-rigole.webp",
  "head-08-rage.webp",
  "head-09-nerd.webp",
  "head-10-uniforme.webp",
];

function formatBytes(size: number) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} Ko`;
  return `${(size / (1024 * 1024)).toFixed(size < 10 * 1024 * 1024 ? 1 : 0)} Mo`;
}

function safeBaseName(name: string) {
  const withoutExtension = name.replace(/\.[^.]+$/, "");
  return (
    withoutExtension
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 90) || "document"
  );
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Le navigateur n’a pas pu créer le fichier."))),
      type,
      quality,
    );
  });
}

let localPdfWorkerUrl = "";

function pdfWorkerUrl() {
  if (!localPdfWorkerUrl) {
    localPdfWorkerUrl = URL.createObjectURL(
      new Blob([pdfWorkerSource], { type: "text/javascript" }),
    );
  }
  return localPdfWorkerUrl;
}

function drawCurvedWatermark(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  rawText: string,
) {
  const text = `${rawText.trim().replace(/\s+/g, " ")}   •   `;
  const shortSide = Math.min(width, height);
  const fontSize = Math.max(19, Math.min(56, shortSide / 31));
  const amplitude = fontSize * 0.92;
  const wavelength = fontSize * 13.4;
  const rowGap = fontSize * 4.65;
  const span = Math.hypot(width, height) * 1.55;
  const letterSpacing = fontSize * 0.035;

  context.save();
  context.translate(width / 2, height / 2);
  context.rotate((-29 * Math.PI) / 180);
  context.font = `700 ${fontSize}px Arial, Helvetica, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.lineJoin = "round";
  context.lineWidth = Math.max(0.8, fontSize * 0.035);
  context.strokeStyle = "rgba(255, 255, 255, 0.22)";

  const phraseWidth = Array.from(text).reduce(
    (total, character) => total + context.measureText(character).width + letterSpacing,
    0,
  );
  const phraseGap = fontSize * 1.45;
  let row = 0;

  for (let baseline = -span / 2; baseline <= span / 2; baseline += rowGap) {
    const phase = row * 0.82;
    const stagger = row % 2 === 0 ? 0 : (phraseWidth + phraseGap) / 2;
    let phrase = 0;

    for (
      let start = -span / 2 - stagger;
      start <= span / 2 + phraseWidth;
      start += phraseWidth + phraseGap
    ) {
      let cursor = start;
      let characterIndex = 0;

      for (const character of text) {
        const glyphWidth = context.measureText(character).width + letterSpacing;
        const centerX = cursor + glyphWidth / 2;
        const wave = (centerX / wavelength) * Math.PI * 2 + phase;
        const centerY = baseline + Math.sin(wave) * amplitude;
        const slope = (amplitude * Math.PI * 2 * Math.cos(wave)) / wavelength;
        const angle = Math.atan(slope);

        context.save();
        context.translate(centerX, centerY);
        context.rotate(angle);
        context.fillStyle =
          WATERMARK_COLORS[(row + phrase + Math.floor(characterIndex / 4)) % WATERMARK_COLORS.length];
        context.strokeText(character, 0, 0);
        context.fillText(character, 0, 0);
        context.restore();

        cursor += glyphWidth;
        characterIndex += 1;
      }

      phrase += 1;
    }

    row += 1;
  }

  context.restore();
}

async function loadImage(file: File) {
  if ("createImageBitmap" in window) {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return {
        source: bitmap as CanvasImageSource,
        width: bitmap.width,
        height: bitmap.height,
        close: () => bitmap.close(),
      };
    } catch {
      // Les anciens Safari peuvent exposer createImageBitmap sans gérer ses options.
    }
  }

  const url = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = "async";
  image.src = url;
  await image.decode();

  return {
    source: image as CanvasImageSource,
    width: image.naturalWidth,
    height: image.naturalHeight,
    close: () => URL.revokeObjectURL(url),
  };
}

async function watermarkImage(file: File, text: string): Promise<GeneratedFile> {
  const image = await loadImage(file);

  try {
    const edgeScale = Math.min(1, MAX_IMAGE_EDGE / Math.max(image.width, image.height));
    const pixelScale = Math.min(1, Math.sqrt(MAX_IMAGE_PIXELS / (image.width * image.height)));
    const scale = Math.min(edgeScale, pixelScale);
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Le navigateur ne permet pas de traiter cette image.");

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image.source, 0, 0, width, height);
    drawCurvedWatermark(context, width, height, text);

    const usePng = file.type === "image/png";
    const outputType = usePng ? "image/png" : "image/jpeg";
    const extension = usePng ? "png" : "jpg";
    const blob = await canvasToBlob(canvas, outputType, usePng ? undefined : 0.94);
    canvas.width = 1;
    canvas.height = 1;

    return {
      blob,
      downloadName: `${safeBaseName(file.name)}-filigrane.${extension}`,
      previewUrl: URL.createObjectURL(blob),
      outputLabel: usePng ? "Image PNG aplatie" : "Image JPEG aplatie",
    };
  } finally {
    image.close();
  }
}

async function watermarkPdf(
  file: File,
  text: string,
  onProgress: (value: number, label: string) => void,
): Promise<GeneratedFile> {
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl();
  const sourceBytes = new Uint8Array(await file.arrayBuffer());
  const sourcePdf = await pdfjs.getDocument({ data: sourceBytes }).promise;
  const outputPdf = await PDFDocument.create();
  outputPdf.setTitle("");
  outputPdf.setAuthor("");
  outputPdf.setSubject("");
  outputPdf.setKeywords([]);
  outputPdf.setProducer("Viligue Filigrane — traitement local");
  outputPdf.setCreator("Viligue Filigrane");

  let previewUrl = "";

  try {
    for (let pageNumber = 1; pageNumber <= sourcePdf.numPages; pageNumber += 1) {
      onProgress(
        Math.round(((pageNumber - 1) / sourcePdf.numPages) * 88) + 5,
        `Incrustation de la page ${pageNumber} sur ${sourcePdf.numPages}`,
      );

      const page = await sourcePdf.getPage(pageNumber);
      const baseViewport = page.getViewport({ scale: 1 });
      const targetEdge = 2300;
      const renderScale = Math.max(
        1,
        Math.min(3.2, targetEdge / Math.max(baseViewport.width, baseViewport.height)),
      );
      const viewport = page.getViewport({ scale: renderScale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.floor(viewport.width));
      canvas.height = Math.max(1, Math.floor(viewport.height));
      const context = canvas.getContext("2d", { alpha: false });

      if (!context) throw new Error("Le navigateur ne permet pas de traiter ce PDF.");

      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, canvasContext: context, viewport }).promise;
      drawCurvedWatermark(context, canvas.width, canvas.height, text);

      const pageBlob = await canvasToBlob(canvas, "image/jpeg", 0.94);
      if (pageNumber === 1) previewUrl = URL.createObjectURL(pageBlob);

      const embeddedPage = await outputPdf.embedJpg(await pageBlob.arrayBuffer());
      const outputPage = outputPdf.addPage([baseViewport.width, baseViewport.height]);
      outputPage.drawImage(embeddedPage, {
        x: 0,
        y: 0,
        width: baseViewport.width,
        height: baseViewport.height,
      });

      page.cleanup();
      canvas.width = 1;
      canvas.height = 1;

      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    }

    onProgress(96, "Création du nouveau PDF aplati");
    const bytes = await outputPdf.save({ addDefaultPage: false, useObjectStreams: true });
    const safeBytes = new Uint8Array(bytes.byteLength);
    safeBytes.set(bytes);
    const blob = new Blob([safeBytes.buffer], { type: "application/pdf" });

    return {
      blob,
      downloadName: `${safeBaseName(file.name)}-filigrane.pdf`,
      previewUrl,
      outputLabel: `PDF aplati · ${sourcePdf.numPages} page${sourcePdf.numPages > 1 ? "s" : ""}`,
    };
  } catch (error) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    throw error;
  } finally {
    await sourcePdf.destroy();
  }
}

function validateFile(file: File) {
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf && !ACCEPTED_IMAGE_TYPES.has(file.type)) {
    return "Choisissez un PDF ou une image JPEG, PNG ou WebP.";
  }
  if (file.size > MAX_FILE_BYTES) return "Ce fichier dépasse la limite de 80 Mo.";
  if (file.size === 0) return "Ce fichier est vide.";
  return null;
}

export default function FiligraneClient() {
  const inputRef = useRef<HTMLInputElement>(null);
  const generatedRef = useRef<GeneratedFile | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [watermark, setWatermark] = useState("");
  const [phase, setPhase] = useState<Phase>("empty");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [generated, setGenerated] = useState<GeneratedFile | null>(null);
  const [dragging, setDragging] = useState(false);
  const [headIndex, setHeadIndex] = useState(0);

  const forgetGenerated = useCallback(() => {
    if (generatedRef.current?.previewUrl) URL.revokeObjectURL(generatedRef.current.previewUrl);
    generatedRef.current = null;
    setGenerated(null);
  }, []);

  const reset = useCallback(() => {
    forgetGenerated();
    setFile(null);
    setWatermark("");
    setPhase("empty");
    setError("");
    setProgress(0);
    setProgressLabel("");
    if (inputRef.current) inputRef.current.value = "";
  }, [forgetGenerated]);

  useEffect(() => {
    const discard = () => {
      if (generatedRef.current?.previewUrl) URL.revokeObjectURL(generatedRef.current.previewUrl);
      generatedRef.current = null;
      if (inputRef.current) inputRef.current.value = "";
    };
    const restoreGuard = (event: PageTransitionEvent) => {
      if (event.persisted) window.location.reload();
    };

    window.addEventListener("pagehide", discard);
    window.addEventListener("pageshow", restoreGuard);
    return () => {
      discard();
      if (localPdfWorkerUrl) {
        URL.revokeObjectURL(localPdfWorkerUrl);
        localPdfWorkerUrl = "";
      }
      window.removeEventListener("pagehide", discard);
      window.removeEventListener("pageshow", restoreGuard);
    };
  }, []);

  useEffect(() => {
    for (const filename of VILIGUE_HEADS.slice(1)) {
      const image = new Image();
      image.src = `/filigrane/heads/${filename}`;
    }
  }, []);

  const showNextHead = () => {
    setHeadIndex((current) => (current + 1) % VILIGUE_HEADS.length);
  };

  const selectFile = (nextFile: File) => {
    const validationError = validateFile(nextFile);
    forgetGenerated();
    setError(validationError ?? "");
    setFile(validationError ? null : nextFile);
    setPhase(validationError ? "error" : "ready");
    setProgress(0);
  };

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0];
    if (nextFile) selectFile(nextFile);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const nextFile = event.dataTransfer.files?.[0];
    if (nextFile) selectFile(nextFile);
  };

  const generate = async () => {
    if (!file || !watermark.trim() || phase === "processing") return;

    forgetGenerated();
    setPhase("processing");
    setError("");
    setProgress(3);
    setProgressLabel("Préparation locale du document");

    try {
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      const result = isPdf
        ? await watermarkPdf(file, watermark, (value, label) => {
            setProgress(value);
            setProgressLabel(label);
          })
        : await watermarkImage(file, watermark);

      generatedRef.current = result;
      setGenerated(result);
      setProgress(100);
      setProgressLabel("Document prêt");
      setPhase("done");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Le traitement a échoué.";
      const friendlyMessage = /password|encrypted/i.test(message)
        ? "Ce PDF est protégé par un mot de passe et ne peut pas être traité."
        : "Impossible de traiter ce document. Vérifiez qu’il n’est pas chiffré ou endommagé.";
      setError(friendlyMessage);
      setPhase("error");
      setProgress(0);
    }
  };

  const download = () => {
    if (!generated) return;
    const url = URL.createObjectURL(generated.blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = generated.downloadName;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <main className="site-shell">
      <header className="site-header">
        <a
          className="brand"
          href="/"
          aria-label="Retour à Viligue"
          onMouseEnter={showNextHead}
          onFocus={showNextHead}
        >
          <span className="head-logo" aria-hidden="true">
            <img
              key={VILIGUE_HEADS[headIndex]}
              src={`/filigrane/heads/${VILIGUE_HEADS[headIndex]}`}
              width="56"
              height="56"
              alt=""
            />
          </span>
          <span className="brand-copy">
            <strong>Viligue</strong>
            <small>Filigrane</small>
          </span>
        </a>
        <div className="header-actions">
          <a
            className="github-link"
            href="https://github.com/Viligue/viligue-filigrane"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Voir le code source de Viligue Filigrane sur GitHub"
          >
            <img
              src="/filigrane/github-mark-white.svg"
              width="18"
              height="18"
              alt=""
              aria-hidden="true"
            />
            <span>GitHub</span>
          </a>
          <a className="plain-link" href="/">Retour au site</a>
          <div className="privacy-status" role="status">
            <span className="status-dot" aria-hidden="true" />
            Traitement 100 % local
          </div>
        </div>
      </header>

      <section className="intro" aria-labelledby="page-title">
        <div>
          <p className="eyebrow"><span className="eyebrow-line" aria-hidden="true" /><LockKeyhole size={14} /> Protection de documents</p>
          <h1 id="page-title">Marquez une copie.<br /><span>Gardez l’original privé.</span></h1>
        </div>
        <p className="intro-copy">
          Le document est filigrané directement sur cet appareil. Il n’est jamais envoyé à Viligue
          et disparaît de la page dès son rechargement.
        </p>
      </section>

      <section className="workspace" aria-label="Outil de filigrane">
        <div className="control-panel">
          <div className="step-heading">
            <span className="step-number">01</span>
            <div>
              <h2>Votre document</h2>
              <p>PDF, JPEG, PNG ou WebP · 80 Mo maximum</p>
            </div>
          </div>

          <div
            className={`drop-zone ${dragging ? "is-dragging" : ""} ${file ? "has-file" : ""}`}
            onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false);
            }}
            onDrop={onDrop}
          >
            <input
              ref={inputRef}
              id="document"
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp"
              onChange={onFileChange}
              tabIndex={-1}
            />
            {file ? (
              <>
                <div className="file-icon"><FileText size={26} /></div>
                <div className="file-copy">
                  <strong>{file.name}</strong>
                  <span>{formatBytes(file.size)} · conservé sur cet appareil</span>
                </div>
                <button className="replace-button" type="button" onClick={() => inputRef.current?.click()}>
                  Remplacer
                </button>
              </>
            ) : (
              <button className="drop-button" type="button" onClick={() => inputRef.current?.click()}>
                <span className="upload-icon"><FileUp size={27} /></span>
                <span>
                  <strong>Choisir un document</strong>
                  <small>ou le déposer ici</small>
                </span>
              </button>
            )}
          </div>

          <div className="step-heading second-step">
            <span className="step-number">02</span>
            <div>
              <h2>Texte à incruster</h2>
              <p>Les courbes, couleurs et répétitions sont automatiques</p>
            </div>
          </div>

          <label className="watermark-field" htmlFor="watermark-text">
            <span>Usage autorisé du document</span>
            <textarea
              id="watermark-text"
              value={watermark}
              maxLength={180}
              rows={3}
              autoComplete="off"
              spellCheck="true"
              onChange={(event) => setWatermark(event.target.value)}
              placeholder="Ex. : Uniquement pour mon dossier de location auprès de…"
              disabled={phase === "processing"}
            />
            <small>{watermark.length}/180</small>
          </label>

          {error && <div className="error-message" role="alert">{error}</div>}

          {phase === "processing" ? (
            <div className="progress-block" aria-live="polite">
              <div className="progress-copy"><span>{progressLabel}</span><strong>{progress} %</strong></div>
              <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
            </div>
          ) : (
            <button
              className="generate-button"
              type="button"
              onClick={generate}
              disabled={!file || !watermark.trim()}
            >
              <ShieldCheck size={20} />
              Incruster le filigrane
            </button>
          )}

          <div className="local-proof">
            <WifiOff size={19} />
            <p><strong>Aucun transfert réseau.</strong> Le traitement continue même si vous coupez Internet après le chargement de cette page.</p>
          </div>
        </div>

        <div className={`preview-panel ${generated ? "has-preview" : ""}`}>
          <div className="preview-header">
            <div>
              <span className="preview-label">APERÇU DU RÉSULTAT</span>
              {generated && <span className="preview-type"><Check size={14} /> {generated.outputLabel}</span>}
            </div>
            {generated && (
              <button className="reset-button" type="button" onClick={reset}>
                <RotateCcw size={15} /> Nouveau
              </button>
            )}
          </div>

          <div className="preview-stage">
            {generated ? (
              <img src={generated.previewUrl} alt="Première page du document avec le filigrane incrusté" />
            ) : (
              <div className="empty-preview">
                <div className="paper-stack" aria-hidden="true">
                  <span className="paper-back" />
                  <span className="paper-front">
                    <i>PRIVÉ</i><i>PRIVÉ</i><i>PRIVÉ</i>
                  </span>
                </div>
                <p>L’aperçu apparaîtra ici,<br />sans quitter votre appareil.</p>
              </div>
            )}
          </div>

          {generated && (
            <div className="download-block">
              <div>
                <strong>Le filigrane est fusionné aux pixels.</strong>
                <span>Aucun texte ni calque ne peut être sélectionné dans le résultat.</span>
              </div>
              <button className="download-button" type="button" onClick={download}>
                <Download size={19} /> Télécharger
              </button>
            </div>
          )}
        </div>
      </section>

      <aside className="notice" aria-label="À savoir">
        <strong>À savoir</strong>
        <p>Un filigrane limite la réutilisation frauduleuse d’une copie. Certains organismes peuvent toutefois exiger un document sans mention.</p>
      </aside>

      <footer className="site-footer">
        <span>VILIGUE FILIGRANE</span>
        <span className="footer-links">
          <a
            href="https://github.com/Viligue/viligue-filigrane"
            target="_blank"
            rel="noopener noreferrer"
          >
            Code source
          </a>
          <span aria-hidden="true">·</span>
          Sans compte · Sans cookie · Sans conservation
        </span>
      </footer>
    </main>
  );
}
