"use client";

import Link from "next/link";
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
} from "../lib/jgAssistantFlow";

function readStoredSession(pathname: string): JGAssistantSession {
  if (typeof window === "undefined") return createInitialJGAssistantSession(pathname);
  return parseStoredJGAssistantSession(
    window.sessionStorage.getItem(JG_ASSISTANT_STORAGE_KEY),
    pathname,
  );
}

function routeLabel(pathname: string) {
  if (pathname.startsWith("/services")) return "Services guide";
  if (pathname.startsWith("/ai-tools")) return "AI systems guide";
  if (pathname.startsWith("/examples")) return "Portfolio guide";
  if (pathname.startsWith("/contact")) return "Project guide";
  if (pathname.startsWith("/about")) return "Studio guide";
  return "Website guide";
}

export default function JGChatWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [session, setSession] = useState<JGAssistantSession>(() =>
    createInitialJGAssistantSession(pathname),
  );
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setSession(readStoredSession(pathname));
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    setSession((current) => syncJGAssistantRoute(current, pathname));
  }, [loaded, pathname]);

  useEffect(() => {
    if (!loaded) return;
    window.sessionStorage.setItem(JG_ASSISTANT_STORAGE_KEY, JSON.stringify(session));
  }, [loaded, session]);

  useEffect(() => {
    if (!open) return;
    const timeout = window.setTimeout(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }, 30);
    return () => window.clearTimeout(timeout);
  }, [open, session.messages.length]);

  const view = useMemo(() => buildJGAssistantView(session), [session]);
  const latestAssistantId = useMemo(() => {
    for (let index = session.messages.length - 1; index >= 0; index -= 1) {
      if (session.messages[index]?.role === "assistant") return session.messages[index].id;
    }
    return null;
  }, [session.messages]);

  const restart = () => {
    const fresh = createInitialJGAssistantSession(pathname);
    setSession(fresh);
    setInputValue("");
    setMenuOpen(false);
    window.sessionStorage.setItem(JG_ASSISTANT_STORAGE_KEY, JSON.stringify(fresh));
  };

  const chooseOption = (id: string, label: string) => {
    setSession((current) => chooseJGAssistantOption(current, id, label));
    setInputValue("");
  };

  const submitInput = (event?: FormEvent) => {
    event?.preventDefault();
    const value = inputValue.trim();
    if (!value) return;
    setSession((current) => submitJGAssistantInput(current, value));
    setInputValue("");
  };

  const contactUrl = buildJGContactUrl(session.answers);
  const emailUrl = buildJGDirectEmailUrl(session.answers);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label={open ? "Close JG Assistant" : "Open JG Assistant"}
        aria-expanded={open}
        className={[
          "fixed bottom-5 right-5 z-[80] flex h-14 w-14 items-center justify-center rounded-2xl",
          "border border-[rgba(212,175,55,0.42)] bg-[linear-gradient(145deg,#101a43,#050b1d)]",
          "text-[var(--gold)] shadow-[0_18px_42px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.08)]",
          "transition duration-200 hover:-translate-y-0.5 hover:border-[rgba(245,158,11,0.62)]",
          open ? "pointer-events-none translate-y-2 opacity-0" : "opacity-100",
        ].join(" ")}
      >
        <span className="text-lg font-black tracking-[0.08em]">JG</span>
      </button>

      {open ? (
        <section
          aria-label="JG Assistant"
          className={[
            "fixed inset-x-3 bottom-3 z-[90] flex h-[min(760px,calc(100dvh-1.5rem))] flex-col overflow-hidden rounded-[24px]",
            "border border-[rgba(212,175,55,0.24)] bg-[#050b1d]",
            "shadow-[0_32px_90px_rgba(0,0,0,0.58),inset_0_1px_0_rgba(255,255,255,0.05)]",
            "sm:inset-x-auto sm:bottom-5 sm:right-5 sm:h-[min(700px,calc(100dvh-2.5rem))] sm:w-[430px]",
          ].join(" ")}
        >
          <header className="relative flex items-center gap-3 border-b border-white/[0.07] bg-[linear-gradient(180deg,rgba(15,25,60,0.98),rgba(6,12,31,0.98))] px-4 py-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[rgba(212,175,55,0.4)] bg-[#07101f] text-xs font-black tracking-[0.08em] text-[var(--gold)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              JG
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black text-white">JG Assistant</p>
              <p className="truncate text-[11px] font-semibold uppercase tracking-[0.13em] text-[var(--gold)]">
                {routeLabel(pathname)}
              </p>
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((current) => !current)}
                aria-label="Open assistant menu"
                aria-expanded={menuOpen}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-lg font-bold text-slate-200 transition hover:border-[rgba(212,175,55,0.35)] hover:text-[var(--gold)]"
              >
                ⋯
              </button>
              {menuOpen ? (
                <div className="absolute right-0 top-11 z-20 min-w-[180px] rounded-xl border border-[rgba(212,175,55,0.22)] bg-[#07101f] p-1.5 shadow-2xl">
                  <button
                    type="button"
                    onClick={restart}
                    className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-200 transition hover:bg-white/[0.06] hover:text-[var(--gold)]"
                  >
                    Restart conversation
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      setOpen(false);
                    }}
                    className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-200 transition hover:bg-white/[0.06] hover:text-[var(--gold)]"
                  >
                    Close assistant
                  </button>
                </div>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close JG Assistant"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-lg text-slate-200 transition hover:border-[rgba(212,175,55,0.35)] hover:text-[var(--gold)]"
            >
              ×
            </button>
          </header>

          <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5">
            {session.messages.map((message) => {
              const incoming = message.role === "assistant";
              const showActions = incoming && message.id === latestAssistantId;

              return (
                <div key={message.id} className={incoming ? "flex justify-start" : "flex justify-end"}>
                  <div className={incoming ? "max-w-[94%]" : "max-w-[84%]"}>
                    <div
                      className={[
                        "whitespace-pre-wrap text-sm leading-6",
                        incoming
                          ? "relative overflow-hidden rounded-2xl border border-[rgba(212,175,55,0.18)] bg-[linear-gradient(145deg,rgba(13,24,55,0.96),rgba(6,12,30,0.96))] px-4 py-3.5 text-slate-100 shadow-[0_16px_34px_rgba(0,0,0,0.24)]"
                          : "rounded-2xl rounded-br-md bg-[linear-gradient(180deg,#d9b73f,#b4871d)] px-4 py-3 text-[#07101f] shadow-[0_12px_24px_rgba(212,175,55,0.16)]",
                      ].join(" ")}
                    >
                      {incoming ? (
                        <span className="absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-[rgba(245,158,11,0.7)] to-transparent" />
                      ) : null}
                      <p className="relative m-0">{message.text}</p>
                    </div>

                    {showActions && view.options.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {view.options.map((option) => (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => chooseOption(option.id, option.label)}
                            className="rounded-full border border-[rgba(212,175,55,0.26)] bg-[rgba(8,16,38,0.92)] px-3 py-2 text-left text-xs font-bold text-slate-100 transition hover:-translate-y-0.5 hover:border-[rgba(245,158,11,0.52)] hover:text-[var(--gold)]"
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    ) : null}

                    {showActions && session.step === "handoff" ? (
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <Link
                          href={contactUrl}
                          className="rounded-xl bg-[linear-gradient(180deg,#e1bd45,#b88c1f)] px-3 py-2.5 text-center text-xs font-black text-[#07101f] transition hover:-translate-y-0.5"
                        >
                          Open project request
                        </Link>
                        <a
                          href={emailUrl}
                          className="rounded-xl border border-[rgba(212,175,55,0.3)] bg-[rgba(8,16,38,0.92)] px-3 py-2.5 text-center text-xs font-black text-slate-100 transition hover:-translate-y-0.5 hover:text-[var(--gold)]"
                        >
                          Email James directly
                        </a>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          <footer className="border-t border-white/[0.07] bg-[rgba(3,7,19,0.96)] p-3.5">
            {view.inputPlaceholder ? (
              <form onSubmit={submitInput} className="flex items-end gap-2">
                <input
                  value={inputValue}
                  onChange={(event) => setInputValue(event.target.value)}
                  placeholder={view.inputPlaceholder}
                  autoComplete={session.expectedInput === "email" ? "email" : session.expectedInput === "phone" ? "tel" : "off"}
                  inputMode={session.expectedInput === "email" ? "email" : session.expectedInput === "phone" ? "tel" : "text"}
                  className="min-h-11 flex-1 rounded-xl border border-white/10 bg-[rgba(9,18,43,0.9)] px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-[rgba(212,175,55,0.45)]"
                />
                <button
                  type="submit"
                  disabled={!inputValue.trim()}
                  className="min-h-11 rounded-xl bg-[linear-gradient(180deg,#e1bd45,#b88c1f)] px-4 text-sm font-black text-[#07101f] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Send
                </button>
              </form>
            ) : (
              <div className="flex items-center justify-between gap-3 text-[11px] text-slate-500">
                <span>Your conversation is remembered in this browser session.</span>
                <Link href="/contact" className="shrink-0 font-semibold text-slate-400 hover:text-[var(--gold)]">
                  Contact
                </Link>
              </div>
            )}
          </footer>
        </section>
      ) : null}
    </>
  );
}

export const ChatWidget = JGChatWidget;
