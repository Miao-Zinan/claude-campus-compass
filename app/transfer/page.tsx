"use client";

import Link from "next/link";
import Image from "next/image";
import { FormEvent, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { CSSProperties, KeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import {
  checklistFor,
  emptyForm,
  exampleForm,
  formatDate,
  formatSituation,
  getTargetSchool,
} from "@/lib/transfer/logic";
import { createLatestRequestTracker, describeGuardFailure, type AiRouteResult } from "@/lib/transfer/ai-status";
import { buildChatHistory, isUnansweredUserMessage, latestChatAnnouncement } from "@/lib/transfer/chat-history";
import {
  approvedHref,
  buildApprovedUrlSet,
  citationMarkers,
  citationSourceElementId,
  numberCitationSources,
} from "@/lib/transfer/citations";
import { MAX_CHAT_MESSAGE_LENGTH, MAX_FIELD_LENGTH } from "@/lib/transfer/validation";
import {
  canSplit,
  chatRatioBounds,
  chatRatioFromPointer,
  clampChatRatio,
  nudgeChatRatio,
  SPLIT_DEFAULT_CHAT_RATIO,
  SPLIT_GRID_TEMPLATE,
} from "@/lib/transfer/split-pane";
import type {
  ChatCitation,
  ChatMessage,
  ChatResponseBlock,
  PlanReference,
  PreparationPlan,
  TransferForm,
} from "@/lib/transfer/types";
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

type GeneratedPlan = PreparationPlan & {
  generatedAt: string;
  references: PlanReference[];
};

type PlanError = {
  message: string;
  retryable: boolean;
};

function renderInlineMarkdown(text: string, onCitation: (index: number) => void, approvedUrls: ReadonlySet<string>) {
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
      const href = approvedHref(link[2], approvedUrls);
      return href ? <a key={index} href={href} target="_blank" rel="noreferrer" className="break-words text-[var(--primary)] underline">{link[1]}</a> : <span key={index}>{link[1]}</span>;
    }
    return <span key={index}>{token}</span>;
  });
}

