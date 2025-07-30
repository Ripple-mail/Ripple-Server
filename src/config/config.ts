import config from 'config';

console.log('LOADING CONFIG...');
export const API_PORT: number = config.get<number>('api.port');
export const SMTP_PORT: number = config.get<number>('smtp.port');
export const MAILDOMAINPREFIX: string = config.get<string>('mailDomainPrefix');
console.log('CONFIG LOADED');