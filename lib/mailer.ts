import nodemailer from 'nodemailer'

/** A Gmail SMTP transport authenticated with an App Password (not OAuth). */
export function createGmailTransport(email: string, appPassword: string) {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: email, pass: appPassword },
  })
}
