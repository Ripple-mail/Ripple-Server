const prod = process.env.NODE_ENV === 'production';

export const rpName = 'Ripple Mail';
export const rpID = prod ? 'ripplemail.de' : 'localhost';
export const origin = prod ? 'https://ripplemail.de' : 'http://localhost:5173';

export function toBase64Url(buffer: ArrayBuffer) {
    return btoa(String.fromCharCode(...new Uint8Array(buffer))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export function fromBase64(base64url: string) {
    const padding = '='.repeat((4 - (base64url.length % 4)) % 4);
    const base64 = (base64url + padding).replace(/-/g, '+').replace(/_/g, '/');
    return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
}

export function generateChallenge(length: number = 32): Uint8Array {
    const random = new Uint8Array(length);
    crypto.getRandomValues(random);
    return random;
}