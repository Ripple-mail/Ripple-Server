import config from 'config';

export const PORT: number = config.get<number>('port');
export const HOST: string = config.get<string>('host');
export const MAILDOMAINPREFIX: string = config.get<string>('mailDomainPrefix');