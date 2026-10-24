"use client";

import Link from "next/link";
import Image from "next/image";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import {
  checklistFor,
  emptyForm,
  exampleForm,
  formatDate,
  formatSituation,
  getTargetSchool,
} from "@/lib/transfer/logic";
import type { ChatCitation, ChatMessage, ChatResponseBlock, TransferForm } from "@/lib/transfer/types";
import type { PublicSevisTransferReference } from "@/lib/references/types";

type DisplayChatMessage = ChatMessage & {
  kind?: "demo" | "claude" | "status" | "error";
  citations?: ChatCitation[];
  blocks?: ChatResponseBlock[];
  truncated?: boolean;
  retryText?: string;
};

type ReferencesResponse = {
  references: PublicSevisTransferReference[];
  notices: string[];
};

function safeHref(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

function renderInlineMarkdown(text: string, onCitation: (index: number) => void) {
  const tokens = text.split(/(\*\*[^*]+\*\*|__[^_]+__|\[[^\]]+\]\([^)]+\)|`[^`]+`|\[\[CITATION:\d+\]\])/g);
  return tokens.map((token, index) => {
    if (/^\*\*[^*]+\*\*$/.test(token) || /^__[^_]+__$/.test(token)) {
      return <strong key={index}>{token.slice(2, -2)}</strong>;
    }
    if (/^`[^`]+`$/.test(token)) {
      return <code key={index} className="break-words rounded bg-[var(--surface-muted)] px-1 py-0.5">{token.slice(1, -1)}</code>;
    }
    const citation = token.match(/^\[\[CITATION:(\d+)\]\]$/);
    if (citation) {
      const number = Number(citation[1]);
      return <button key={index} type="button" onClick={() => onCitation(number)} className="ml-1 align-super text-xs font-semibold text-[var(--primary)] underline" aria-label={`Show citation ${number}`}>[{number}]</button>;
    }
    const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) {
      const href = safeHref(link[2]);
      return href ? <a key={index} href={href} target="_blank" rel="noreferrer" className="break-words text-[var(--primary)] underline">{link[1]}</a> : <span key={index}>{link[1]}</span>;
    }
    return <span key={index}>{token}</span>;
  });
}

function MarkdownContent({ text, citationNumbers, onCitation }: {
  text: string;
  citationNumbers: number[];
  onCitation: (index: number) => void;
}) {
  const lines = text.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let listItems: string[] = [];
  let orderedList = false;
  let paragraphLines: string[] = [];
  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;
    blocks.push(<p key={`paragraph-${blocks.length}`} className="my-2 whitespace-pre-wrap">{renderInlineMarkdown(paragraphLines.join("\n").trim(), onCitation)}</p>);
    paragraphLines = [];
  };
  const flushList = () => {
    if (listItems.length === 0) return;
    flushParagraph();
    blocks.push(
      orderedList ? <ol key={`list-${blocks.length}`} className="my-3 list-decimal space-y-1 pl-5">
        {listItems.map((item, index) => <li key={index}>{renderInlineMarkdown(item, onCitation)}</li>)}
      </ol> : <ul key={`list-${blocks.length}`} className="my-3 list-disc space-y-1 pl-5">
        {listItems.map((item, index) => <li key={index}>{renderInlineMarkdown(item, onCitation)}</li>)}
      </ul>,
    );
    listItems = [];
    orderedList = false;
  };
  lines.forEach((line) => {
    const heading = line.match(/^#{1,3}\s+(.+)$/);
    const bullet = line.match(/^\s*[-*]\s+(.+)$/);
    const numbered = line.match(/^\s*\d+\.\s+(.+)$/);
    if (bullet || numbered) {
      if (listItems.length > 0 && Boolean(numbered) !== orderedList) flushList();
      listItems.push(bullet?.[1] || numbered?.[1] || "");
      orderedList = Boolean(numbered);
      return;
    }
    if (line.trim() === "-") return;
    flushList();
    if (heading) {
      flushParagraph();
      blocks.push(<h3 key={`heading-${blocks.length}`} className="mt-4 mb-2 text-base font-semibold text-[var(--heading)]">{renderInlineMarkdown(heading[1], onCitation)}</h3>);
    } else if (line.trim()) {
      paragraphLines.push(line);
    } else {
      flushParagraph();
    }
  });
  flushList();
  flushParagraph();
  return <div className="max-w-none break-words leading-7">{blocks}{citationNumbers.map((number) => <button key={number} type="button" onClick={() => onCitation(number)} className="ml-1 align-super text-xs font-semibold text-[var(--primary)] underline" aria-label={`Show citation ${number}`}>[{number}]</button>)}</div>;
}

