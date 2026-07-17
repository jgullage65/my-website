import Link from "next/link";
import type { ReactNode } from "react";

export const metadata = {
  title: "Pricing",
};

type PriceOption = {
  title: string;
  price: string;
  description: string;
  details: readonly string[];
};

type PricingSection = {
  eyebrow: string;
  title: ReactNode;
  description: string;
  options: readonly PriceOption[];
  note?: string;
};

const pricingSections: readonly PricingSection[] = [
  {
    eyebrow: "Websites",
    title: <>A clear <span className="text-[var(--gold)]">starting point</span> for every stage of business.</>,
    description:
      "From a focused landing page to a larger custom build, every website is designed to look credible, work smoothly on mobile, and guide visitors toward action.",
    options: [
      {
        title: "Landing Page",
        price: "$99+",
        description: "A focused single-page site for one offer, service, event, or launch.",
        details: [
          "One responsive page",
          "Clear call-to-action flow",
          "Contact section or lead form",
        ],
      },
      {
        title: "Starter Website",
        price: "$199+",
        description: "A compact website for businesses that need more than one page.",
        details: [
          "Up to 3 pages",
          "Mobile-first layout",
          "Core business details",
        ],
      },
      {
        title: "Business Website",
        price: "$399+",
        description: "A fuller website for established businesses with multiple services.",
        details: [
          "5 or more pages",
          "Conversion-focused page structure",
          "Lead form and thank-you flow",
        ],
      },
      {
        title: "Custom Website",
        price: "Custom Quote",
        description: "For advanced layouts, booking, integrations, or unique requirements.",
        details: [
          "Custom scope and architecture",
          "Advanced features or integrations",
          "Built around your workflow",
        ],
      },
    ],
    note: "Website refreshes start at $99. Ongoing website maintenance starts at $79 per month.",
  },
  {
    eyebrow: "AI Systems",
    title: <>Practical <span className="text-[var(--gold)]">AI and automation</span> built around real work.</>,
    description:
      "AI projects are scoped around the business problem, the tools involved, and how much of the workflow should be automated.",
    options: [
      {
        title: "AI Consultation",
        price: "$49+",
        description: "A focused review of where AI or automation could save time.",
        details: [
          "Workflow review",
          "Opportunity recommendations",
          "Simple next-step plan",
        ],
      },
      {
        title: "AI Assistant",
        price: "$99+",
        description: "A focused assistant for customer replies, intake, FAQs, or internal knowledge.",
        details: [
          "Custom instructions and behavior",
          "Business-specific information",
          "Testing and refinement",
        ],
      },
      {
        title: "Workflow Automation",
        price: "$199+",
        description: "Connect repeat tasks into a clearer, faster business workflow.",
        details: [
          "Multi-step workflow planning",
          "Tool or form connections",
          "Human approval paths where needed",
        ],
      },
      {
        title: "Custom AI System",
        price: "Custom Quote",
        description: "For copilots, support systems, connected dashboards, and advanced automation.",
        details: [
          "Custom system design",
          "Integrations and business logic",
          "Launch support and testing",
        ],
      },
    ],
  },
  {
    eyebrow: "Custom Software",
    title: <>Tools <span className="text-[var(--gold)]">designed around</span> the way your business actually operates.</>,
    description:
      "Custom software is quoted after the workflow, users, required features, and launch goals are understood.",
    options: [
      {
        title: "Internal Tools",
        price: "Custom Quote",
        description: "Dashboards, admin tools, reporting views, and workflow utilities.",
        details: [
          "Role and workflow mapping",
          "Purpose-built interface",
          "Business-specific logic",
        ],
      },
      {
        title: "Client Portals",
        price: "Custom Quote",
        description: "Secure customer-facing spaces for information, tasks, files, or services.",
        details: [
          "Customer and admin experiences",
          "Account-based access",
          "Custom features and workflows",
        ],
      },
      {
        title: "SaaS Foundations",
        price: "Custom Quote",
        description: "Launch-ready foundations for a focused software product or platform.",
        details: [
          "Product structure and core flows",
          "Responsive application interface",
          "Foundation for future growth",
        ],
      },
    ],
  },
  {
    eyebrow: "Creative Support",
    title: <>Professional <span className="text-[var(--gold)]">promotional design</span> without a heavy process.</>,
    description:
      "Creative support is available for businesses that need clear, polished assets for offers, events, and social content.",
    options: [
      {
        title: "Single Flyer",
        price: "$25+",
        description: "One polished promotional graphic ready to share.",
        details: ["One design", "Common platform sizing", "One revision included"],
      },
      {
        title: "Flyer Pack",
        price: "$60+",
        description: "A coordinated set of promotional graphics for a campaign or event.",
        details: ["Three designs", "Consistent visual direction", "Ready-to-post exports"],
      },
      {
        title: "Social Pack",
        price: "$50+",
        description: "A small set of branded social graphics for regular posting.",
        details: ["Multiple post graphics", "Platform-ready sizing", "Consistent presentation"],
      },
    ],
  },
];

