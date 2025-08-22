import { Request, Response, NextFunction } from 'express';

const dangerousTags = ['script', 'iframe', 'object', 'embed', 'link', 'meta', 'style'];

function sanitizeHTML(str: string): string {
    dangerousTags.forEach(tag => {
        const regex = new RegExp(`<${tag}.*?>.*?<\\/${tag}>`, 'gi');
        str = str.replace(regex, '');
        const selfClosing = new RegExp(`<${tag}.*?\\/?>`, 'gi');
        str = str.replace(selfClosing, '');
    });

    str = str.replace(/\son\w+=".*?"/gi, '');
    str = str.replace(/\son\w+='.*?'/gi, '');

    str = str.replace(/\s(href|src)\s*=\s*['"]?\s*(javascript:|data:)[^'"]*['"]?/gi, '');

    str = str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');

    return str;
}

function sanitizeObject(obj: any): any {
    if (typeof obj === 'string') {
        return sanitizeHTML(obj);
    } else if (Array.isArray(obj)) {
        return obj.map(sanitizeObject);
    } else if (typeof obj === 'object' && obj !== null) {
        const sanitized: any = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                sanitized[key] = sanitizeObject(obj[key]);
            }
        }
        return sanitized;
    }
    return obj;
}

export function xssSanitizer(req: Request, res: Response, next: NextFunction) {
    if (req.body) req.body = sanitizeObject(req.body);
    if (req.query) {
        for (const key in req.query) {
            if (Object.prototype.hasOwnProperty.call(req.query, key)) {
                req.query[key] = sanitizeObject(req.query[key]);
            }
        }
    }

    if (req.params) {
        for (const key in req.params) {
            if (Object.prototype.hasOwnProperty.call(req.params, key)) {
                req.params[key] = sanitizeObject(req.params[key]);
            }
        }
    }
    
    next();
}
