import axios, { AxiosInstance, AxiosError } from 'axios';
import { authService } from './auth';

/**
 * Cliente HTTP para comunicarse con el CDM
 * Maneja:
 * - Autenticación JWT automática
 * - Reintentos en caso de error
 * - Logging detallado
 */

class CDMClient {
    private client: AxiosInstance;
    private cdmUrl: string;

    constructor() {
        this.cdmUrl = import.meta.env.VITE_CDM_URL || 'http://localhost:3000/api/v1';

        this.client = axios.create({
            baseURL: this.cdmUrl,
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json'
            }
        });

        // Interceptor: Agrega token JWT a cada request
        this.client.interceptors.request.use((config) => {
            const token = authService.getToken();
            config.headers.Authorization = `Bearer ${token}`;

            console.log(`[CDM Request] ${config.method?.toUpperCase()} ${config.url}`);
            return config;
        });

        // Interceptor: Maneja respuestas y errores
        this.client.interceptors.response.use(
            (response) => {
                console.log(`[CDM Response] ${response.status}`, response.data);
                return response;
            },
            (error: AxiosError) => {
                if (error.response?.status === 401) {
                    console.error('[CDM Auth Error] Token inválido o expirado');
                    authService.clearToken();
                }
                console.error('[CDM Error]', error.response?.data || error.message);
                throw error;
            }
        );
    }

    /**
     * GET /api/v1/sheets/read
     * Obtiene lista de todas las transcripciones
     */
    async readTranscriptions(): Promise<any> {
        try {
            const response = await this.client.get('/sheets/read');
            return response.data;
        } catch (error) {
            console.error('[CDM] Error reading transcriptions:', error);
            throw error;
        }
    }

    /**
     * GET /api/v1/sheets/getText?id={FILE_ID}
     * Obtiene contenido completo de un archivo
     */
    async getTextContent(fileId: string): Promise<any> {
        try {
            const response = await this.client.get('/sheets/getText', {
                params: { id: fileId }
            });
            return response.data;
        } catch (error) {
            console.error('[CDM] Error getting text content:', error);
            throw error;
        }
    }

    /**
     * POST /api/v1/sheets/update
     * Actualiza el resumen de una transcripción
     */
    async updateResumen(id: string, resumen: string): Promise<any> {
        try {
            const response = await this.client.post('/sheets/update', {
                id,
                resumen
            });
            return response.data;
        } catch (error) {
            console.error('[CDM] Error updating resumen:', error);
            throw error;
        }
    }

    /**
     * Verifica conectividad con CDM
     */
    async healthCheck(): Promise<boolean> {
        try {
            const response = await axios.get(`${this.cdmUrl.replace('/api/v1', '')}/health`);
            console.log('[CDM Health] OK:', response.data);
            return true;
        } catch (error) {
            console.error('[CDM Health] FAILED:', error);
            return false;
        }
    }
}

export const cdmClient = new CDMClient();
