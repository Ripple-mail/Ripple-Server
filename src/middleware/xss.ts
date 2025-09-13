import { Request, Response, NextFunction } from 'express';
import createDomPurify, { Config as XSSConfig } from 'dompurify';
import { JSDOM } from 'jsdom';

const window = new JSDOM('').window;
const DOMPurify = createDomPurify(window);

const plainTextConfig: XSSConfig = { ALLOWED_TAGS: [], ALLOWED_ATTR: [] }

const safeHTMLConfig: XSSConfig = {
    ALLOWED_TAGS: [
        'b', 'i', 'em', 'strong', 'u',
        'a', 'p', 'br', 'ul', 'ol', 'li',
        'blockquote', 'code', 'pre', 'span'
    ],
    ALLOWED_ATTR: ['href', 'title'],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i
}

const CURRENT_CONFIG = plainTextConfig;

export function sanitizeInput(input: any): any {
    if (typeof input === 'string') {
        return DOMPurify.sanitize(input, CURRENT_CONFIG);
    } else if (Array.isArray(input)) {
        return input.map(sanitizeInput);
    } else if (typeof input === 'object' && input !== null) {
        const sanitized: Record<string, any> = {}
        for (const key in input) {
            if (Object.prototype.hasOwnProperty.call(input, key)) {
                sanitized[key] = sanitizeInput(input[key]);
            }
        }
        return sanitized;
    }
    return input;
}

export function xssSanitizer(req: Request, res: Response, next: NextFunction) {
    if (req.body) req.body = sanitizeInput(req.body ?? {});

    if (req.query) {
        const sanitizedQuery = sanitizeInput(req.query ?? {});
        for (const key in sanitizedQuery) {
            (req.query as any)[key] = sanitizedQuery[key];
        }
    }

    if (req.params) {
        const sanitizedParams = sanitizeInput(req.params ?? {});
        for (const key in sanitizedParams) {
            (req.params as any)[key] = sanitizedParams[key];
        }
    }
    next();
}