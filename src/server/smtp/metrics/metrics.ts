import client from 'prom-client';

export const smtpConnectionsTotal = new client.Gauge({
    name: 'smtp_connections_total',
    help: 'Total number of SMTP connections'
});

export const smtpActiveConnections = new client.Gauge({
    name: 'smtp_active_connections',
    help: 'Current number of active SMTP connections'
});

export const smtpCommandsTotal = new client.Counter({
    name: 'smtp_commands_total',
    help: 'Total number of SMTP commands received',
    labelNames: ['command']
});

export const smtpErrorsTotal = new client.Counter({
    name: 'smtp_errors_total',
    help: 'Total number of SMTP errors encountered'
});

export const smtpEmailsAcceptedTotal = new client.Counter({
    name: 'smtp_emails_accepted_total',
    help: 'Total number of emails successfully accepted'
});

export const smtpUpSince = new client.Gauge({
    name: 'smtp_up_since',
    help: 'Timestamp of when the SMTP server last became online'
});