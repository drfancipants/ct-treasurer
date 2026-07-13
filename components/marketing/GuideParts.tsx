/** Shared presentational bits for the SEO guide pages (app/guides/*). */

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-xl font-semibold text-slate-900 mb-3">{title}</h2>
      <div className="text-slate-600 leading-7 space-y-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-2 [&_a]:text-blue-600 [&_a:hover]:underline [&_strong]:text-slate-900">
        {children}
      </div>
    </section>
  )
}

/** A two-column reference row (label + description), e.g. eCRIS section letters. */
export function Row({ s, d }: { s: string; d: string }) {
  return (
    <tr className="border-b border-slate-100 align-top">
      <td className="py-2 pr-4 font-mono font-semibold text-slate-900 whitespace-nowrap">{s}</td>
      <td className="py-2">{d}</td>
    </tr>
  )
}

/** Standard closing call-to-action block for a guide. */
export function GuideCta({ heading, body }: { heading: string; body: string }) {
  return (
    <div className="mt-12 bg-navy-900 text-white rounded-2xl p-8 text-center">
      <h2 className="text-lg font-semibold mb-2">{heading}</h2>
      <p className="text-sm text-slate-300 max-w-md mx-auto mb-6">{body}</p>
      <a
        href="/signup"
        className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-blue-500 text-white font-medium hover:bg-blue-400 transition-colors"
      >
        Start your free trial
        <span aria-hidden="true">→</span>
      </a>
    </div>
  )
}
