"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  JG_ASSISTANT_STORAGE_KEY,
  buildJGAssistantView,
  buildJGContactUrl,
  buildJGDirectEmailUrl,
  chooseJGAssistantOption,
  createInitialJGAssistantSession,
  parseStoredJGAssistantSession,
  submitJGAssistantInput,
  syncJGAssistantRoute,
  type JGAssistantSession,
} from "@/app/lib/jgAssistantFlow";

const JG_ASSISTANT_VISIBILITY_KEY = "jg-assistant-visibility-v1";

export default function JGChatWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [session, setSession] = useState<JGAssistantSession>(() => createInitialJGAssistantSession(pathname));
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const view = useMemo(() => buildJGAssistantView(session), [session]);

  useEffect(() => {
    setSession(parseStoredJGAssistantSession(window.sessionStorage.getItem(JG_ASSISTANT_STORAGE_KEY), pathname));

    const isDesktop = window.matchMedia("(min-width: 1200px)").matches;
    const storedVisibility = window.localStorage.getItem(JG_ASSISTANT_VISIBILITY_KEY);

    if (!isDesktop) {
      setOpen(false);
    } else if (storedVisibility === "closed") {
      setOpen(false);
    } else if (storedVisibility === "open") {
      setOpen(true);
    } else {
      setOpen(true);
    }

    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    setSession((current) =>
      current.step === "opening"
        ? createInitialJGAssistantSession(pathname)
        : syncJGAssistantRoute(current, pathname),
    );
  }, [hydrated, pathname]);

  useEffect(() => {
    if (!hydrated) return;
    window.sessionStorage.setItem(JG_ASSISTANT_STORAGE_KEY, JSON.stringify(session));
  }, [hydrated, session]);

  useEffect(() => {
    if (!open) return;
    const timeoutId = window.setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }, 30);
    return () => window.clearTimeout(timeoutId);
  }, [open, session.messages.length, view.options.length]);

  function openAssistant() {
    setOpen(true);
    window.localStorage.setItem(JG_ASSISTANT_VISIBILITY_KEY, "open");
  }

  function closeAssistant() {
    setMenuOpen(false);
    setOpen(false);
    window.localStorage.setItem(JG_ASSISTANT_VISIBILITY_KEY, "closed");
  }

  function restartAssistant() {
    const fresh = createInitialJGAssistantSession(pathname);
    setSession(fresh);
    setInputValue("");
    setMenuOpen(false);
    window.sessionStorage.setItem(JG_ASSISTANT_STORAGE_KEY, JSON.stringify(fresh));
  }

  function chooseOption(id: string, label: string) {
    setSession((current) => chooseJGAssistantOption(current, id, label));
  }

  function submitInput(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = inputValue.trim();
    if (!value) return;
    setSession((current) => submitJGAssistantInput(current, value));
    setInputValue("");
  }

  const finalAssistantMessageId = useMemo(() => {
    for (let index = session.messages.length - 1; index >= 0; index -= 1) {
      if (session.messages[index].role === "assistant") return session.messages[index].id;
    }
    return null;
  }, [session.messages]);

  return (
    <>
      {!open ? (
        <button
          type="button"
          onClick={openAssistant}
          className="fixed bottom-5 right-5 z-[80] flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-300/15 bg-[#081226] text-[var(--gold)] shadow-[0_18px_45px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.08)] transition duration-200 hover:-translate-y-0.5 hover:border-amber-300/30 hover:bg-[#0b1830]"
          aria-label="Open JG Assistant"
          aria-expanded={false}
          aria-controls="jg-assistant-panel"
        >
          <Image
            src="/apple-touch-icon.png"
            alt=""
            width={56}
            height={56}
            className="h-full w-full rounded-2xl"
          />
        </button>
      ) : null}

      {open ? (
        <section
          id="jg-assistant-panel"
          aria-label="JG Assistant"
          className="jg-assistant-panel fixed inset-0 z-[81] flex h-[100dvh] w-screen flex-col overflow-hidden rounded-none border-0 bg-[linear-gradient(180deg,rgba(8,14,34,0.99),rgba(3,7,19,0.99))] shadow-[0_30px_90px_rgba(0,0,0,0.58),inset_0_1px_0_rgba(255,255,255,0.05)] sm:inset-auto sm:bottom-20 sm:right-5 sm:h-[min(680px,calc(100vh-7rem))] sm:w-[calc(100vw-2rem)] sm:max-w-[430px] sm:rounded-[24px] sm:border sm:border-[rgba(212,175,55,0.24)] xl:bottom-0 xl:right-0 xl:h-[min(760px,100vh)] xl:max-w-[430px] xl:rounded-none xl:rounded-tl-[24px] xl:border-b-0 xl:border-r-0"
        >
          <header className="relative flex items-center gap-3 border-b border-white/[0.07] px-4 py-3.5">
            <Image
              src="/apple-touch-icon.png"
              alt="JG Creative Studio"
              width={40}
              height={40}
              className="h-10 w-10 shrink-0 rounded-xl"
            />
            <div className="pointer-events-none absolute left-1/2 top-1/2 min-w-0 max-w-[calc(100%-7rem)] -translate-x-1/2 -translate-y-1/2 text-center">
              <p className="truncate text-sm font-black text-white">JG Assistant</p>
              <p className="truncate text-[11px] font-medium text-slate-400">Project guidance and quick answers</p>
            </div>
            <div className="relative ml-auto">
              <button
                type="button"
                onClick={() => setMenuOpen((current) => !current)}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-300/15 bg-[#081226] text-lg text-slate-200 transition hover:border-amber-300/30 hover:bg-[#0b1830] hover:text-[var(--gold)]"
                aria-label="Open assistant menu"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                ⋯
              </button>
              {menuOpen ? (
                <div role="menu" className="absolute right-0 top-11 z-20 min-w-[180px] rounded-xl border border-[rgba(212,175,55,0.2)] bg-[#070d21] p-1.5 shadow-2xl">
                  <button type="button" role="menuitem" onClick={restartAssistant} className="block w-full rounded-lg border border-amber-300/15 bg-[#081226] px-3 py-2 text-left text-xs font-semibold text-slate-200 transition hover:border-amber-300/30 hover:bg-[#0b1830] hover:text-[var(--gold)]">Restart conversation</button>
                  <button type="button" role="menuitem" onClick={closeAssistant} className="block w-full rounded-lg border border-amber-300/15 bg-[#081226] px-3 py-2 text-left text-xs font-semibold text-slate-200 transition hover:border-amber-300/30 hover:bg-[#0b1830] hover:text-[var(--gold)]">Close assistant</button>
                </div>
              ) : null}
            </div>
          </header>

          <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3.5 py-4">
            {session.messages.map((message) => {
              const incoming = message.role === "assistant";
              const showActions = incoming && message.id === finalAssistantMessageId && view.options.length > 0;
              return (
                <div key={message.id} className={incoming ? "flex justify-start" : "flex justify-end"}>
                  <div className={incoming ? "jg-assistant-answer-message" : "max-w-[84%]"}>
                    <div
                      className={[
                        "whitespace-pre-wrap text-sm leading-6",
                        incoming
                          ? "jg-assistant-unified-card jg-assistant-answer-card text-slate-100"
                          : "rounded-2xl rounded-br-md bg-[linear-gradient(180deg,#d7b43c,#aa7f18)] px-4 py-3 font-semibold text-[#07101f] shadow-[0_10px_24px_rgba(212,175,55,0.14)]",
                      ].join(" ")}
                    >
                      {incoming ? (
                        <>
                          <div className="jg-assistant-canonical-amber-overlay" />
                          <div className="jg-assistant-shell-topline" />
                        </>
                      ) : null}
                      <span className="relative">{message.text}</span>
                      {showActions ? (
                        <div className="relative mt-3 flex w-full flex-col gap-2">
                          {view.options.map((option) => (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => chooseOption(option.id, option.label)}
                              className="w-full rounded-xl border border-amber-300/15 bg-[#081226] px-3.5 py-3 text-left text-xs font-bold leading-4 text-slate-100 transition hover:-translate-y-px hover:border-amber-300/30 hover:bg-[#0b1830] hover:text-[var(--gold)]"
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}

            {session.step === "handoff" ? (
              <div className="rounded-2xl border border-[rgba(212,175,55,0.22)] bg-[rgba(5,11,28,0.82)] p-3.5">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--gold)]">Ready when you are</p>
                <div className="mt-3 grid gap-2">
                  <Link href={buildJGContactUrl(session.answers)} className="rounded-xl border border-amber-300/15 bg-[#081226] px-4 py-3 text-center text-sm font-black text-white transition hover:-translate-y-0.5 hover:border-amber-300/30 hover:bg-[#0b1830]">Open project request</Link>
                  <a href={buildJGDirectEmailUrl(session.answers)} className="rounded-xl border border-amber-300/15 bg-[#081226] px-4 py-3 text-center text-sm font-bold text-slate-100 transition hover:border-amber-300/30 hover:bg-[#0b1830] hover:text-[var(--gold)]">Email James directly</a>
                </div>
              </div>
            ) : null}
          </div>

          {view.inputPlaceholder ? (
            <form onSubmit={submitInput} className="border-t border-white/[0.07] p-3">
              <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-[rgba(3,7,19,0.9)] p-2">
                <input
                  value={inputValue}
                  onChange={(event) => setInputValue(event.target.value)}
                  placeholder={view.inputPlaceholder}
                  className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm text-white outline-none placeholder:text-slate-500"
                  autoComplete={session.expectedInput === "email" ? "email" : session.expectedInput === "phone" ? "tel" : "off"}
                  inputMode={session.expectedInput === "email" ? "email" : session.expectedInput === "phone" ? "tel" : "text"}
                />
                <button type="submit" disabled={!inputValue.trim()} className="rounded-xl border border-amber-300/15 bg-[#081226] px-4 py-2.5 text-xs font-black text-white transition hover:-translate-y-px hover:border-amber-300/30 hover:bg-[#0b1830] disabled:cursor-not-allowed disabled:opacity-45">Send</button>
              </div>
            </form>
          ) : (
            <div className="border-t border-white/[0.06] px-4 py-3 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Your conversation is remembered in this browser session</div>
          )}
        </section>
      ) : null}
    </>
  );
}

export const ChatWidget = JGChatWidget;
