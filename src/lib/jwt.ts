import { JwtPayload as OriginalJwtPayload } from 'jsonwebtoken';

// Extend the JwtPayload interface to include userId and uid fields
export interface JwtPayload extends OriginalJwtPayload {
    userId?: string;
    uid?: string;
}