function DateChoice({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const isUnknown = value === "unknown";
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-semibold text-[var(--heading)]">
        {label}
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id={id}
          type="date"
          value={isUnknown ? "" : value}
          onChange={(event) => onChange(event.target.value)}
          disabled={isUnknown}
          className="min-h-12 flex-1 rounded-xl border border-[var(--accent)] bg-[var(--surface)] px-4 text-sm text-[var(--heading)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--surface-muted)] disabled:bg-[var(--surface-muted)]"
        />
        <label className="flex min-h-12 items-center gap-2 rounded-xl border border-[var(--accent)] bg-[var(--surface)] px-4 text-sm text-[var(--text)]">
          <input
            type="checkbox"
            checked={isUnknown}
            onChange={(event) => onChange(event.target.checked ? "unknown" : "")}
            className="h-4 w-4 accent-[var(--primary)]"
          />
          Not sure
        </label>
      </div>
    </div>
  );
}

function DemoNotice() {
  return (
    <div className="rounded-xl border border-[var(--accent)] bg-[var(--surface-muted)] px-4 py-3 text-sm leading-6 text-[var(--heading)]">
      <strong className="font-semibold">Demo mode.</strong> Reference materials are connected.
      Live guidance status is shown after each request.
    </div>
  );
}

export default function TransferPage() {
  const [form, setForm] = useState<TransferForm>(emptyForm);
  const [step, setStep] = useState(1);
  const [summary, setSummary] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<DisplayChatMessage[]>([]);
  const [isResponding, setIsResponding] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState("");
  const [isExample, setIsExample] = useState(false);
  const [detailsChanged, setDetailsChanged] = useState(false);
  const [references, setReferences] = useState<PublicSevisTransferReference[]>([]);
  const [referenceNotices, setReferenceNotices] = useState<string[]>([]);

  useEffect(() => {
    if (window.location.search.includes("example=1")) {
      const timer = window.setTimeout(() => {
        setIsExample(true);
        setForm(exampleForm);
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    if (step !== 3) return;
    const controller = new AbortController();
    const params = new URLSearchParams({
      currentSchool: form.currentSchool,
      targetSchool: form.targetSchool,
      targetSchoolCustom: form.targetSchoolCustom,
      situation: form.situation,
    });
    fetch(`/api/references?${params.toString()}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load references");
        return (await response.json()) as ReferencesResponse;
      })
      .then((result) => {
        setReferences(result.references);
        setReferenceNotices(result.notices);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setReferences([]);
          setReferenceNotices(["Sources could not be loaded right now."]);
        }
      });
    return () => controller.abort();
  }, [form.currentSchool, form.targetSchool, form.targetSchoolCustom, form.situation, step]);

  const updateForm = (key: keyof TransferForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const targetSchoolName = getTargetSchool(form);
  const currentSchoolInvalid = !form.currentSchool.trim();
  const customTargetSchoolSelected = form.targetSchool === "another school";
  const customTargetSchoolInvalid = customTargetSchoolSelected && !form.targetSchoolCustom.trim();
  const canContinueStepOne = Boolean(!currentSchoolInvalid && form.situation && !customTargetSchoolInvalid);
  const canContinueStepTwo = Boolean(form.programEnd && form.programStart);

  const generatedSummary = useMemo(() => {
    const target = targetSchoolName || "a target school that is not decided yet";
    return `${formatSituation(form.situation, form.currentSchool.trim())} I am considering a transfer to ${target}. My current program end date is ${formatDate(form.programEnd)}, and my target program start date is ${formatDate(form.programStart)}.${form.questions ? ` I want to ask: ${form.questions}` : ""}`;
  }, [form, targetSchoolName]);

  const enterConsultation = () => {
    setSummary(generatedSummary);
    setDetailsChanged(false);
    setChatMessages([
      {
        role: "assistant",
        kind: "demo",
        text: `Thanks for sharing this context. ${formatSituation(form.situation, form.currentSchool.trim())} You are considering ${targetSchoolName || "a school you have not selected yet"}. I can help you organize details and questions for your DSO (Designated School Official, the staff member responsible for international student services).`,
      },
    ]);
    setStep(3);
  };

  const editDetails = () => setStep(2);

  const saveDetails = () => {
    setSummary(generatedSummary);
    setDetailsChanged(true);
    setStep(3);
  };

  const submitChat = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = chatInput.trim();
    if (!message || isResponding) return;
    const nextMessages: DisplayChatMessage[] = [...chatMessages, { role: "user", text: message }];
    setChatMessages(nextMessages);
    setChatInput("");
    setIsResponding(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentData: form,
          messages: nextMessages
            .filter((item) => item.kind === undefined)
            .map(({ role, text }) => ({ role, text })),
        }),
      });
      const result: {
        status?: string;
        message?: string;
        blocks?: ChatResponseBlock[];
        truncated?: boolean;
      } = await response.json();
      const blocks = result.status === "ready" ? result.blocks || [] : undefined;
      setChatMessages((messages) => [
        ...messages,
        {
          role: "assistant",
          kind: result.status === "ready" ? "claude" : result.status === "error" ? "error" : "status",
          text: blocks ? blocks.map((block) => block.text).join("\n\n") : result.message || "The chat service did not return a response.",
          blocks,
          citations: blocks?.flatMap((block) => block.citations),
          truncated: result.truncated,
          retryText: result.status === "error" ? message : undefined,
        },
      ]);
    } catch {
      setChatMessages((messages) => [
        ...messages,
        {
          role: "assistant",
          kind: "error",
          text: "The chat service could not be reached. Please try again.",
          retryText: message,
        },
      ]);
    } finally {
      setIsResponding(false);
    }
  };

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback(`${label} copied`);
    } catch {
      setCopyFeedback("Copy failed - please select and copy manually");
    }
    window.setTimeout(() => setCopyFeedback(""), 2200);
  };

  return (
    <div className={`${step === 3 ? "flex h-[100dvh] flex-col overflow-hidden" : "min-h-screen"} bg-[linear-gradient(135deg,var(--background)_0%,var(--surface)_55%,var(--surface-muted)_100%)] text-[var(--text)]`}>
      <header className={`mx-auto flex w-full max-w-7xl shrink-0 items-center justify-between px-5 sm:px-8 ${step === 3 ? "py-3" : "py-6"}`}>
        <Link href="/" aria-label="Claude Campus Compass home" className="flex items-center gap-3">
          <Image src="/campus-compass-icon.png" alt="" width={48} height={48} className="h-10 w-10 shrink-0 object-contain sm:h-12 sm:w-12" />
          <span className="text-xl font-semibold tracking-tight">Claude Campus Compass</span>
        </Link>
        <span className="rounded-full border border-[var(--accent)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--heading)] sm:px-4 sm:text-xs">
          Interactive Demo
        </span>
      </header>

      <main className={`mx-auto w-full max-w-7xl px-5 sm:px-8 ${step === 3 ? "min-h-0 flex-1 overflow-hidden pb-3" : "pb-12"}`}>
        {step < 3 ? (
          <div className="mx-auto max-w-3xl pt-8 sm:pt-12">
            <div className="mb-8">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--heading)]">F-1 SEVIS transfer</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
                Let&apos;s make a clear starting point.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text)]">
                A few questions will help organize a conversation with your international
                student adviser. This is information navigation only, not an immigration
                eligibility assessment.
              </p>
            </div>
            <div className="mb-6 flex items-center gap-3 text-xs font-semibold text-[var(--heading)]">
              {[1, 2].map((number) => (
                <div key={number} className="flex items-center gap-3">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-full ${step >= number ? "bg-[var(--primary)] text-white" : "bg-[var(--surface-muted)] text-[var(--heading)]"}`}>
                    {number}
                  </span>
                  {number === 1 ? <span className="h-px w-10 bg-[var(--accent)] sm:w-20" /> : null}
                </div>
              ))}
              <span>{step === 1 ? "Your situation" : "Dates and questions"}</span>
            </div>
            <form
              className="rounded-[2rem] border border-[var(--accent)] bg-[var(--surface)]/75 p-6 shadow-[0_20px_60px_rgba(6,75,96,0.08)] sm:p-9"
              onSubmit={(event) => {
                event.preventDefault();
                if (step === 1) {
                  if (!canContinueStepOne) return;
                  setStep(2);
                } else if (summary) {
                  saveDetails();
                } else {
                  enterConsultation();
                }
              }}
            >
              {isExample ? (
                <div className="mb-6 rounded-xl border border-[var(--accent)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--text)]">
                  <strong className="font-semibold text-[var(--primary)]">Fictional example loaded.</strong> You can edit every field before continuing.
                </div>
              ) : null}
              {step === 1 ? (
                <div className="space-y-6">
                  <div>
                    <label htmlFor="currentSchool" className="mb-2 block text-sm font-semibold text-[var(--heading)]">Current school</label>
                    <input id="currentSchool" value={form.currentSchool} onChange={(event) => updateForm("currentSchool", event.target.value)} placeholder="e.g. Lakeview Community College" className="min-h-12 w-full rounded-xl border border-[var(--accent)] bg-[var(--surface)] px-4 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--surface-muted)]" aria-invalid={currentSchoolInvalid} required />
                    {form.currentSchool.length > 0 && currentSchoolInvalid ? <p className="mt-2 text-xs text-[var(--heading)]">Enter your current school name. It cannot be blank.</p> : null}
                  </div>
                  <div>
                    <label htmlFor="targetSchool" className="mb-2 block text-sm font-semibold text-[var(--heading)]">Target school</label>
                    <select id="targetSchool" value={form.targetSchool} onChange={(event) => updateForm("targetSchool", event.target.value)} className="min-h-12 w-full rounded-xl border border-[var(--accent)] bg-[var(--surface)] px-4 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--surface-muted)]">
                      <option value="">Select a school or choose not sure</option>
                      <option value="not sure yet">Not sure yet</option>
                      <option value="Northbridge University">Northbridge University</option>
                      <option value="another school">Another school</option>
                    </select>
                    {customTargetSchoolSelected ? (
                      <div className="mt-4">
                        <label htmlFor="targetSchoolCustom" className="mb-2 block text-sm font-semibold text-[var(--heading)]">School name</label>
                        <input
                          id="targetSchoolCustom"
                          value={form.targetSchoolCustom}
                          onChange={(event) => updateForm("targetSchoolCustom", event.target.value)}
                          placeholder="e.g. Westbridge University"
                          className="min-h-12 w-full rounded-xl border border-[var(--accent)] bg-[var(--surface)] px-4 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--surface-muted)]"
                          aria-invalid={customTargetSchoolInvalid}
                          required
                        />
                        {customTargetSchoolInvalid ? <p className="mt-2 text-xs text-[var(--heading)]">Enter a school name. It cannot be blank.</p> : null}
                      </div>
                    ) : null}
                  </div>
                  <div>
                    <label htmlFor="situation" className="mb-2 block text-sm font-semibold text-[var(--heading)]">Current situation</label>
                    <select id="situation" value={form.situation} onChange={(event) => updateForm("situation", event.target.value)} required className="min-h-12 w-full rounded-xl border border-[var(--accent)] bg-[var(--surface)] px-4 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--surface-muted)]">
                      <option value="">Choose one</option>
                      <option value="Currently enrolled">Currently enrolled</option>
                      <option value="Currently on OPT">Currently on OPT</option>
                      <option value="Completed my program">Completed my program</option>
                      <option value="Other">Other</option>
                      <option value="Not sure">Not sure</option>
                    </select>
                    <p className="mt-2 text-xs leading-5 text-[var(--text)]">Your DSO is the Designated School Official responsible for international student services at your school.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <DateChoice id="programEnd" label="Current program end date" value={form.programEnd} onChange={(value) => updateForm("programEnd", value)} />
                  <DateChoice id="programStart" label="Target program start date" value={form.programStart} onChange={(value) => updateForm("programStart", value)} />
                  <div>
                    <label htmlFor="questions" className="mb-2 block text-sm font-semibold text-[var(--heading)]">What would you like to ask? <span className="font-normal text-[var(--text)]">(optional)</span></label>
                    <textarea id="questions" value={form.questions} onChange={(event) => updateForm("questions", event.target.value)} rows={4} placeholder="Add questions you want to discuss with your DSO..." className="w-full resize-y rounded-xl border border-[var(--accent)] bg-[var(--surface)] px-4 py-3 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--surface-muted)]" />
                  </div>
                  <p className="text-xs leading-5 text-[var(--text)]">Dates can be marked as &quot;Not sure&quot;. No name, passport number, SEVIS ID, or files are collected.</p>
                </div>
              )}
              <div className="mt-8 flex flex-wrap justify-between gap-3 border-t border-[var(--accent)] pt-6">
                {step === 2 ? <button type="button" onClick={() => setStep(1)} className="rounded-full border border-[var(--primary)] px-5 py-3 text-sm font-semibold text-[var(--primary)] hover:bg-[var(--surface-muted)] focus-visible:outline-2 focus-visible:outline-[var(--primary)]">Back</button> : <span />}
                <button type="submit" disabled={step === 1 ? !canContinueStepOne : !canContinueStepTwo} className="rounded-full bg-[var(--primary)] px-6 py-3 text-sm font-semibold text-white hover:bg-[var(--heading)] disabled:cursor-not-allowed disabled:bg-[var(--surface-muted)] disabled:text-[var(--text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]">
                  {step === 1 ? "Next" : summary ? "Save details" : "See my summary"}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <ConsultationView
            form={form}
            summary={summary}
            onEditDetails={editDetails}
            chatInput={chatInput}
            setChatInput={setChatInput}
            chatMessages={chatMessages}
            isResponding={isResponding}
            submitChat={submitChat}
            copyFeedback={copyFeedback}
            copyText={copyText}
            detailsChanged={detailsChanged}
            references={references}
            referenceNotices={referenceNotices}
          />
        )}
      </main>
    </div>
  );
}