function PriceCard({
  option,
  centered = false,
  mobileCentered = false,
}: {
  option: PriceOption;
  centered?: boolean;
  mobileCentered?: boolean;
}) {
  return (
    <article className="relative flex h-full flex-col rounded-[1.35rem] border border-[rgba(212,175,55,.14)] bg-[linear-gradient(145deg,rgba(9,16,32,.96),rgba(2,5,14,.99))] p-6 shadow-[0_28px_80px_rgba(0,0,0,.34)]">
      <h3 className="text-center text-2xl font-black tracking-[-.04em] text-white">{option.title}</h3>
      <p className="mt-3 text-center text-3xl font-black text-[var(--gold)]">{option.price}</p>
      <p
        className={`mt-3 text-sm leading-6 text-[var(--muted)] ${
          centered
            ? "text-center"
            : mobileCentered
              ? "text-center md:text-left"
              : ""
        }`}
      >
        {option.description}
      </p>
      <ul
        className={`mt-5 grid gap-3 text-sm text-slate-200 ${
          centered
            ? "mx-auto w-fit text-left"
            : mobileCentered
              ? "mx-auto w-fit text-left md:mx-0 md:w-auto"
              : ""
        }`}
      >
        {option.details.map((detail) => (
          <li key={detail} className="grid grid-cols-[.5rem_minmax(0,1fr)] gap-3">
            <span className="mt-1.5 h-2 w-2 rounded-full bg-[var(--gold)] shadow-[0_0_18px_rgba(212,175,55,.55)]" />
            <span>{detail}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

export default function PricingPage() {
  return (
    <main className="overflow-hidden bg-[#030713] text-white">
      <div className="border-t border-[rgba(212,175,55,.10)]">
        {pricingSections.map((section) => {
          const centerCardContent =
            section.eyebrow === "Custom Software" ||
            section.eyebrow === "Creative Support";
          const centerCardContentOnMobile =
            section.eyebrow === "Websites" ||
            section.eyebrow === "AI Systems";

          return (
            <section key={section.eyebrow} className="mx-auto max-w-[94rem] border-b border-[rgba(212,175,55,.10)] px-5 py-14 sm:px-8 lg:px-10 lg:py-16">
              <div className="mx-auto max-w-5xl text-center">
                <p className="text-xs font-black uppercase tracking-[.3em] text-[var(--gold)]">{section.eyebrow}</p>
                <h2 className="mt-4 text-3xl font-black tracking-[-.05em] sm:text-5xl">{section.title}</h2>
                <p className="mx-auto mt-4 max-w-3xl leading-7 text-[var(--muted)]">{section.description}</p>
              </div>

              <div className={`mx-auto mt-10 grid max-w-7xl gap-5 ${section.options.length === 4 ? "lg:grid-cols-4" : "md:grid-cols-3"}`}>
                {section.options.map((option) => (
                  <PriceCard
                    key={option.title}
                    option={option}
                    centered={centerCardContent}
                    mobileCentered={centerCardContentOnMobile}
                  />
                ))}
              </div>

              {section.note ? (
                <p className="mx-auto mt-6 max-w-4xl text-center text-sm font-bold text-slate-300">{section.note}</p>
              ) : null}
            </section>
          );
        })}
      </div>

      <section className="mx-auto max-w-[94rem] px-5 py-16 sm:px-8 lg:px-10 lg:py-20">
        <div className="mx-auto max-w-5xl rounded-[1.75rem] border border-[rgba(212,175,55,.18)] bg-[linear-gradient(145deg,rgba(11,20,40,.98),rgba(3,7,19,.98))] px-6 py-10 text-center shadow-[0_32px_100px_rgba(0,0,0,.38)] sm:px-10 sm:py-14">
          <p className="text-xs font-black uppercase tracking-[.3em] text-[var(--gold)]">Ready when you are</p>
          <h2 className="mt-4 text-3xl font-black tracking-[-.05em] sm:text-5xl">Tell me what you want to build.</h2>
          <p className="mx-auto mt-4 max-w-2xl leading-7 text-[var(--muted)]">
            I will recommend the simplest option that fits your goals and send a clear custom quote before any work begins.
          </p>
          <Link
            href="/contact"
            className="mt-7 inline-flex items-center justify-center rounded-lg border border-amber-300/15 bg-[#081226] px-6 py-3 text-sm font-black text-white shadow-[0_18px_48px_rgba(212,175,55,.24),inset_0_1px_0_rgba(255,255,255,.55)] transition duration-300 hover:-translate-y-0.5 hover:border-amber-300/30 hover:bg-[#0b1830]"
          >
            Request a Quote
          </Link>
        </div>
      </section>
    </main>
  );
}
