import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import {
  Download,
  FileDown,
  Image as ImageIcon,
  Loader2,
  PenLine,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import emptyState from "@/assets/empty-state.png";
import { streamImage } from "@/lib/stream-image";
import { downloadCardPdf, downloadCardPng, renderCard, type CardData } from "@/lib/card-render";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Heartfelt — Greeting Card Studio" },
      {
        name: "description",
        content:
          "Pick an occasion and style — the AI writes a personal message, paints matching artwork, and hands you a finished greeting card to download as PNG or PDF.",
      },
      { property: "og:title", content: "Heartfelt — Greeting Card Studio" },
      {
        property: "og:description",
        content:
          "AI-written messages and matching artwork for any occasion — download your finished card as PNG or PDF.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const OCCASIONS = [
  "Birthday",
  "Anniversary",
  "Wedding",
  "Thank You",
  "Congratulations",
  "Graduation",
  "Get Well Soon",
  "New Baby",
  "Housewarming",
  "Diwali",
  "Christmas",
  "New Year",
  "Eid Mubarak",
  "Valentine's Day",
  "Mother's Day",
  "Father's Day",
  "Just Because",
  "Something else…",
];

const STYLES = [
  "Elegant watercolor",
  "Whimsical illustration",
  "Vintage botanical",
  "Minimal modern",
  "Bold retro graphic",
  "Dreamy pastel",
];

const TONES = ["Heartfelt", "Playful", "Poetic", "Formal", "Uplifting"];

type Stage = "idle" | "writing" | "painting" | "done";

type FormState = {
  occasion: string;
  customOccasion: string;
  style: string;
  tone: string;
  recipient: string;
  sender: string;
  note: string;
};

type WrittenText = { headline: string; message: string; occasion: string };

function Index() {
  const [form, setForm] = useState<FormState>({
    occasion: "Birthday",
    customOccasion: "",
    style: STYLES[0],
    tone: TONES[0],
    recipient: "",
    sender: "",
    note: "",
  });
  const [stage, setStage] = useState<Stage>("idle");
  const [written, setWritten] = useState<WrittenText | null>(null);
  const [artwork, setArtwork] = useState<{ dataUrl: string; final: boolean } | null>(null);
  const [cardUrl, setCardUrl] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<null | "png" | "pdf">(null);
  const cardRef = useRef<CardData | null>(null);

  const isCustom = form.occasion === "Something else…";
  const occasionLabel = isCustom ? form.customOccasion.trim() : form.occasion;
  const working = stage === "writing" || stage === "painting";

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function generate() {
    if (working) return;
    if (!occasionLabel) {
      toast.error("Tell me the occasion for your card first.");
      return;
    }
    setWritten(null);
    setArtwork(null);
    setCardUrl(null);
    setStage("writing");
    try {
      const res = await fetch("/api/generate-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          occasion: occasionLabel,
          style: form.style,
          tone: form.tone,
          recipient: form.recipient.trim() || undefined,
          sender: form.sender.trim() || undefined,
          personalNote: form.note.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error ?? "The AI writer is unavailable right now. Please try again.");
      }
      const data = (await res.json()) as { headline: string; message: string; artPrompt: string };
      setWritten({ headline: data.headline, message: data.message, occasion: occasionLabel });

      // The artwork brief comes from the same context the message was written from.
      setStage("painting");
      const prompt = `${data.artPrompt}. Portrait greeting-card cover illustration, rich detail, harmonious composition. Absolutely no text, no letters, no words and no typography anywhere in the image.`;
      let finalUrl = "";
      await streamImage("/api/generate-image", { prompt }, (dataUrl, isFinal) => {
        setArtwork({ dataUrl, final: isFinal });
        if (isFinal) finalUrl = dataUrl;
      });

      const card: CardData = {
        occasion: occasionLabel,
        headline: data.headline,
        message: data.message,
        sender: form.sender.trim() || undefined,
        imageDataUrl: finalUrl,
      };
      cardRef.current = card;
      setCardUrl(await renderCard(card));
      setStage("done");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setStage("idle");
        return;
      }
      toast.error(error instanceof Error ? error.message : "Something went wrong. Please try again.");
      setStage("idle");
    }
  }

  async function download(kind: "png" | "pdf") {
    const card = cardRef.current;
    if (!card || downloading) return;
    setDownloading(kind);
    try {
      if (kind === "png") await downloadCardPng(card);
      else await downloadCardPdf(card);
    } catch {
      toast.error("Could not prepare the download. Please try again.");
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/70 bg-card/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="font-display text-lg font-bold leading-tight text-foreground">Heartfelt</p>
              <p className="text-xs text-muted-foreground">Greeting Card Studio</p>
            </div>
          </div>
          <span className="hidden rounded-full border border-border bg-secondary px-4 py-1.5 text-xs font-bold tracking-wide text-secondary-foreground sm:block">
            Personalized cards for every occasion
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-16">
        <section className="py-10 text-center sm:py-14">
          <p className="eyebrow">Generative AI · Made for you</p>
          <h1 className="mx-auto mt-3 max-w-2xl font-display text-4xl font-bold leading-tight text-foreground sm:text-5xl">
            A one-of-a-kind greeting card, written and illustrated for you
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Pick an occasion and a style — the AI writes a personal message, paints matching artwork,
            and hands you a finished card to download.
          </p>
        </section>

        <div className="grid items-start gap-8 lg:grid-cols-[400px_1fr]">
          {/* Studio form */}
          <section className="card-panel h-fit p-7 lg:sticky lg:top-8">
            <h2 className="font-display text-2xl font-bold text-foreground">Design your card</h2>
            <div className="mt-6 space-y-5">
              <div>
                <label className="field-label" htmlFor="occasion">
                  Occasion
                </label>
                <select
                  id="occasion"
                  className="select"
                  value={form.occasion}
                  onChange={(e) => update("occasion", e.target.value)}
                >
                  {OCCASIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
                {isCustom && (
                  <input
                    className="input mt-3"
                    placeholder="e.g. First day at a new job"
                    value={form.customOccasion}
                    onChange={(e) => update("customOccasion", e.target.value)}
                    maxLength={60}
                  />
                )}
              </div>

              <div>
                <label className="field-label" htmlFor="style">
                  Artwork style
                </label>
                <select
                  id="style"
                  className="select"
                  value={form.style}
                  onChange={(e) => update("style", e.target.value)}
                >
                  {STYLES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="field-label" htmlFor="tone">
                  Tone of the message
                </label>
                <select
                  id="tone"
                  className="select"
                  value={form.tone}
                  onChange={(e) => update("tone", e.target.value)}
                >
                  {TONES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label" htmlFor="recipient">
                    For (optional)
                  </label>
                  <input
                    id="recipient"
                    className="input"
                    placeholder="Maya"
                    value={form.recipient}
                    onChange={(e) => update("recipient", e.target.value)}
                    maxLength={30}
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="sender">
                    Signed (optional)
                  </label>
                  <input
                    id="sender"
                    className="input"
                    placeholder="Vaishnavi"
                    value={form.sender}
                    onChange={(e) => update("sender", e.target.value)}
                    maxLength={30}
                  />
                </div>
              </div>

              <div>
                <label className="field-label" htmlFor="note">
                  Personal note (optional)
                </label>
                <textarea
                  id="note"
                  className="textarea"
                  placeholder="e.g. She loves gardening and her cat Mango"
                  value={form.note}
                  onChange={(e) => update("note", e.target.value)}
                  maxLength={200}
                />
              </div>

              <button className="btn btn-primary w-full" onClick={generate} disabled={working}>
                {working ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Creating…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" /> Generate my card
                  </>
                )}
              </button>
              <p className="text-center text-xs text-muted-foreground">
                Powered by Lovable AI · takes up to a minute
              </p>
            </div>
          </section>

          {/* Card stage */}
          <section className="card-panel overflow-hidden p-5 sm:p-8">
            {stage === "idle" && (
              <div className="flex flex-col items-center py-4 text-center">
                <img
                  src={emptyState}
                  width={1024}
                  height={1024}
                  loading="lazy"
                  alt="Illustration of greeting cards, envelopes and a fountain pen"
                  className="w-full max-w-sm rounded-2xl"
                />
                <h2 className="mt-6 font-display text-2xl font-bold text-foreground">
                  Your card takes shape here
                </h2>
                <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                  Choose an occasion, style and tone, then press Generate — you'll watch the artwork
                  paint itself before the card is assembled.
                </p>
              </div>
            )}

            {stage === "writing" && (
              <div className="grid place-items-center py-24 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="mt-5 font-display text-xl font-semibold text-foreground">
                  Writing your message…
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Shaping a {form.tone.toLowerCase()} {occasionLabel} card
                  {form.recipient.trim() ? ` for ${form.recipient.trim()}` : ""}
                </p>
              </div>
            )}

            {stage === "painting" && (
              <div className="flex flex-col items-center gap-6">
                {written && (
                  <div className="w-full max-w-md rounded-2xl border border-border bg-secondary/60 p-5 text-center">
                    <p className="eyebrow">Message written</p>
                    <p className="mt-1 font-display text-xl font-bold text-foreground">
                      {written.headline}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {written.message}
                    </p>
                  </div>
                )}
                <div className="relative w-full max-w-md">
                  <div className="aspect-[5/7] w-full overflow-hidden rounded-2xl bg-muted">
                    {artwork ? (
                      <img
                        src={artwork.dataUrl}
                        alt="Artwork preview"
                        className={`h-full w-full object-cover transition-[filter] duration-700 ${
                          artwork.final ? "blur-0" : "blur-2xl"
                        }`}
                      />
                    ) : (
                      <div className="grid h-full place-items-center text-muted-foreground">
                        <ImageIcon className="h-10 w-10" />
                      </div>
                    )}
                  </div>
                  {!artwork?.final && (
                    <div className="absolute inset-0 grid place-items-center rounded-2xl bg-background/40 backdrop-blur-[2px]">
                      <div className="rounded-full bg-card/90 px-5 py-3 text-sm font-semibold text-foreground shadow-lg">
                        <Loader2 className="mr-2 inline h-4 w-4 animate-spin text-primary" />
                        Painting your artwork…
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {stage === "done" && cardUrl && (
              <div className="flex flex-col items-center">
                <img
                  src={cardUrl}
                  alt="Finished greeting card"
                  className="w-full max-w-md rounded-2xl shadow-xl"
                />
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  <button className="btn btn-primary" onClick={() => download("png")} disabled={!!downloading}>
                    {downloading === "png" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    Download PNG
                  </button>
                  <button className="btn btn-outline" onClick={() => download("pdf")} disabled={!!downloading}>
                    {downloading === "pdf" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileDown className="h-4 w-4" />
                    )}
                    Download PDF
                  </button>
                  <button className="btn btn-outline" onClick={generate} disabled={working}>
                    <RefreshCw className="h-4 w-4" /> Regenerate
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>

        <section className="mt-14">
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                icon: PenLine,
                title: "1 · Message",
                body: "The message is written from your occasion, tone, names and personal note.",
              },
              {
                icon: ImageIcon,
                title: "2 · Artwork",
                body: "The same brief drives a matching illustration, painted live as you watch.",
              },
              {
                icon: Download,
                title: "3 · Download",
                body: "The finished 5×7 card is assembled and saved as a PNG, or a print-ready PDF.",
              },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded-2xl border border-border bg-card/70 p-5">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-secondary-foreground">
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <p className="mt-3 font-display text-lg font-bold text-foreground">{title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border/70 py-6 text-center text-sm text-muted-foreground">
        Made with Lovable AI
      </footer>
    </div>
  );
}
