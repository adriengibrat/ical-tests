const { send } = require('micro')
const { router, get } = require('microrouter')
const { URL, parse } = require('url')
const mailer = require('nodemailer')
const ical = require('ical-generator')

const { NOW_URL, SENDGRID_USERNAME, SENDGRID_PASSWORD } = process.env
const summary = 'Example Event'
const htmlDescription = '<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 3.2//EN"><html><body><img alt="calendar" src="https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Google_Calendar.png/128px-Google_Calendar.png"><em>It</em> <b>works</b> ;)</body></html>'
const attentees = [ 'adrien.gibrat@gmail.com', 'a.gibrat@oodrive.com' ]
const method = 'REQUEST'
const filename = 'calendar.ics'
let messageId

// const smtp = mailer.createTransport({
//     service: 'SendGrid',
//     auth: { user: SENDGRID_USERNAME, pass: SENDGRID_PASSWORD },
// })

const smtp = mailer.createTransport({
    host: 'mail.oodrive.com',
    port: 587,
    secure: true,
    auth: {
        user: 'a.gibrat@oodrive.com',
        pass: 'xxx'
    }
})

const calendar = ical({
    domain: new URL(NOW_URL).hostname,
    prodId: { company: 'Oodrive', product: 'Boardnox' },
    name: 'Boarnox Workspace',
    timezone: 'Europe/Paris'
})
const event = calendar.createEvent({
    method,
    summary,
    htmlDescription,
    description: 'It works ;)',
    start: new Date(), end: new Date(Date.now() + 3600000),
    organizer: 'Oodrive Board <adrien.gibrat+organizer@gmail.com>',
    location: 'my place',
    status: 'confirmed',
    url: `${NOW_URL}/${filename}`,
})

module.exports = router(
    get(`/${filename}`, (_, response) => {
        response.setHeader('Content-Type', 'text/calendar; charset=utf-8; method=${method}')
        response.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
        send(response, 200, calendar.toString())
    }),
    get('/time', (_, response) => {
        const start = new Date(), end = new Date(Date.now() + 3600000)
        event.start(start)
        event.end(end)
        send(response, 200, `${start} ${end}` )
    }),
    get('/summary', (_, response) => {
        const newSummary = `${summary} ${Date.now()}`
        event.summary(newSummary)
        send(response, 200, newSummary)
    }),
    get('/send', (request, response) => {
        const sendmail = new Promise((resolve, reject) => {
            event.attendees().splice(0, 1000)
            event.attendees(attentees.map(email => ({
                email,
                name: email.replace(/@.*$/, ''),
            })))
            smtp.sendMail({
                envelope: {
                    from: 'adrien.gibrat+return@gmail.com',
                    to: attentees.map(email => ({ name: email.replace(/@.*$/, ''), address: email })),
                },
                from: { name: 'Adrien From', address: 'adrien.gibrat+from@gmail.com' },
                sender: { name: 'Adrien Sender', address: 'adrien.gibrat+sender@gmail.com' },
                replyTo: { name: 'Adrien Reply', address: 'adrien.gibrat+reply@gmail.com' },
                to: attentees.map(email => ({ name: email.replace(/@.*$/, ''), address: email })),
                subject: event.summary(),
                inReplyTo: messageId || undefined,
                references: messageId ? [messageId] : undefined,
                alternatives: [
                    { // https://tools.ietf.org/html/rfc3676
                        contentType: 'text/plain; charset=utf-8; format=flowed; delsp=yes',
                        content: 'hope this works',
                    },
                    {
                        contentType: 'text/html; charset=utf-8',
                        content: 'hope <em>this</em> <b>works</b><img alt="calendar" src="https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Google_Calendar.png/128px-Google_Calendar.png">',
                    },
                    {
                        contentType: `text/calendar; charset=utf-8; method=${method}`, // ; name=${filename}
                        content: calendar.toString()
                            // RSVP not supported yet... see https://github.com/sebbo2002/ical-generator/pull/58
                            .replace(/ATTENDEE/g, 'ATTENDEE;RSVP=FALSE'),
                    },
                ],
            }, (error, message) => error ? reject(error) : resolve(message))
        })
        sendmail.then((message) => {
            console.log(message)
            messageId = message.messageId
            send(response, 200)
        }, console.error)
    }),
)
