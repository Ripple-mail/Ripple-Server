import config from 'config';

export const PORT: number = config.get<number>('port');