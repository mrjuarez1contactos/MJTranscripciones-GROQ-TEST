import { useState, useCallback, useEffect } from 'react';
import { cdmClient } from '../services/cdmClient';

interface TranscriptionRecord {
    id: string;
    resumen: string;
    txt_id: string;
    link_txt: string;
    contacto: string;
    fecha: string;
}

export function useCDM() {
    const [transcriptions, setTranscriptions] = useState<TranscriptionRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [cdmConnected, setCdmConnected] = useState(false);

    // Verifica conexión con CDM al cargar
    useEffect(() => {
        const checkConnection = async () => {
            const connected = await cdmClient.healthCheck();
            setCdmConnected(connected);
            if (!connected) {
                setError('CDM no disponible. Asegúrate de ejecutar: cd cdm && npm run dev');
            }
        };

        checkConnection();
    }, []);

    /**
     * Obtiene lista de transcripciones
     */
    const fetchTranscriptions = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await cdmClient.readTranscriptions();

            if (response.success) {
                setTranscriptions(response.data || []);
                console.log(`[Hook] Loaded ${response.data?.length || 0} transcriptions`);
            } else {
                setError(response.error || 'Error al cargar transcripciones');
            }
        } catch (err) {
            setError(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
        } finally {
            setLoading(false);
        }
    }, []);

    /**
     * Obtiene contenido completo de una transcripción
     */
    const fetchTextContent = useCallback(async (fileId: string) => {
        setLoading(true);
        setError(null);

        try {
            const response = await cdmClient.getTextContent(fileId);

            if (response.success) {
                return response.text;
            } else {
                setError(response.error || 'Error al cargar contenido');
                return null;
            }
        } catch (err) {
            setError(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    /**
     * Actualiza resumen de una transcripción
     */
    const updateResumen = useCallback(async (id: string, resumen: string) => {
        setLoading(true);
        setError(null);

        try {
            const response = await cdmClient.updateResumen(id, resumen);

            if (response.success) {
                // Actualiza el estado local
                setTranscriptions(prevTranscriptions =>
                    prevTranscriptions.map(t =>
                        t.id === id ? { ...t, resumen } : t
                    )
                );
                return true;
            } else {
                setError(response.error || 'Error al guardar resumen');
                return false;
            }
        } catch (err) {
            setError(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
            return false;
        } finally {
            setLoading(false);
        }
    }, []);

    /**
     * Obtiene historial de un contacto
     */
    const getHistoryByContact = useCallback((contactName: string) => {
        return transcriptions
            .filter(t => t.contacto.toLowerCase() === contactName.toLowerCase())
            .sort((a, b) => b.fecha.localeCompare(a.fecha))
            .slice(0, 20);
    }, [transcriptions]);

    return {
        transcriptions,
        loading,
        error,
        cdmConnected,
        fetchTranscriptions,
        fetchTextContent,
        updateResumen,
        getHistoryByContact
    };
}
