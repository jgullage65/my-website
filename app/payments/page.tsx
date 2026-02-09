export const metadata = {
    title: "Payments",
  };
  
  const PAYMENTS = [
    {
      title: "Flyer Design",
      note: "Paid in full",
      amount: "$20",
      desc: "One clean promo/flyer design ready to post or print.",
      url: "https://buy.stripe.com/dRmaEQ2im02kgw9eFZ24001",
    },
    {
      title: "Social Media Pack",
      note: "Paid in full",
      amount: "$35",
      desc: "Simple social pack ready to post (great for weekly content).",
      url: "https://buy.stripe.com/5kQ7sE6yC8yQ6Vz9lF24002",
    },
    {
      title: "Website Updates",
      note: "Paid in full",
      amount: "$79",
      desc: "Quick fixes + updates to keep your site current and clean.",
      url: "https://buy.stripe.com/4gM14g9KOcP6a7L8hB24000",
    },
    {
      title: "AI Setup (Basic)",
      note: "Deposit",
      amount: "$25",
      desc: "Deposit to start your AI templates/setup. Final quote confirmed after details.",
      url: "https://buy.stripe.com/28E14g6yC2asgw9btN24003",
    },
    {
      title: "AI Setup (Pro)",
      note: "Deposit",
      amount: "$75",
      desc: "Deposit to start a deeper AI setup (more automation + custom workflows). Final quote confirmed after details.",
      url: "https://buy.stripe.com/fZu8wIaOS3ew3Jn69t24007",
    },
    {
      title: "Admin Support",
      note: "Deposit",
      amount: "$50",
      desc: "Deposit to begin admin support. Hourly work is invoiced after we confirm tasks.",
      url: "https://buy.stripe.com/aFa8wIcX04iA6Vz69t24004",
    },
    {
      title: "Simple Website",
      note: "Deposit",
      amount: "$60",
      desc: "Deposit to start a simple site. Final price confirmed after project details.",
      url: "https://buy.stripe.com/14AbIUaOSdTa3Jn8hB24005",
    },
    {
      title: "Business Website",
      note: "Deposit",
      amount: "$120",
      desc: "Deposit to start a multi-page business site. Final price confirmed after details.",
      url: "https://buy.stripe.com/dRmfZa3mq7uM93H9lF24006",
    },
  ];
  
  export default function PaymentsPage() {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-900">
        <section className="mx-auto max-w-5xl px-6 py-16 space-y-10">
          {/* Header */}
          <header className="space-y-3 text-center">
            <h1 className="text-4xl font-black">Payments</h1>
            <p className="text-slate-600 text-lg max-w-3xl mx-auto">
              Pay securely online to start your project. Deposits lock in your spot and we’ll
              confirm the final quote after a quick message.
            </p>
          </header>
  
          {/* Cards */}
          <div className="grid gap-6 md:grid-cols-2">
            {PAYMENTS.map((p) => (
              <div
                key={p.url}
                className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm space-y-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-black">{p.title}</h2>
                    <p className="mt-1 text-sm text-slate-600">
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 font-semibold ${
                          p.note === "Paid in full"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {p.note}
                      </span>
                    </p>
                  </div>
  
                  <div className="text-right">
                    <p className="text-sm text-slate-500">Amount</p>
                    <p className="text-3xl font-black text-[var(--navy)]">{p.amount}</p>
                  </div>
                </div>
  
                <p className="text-slate-600">{p.desc}</p>
  
                <a
                  href={p.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block w-full rounded-xl bg-[var(--navy)] py-3 text-center font-semibold text-white hover:opacity-90"
                >
                  Pay {p.note === "Paid in full" ? "Now" : "Deposit"} & Start Project →
                </a>
  
                <p className="text-xs text-slate-500">
                  Prefer to message first?{" "}
                  <a className="font-semibold text-[var(--navy)] hover:underline" href="/contact">
                    Contact me here
                  </a>
                  .
                </p>
              </div>
            ))}
          </div>
  
          {/* Footer note */}
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm text-center space-y-2">
            <p className="font-semibold">After payment, I’ll reply and confirm the next steps.</p>
            <p className="text-slate-600">
              Deposits are applied toward your project total. Final pricing depends on scope and
              is confirmed before work begins.
            </p>
          </div>
        </section>
      </main>
    );
  }