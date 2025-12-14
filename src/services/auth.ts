/**
 * SISTEMA DE AUTENTICACIÓN JWT (Browser Compatible)
 * 
 * IMPORTANTE: En producción, estos tokens deben venir de un servidor de autenticación real.
 * Por ahora, para testing, generaremos tokens locales firmados con la misma JWT_SECRET usando 'jwt-encode'.
 * 
 * NUNCA expongas JWT_SECRET en el frontend en producción.
 */

// @ts-ignore - jwt-encode usually lacks type definitions
import sign from 'jwt-encode';
import { jwtDecode } from 'jwt-decode';

// TEMPORAL: Para testing local
// En producción, esto vendría de un login server
const JWT_SECRET = import.meta.env.VITE_JWT_SECRET || 'test-secret-key-min-32-characters-here';

interface TokenPayload {
    user_id: string;
    app_id: string;
    iat: number;
    exp: number;
}

class AuthService {
    /**
     * Genera un JWT token local (SOLO PARA TESTING)
     * En producción, reemplaza esto con un login real
     */
    generateTestToken(userId: string = 'test_user'): string {
        const payload = {
            user_id: userId,
            app_id: 'mjtranscriptor_web',
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 3600 // 1 hora
        };

        // Usamos jwt-encode para el navegador
        const token = sign(payload, JWT_SECRET);
        return token;
    }

    /**
     * Obtiene token del localStorage o genera uno nuevo
     */
    getToken(): string {
        let token = localStorage.getItem('auth_token');

        if (!token) {
            console.warn('[Auth] No token found. Generating test token...');
            token = this.generateTestToken();
            localStorage.setItem('auth_token', token);
        }

        // Verifica si token está expirado
        if (this.isTokenExpired(token)) {
            console.warn('[Auth] Token expired. Generating new one...');
            token = this.generateTestToken();
            localStorage.setItem('auth_token', token);
        }

        return token;
    }

    /**
     * Verifica si token está expirado
     */
    isTokenExpired(token: string): boolean {
        try {
            const decoded = jwtDecode<TokenPayload>(token);
            if (!decoded || !decoded.exp) return true;
            return decoded.exp * 1000 < Date.now();
        } catch {
            return true;
        }
    }

    /**
     * Limpia el token (logout)
     */
    clearToken(): void {
        localStorage.removeItem('auth_token');
    }

    /**
     * Obtiene decoded token (para debugging)
     */
    getDecodedToken(): TokenPayload | null {
        const token = this.getToken();
        try {
            return jwtDecode<TokenPayload>(token);
        } catch {
            return null;
        }
    }
}

export const authService = new AuthService();