function MarkdownContent({ text, citationNumbers, onCitation, approvedUrls }: {
  text: string;
  citationNumbers: number[];
  onCitation: (index: number) => void;
  approvedUrls: ReadonlySet<string>;
}) {
  const lines = text.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let listItems: string[] = [];
  let orderedList = false;
  let paragraphLines: string[] = [];
  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;
    blocks.push(<p key={`paragraph-${blocks.length}`} className="my-2 whitespace-pre-wrap">{renderInlineMarkdown(paragraphLines.join("\n").trim(), onCitation, approvedUrls)}</p>);
    paragraphLines = [];
  };
  const flushList = () => {
    if (listItems.length === 0) return;
    flushParagraph();
    blocks.push(
      orderedList ? <ol key={`list-${blocks.length}`} className="my-3 list-decimal space-y-1 pl-5">
        {listItems.map((item, index) => <li key={index}>{renderInlineMarkdown(item, onCitation, approvedUrls)}</li>)}
      </ol> : <ul key={`list-${blocks.length}`} className="my-3 list-disc space-y-1 pl-5">
        {listItems.map((item, index) => <li key={index}>{renderInlineMarkdown(item, onCitation, approvedUrls)}</li>)}
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
      blocks.push(<h3 key={`heading-${blocks.length}`} className="mt-4 mb-2 text-base font-semibold text-[var(--heading)]">{renderInlineMarkdown(heading[1], onCitation, approvedUrls)}</h3>);
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

// Matches Tailwind's lg breakpoint, where the workspace switches to the fixed-height desktop layout.
const DESKTOP_QUERY = "(min-width: 64rem)";

function subscribeToDesktopQuery(onChange: () => void) {
  const query = window.matchMedia(DESKTOP_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

const getDesktopSnapshot = () => window.matchMedia(DESKTOP_QUERY).matches;
const getServerDesktopSnapshot = () => false;
const toPercent = (ratio: number) => Math.round(ratio * 100);

function CharacterCount({ id, length, max, label, showCount = true }: {
  id: string;
  length: number;
  max: number;
  label: string;
  showCount?: boolean;
}) {
  const atLimit = length >= max;
  if (!showCount && !atLimit) return null;
  return (
    <p id={id} className={`mt-2 text-xs ${atLimit ? "font-semibold text-[var(--heading)]" : "text-[var(--text)]"}`}>
      {atLimit ? `${label} can be at most ${max.toLocaleString()} characters. Extra text is not added.` : `${length.toLocaleString()}/${max.toLocaleString()} characters`}
    </p>
  );
}

export default function TransferPage() {
  const [form, setForm] = useState<TransferForm>(emptyForm);
  const [step, setStep] = useState(1);
  const [summary, setSummary] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<DisplayChatMessage[]>([]);
  const [isResponding, setIsResponding] = useState(false);
  const [copyStatuses, setCopyStatuses] = useState<Record<string, "success" | "error">>({});
  const copyTimers = useRef<Record<string, number>>({});
  const [isExample, setIsExample] = useState(false);
  const [detailsChanged, setDetailsChanged] = useState(false);
  const [references, setReferences] = useState<PublicSevisTransferReference[]>([]);
  const [referenceNotices, setReferenceNotices] = useState<string[]>([]);
  const [generatedPlan, setGeneratedPlan] = useState<GeneratedPlan | null>(null);
  const [planGenerating, setPlanGenerating] = useState(false);
  const [planError, setPlanError] = useState<PlanError | null>(null);
  const [planOutOfDate, setPlanOutOfDate] = useState(false);
  const [checkedPlanItems, setCheckedPlanItems] = useState<Record<string, boolean>>({});
  const [planRequests] = useState(createLatestRequestTracker);
  // Desktop split ratio, kept in page memory so it survives Edit details and hiding Details.
  const [chatRatio, setChatRatio] = useState(SPLIT_DEFAULT_CHAT_RATIO);
  const editHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => () => planRequests.cancel(), [planRequests]);

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
    if (step === 2) editHeadingRef.current?.focus();
  }, [step]);

  useEffect(() => () => {
    Object.values(copyTimers.current).forEach((timer) => window.clearTimeout(timer));
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
    setGeneratedPlan(null);
    setPlanError(null);
    setPlanOutOfDate(false);
    setCheckedPlanItems({});
    setChatMessages([
      {
        role: "assistant",
        kind: "demo",
        text: `Thanks for sharing this context. ${formatSituation(form.situation, form.currentSchool.trim())} You are considering ${targetSchoolName || "a school you have not selected yet"}. I can help you organize details and questions for your DSO (Designated School Official, the staff member responsible for international student services).`,
      },
    ]);
    setStep(3);
  };

  const editDetails = () => {
    // Cancel an in-flight plan so it cannot overlap with a regeneration after editing.
    if (planGenerating) {
      planRequests.cancel();
      setPlanGenerating(false);
      setPlanError({ message: "Plan generation was cancelled because you started editing your details. Generate the plan again when you are ready.", retryable: true });
    }
    setStep(2);
  };

  const saveDetails = () => {
    setSummary(generatedSummary);
    setDetailsChanged(true);
    setPlanOutOfDate(Boolean(generatedPlan));
    setStep(3);
  };

  const generatePlan = async () => {
    if (planGenerating) return;
    if (generatedPlan && !window.confirm("Regenerating will replace the current plan and its checked items. Continue?")) {
      return;
    }
    const request = planRequests.start();
    setPlanGenerating(true);
    setPlanError(null);
    try {
      const response = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentData: form }),
        signal: request.signal,
      });
      const result: AiRouteResult & {
        plan?: PreparationPlan;
        references?: PlanReference[];
        generatedAt?: string;
      } = await response.json();
      if (!request.isCurrent()) return;
      const guardMessage = describeGuardFailure(response.status, result);
      if (guardMessage) {
        setPlanError({ message: guardMessage, retryable: true });
        return;
      }
      if (result.status !== "ready" || !result.plan || !result.references || !result.generatedAt) {
        setPlanError({
          message: result.message || "The preparation plan could not be generated. Please try again.",
          retryable: result.retryable !== false,
        });
        return;
      }
      setGeneratedPlan({ ...result.plan, references: result.references, generatedAt: result.generatedAt });
      setCheckedPlanItems({});
      setPlanOutOfDate(false);
    } catch {
      if (request.isCurrent()) {
        setPlanError({ message: "The preparation plan could not be reached. Please try again.", retryable: true });
      }
    } finally {
      if (request.isCurrent()) setPlanGenerating(false);
    }
  };

  const submitChat = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = chatInput.trim();
    if (!message || isResponding || message.length > MAX_CHAT_MESSAGE_LENGTH) return;
    const history = buildChatHistory(chatMessages, message);
    setChatMessages([...chatMessages, { role: "user", text: message }]);
    setChatInput("");
    setIsResponding(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentData: form,
          messages: history,
        }),
      });
      const result: AiRouteResult & {
        blocks?: ChatResponseBlock[];
        truncated?: boolean;
      } = await response.json();
      const guardMessage = describeGuardFailure(response.status, result);
      if (guardMessage) {
        setChatMessages((messages) => [
          ...messages,
          {
            role: "assistant",
            kind: "status",
            text: guardMessage,
            retryText: message,
          },
        ]);
        return;
      }
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
          retryText: result.status === "ready" ? undefined : message,
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

  const copyText = async (text: string, key: string) => {
    if (copyTimers.current[key]) window.clearTimeout(copyTimers.current[key]);
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatuses((current) => ({ ...current, [key]: "success" }));
    } catch {
      setCopyStatuses((current) => ({ ...current, [key]: "error" }));
    }
    copyTimers.current[key] = window.setTimeout(() => {
      setCopyStatuses((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
    }, 2000);
  };

  const copyPlan = () => {
    if (!generatedPlan || planOutOfDate) return;
    const items = generatedPlan.preparationItems.map((item) => `- ${item.title}: ${item.description}`).join("\n");
    const sources = generatedPlan.references.map((reference) => `${reference.publisher}: ${reference.title} - ${reference.url} (Verified ${reference.lastVerifiedAt || "Not verified"}; ${reference.schoolScope})`).join("\n");
    copyText([
      "Claude-generated preparation plan",
      `Generated: ${generatedPlan.generatedAt}`,
      `Situation: ${generatedPlan.situationSummary}`,
      "Preparation items:",
      items || "None",
      "Current DSO questions:",
      generatedPlan.currentDsoQuestions.join("\n- "),
      "Target-school DSO questions:",
      generatedPlan.targetDsoQuestions.join("\n- "),
      "Coverage limits:",
      generatedPlan.coverageLimits.join("\n- ") || "None stated",
      "Available background references (not a complete OPT-specific process):",
      sources || "None",
    ].join("\n"), "plan");
  };

  return (
    <div className={`${step === 3 ? "min-h-screen lg:flex lg:h-[100dvh] lg:flex-col lg:overflow-hidden" : "min-h-screen"} bg-[linear-gradient(135deg,var(--background)_0%,var(--surface)_55%,var(--surface-muted)_100%)] text-[var(--text)]`}>
      <header className={`mx-auto flex w-full max-w-7xl shrink-0 flex-wrap items-center justify-between gap-2 px-4 sm:px-8 ${step === 3 ? "py-2 sm:py-3" : "py-6"}`}>
        <Link href="/" aria-label="Claude Campus Compass home" className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Image src="/campus-compass-icon.png" alt="" width={48} height={48} className="h-8 w-8 shrink-0 object-contain sm:h-12 sm:w-12" />
          <span className="text-base font-semibold tracking-tight sm:text-xl">Claude Campus Compass</span>
        </Link>
        <span className="rounded-full border border-[var(--accent)] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--heading)] sm:px-4 sm:py-1.5 sm:text-xs sm:tracking-[0.15em]">
          Interactive Demo
        </span>
      </header>

      <main className={`mx-auto w-full max-w-7xl px-4 sm:px-8 ${step === 3 ? "pb-6 lg:min-h-0 lg:flex-1 lg:overflow-hidden lg:pb-3" : "pb-12"}`}>
        {step < 3 ? (
          <div className="mx-auto max-w-3xl pt-8 sm:pt-12">
            <div className="mb-8">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--heading)]">F-1 SEVIS transfer</p>
              <h1 ref={editHeadingRef} tabIndex={-1} className="mt-3 text-3xl font-semibold tracking-[-0.03em] outline-none sm:text-4xl">
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
                    <input id="currentSchool" value={form.currentSchool} onChange={(event) => updateForm("currentSchool", event.target.value)} placeholder="e.g. Lakeview Community College" maxLength={MAX_FIELD_LENGTH} aria-describedby="currentSchoolLimit" className="min-h-12 w-full rounded-xl border border-[var(--accent)] bg-[var(--surface)] px-4 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--surface-muted)]" aria-invalid={currentSchoolInvalid} required />
                    {form.currentSchool.length > 0 && currentSchoolInvalid ? <p className="mt-2 text-xs text-[var(--heading)]">Enter your current school name. It cannot be blank.</p> : null}
                    <CharacterCount id="currentSchoolLimit" length={form.currentSchool.length} max={MAX_FIELD_LENGTH} label="School name" showCount={false} />
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
                          maxLength={MAX_FIELD_LENGTH}
                          aria-describedby="targetSchoolCustomLimit"
                          className="min-h-12 w-full rounded-xl border border-[var(--accent)] bg-[var(--surface)] px-4 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--surface-muted)]"
                          aria-invalid={customTargetSchoolInvalid}
                          required
                        />
                        {customTargetSchoolInvalid ? <p className="mt-2 text-xs text-[var(--heading)]">Enter a school name. It cannot be blank.</p> : null}
                        <CharacterCount id="targetSchoolCustomLimit" length={form.targetSchoolCustom.length} max={MAX_FIELD_LENGTH} label="School name" showCount={false} />
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
                    <textarea id="questions" value={form.questions} onChange={(event) => updateForm("questions", event.target.value)} rows={4} maxLength={MAX_FIELD_LENGTH} aria-describedby="questionsCount" placeholder="Add questions you want to discuss with your DSO..." className="w-full resize-y rounded-xl border border-[var(--accent)] bg-[var(--surface)] px-4 py-3 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--surface-muted)]" />
                    <CharacterCount id="questionsCount" length={form.questions.length} max={MAX_FIELD_LENGTH} label="Questions" />
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
            isExample={isExample}
            chatRatio={chatRatio}
            setChatRatio={setChatRatio}
            summary={summary}
            onEditDetails={editDetails}
            chatInput={chatInput}
            setChatInput={setChatInput}
            chatMessages={chatMessages}
            isResponding={isResponding}
            submitChat={submitChat}
            copyStatuses={copyStatuses}
            copyText={copyText}
            detailsChanged={detailsChanged}
            references={references}
            referenceNotices={referenceNotices}
            generatedPlan={generatedPlan}
            planGenerating={planGenerating}
            planError={planError}
            planOutOfDate={planOutOfDate}
            generatePlan={generatePlan}
            checkedPlanItems={checkedPlanItems}
            togglePlanItem={(id) => setCheckedPlanItems((current) => ({ ...current, [id]: !current[id] }))}
            copyPlan={copyPlan}
          />
        )}
      </main>
    </div>
  );
}

