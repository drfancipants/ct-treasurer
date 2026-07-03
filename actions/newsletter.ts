'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireCommitteeMember, requireRosterRole } from '@/lib/auth'
import { encryptSecret, decryptSecret } from '@/lib/crypto'
import { createGmailTransport } from '@/lib/mailer'
import { getMonthlyData, getTrailingMonths } from '@/lib/analytics'
import { renderContributionsChart } from '@/lib/newsletter-chart'
import { getContributions } from './donations'

const MAX_RECIPIENTS_PER_SEND = 450
const CHART_CID = 'contributions-chart'

export interface GmailConnection {
  email: string | null
  connectedAt: string | null
}

/** Read-only — same data any committee member can already see reflected in Settings. */
export async function getGmailConnection(committeeSlug: string): Promise<GmailConnection> {
  const { committeeId } = await requireCommitteeMember(committeeSlug)
  const committee = await prisma.committee.findUnique({
    where: { id: committeeId },
    select: { newsletterGmailEmail: true, newsletterGmailConnectedAt: true },
  })
  return {
    email: committee?.newsletterGmailEmail ?? null,
    connectedAt: committee?.newsletterGmailConnectedAt?.toISOString() ?? null,
  }
}

export async function connectGmailAccount(
  committeeSlug: string,
  email: string,
  appPassword: string
): Promise<{ email: string }> {
  const { committeeId } = await requireRosterRole(committeeSlug)

  const transporter = createGmailTransport(email, appPassword)
  try {
    await transporter.verify()
  } catch {
    throw new Error('Gmail rejected these credentials — double check the address and app password')
  }

  await prisma.committee.update({
    where: { id: committeeId },
    data: {
      newsletterGmailEmail: email,
      newsletterGmailAppPassword: encryptSecret(appPassword),
      newsletterGmailConnectedAt: new Date(),
    },
  })
  revalidatePath(`/app/${committeeSlug}/settings`)
  return { email }
}

export async function disconnectGmailAccount(committeeSlug: string): Promise<void> {
  const { committeeId } = await requireRosterRole(committeeSlug)
  await prisma.committee.update({
    where: { id: committeeId },
    data: {
      newsletterGmailEmail: null,
      newsletterGmailAppPassword: null,
      newsletterGmailConnectedAt: null,
    },
  })
  revalidatePath(`/app/${committeeSlug}/settings`)
}

async function buildChartBuffer(committeeId: string): Promise<Buffer> {
  const contributions = await getContributions(committeeId)
  const monthly = getTrailingMonths(getMonthlyData(contributions, []))
  return renderContributionsChart(monthly)
}