function ConsultationView({
  form,
  summary,
  onEditDetails,
  chatInput,
  setChatInput,
  chatMessages,
  isResponding,
  submitChat,
  copyFeedback,
  copyText,
  detailsChanged,
  references,
  referenceNotices,
}: {
  form: TransferForm;
  summary: string;
  onEditDetails: () => void;
  chatInput: string;
  setChatInput: (value: string) => void;
  chatMessages: DisplayChatMessage[];
  isResponding: boolean;
  submitChat: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  copyFeedback: string;
  copyText: (text: string, label: string) => void;
  detailsChanged: boolean;
  references: PublicSevisTransferReference[];
  referenceNotices: string[];
}) {
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [openSources, setOpenSources] = useState<Record<number, boolean>>({});
  const [expandedQuotes, setExpandedQuotes] = useState<Record<string, boolean>>({});
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);

  useEffect(() => {
    const element = chatScrollRef.current;
    if (element && !showJumpToLatest) {
      element.scrollTop = element.scrollHeight;
    }
  }, [chatMessages.length, isResponding, showJumpToLatest]);

  const handleChatScroll = () => {
    const element = chatScrollRef.current;
    if (!element) return;
    const nearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 96;
    setShowJumpToLatest(!nearBottom);
  };

  const jumpToLatest = () => {
    const element = chatScrollRef.current;
    if (!element) return;
    setShowJumpToLatest(false);
    element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
  };

  const handleChatInputKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing &&
      event.nativeEvent.keyCode !== 229
    ) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col pt-2 sm:pt-3">
      <div className="mb-2 flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--heading)]">Your transfer planning workspace</p>
          <h1 className="mt-1 text-xl font-semibold tracking-[-0.03em] sm:text-2xl">A clearer conversation starts here.</h1>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setDetailsOpen((open) => !open)} aria-expanded={detailsOpen} className="rounded-full border border-[var(--primary)] px-3 py-1.5 text-xs font-semibold text-[var(--primary)] hover:bg-[var(--surface-muted)]">
            {detailsOpen ? "Hide details" : "Details"}
          </button>
          <Link href="/" className="rounded-full border border-[var(--primary)] px-3 py-1.5 text-xs font-semibold text-[var(--primary)] hover:bg-[var(--surface-muted)]">Exit demo</Link>
        </div>
      </div>
      <div className="mb-2 shrink-0"><DemoNotice /></div>
      <div className={`grid min-h-0 flex-1 items-stretch gap-5 overflow-y-auto lg:overflow-hidden ${detailsOpen ? "lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.6fr)]" : "grid-cols-1"}`}>
        <section className={`order-1 flex min-h-0 min-w-0 flex-col rounded-[2rem] border border-[var(--accent)] bg-[var(--surface)]/75 p-4 shadow-[0_20px_60px_rgba(6,75,96,0.08)] sm:p-6 ${detailsOpen ? "" : "w-full"}`}>
          <div className="mb-5 flex items-center justify-between border-b border-[var(--accent)] pb-4">
            <div>
              <h2 className="font-semibold">Ask about your situation</h2>
              <p className="mt-1 text-xs text-[var(--text)]">Ask a focused question about the information you provided.</p>
            </div>
            <span className="rounded-full bg-[var(--surface-muted)] px-3 py-1 text-xs font-semibold text-[var(--heading)]">Fictional example</span>
          </div>
          {detailsChanged ? (
            <p className="mb-4 rounded-xl border border-[var(--accent)] bg-[var(--surface-muted)] px-3 py-2 text-xs leading-5 text-[var(--heading)]">
              Your details have changed. Earlier messages may refer to your previous details.
            </p>
          ) : null}
          <div ref={chatScrollRef} onScroll={handleChatScroll} className="relative min-h-0 flex-1 space-y-5 overflow-y-auto pb-5 pr-1">
            {chatMessages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`w-full ${message.role === "user" ? "max-w-[min(75%,680px)]" : "max-w-full"}`}>
                  <p className={`mb-2 text-xs font-semibold uppercase tracking-[0.12em] ${message.role === "user" ? "text-right text-[var(--heading)]" : "text-left text-[var(--heading)]"}`}>
                    {message.kind === "claude" ? "Claude" : message.kind === "error" ? "Service error" : message.kind === "status" ? "Service status" : "Fictional example"}
                  </p>
                  {message.kind === "claude" && message.blocks ? (
                    <div className="max-w-none text-sm">
                      {(() => {
                        const citations = message.citations || [];
                        const referenceNumbers = new Map<string, number>();
                        citations.forEach((citation) => {
                          if (!referenceNumbers.has(citation.referenceId)) {
                            referenceNumbers.set(citation.referenceId, referenceNumbers.size + 1);
                          }
                        });
                        const markdown = message.blocks.map((block) => {
                          const markers = block.citations
                            .map((citation) => referenceNumbers.get(citation.referenceId))
                            .filter((number): number is number => number !== undefined)
                            .filter((number, markerIndex, numbers) => numbers.indexOf(number) === markerIndex)
                            .map((number) => `[[CITATION:${number}]]`)
                            .join(" ");
                          return `${block.text}${markers ? ` ${markers}` : ""}`;
                        }).join("\n");
                        return <MarkdownContent text={markdown} citationNumbers={[]} onCitation={(number) => {
                          setOpenSources((current) => ({ ...current, [index]: true }));
                          window.setTimeout(() => document.getElementById(`citation-source-${index}-${number}`)?.focus(), 0);
                        }} />;
                      })()}
                      {message.truncated ? <p className="mt-3 rounded-lg border border-[var(--accent)] bg-[var(--surface-muted)] p-3 text-sm font-semibold text-[var(--heading)]">This answer reached its output limit and may be incomplete. Please ask a focused follow-up question.</p> : null}
                    </div>
                  ) : (
                    <div className={`text-sm ${message.role === "user" ? "rounded-2xl rounded-br-sm bg-[var(--primary)] px-4 py-3 text-white" : ""}`}>
                      <MarkdownContent text={message.text} citationNumbers={[]} onCitation={() => undefined} />
                    </div>
                  )}
                {message.kind === "error" && message.retryText ? (
                  <button type="button" onClick={() => setChatInput(message.retryText || "")} className="mt-1 text-xs font-semibold text-[var(--primary)] underline underline-offset-2">
                    Retry
                  </button>
                ) : null}
                {message.kind === "claude" && message.citations && message.citations.length > 0 ? (() => {
                  const citations = message.citations;
                  const sources = Array.from(new Map(citations.map((citation) => {
                    const citedTexts = Array.from(new Set(citations.filter((item) => item.referenceId === citation.referenceId).map((item) => item.citedText)));
                    return [citation.referenceId, { ...citation, citedTexts }];
                  })).values());
                  const expanded = openSources[index] === true;
                  return <div className="mt-3 w-full">
                    <button type="button" onClick={() => setOpenSources((current) => ({ ...current, [index]: !expanded }))} aria-expanded={expanded} className="text-xs font-semibold text-[var(--primary)] underline underline-offset-2">
                      Sources · {sources.length}
                    </button>
                    {expanded ? <ul className="mt-2 space-y-3 rounded-xl border border-[var(--accent)] bg-[var(--surface)] p-3 text-xs leading-5">
                      {sources.map((source) => <li key={source.referenceId} id={`citation-source-${index}-${citations.findIndex((citation) => citation.referenceId === source.referenceId) + 1}`} tabIndex={-1}>
                        <a href={source.url} target="_blank" rel="noreferrer" className="font-semibold text-[var(--primary)] underline underline-offset-2">{source.title}</a>
                        <p className="mt-1 text-[var(--text)]">{source.publisher}</p>
                        {source.citedTexts.map((citedText, citedTextIndex) => {
                          const quoteKey = `${index}-${source.referenceId}-${citedTextIndex}`;
                          const expandedQuote = expandedQuotes[quoteKey] === true;
                          return <div key={citedTextIndex} className="mt-1">
                            <p className={`break-words ${expandedQuote ? "" : "line-clamp-3"}`}>{citedText}</p>
                            <button type="button" onClick={() => setExpandedQuotes((current) => ({ ...current, [quoteKey]: !expandedQuote }))} aria-expanded={expandedQuote} className="font-semibold text-[var(--primary)] underline underline-offset-2">
                              {expandedQuote ? "Show less" : "Show more"}
                            </button>
                          </div>;
                        })}
                        <p className="mt-1 italic">This source supports the explanation; it does not determine personal eligibility.</p>
                      </li>)}
                    </ul> : null}
                  </div>;
                })() : null}
                </div>
              </div>
            ))}
            {isResponding ? <p className="text-xs text-[var(--text)]">Requesting Claude guidance...</p> : null}
            {showJumpToLatest ? <button type="button" onClick={jumpToLatest} className="sticky bottom-2 left-1/2 z-10 -translate-x-1/2 rounded-full border border-[var(--primary)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--primary)] shadow-sm">Jump to latest</button> : null}
          </div>
          <form onSubmit={submitChat} autoComplete="off" className="flex shrink-0 gap-2 border-t border-[var(--accent)] pt-5">
            <label htmlFor="chatInput" className="sr-only">Ask a question</label>
            <textarea id="chatInput" value={chatInput} onChange={(event) => setChatInput(event.target.value)} onKeyDown={handleChatInputKeyDown} placeholder="Type a question for the demo..." autoComplete="off" rows={2} className="min-h-12 min-w-0 flex-1 resize-y rounded-xl border border-[var(--accent)] bg-[var(--surface)] px-4 py-3 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--surface-muted)]" />
            <button type="submit" disabled={!chatInput.trim() || isResponding} className="rounded-xl bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white hover:bg-[var(--heading)] disabled:cursor-not-allowed disabled:bg-[var(--accent)]">Send</button>
          </form>
        </section>

        {detailsOpen ? <aside className="order-2 flex min-h-0 min-w-0 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto pr-1">
          <section className="rounded-[2rem] border border-[var(--accent)] bg-[var(--surface)]/75 p-6 shadow-[0_20px_60px_rgba(6,75,96,0.08)]">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold">Your situation summary</h2>
              <button type="button" onClick={() => copyText(summary, "Summary")} className="text-xs font-semibold text-[var(--primary)] underline underline-offset-4">{copyFeedback || "Copy"}</button>
            </div>
            <p className="mt-4 rounded-xl border border-[var(--accent)] bg-[var(--surface)] p-3 text-sm leading-6 text-[var(--text)]">{summary}</p>
            <button type="button" onClick={onEditDetails} className="mt-3 text-xs font-semibold text-[var(--primary)] underline underline-offset-4">Edit details</button>
            <button type="button" onClick={() => copyText(`${summary}\n\nQuestions: ${form.questions || "None added"}`, "Summary and questions")} className="mt-3 w-full rounded-xl border border-[var(--primary)] px-4 py-2.5 text-xs font-semibold text-[var(--primary)] hover:bg-[var(--surface-muted)]">Copy summary + questions</button>
          </section>
          <section className="rounded-[2rem] border border-[var(--accent)] bg-[var(--surface-muted)] p-6">
            <h2 className="font-semibold">Preparation checklist</h2>
            <ul className="mt-4 space-y-3 text-sm leading-5 text-[var(--text)]">
              {checklistFor(form).map((item) => <li key={item} className="flex gap-3"><span className="mt-1 h-4 w-4 shrink-0 rounded border border-[var(--primary)] bg-[var(--surface)]" />{item}</li>)}
            </ul>
          </section>
          <section className="rounded-[2rem] border border-[var(--accent)] bg-[var(--surface)]/60 p-6">
            <h2 className="font-semibold">Sources</h2>
            <p className="mt-3 text-sm leading-6 text-[var(--text)]">
              These references are available for review. Their display does not mean they were cited in a response.
            </p>
            {references.length > 0 ? (
              <ul className="mt-4 space-y-4">
                {references.map((reference) => (
                  <li key={reference.id} className="border-t border-[var(--accent)] pt-3 text-xs leading-5 text-[var(--text)]">
                    <p className="font-semibold text-[var(--heading)]">{reference.title}</p>
                    <p>{reference.publisher}</p>
                    <p>Verified: {reference.lastVerifiedAt || "Not verified"}</p>
                    <p>Applies to: {reference.schoolScope}</p>
                    <a href={reference.url} target="_blank" rel="noreferrer" className="font-semibold text-[var(--primary)] underline underline-offset-2">
                      View original source
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
            {referenceNotices.length > 0 ? (
              <ul className="mt-4 space-y-2 text-sm font-semibold text-[var(--heading)]">
                {referenceNotices.map((notice) => <li key={notice}>{notice}</li>)}
              </ul>
            ) : null}
          </section>
          </div>
        </aside> : null}
      </div>
      <p className="mt-2 shrink-0 text-center text-xs leading-5 text-[var(--text)]">Independent student project providing information navigation. Confirm personal details with your school adviser.</p>
    </div>
  );
}
