"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

type TransferForm = {
  currentSchool: string;
  targetSchool: string;
  targetSchoolCustom: string;
  situation: string;
  programEnd: string;
  programStart: string;
  questions: string;
};

type ChatMessage = {
  role: "assistant" | "user";
  text: string;
};

const emptyForm: TransferForm = {
  currentSchool: "",
  targetSchool: "",
  targetSchoolCustom: "",
  situation: "",
  programEnd: "",
  programStart: "",
  questions: "",
};

const exampleForm: TransferForm = {
  currentSchool: "Lakeview Community College",
  targetSchool: "Northbridge University",
  targetSchoolCustom: "",
  situation: "Currently enrolled",
  programEnd: "2027-05-15",
  programStart: "2027-08-23",
  questions: "What should I ask my current and future international student advisers?",
};

const situationLabels: Record<string, string> = {
  "Currently enrolled": "currently enrolled",
  "Currently on OPT": "currently on OPT",
  "Completed my program": "done with my program",
  Other: "in another situation",
  "Not sure": "not sure about my current status",
};

function formatSituation(situation: string, school: string) {
  const phrase = situationLabels[situation] || "not sure about my current status";
  return `I am ${phrase} at ${school}.`;
}

function getTargetSchool(form: TransferForm) {
  if (form.targetSchool === "another school") return form.targetSchoolCustom.trim();
  if (form.targetSchool === "not sure yet" || !form.targetSchool) return "";
  return form.targetSchool;
}

function formatDate(value: string) {
  if (value === "unknown") return "a date I have not confirmed yet";
  if (!value) return "a date I have not provided";
  return value;
}

function checklistFor(form: TransferForm) {
  const items: string[] = [];
  if (form.programEnd === "unknown") items.push("Fill in your current program end date when you have confirmed it.");
  if (form.programStart === "unknown") items.push("Fill in your target program start date when you have confirmed it.");
  if (!form.targetSchool || form.targetSchool === "not sure yet") {
    items.push("Confirm which target school you want to discuss with your adviser.");
  }
  items.push("Keep your current and target school information together.");
  items.push("Write down questions to confirm with your DSO.");
  return items;
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
      <label htmlFor={id} className="mb-2 block text-sm font-semibold text-[#25382d]">
        {label}
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id={id}
          type="date"
          value={isUnknown ? "" : value}
          onChange={(event) => onChange(event.target.value)}
          disabled={isUnknown}
          className="min-h-12 flex-1 rounded-xl border border-[#cbd8cc] bg-white px-4 text-sm text-[#25382d] outline-none transition focus:border-[#1d4d3a] focus:ring-2 focus:ring-[#d8e8d9] disabled:bg-[#edf1eb]"
        />
        <label className="flex min-h-12 items-center gap-2 rounded-xl border border-[#cbd8cc] bg-white px-4 text-sm text-[#53625a]">
          <input
            type="checkbox"
            checked={isUnknown}
            onChange={(event) => onChange(event.target.checked ? "unknown" : "")}
            className="h-4 w-4 accent-[#1d4d3a]"
          />
          Not sure
        </label>
      </div>
    </div>
  );
}

function DemoNotice() {
  return (
    <div className="rounded-xl border border-[#ead9c7] bg-[#fff8ef] px-4 py-3 text-sm leading-6 text-[#76583f]">
      <strong className="font-semibold">Demo mode.</strong> AI responses and verified policy
      sources are not connected yet.
    </div>
  );
}