/** Data: URI for the in-app browser preview only — never what's actually attached to a sent email. */
export async function previewNewsletterChart(committeeSlug: string): Promise<string> {
  const { committeeId } = await requireCommitteeMember(committeeSlug)
  const buffer = await buildChartBuffer(committeeId)
  return `data:image/png;base64,${buffer.toString('base64')}`
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function bodyToHtmlParagraphs(body: string): string {
  return body
    .split('\n')
    .map((line) => `<p style="margin:0 0 12px;">${escapeHtml(line) || '&nbsp;'}</p>`)
    .join('')
}

async function loadGmailCredentials(committeeId: string) {
  const committee = await prisma.committee.findUnique({
    where: { id: committeeId },
    select: { name: true, newsletterGmailEmail: true, newsletterGmailAppPassword: true },
  })
  if (!committee?.newsletterGmailEmail || !committee.newsletterGmailAppPassword) {
    throw new Error('Connect your Gmail account in Settings first.')
  }
  return {
    committeeName: committee.name,
    email: committee.newsletterGmailEmail,
    appPassword: decryptSecret(committee.newsletterGmailAppPassword),
  }
}

interface ComposeInput {
  subject: string
  body: string
  includeChart: boolean
}

async function composeMessage(committeeId: string, committeeName: string, input: ComposeInput) {
  const disclaimer = `You're receiving this because you're on the ${committeeName} roster.`
  const text = `${input.body}\n\n—\n${disclaimer}`
  let html = bodyToHtmlParagraphs(input.body)
  const attachments: { filename: string; content: Buffer; cid: string }[] = []

  if (input.includeChart) {
    const chart = await buildChartBuffer(committeeId)
    attachments.push({ filename: 'contributions.png', content: chart, cid: CHART_CID })
    html += `<p><img src="cid:${CHART_CID}" alt="Donor contributions by month" style="max-width:600px;width:100%;" /></p>`
  }

  html += `<p style="color:#94a3b8;font-size:12px;margin-top:16px;">${escapeHtml(disclaimer)}</p>`
  return { text, html, attachments }
}

export async function sendNewsletter(
  committeeSlug: string,
  input: { subject: string; body: string; rosterMemberIds: string[]; includeChart: boolean }
): Promise<{ sent: number; skipped: number }> {
  const { committeeId, userId } = await requireRosterRole(committeeSlug)
  if (!input.subject.trim()) throw new Error('Subject is required')
  if (!input.body.trim()) throw new Error('Message body is required')
  if (input.rosterMemberIds.length === 0) throw new Error('Select at least one recipient')

  const { committeeName, email, appPassword } = await loadGmailCredentials(committeeId)

  // Recipient emails are always re-derived from committee-scoped roster IDs —
  // never trust client-supplied addresses directly.
  const recipients = await prisma.rosterMember.findMany({
    where: { id: { in: input.rosterMemberIds }, committeeId, email: { not: null } },
    select: { email: true },
  })
  const addresses = [...new Set(recipients.map((r) => r.email!.toLowerCase()))]
  const skipped = input.rosterMemberIds.length - addresses.length

  if (addresses.length === 0) throw new Error('None of the selected members have an email on file')
  if (addresses.length > MAX_RECIPIENTS_PER_SEND) {
    throw new Error(
      `Too many recipients (${addresses.length}) for a single send — split into groups of ${MAX_RECIPIENTS_PER_SEND} or fewer`
    )
  }

  const { text, html, attachments } = await composeMessage(committeeId, committeeName, input)
  const transporter = createGmailTransport(email, appPassword)
  await transporter.sendMail({
    from: email,
    to: email,
    bcc: addresses,
    subject: input.subject,
    text,
    html,
    attachments,
  })

  await prisma.newsletter.create({
    data: {
      committeeId,
      subject: input.subject,
      recipientCount: addresses.length,
      includedChart: input.includeChart,
      sentByUserId: userId,
    },
  })
  revalidatePath(`/app/${committeeSlug}/newsletter`)

  return { sent: addresses.length, skipped }
}

/** Sends the composed message only to the connected Gmail address itself, so the treasurer can review before the real send. Not logged to the Newsletter audit table. */
export async function sendTestNewsletter(
  committeeSlug: string,
  input: { subject: string; body: string; includeChart: boolean }
): Promise<void> {
  const { committeeId } = await requireRosterRole(committeeSlug)
  if (!input.subject.trim()) throw new Error('Subject is required')
  if (!input.body.trim()) throw new Error('Message body is required')

  const { committeeName, email, appPassword } = await loadGmailCredentials(committeeId)
  const { text, html, attachments } = await composeMessage(committeeId, committeeName, input)

  const transporter = createGmailTransport(email, appPassword)
  await transporter.sendMail({
    from: email,
    to: email,
    subject: `[Test] ${input.subject}`,
    text,
    html,
    attachments,
  })
}

export interface NewsletterHistoryItem {
  id: string
  subject: string
  recipientCount: number
  includedChart: boolean
  sentAt: string
}

export async function getRecentNewsletters(committeeSlug: string): Promise<NewsletterHistoryItem[]> {
  const { committeeId } = await requireCommitteeMember(committeeSlug)
  const rows = await prisma.newsletter.findMany({
    where: { committeeId },
    orderBy: { sentAt: 'desc' },
    take: 10,
  })
  return rows.map((r) => ({
    id: r.id,
    subject: r.subject,
    recipientCount: r.recipientCount,
    includedChart: r.includedChart,
    sentAt: r.sentAt.toISOString(),
  }))
}