function ConsultationView({
  form,
  isExample,
  chatRatio,
  setChatRatio,
  summary,
  onEditDetails,
  chatInput,
  setChatInput,
  chatMessages,
  isResponding,
  submitChat,
  copyStatuses,
  copyText,
  detailsChanged,
  references,
  referenceNotices,
  generatedPlan,
  planGenerating,
  planError,
  planOutOfDate,
  generatePlan,
  checkedPlanItems,
  togglePlanItem,
  copyPlan,
}: {
  form: TransferForm;
  isExample: boolean;
  chatRatio: number;
  setChatRatio: (ratio: number) => void;
  summary: string;
  onEditDetails: () => void;
  chatInput: string;
  setChatInput: (value: string) => void;
  chatMessages: DisplayChatMessage[];
  isResponding: boolean;
  submitChat: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  copyStatuses: Record<string, "success" | "error">;
  copyText: (text: string, label: string) => void;
  detailsChanged: boolean;
  references: PublicSevisTransferReference[];
  referenceNotices: string[];
  generatedPlan: GeneratedPlan | null;
  planGenerating: boolean;
  planError: PlanError | null;
  planOutOfDate: boolean;
  generatePlan: () => Promise<void>;
  checkedPlanItems: Record<string, boolean>;
  togglePlanItem: (id: string) => void;
  copyPlan: () => void;
}) {
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [openSources, setOpenSources] = useState<Record<number, boolean>>({});
  const [expandedQuotes, setExpandedQuotes] = useState<Record<string, boolean>>({});
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const workspaceHeadingRef = useRef<HTMLHeadingElement>(null);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const referenceUrls = useMemo(() => references.map((reference) => reference.url), [references]);
  const chatAnnouncement = latestChatAnnouncement(chatMessages, isResponding);
  const planAnnouncement = planGenerating
    ? "Generating preparation plan."
    : planError
      ? `Preparation plan: ${planError.message}`
      : generatedPlan
        ? "Preparation plan ready."
        : "";

  useEffect(() => {
    workspaceHeadingRef.current?.focus();
  }, []);

  // Desktop split pane. Measured against the workspace grid itself, not the window.
  const workspaceGridRef = useRef<HTMLDivElement>(null);
  const separatorRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; left: number; width: number; ratio: number; moved: boolean; userSelect: string; cursor: string } | null>(null);
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);
  const [gridWidth, setGridWidth] = useState<number | null>(null);
  const isDesktop = useSyncExternalStore(subscribeToDesktopQuery, getDesktopSnapshot, getServerDesktopSnapshot);
  const splitActive = detailsOpen && isDesktop && (gridWidth === null || canSplit(gridWidth));
  const stackedDesktop = detailsOpen && isDesktop && !splitActive;
  const effectiveChatRatio = gridWidth === null ? chatRatio : clampChatRatio(chatRatio, gridWidth);
  const ratioBounds = gridWidth === null ? { min: effectiveChatRatio, max: effectiveChatRatio } : chatRatioBounds(gridWidth);
  const splitValueText = (ratio: number) => `Chat ${toPercent(ratio)}%, details ${100 - toPercent(ratio)}%`;

  useEffect(() => {
    const element = workspaceGridRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setGridWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const finishSplitDrag = () => {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    document.body.style.userSelect = drag.userSelect;
    document.body.style.cursor = drag.cursor;
    setIsDraggingSplit(false);
    // A click without movement keeps the stored preference instead of its clamped value.
    if (drag.moved) setChatRatio(drag.ratio);
  };

  useEffect(() => () => {
    // Restore text selection if the workspace unmounts mid-drag.
    const drag = dragRef.current;
    if (drag) {
      document.body.style.userSelect = drag.userSelect;
      document.body.style.cursor = drag.cursor;
    }
  }, []);

  const startSplitDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const grid = workspaceGridRef.current;
    if (event.button !== 0 || !grid) return;
    event.preventDefault();
    const rect = grid.getBoundingClientRect();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      left: rect.left,
      width: rect.width,
      ratio: clampChatRatio(chatRatio, rect.width),
      moved: false,
      userSelect: document.body.style.userSelect,
      cursor: document.body.style.cursor,
    };
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    setIsDraggingSplit(true);
  };

  const moveSplitDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    drag.ratio = chatRatioFromPointer(event.clientX, drag.left, drag.width);
    drag.moved = true;
    // Update only the CSS variable while dragging so chat and plan content are not re-rendered per move.
    workspaceGridRef.current?.style.setProperty("--chat-ratio", String(drag.ratio));
    separatorRef.current?.setAttribute("aria-valuenow", String(toPercent(drag.ratio)));
    separatorRef.current?.setAttribute("aria-valuetext", splitValueText(drag.ratio));
  };

  const handleSplitKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const width = gridWidth ?? workspaceGridRef.current?.getBoundingClientRect().width;
    if (!width) return;
    const next = event.key === "ArrowLeft"
      ? nudgeChatRatio(chatRatio, -1, width)
      : event.key === "ArrowRight"
        ? nudgeChatRatio(chatRatio, 1, width)
        : event.key === "Home"
          ? chatRatioBounds(width).min
          : event.key === "End"
            ? chatRatioBounds(width).max
            : null;
    if (next === null) return;
    event.preventDefault();
    setChatRatio(next);
  };

  const resetSplit = () => setChatRatio(SPLIT_DEFAULT_CHAT_RATIO);
  const actionButtonClass = "cursor-pointer rounded-full text-[var(--heading)] transition-colors hover:bg-[#D1E9EB] active:bg-[#B8DADD] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2";
  const copyStatusLabel = (key: string, label: string) => copyStatuses[key] === "success" ? "✓ Copied" : copyStatuses[key] === "error" ? "Copy failed" : label;

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
    <div className="flex flex-col pt-1 sm:pt-3 lg:h-full lg:min-h-0">
      {/* Announce only the newest status or answer, not the whole conversation. */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">{chatAnnouncement}</div>
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">{planAnnouncement}</div>
      <div className="mb-2 flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--heading)]">Your transfer planning workspace</p>
          <h1 ref={workspaceHeadingRef} tabIndex={-1} className="mt-1 text-lg font-semibold tracking-[-0.03em] outline-none sm:text-2xl">A clearer conversation starts here.</h1>
        </div>
        <div className="flex items-center gap-2">
          {splitActive ? (
            <button type="button" onClick={resetSplit} title="Restore the default 70% chat / 30% details split" className={`${actionButtonClass} px-3 py-1.5 text-xs font-semibold underline underline-offset-4`}>
              Reset layout
            </button>
          ) : null}
          <button type="button" onClick={() => setDetailsOpen((open) => !open)} aria-expanded={detailsOpen} aria-controls="workspace-details" className={`${actionButtonClass} border border-[var(--primary)] px-3 py-1.5 text-xs font-semibold`}>
            {detailsOpen ? "Hide details" : "Details"}
          </button>
          <Link href="/" className={`${actionButtonClass} border border-[var(--primary)] px-3 py-1.5 text-xs font-semibold`}>Exit demo</Link>
        </div>
      </div>
      <div className="mb-2 shrink-0"><DemoNotice /></div>
      <div
        ref={workspaceGridRef}
        style={{ "--chat-ratio": String(chatRatio), gridTemplateColumns: splitActive ? SPLIT_GRID_TEMPLATE : undefined } as CSSProperties}
        className={
          splitActive
            ? "grid items-stretch gap-0 overflow-visible lg:min-h-0 lg:flex-1 lg:overflow-hidden"
            : stackedDesktop
              ? "grid grid-cols-1 items-stretch gap-5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto"
              : "grid grid-cols-1 items-stretch gap-5 overflow-visible lg:min-h-0 lg:flex-1 lg:overflow-hidden"
        }
      >
        <section id="workspace-chat" className={`order-1 flex min-h-[30rem] h-[min(70dvh,42rem)] min-w-0 flex-col rounded-[2rem] border border-[var(--accent)] bg-[var(--surface)]/75 p-4 shadow-[0_20px_60px_rgba(6,75,96,0.08)] sm:p-6 ${stackedDesktop ? "" : "lg:h-full lg:min-h-0"} ${detailsOpen ? "" : "w-full"}`}>
          <div className="mb-5 flex items-center justify-between border-b border-[var(--accent)] pb-4">
            <div>
              <h2 className="font-semibold">Ask about your situation</h2>
              <p className="mt-1 text-xs text-[var(--text)]">Ask a focused question about the information you provided.</p>
            </div>
            {isExample ? <span className="rounded-full bg-[var(--surface-muted)] px-3 py-1 text-xs font-semibold text-[var(--heading)]">Fictional example</span> : null}
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
                    {message.role === "user" ? "You" : message.kind === "claude" ? "Claude" : message.kind === "error" ? "Service error" : message.kind === "status" ? "Service status" : isExample ? "Fictional example" : "Campus Compass"}
                  </p>
                  {(() => {
                    const sources = numberCitationSources(message.citations || []);
                    const approvedUrls = buildApprovedUrlSet([...referenceUrls, ...sources.map((source) => source.url)]);
                    const content = message.kind === "claude" && message.blocks ? (
                      <div className="max-w-none text-sm">
                        <MarkdownContent
                          text={message.blocks.map((block) => {
                            const markers = citationMarkers(block.citations, sources).map((number) => `[[CITATION:${number}]]`).join(" ");
                            return `${block.text}${markers ? ` ${markers}` : ""}`;
                          }).join("\n")}
                          citationNumbers={[]}
                          approvedUrls={approvedUrls}
                          onCitation={(number) => {
                            setOpenSources((current) => ({ ...current, [index]: true }));
                            window.setTimeout(() => document.getElementById(citationSourceElementId(index, number))?.focus(), 0);
                          }}
                        />
                        {message.truncated ? <p className="mt-3 rounded-lg border border-[var(--accent)] bg-[var(--surface-muted)] p-3 text-sm font-semibold text-[var(--heading)]">This answer reached its output limit and may be incomplete. Please ask a focused follow-up question.</p> : null}
                      </div>
                    ) : (
                      <div className={`text-sm ${message.role === "user" ? "rounded-2xl rounded-br-sm bg-[var(--primary)] px-4 py-3 text-white" : ""}`}>
                        <MarkdownContent text={message.text} citationNumbers={[]} approvedUrls={approvedUrls} onCitation={() => undefined} />
                      </div>
                    );
                    if (message.kind !== "claude" || sources.length === 0) return content;
                    const expanded = openSources[index] === true;
                    return <>
                      {content}
                      <div className="mt-3 w-full">
                        <button type="button" onClick={() => setOpenSources((current) => ({ ...current, [index]: !expanded }))} aria-expanded={expanded} className="text-xs font-semibold text-[var(--primary)] underline underline-offset-2">
                          Sources · {sources.length}
                        </button>
                        {expanded ? <ul className="mt-2 space-y-3 rounded-xl border border-[var(--accent)] bg-[var(--surface)] p-3 text-xs leading-5">
                          {sources.map((source) => <li key={source.referenceId} id={citationSourceElementId(index, source.number)} tabIndex={-1}>
                            <span className="mr-1 font-semibold text-[var(--heading)]">[{source.number}]</span>
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
                      </div>
                    </>;
                  })()}
                {isUnansweredUserMessage(chatMessages, index) ? (
                  <p className="mt-1 text-right text-xs text-[var(--text)]">Not answered. This question is not included in later conversation context.</p>
                ) : null}
                {(message.kind === "error" || message.kind === "status") && message.retryText ? (
                  <button
                    type="button"
                    onClick={() => {
                      setChatInput(message.retryText || "");
                      chatInputRef.current?.focus();
                    }}
                    className="mt-1 text-xs font-semibold text-[var(--primary)] underline underline-offset-2"
                  >
                    Put question back in the message box
                  </button>
                ) : null}
                </div>
              </div>
            ))}
            {isResponding ? <p className="text-xs text-[var(--text)]">Requesting Claude guidance...</p> : null}
            {showJumpToLatest ? <button type="button" onClick={jumpToLatest} className="sticky bottom-2 left-1/2 z-10 -translate-x-1/2 rounded-full border border-[var(--primary)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--primary)] shadow-sm">Jump to latest</button> : null}
          </div>
          <form onSubmit={submitChat} autoComplete="off" className="flex shrink-0 flex-col gap-2 border-t border-[var(--accent)] pt-4 sm:flex-row sm:pt-5">
            <label htmlFor="chatInput" className="sr-only">Ask a question</label>
            <div className="flex min-w-0 flex-1 flex-col">
              <textarea ref={chatInputRef} id="chatInput" value={chatInput} onChange={(event) => setChatInput(event.target.value)} onKeyDown={handleChatInputKeyDown} placeholder="Type a question for the demo..." autoComplete="off" rows={2} maxLength={MAX_CHAT_MESSAGE_LENGTH} aria-describedby="chatInputCount" className="min-h-12 w-full resize-y rounded-xl border border-[var(--accent)] bg-[var(--surface)] px-4 py-3 text-base outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--surface-muted)]" />
              <CharacterCount id="chatInputCount" length={chatInput.length} max={MAX_CHAT_MESSAGE_LENGTH} label="A message" />
            </div>
            <button type="submit" disabled={!chatInput.trim() || isResponding} className="min-h-12 rounded-xl bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white hover:bg-[var(--heading)] disabled:cursor-not-allowed disabled:bg-[var(--accent)] sm:self-end">Send</button>
          </form>
        </section>

        {splitActive ? (
          <div
            ref={separatorRef}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize chat and details panels"
            aria-controls="workspace-chat workspace-details"
            aria-valuemin={toPercent(ratioBounds.min)}
            aria-valuemax={toPercent(ratioBounds.max)}
            aria-valuenow={toPercent(effectiveChatRatio)}
            aria-valuetext={splitValueText(effectiveChatRatio)}
            tabIndex={0}
            title="Drag or use the Left and Right arrow keys to resize. Double-click to reset."
            data-dragging={isDraggingSplit ? "true" : "false"}
            onPointerDown={startSplitDrag}
            onPointerMove={moveSplitDrag}
            onPointerUp={finishSplitDrag}
            onPointerCancel={finishSplitDrag}
            onLostPointerCapture={finishSplitDrag}
            onMouseDown={(event) => event.preventDefault()}
            onDoubleClick={resetSplit}
            onKeyDown={handleSplitKeyDown}
            className="group relative order-2 flex cursor-col-resize touch-none select-none justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
          >
            <span aria-hidden="true" className="my-6 w-0.5 rounded-full bg-[var(--accent)]/30 transition-colors group-hover:bg-[var(--accent)] group-focus-visible:bg-[var(--primary)] group-data-[dragging=true]:bg-[var(--heading)]" />
            <span aria-hidden="true" className="absolute top-1/2 flex h-10 w-3 -translate-y-1/2 flex-col items-center justify-center gap-1 rounded-full border border-[var(--accent)] bg-[var(--surface)] shadow-sm transition-colors group-hover:border-[var(--primary)] group-hover:bg-[var(--surface-muted)] group-focus-visible:border-[var(--primary)] group-data-[dragging=true]:border-[var(--heading)] group-data-[dragging=true]:bg-[var(--surface-muted)]">
              <span className="h-1 w-1 rounded-full bg-[var(--heading)]" />
              <span className="h-1 w-1 rounded-full bg-[var(--heading)]" />
              <span className="h-1 w-1 rounded-full bg-[var(--heading)]" />
            </span>
          </div>
        ) : null}

        {detailsOpen ? <aside id="workspace-details" className="order-3 flex min-w-0 flex-col overflow-visible lg:min-h-0 lg:overflow-hidden">
          <div className="space-y-6 pr-1 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
          <section className="rounded-[2rem] border border-[var(--accent)] bg-[var(--surface)]/75 p-6 shadow-[0_20px_60px_rgba(6,75,96,0.08)]">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold">Your situation summary</h2>
              <button type="button" onClick={() => copyText(summary, "summary")} aria-live="polite" className={`${actionButtonClass} min-w-20 px-2 py-1 text-xs font-semibold underline underline-offset-4`}>{copyStatusLabel("summary", "Copy")}</button>
            </div>
            <p className="mt-4 rounded-xl border border-[var(--accent)] bg-[var(--surface)] p-3 text-sm leading-6 text-[var(--text)]">{summary}</p>
            <button type="button" onClick={onEditDetails} className={`${actionButtonClass} mt-3 px-2 py-1 text-xs font-semibold underline underline-offset-4`}>Edit details</button>
            <button type="button" onClick={() => copyText(`${summary}\n\nQuestions: ${form.questions || "None added"}`, "summaryQuestions")} aria-live="polite" className={`${actionButtonClass} mt-3 flex min-h-10 w-full items-center justify-center rounded-xl border border-[var(--primary)] px-4 py-2.5 text-xs font-semibold`}>{copyStatusLabel("summaryQuestions", "Copy summary + questions")}</button>
          </section>
          <section className="rounded-[2rem] border border-[var(--accent)] bg-[var(--surface-muted)] p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">Preparation plan</h2>
                <p className="mt-1 text-xs leading-5 text-[var(--text)]">
                  {generatedPlan ? "Your Claude-generated plan is shown below. You can regenerate it when your details change." : "Your basic preparation checklist is ready. Generate a Claude plan when you are ready."}
                </p>
              </div>
              <button type="button" onClick={generatePlan} disabled={planGenerating} className="cursor-pointer rounded-xl bg-[var(--primary)] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[var(--heading)] active:bg-[var(--heading)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 disabled:cursor-wait disabled:bg-[var(--accent)]">
                {planGenerating ? "Generating plan..." : generatedPlan ? "Regenerate plan" : "Generate my plan"}
              </button>
            </div>
            {!generatedPlan ? <ul className="mt-4 space-y-3 text-sm leading-5 text-[var(--text)]">
              {checklistFor(form).map((item) => <li key={item} className="flex gap-3"><span className="mt-1 h-4 w-4 shrink-0 rounded border border-[var(--primary)] bg-[var(--surface)]" />{item}</li>)}
            </ul> : null}
            {planError ? <p className="mt-4 rounded-xl border border-[var(--accent)] bg-[var(--surface)] px-3 py-2 text-xs leading-5 text-[var(--heading)]">{planError.message} {planError.retryable && !planGenerating ? <button type="button" onClick={generatePlan} className="font-semibold underline">Retry</button> : null}</p> : null}
            {planOutOfDate ? <p className="mt-4 rounded-xl border border-[var(--accent)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold leading-5 text-[var(--heading)]">Out of date: your structured details changed. Regenerate plan to use the latest information.</p> : null}
            {generatedPlan ? (
              <div className="mt-5 space-y-4 border-t border-[var(--accent)] pt-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text)]">
                  <span className="font-semibold text-[var(--heading)]">Claude-generated</span>
                  <button type="button" onClick={copyPlan} disabled={planOutOfDate} title={planOutOfDate ? "Regenerate the plan before copying it." : undefined} aria-live="polite" className={`${actionButtonClass} inline-flex min-w-[92px] items-center justify-center px-3 py-1 text-center text-xs font-semibold underline underline-offset-2 disabled:cursor-not-allowed disabled:opacity-60`}>{planOutOfDate ? "Regenerate to copy" : copyStatusLabel("plan", "Copy plan")}</button>
                </div>
                <p className="text-sm leading-6">{generatedPlan.situationSummary}</p>
                <p className="text-xs text-[var(--text)]">Generated {new Date(generatedPlan.generatedAt).toLocaleString()} · Policy verification dates below refer to the sources, not this plan.</p>
                {generatedPlan.missingInformation.length > 0 ? <div><h3 className="text-sm font-semibold text-[var(--heading)]">Information to add</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{generatedPlan.missingInformation.map((item) => <li key={item}>{item}</li>)}</ul></div> : null}
                <div>
                  <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold text-[var(--heading)]">Preparation items</h3><span className="text-xs text-[var(--text)]">{generatedPlan.preparationItems.filter((item) => checkedPlanItems[item.id]).length}/{generatedPlan.preparationItems.length} complete</span></div>
                  <ul className="mt-2 space-y-2 text-sm">
                    {generatedPlan.preparationItems.map((item, itemIndex) => <li key={item.id} className="flex gap-2">
                      <input id={`plan-item-${itemIndex}`} type="checkbox" checked={checkedPlanItems[item.id] === true} onChange={() => togglePlanItem(item.id)} className="mt-1 h-4 w-4 shrink-0 accent-[var(--primary)]" />
                      <span><label htmlFor={`plan-item-${itemIndex}`} className="cursor-pointer"><strong>{item.title}</strong></label> <span className="text-xs text-[var(--text)]">({item.basisType})</span><br />{item.description}{item.basisType === "source_based" && item.referenceIds.length > 0 ? <><br /><span className="text-xs text-[var(--text)]">Source basis: {item.referenceIds.map((id) => generatedPlan.references.find((reference) => reference.id === id)?.title).filter(Boolean).join("; ")}</span></> : null}</span>
                    </li>)}
                  </ul>
                </div>
                {generatedPlan.currentDsoQuestions.length > 0 ? <div><h3 className="text-sm font-semibold text-[var(--heading)]">Questions for your current DSO</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{generatedPlan.currentDsoQuestions.map((item) => <li key={item}>{item}</li>)}</ul></div> : null}
                {generatedPlan.targetDsoQuestions.length > 0 ? <div><h3 className="text-sm font-semibold text-[var(--heading)]">Questions for the target-school DSO</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{generatedPlan.targetDsoQuestions.map((item) => <li key={item}>{item}</li>)}</ul></div> : null}
                {generatedPlan.coverageLimits.length > 0 ? <div><h3 className="text-sm font-semibold text-[var(--heading)]">Coverage limits</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{generatedPlan.coverageLimits.map((item) => <li key={item}>{item}</li>)}</ul></div> : null}
                <div><h3 className="text-sm font-semibold text-[var(--heading)]">Available background references</h3><p className="mt-1 text-xs leading-5 text-[var(--text)]">These references provide background context and do not constitute a complete OPT-specific process.</p><ul className="mt-2 space-y-2 text-xs">{generatedPlan.references.map((reference) => <li key={reference.id}><a href={reference.url} target="_blank" rel="noreferrer" className="font-semibold text-[var(--primary)] underline">{reference.title}</a><br />{reference.publisher} · Verified {reference.lastVerifiedAt || "Not verified"} · {reference.schoolScope}</li>)}</ul></div>
              </div>
            ) : null}
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
      <p className="mt-2 shrink-0 pb-[env(safe-area-inset-bottom)] text-center text-xs leading-5 text-[var(--text)]">Independent student project providing information navigation. Confirm personal details with your school adviser.</p>
    </div>
  );
}