export default function TransferPage() {
  const [form, setForm] = useState<TransferForm>(emptyForm);
  const [step, setStep] = useState(1);
  const [summary, setSummary] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isResponding, setIsResponding] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState("");
  const [isExample, setIsExample] = useState(false);
  const [detailsChanged, setDetailsChanged] = useState(false);

  useEffect(() => {
    if (window.location.search.includes("example=1")) {
      const timer = window.setTimeout(() => {
        setIsExample(true);
        setForm(exampleForm);
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, []);

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

  const submitChat = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = chatInput.trim();
    if (!message || isResponding) return;
    setChatMessages((messages) => [...messages, { role: "user", text: message }]);
    setChatInput("");
    setIsResponding(true);
    window.setTimeout(() => {
      setChatMessages((messages) => [
        ...messages,
        {
          role: "assistant",
          text: `I am using your current details for this demo: ${form.currentSchool.trim()}, ${situationLabels[form.situation] || "status not confirmed"}${targetSchoolName ? `, considering ${targetSchoolName}` : ""}. I can help you clarify what to discuss and identify missing details, but this demo does not provide policy requirements, deadlines, eligibility conclusions, or verified sources. Your DSO can confirm the next steps for your situation.`,
        },
      ]);
      setIsResponding(false);
    }, 500);
  };

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback(`${label} copied`);
    } catch {
      setCopyFeedback("Copy failed — please select and copy manually");
    }
    window.setTimeout(() => setCopyFeedback(""), 2200);
  };

  return (
    <div className="min-h-screen bg-[#f8f7f3] text-[#17231e]">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-6 sm:px-8">
        <Link href="/" className="flex items-center gap-3 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1d4d3a]">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1d4d3a] text-sm font-bold text-white">CC</span>
          <span className="font-semibold tracking-tight">Claude Campus Compass</span>
        </Link>
        <span className="rounded-full border border-[#cbd7cc] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#55705d] sm:px-4 sm:text-xs">
          Interactive Demo
        </span>
      </header>

      <main className="mx-auto w-full max-w-7xl px-5 pb-12 sm:px-8">
        {step < 3 ? (
          <div className="mx-auto max-w-3xl pt-8 sm:pt-12">
            <div className="mb-8">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#be6b43]">F-1 SEVIS transfer</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
                Let&apos;s make a clear starting point.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#607067]">
                A few questions will help organize a conversation with your international
                student adviser. This is information navigation only, not an immigration
                eligibility assessment.
              </p>
            </div>
            <div className="mb-6 flex items-center gap-3 text-xs font-semibold text-[#55705d]">
              {[1, 2].map((number) => (
                <div key={number} className="flex items-center gap-3">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-full ${step >= number ? "bg-[#1d4d3a] text-white" : "bg-[#dce6dc] text-[#55705d]"}`}>
                    {number}
                  </span>
                  {number === 1 ? <span className="h-px w-10 bg-[#cbd8cc] sm:w-20" /> : null}
                </div>
              ))}
              <span>{step === 1 ? "Your situation" : "Dates and questions"}</span>
            </div>
            <form
              className="rounded-[2rem] border border-[#d7e0d6] bg-white/75 p-6 shadow-[0_20px_60px_rgba(39,67,48,0.08)] sm:p-9"
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
                <div className="mb-6 rounded-xl border border-[#cbd8cc] bg-[#f1f5ef] px-4 py-3 text-sm text-[#53625a]">
                  <strong className="font-semibold text-[#1d4d3a]">Fictional example loaded.</strong> You can edit every field before continuing.
                </div>
              ) : null}
              {step === 1 ? (
                <div className="space-y-6">
                  <div>
                    <label htmlFor="currentSchool" className="mb-2 block text-sm font-semibold text-[#25382d]">Current school</label>
                    <input id="currentSchool" value={form.currentSchool} onChange={(event) => updateForm("currentSchool", event.target.value)} placeholder="e.g. Lakeview Community College" className="min-h-12 w-full rounded-xl border border-[#cbd8cc] bg-white px-4 text-sm outline-none focus:border-[#1d4d3a] focus:ring-2 focus:ring-[#d8e8d9]" aria-invalid={currentSchoolInvalid} required />
                    {form.currentSchool.length > 0 && currentSchoolInvalid ? <p className="mt-2 text-xs text-[#a34f38]">Enter your current school name. It cannot be blank.</p> : null}
                  </div>
                  <div>
                    <label htmlFor="targetSchool" className="mb-2 block text-sm font-semibold text-[#25382d]">Target school</label>
                    <select id="targetSchool" value={form.targetSchool} onChange={(event) => updateForm("targetSchool", event.target.value)} className="min-h-12 w-full rounded-xl border border-[#cbd8cc] bg-white px-4 text-sm outline-none focus:border-[#1d4d3a] focus:ring-2 focus:ring-[#d8e8d9]">
                      <option value="">Select a school or choose not sure</option>
                      <option value="not sure yet">Not sure yet</option>
                      <option value="Northbridge University">Northbridge University</option>
                      <option value="another school">Another school</option>
                    </select>
                    {customTargetSchoolSelected ? (
                      <div className="mt-4">
                        <label htmlFor="targetSchoolCustom" className="mb-2 block text-sm font-semibold text-[#25382d]">School name</label>
                        <input
                          id="targetSchoolCustom"
                          value={form.targetSchoolCustom}
                          onChange={(event) => updateForm("targetSchoolCustom", event.target.value)}
                          placeholder="e.g. Westbridge University"
                          className="min-h-12 w-full rounded-xl border border-[#cbd8cc] bg-white px-4 text-sm outline-none focus:border-[#1d4d3a] focus:ring-2 focus:ring-[#d8e8d9]"
                          aria-invalid={customTargetSchoolInvalid}
                          required
                        />
                        {customTargetSchoolInvalid ? <p className="mt-2 text-xs text-[#a34f38]">Enter a school name. It cannot be blank.</p> : null}
                      </div>
                    ) : null}
                  </div>
                  <div>
                    <label htmlFor="situation" className="mb-2 block text-sm font-semibold text-[#25382d]">Current situation</label>
                    <select id="situation" value={form.situation} onChange={(event) => updateForm("situation", event.target.value)} required className="min-h-12 w-full rounded-xl border border-[#cbd8cc] bg-white px-4 text-sm outline-none focus:border-[#1d4d3a] focus:ring-2 focus:ring-[#d8e8d9]">
                      <option value="">Choose one</option>
                      <option value="Currently enrolled">Currently enrolled</option>
                      <option value="Currently on OPT">Currently on OPT</option>
                      <option value="Completed my program">Completed my program</option>
                      <option value="Other">Other</option>
                      <option value="Not sure">Not sure</option>
                    </select>
                    <p className="mt-2 text-xs leading-5 text-[#718078]">Your DSO is the Designated School Official responsible for international student services at your school.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <DateChoice id="programEnd" label="Current program end date" value={form.programEnd} onChange={(value) => updateForm("programEnd", value)} />
                  <DateChoice id="programStart" label="Target program start date" value={form.programStart} onChange={(value) => updateForm("programStart", value)} />
                  <div>
                    <label htmlFor="questions" className="mb-2 block text-sm font-semibold text-[#25382d]">What would you like to ask? <span className="font-normal text-[#718078]">(optional)</span></label>
                    <textarea id="questions" value={form.questions} onChange={(event) => updateForm("questions", event.target.value)} rows={4} placeholder="Add questions you want to discuss with your DSO..." className="w-full resize-y rounded-xl border border-[#cbd8cc] bg-white px-4 py-3 text-sm outline-none focus:border-[#1d4d3a] focus:ring-2 focus:ring-[#d8e8d9]" />
                  </div>
                  <p className="text-xs leading-5 text-[#718078]">Dates can be marked “Not sure.” No name, passport number, SEVIS ID, or files are collected.</p>
                </div>
              )}
              <div className="mt-8 flex flex-wrap justify-between gap-3 border-t border-[#e5ebe3] pt-6">
                {step === 2 ? <button type="button" onClick={() => setStep(1)} className="rounded-full border border-[#b8c8ba] px-5 py-3 text-sm font-semibold text-[#1d4d3a] hover:bg-[#eaf0e8] focus-visible:outline-2 focus-visible:outline-[#1d4d3a]">Back</button> : <span />}
                <button type="submit" disabled={step === 1 ? !canContinueStepOne : !canContinueStepTwo} className="rounded-full bg-[#1d4d3a] px-6 py-3 text-sm font-semibold text-white hover:bg-[#28634b] disabled:cursor-not-allowed disabled:bg-[#aabbb0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1d4d3a]">
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
}: {
  form: TransferForm;
  summary: string;
  onEditDetails: () => void;
  chatInput: string;
  setChatInput: (value: string) => void;
  chatMessages: ChatMessage[];
  isResponding: boolean;
  submitChat: (event: FormEvent<HTMLFormElement>) => void;
  copyFeedback: string;
  copyText: (text: string, label: string) => void;
  detailsChanged: boolean;
}) {
  return (
    <div className="pt-6 sm:pt-10">
      <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#be6b43]">Your transfer planning workspace</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">A clearer conversation starts here.</h1>
        </div>
        <Link href="/" className="rounded-full border border-[#b8c8ba] px-4 py-2 text-sm font-semibold text-[#1d4d3a] hover:bg-[#eaf0e8]">Exit demo</Link>
      </div>
      <div className="mb-7"><DemoNotice /></div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.6fr)]">
        <section className="order-1 flex min-h-[390px] max-h-[calc(100vh-270px)] flex-col rounded-[2rem] border border-[#d7e0d6] bg-white/75 p-5 shadow-[0_20px_60px_rgba(39,67,48,0.08)] sm:p-7">
          <div className="mb-5 flex items-center justify-between border-b border-[#e5ebe3] pb-4">
            <div>
              <h2 className="font-semibold">Ask about your situation</h2>
              <p className="mt-1 text-xs text-[#718078]">Simulated guidance for organizing your questions.</p>
            </div>
            <span className="rounded-full bg-[#f1f5ef] px-3 py-1 text-xs font-semibold text-[#55705d]">Demo</span>
          </div>
          {detailsChanged ? (
            <p className="mb-4 rounded-xl border border-[#ead9c7] bg-[#fff8ef] px-3 py-2 text-xs leading-5 text-[#76583f]">
              Your details have changed. Earlier messages may refer to your previous details.
            </p>
          ) : null}
          <div className="flex-1 space-y-4 overflow-y-auto pb-5">
            {chatMessages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <p className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === "user" ? "rounded-br-sm bg-[#1d4d3a] text-white" : "rounded-bl-sm bg-[#f1f5ef] text-[#3d5145]"}`}>{message.text}</p>
              </div>
            ))}
            {isResponding ? <p className="text-xs text-[#718078]">Preparing a demo response...</p> : null}
          </div>
          <form onSubmit={submitChat} className="flex gap-2 border-t border-[#e5ebe3] pt-5">
            <label htmlFor="chatInput" className="sr-only">Ask a question</label>
            <input id="chatInput" value={chatInput} onChange={(event) => setChatInput(event.target.value)} placeholder="Type a question for the demo..." className="min-w-0 flex-1 rounded-xl border border-[#cbd8cc] bg-white px-4 py-3 text-sm outline-none focus:border-[#1d4d3a] focus:ring-2 focus:ring-[#d8e8d9]" />
            <button type="submit" disabled={!chatInput.trim() || isResponding} className="rounded-xl bg-[#1d4d3a] px-4 py-3 text-sm font-semibold text-white hover:bg-[#28634b] disabled:cursor-not-allowed disabled:bg-[#aabbb0]">Send</button>
          </form>
        </section>

        <aside className="order-2 space-y-6">
          <section className="rounded-[2rem] border border-[#d7e0d6] bg-white/75 p-6 shadow-[0_20px_60px_rgba(39,67,48,0.08)]">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold">Your situation summary</h2>
              <button type="button" onClick={() => copyText(summary, "Summary")} className="text-xs font-semibold text-[#1d4d3a] underline underline-offset-4">{copyFeedback || "Copy"}</button>
            </div>
            <p className="mt-4 rounded-xl border border-[#cbd8cc] bg-[#fbfcf9] p-3 text-sm leading-6 text-[#53625a]">{summary}</p>
            <button type="button" onClick={onEditDetails} className="mt-3 text-xs font-semibold text-[#1d4d3a] underline underline-offset-4">Edit details</button>
            <button type="button" onClick={() => copyText(`${summary}\n\nQuestions: ${form.questions || "None added"}`, "Summary and questions")} className="mt-3 w-full rounded-xl border border-[#b8c8ba] px-4 py-2.5 text-xs font-semibold text-[#1d4d3a] hover:bg-[#eaf0e8]">Copy summary + questions</button>
          </section>
          <section className="rounded-[2rem] border border-[#d7e0d6] bg-[#edf4eb] p-6">
            <h2 className="font-semibold">Preparation checklist</h2>
            <ul className="mt-4 space-y-3 text-sm leading-5 text-[#53625a]">
              {checklistFor(form).map((item) => <li key={item} className="flex gap-3"><span className="mt-1 h-4 w-4 shrink-0 rounded border border-[#9fb6a2] bg-white" />{item}</li>)}
            </ul>
          </section>
          <section className="rounded-[2rem] border border-[#d7e0d6] bg-white/60 p-6">
            <h2 className="font-semibold">Sources</h2>
            <p className="mt-3 text-sm leading-6 text-[#718078]">Verified policy sources have not been connected yet.</p>
          </section>
        </aside>
      </div>
      <p className="mt-7 text-center text-xs leading-5 text-[#718078]">Independent student project providing information navigation. Confirm personal details with your school adviser.</p>
    </div>
  );
}
