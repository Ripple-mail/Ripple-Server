import * as net from 'net';

export class SMTPSession {
    socket: net.Socket;
    hello: string = '';
    mailFrom: string = '';
    rcptTo: string = '';
    collectingData: boolean = false;
    dataLines: string[] = [];

    constructor(socket: net.Socket) {
        this.socket = socket;
    }
}