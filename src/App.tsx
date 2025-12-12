import React, { useState, useRef, useEffect } from 'react';

// === CONFIGURACIÓN ===
// Ya no hay keys expuestas aquí. Todo va al backend.
const BACKEND_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const App: React.FC = () => {
    const [file, setFile] = useState<File | null>(null);
    const [transcription, setTranscription] = useState<string>('');
    const [generalSummary, setGeneralSummary] = useState<string>('');
    const [businessSummary, setBusinessSummary] = useState<string>('');
    const [status, setStatus] = useState<string>('Por favor, selecciona un archivo de audio y presiona "Procesar".');
    const [isLoading, setIsLoading] = useState<boolean>(false);

    // State for permanent instructions
    const [globalInstructions, setGlobalInstructions] = useState<string[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newInstruction, setNewInstruction] = useState('');
    const importFileInputRef = useRef<HTMLInputElement>(null);

    // Estados para procesamiento desde Drive
    const [driveLink, setDriveLink] = useState<string>('');
    const [isDriveProcessing, setIsDriveProcessing] = useState<boolean>(false);
    const [driveAccessToken, setDriveAccessToken] = useState<string>('');
    const [isConnectedToDrive, setIsConnectedToDrive] = useState<boolean>(false);
    const [sessionToken, setSessionToken] = useState<string>('');


    useEffect(() => {
        try {
            const storedInstructions = localStorage.getItem('globalInstructions');
            if (storedInstructions) {
                setGlobalInstructions(JSON.parse(storedInstructions));
            }
        } catch (error) {
            console.error("Failed to parse global instructions from localStorage", error);
        }
    }, []);

    // Verificar si hay token de Drive guardado
    useEffect(() => {
        const token = localStorage.getItem('drive_access_token');
        if (token) {
            setDriveAccessToken(token);
            setIsConnectedToDrive(true);
        }
    }, []);

    // Manejar callback de OAuth de Google
    useEffect(() => {
        const hash = window.location.hash;
        if (hash && hash.includes('access_token')) {
            const params = new URLSearchParams(hash.substring(1));
            const token = params.get('access_token');

            if (token) {
                localStorage.setItem('drive_access_token', token);
                setDriveAccessToken(token);
                setIsConnectedToDrive(true);

                // Limpiar hash de la URL
                window.history.replaceState(null, '', window.location.pathname);
                setStatus('Conectado exitosamente a Google Drive.');
            }
        }
    }, []);

    // === SECURITY: Session Management ===
    const getSessionToken = async () => {
        // En memoria, si ya tenemos uno válido (simple check, idealmente checar expiración)
        if (sessionToken) return sessionToken;

        try {
            const res = await fetch(`${BACKEND_URL}/api/session`);
            if (!res.ok) throw new Error("No se pudo iniciar sesión segura con el servidor.");
            const data = await res.json();
            setSessionToken(data.token);
            return data.token;
        } catch (e) {
            console.error("Session Error:", e);
            throw e;
        }
    };

    const saveGlobalInstructions = (instructions: string[]) => {
        setGlobalInstructions(instructions);
        localStorage.setItem('globalInstructions', JSON.stringify(instructions));
    };

    const handleConnectDrive = () => {
        // Google OAuth 2.0 Configuration
        const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
        const REDIRECT_URI = `${window.location.origin}/oauth-callback`;
        const SCOPE = 'https://www.googleapis.com/auth/drive.file';

        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
            `client_id=${CLIENT_ID}&` +
            `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
            `response_type=token&` +
            `scope=${encodeURIComponent(SCOPE)}&` +
            `access_type=online`;

        // Abrir ventana de autorización
        window.location.href = authUrl;
    };

    const handleDisconnectDrive = () => {
        localStorage.removeItem('drive_access_token');
        setDriveAccessToken('');
        setIsConnectedToDrive(false);
        setStatus('Desconectado de Google Drive.');
    };

    const extractDriveFileId = (link: string): string | null => {
        const patterns = [
            /\/file\/d\/([a-zA-Z0-9_-]+)/,
            /id=([a-zA-Z0-9_-]+)/,
            /^([a-zA-Z0-9_-]+)$/  // Solo ID
        ];

        for (const pattern of patterns) {
            const match = link.match(pattern);
            if (match && match[1]) {
                return match[1];
            }
        }
        return null;
    };

    const handleProcessFromDrive = async () => {
        if (!driveLink) {
            setStatus('Por favor, pega un link de Google Drive.');
            return;
        }

        if (!isConnectedToDrive || !driveAccessToken) {
            setStatus('Primero debes conectar tu Google Drive.');
            return;
        }

        const fileId = extractDriveFileId(driveLink);

        if (!fileId) {
            setStatus('Link de Drive inválido.');
            return;
        }

        setIsDriveProcessing(true);
        setStatus(`Iniciando procesamiento seguro desde Drive...`);
        setTranscription('');
        setGeneralSummary('');
        setBusinessSummary('');

        try {
            // 1. Get Session Token
            const token = await getSessionToken();

            // 2. Call Backend
            setStatus("Procesando en servidor seguro (Descarga -> Transcribe -> Resume)...");
            const response = await fetch(`${BACKEND_URL}/api/process-drive`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    file_id: fileId,
                    access_token: driveAccessToken,
                    permanent_instructions: globalInstructions
                }),
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || `Backend error: ${response.statusText}`);
            }

            const data = await response.json();

            // Mostrar resultados
            setTranscription(data.transcription ?? "");
            setGeneralSummary(data.general_summary ?? "");
            setBusinessSummary(data.business_summary ?? "");

            setStatus(`Procesamiento completo. Archivo guardado en tu Drive: ${data.txt_file_name}`);
            setDriveLink(''); // Limpiar input

        } catch (error) {
            console.error('Drive processing error:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            setStatus(`Error procesando desde Drive: ${errorMessage}`);
            setSessionToken(''); // Clear token on error to force refresh
        } finally {
            setIsDriveProcessing(false);
        }
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            setTranscription('');
            setGeneralSummary('');
            setBusinessSummary('');
            setStatus(`Archivo seleccionado: ${selectedFile.name}`);
        }
    };

    const handleTranscribe = async () => {
        if (!file) {
            setStatus('Por favor, selecciona un archivo primero.');
            return;
        }

        setIsLoading(true);
        setStatus(`Subiendo y procesando ${file.name}...`);
        setTranscription('');
        setGeneralSummary('');
        setBusinessSummary('');

        try {
            // 1. Get Session Token
            const token = await getSessionToken();

            // 2. Prepare Form Data
            const formData = new FormData();
            formData.append("file", file);
            formData.append("instructions", JSON.stringify(globalInstructions));

            // 3. Call Backend
            const response = await fetch(`${BACKEND_URL}/api/process-local`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`
                },
                body: formData,
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || `Backend Error: ${response.status}`);
            }

            const result = await response.json();

            setTranscription(result.transcription ?? "");
            setGeneralSummary(result.generalSummary ?? "");
            setBusinessSummary(result.businessSummary ?? "");
            setStatus('Procesamiento completo (Transcripción + Resúmenes).');
        } catch (error) {
            console.error('Processing error:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            setStatus(`Error en el procesamiento: ${errorMessage}`);
            setSessionToken('');
        } finally {
            setIsLoading(false);
        }
    };

    const handleGenerateDocument = () => {
        if (!file && !driveLink) {
            // Relaxed check
        }

        const filename = file ? file.name : "archivo_drive";

        const docContent = `
=========================================
REGISTRO DE LLAMADA
=========================================

Archivo: ${filename}
Fecha: ${new Date().toLocaleString()}

-----------------------------------------
1. TRANSCRIPCIÓN COMPLETA
-----------------------------------------

${transcription}

-----------------------------------------
2. RESUMEN GENERAL DE LA LLAMADA
-----------------------------------------

${generalSummary}

-----------------------------------------
3. RESUMEN DE NEGOCIO
-----------------------------------------

${businessSummary}
        `;

        const blob = new Blob([docContent.trim()], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Resumen_${filename}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleExportInstructions = () => {
        if (globalInstructions.length === 0) {
            alert("No hay mejoras permanentes para exportar.");
            return;
        }
        const content = globalInstructions.join('\n');
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'mejoras-permanentes.txt';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleImportInstructions = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            const lines = text.split('\n').filter(line => line.trim() !== '');
            saveGlobalInstructions(lines);
            alert(`${lines.length} mejoras importadas correctamente.`);
        };
        reader.readAsText(file);
        event.target.value = ''; // Reset input
    };

    // Styles
    const styles: { [key: string]: React.CSSProperties } = {
        container: { fontFamily: 'sans-serif', backgroundColor: '#f0f2f5', minHeight: '100vh', padding: '2rem' },
        header: { textAlign: 'center', marginBottom: '1rem', color: '#1c1e21' },
        card: { backgroundColor: 'white', padding: '2rem', borderRadius: '8px', boxShadow: '0 4px 8px rgba(0,0,0,0.1)', marginBottom: '1.5rem' },
        button: { backgroundColor: '#1877f2', color: 'white', border: 'none', padding: '12px 20px', borderRadius: '6px', fontSize: '16px', cursor: 'pointer', margin: '0.5rem 0', display: 'inline-block', transition: 'background-color 0.3s' },
        buttonDisabled: { backgroundColor: '#a0bdf5', cursor: 'not-allowed' },
        textarea: { width: '100%', minHeight: '150px', padding: '10px', borderRadius: '6px', border: '1px solid #dddfe2', fontSize: '14px', boxSizing: 'border-box', marginTop: '1rem' },
        status: { textAlign: 'center', margin: '1.5rem 0', color: isLoading ? '#1877f2' : '#606770', fontWeight: 'bold' },
        modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
        modalContent: { backgroundColor: 'white', padding: '2rem', borderRadius: '8px', width: '90%', maxWidth: '600px', maxHeight: '80vh', overflowY: 'auto' },
        modalInput: { width: 'calc(100% - 100px)', padding: '10px', borderRadius: '6px', border: '1px solid #dddfe2' },
        modalButton: { padding: '10px', marginLeft: '10px' },
        instructionItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', borderBottom: '1px solid #eee', color: '#1c1e21' },
        deleteButton: { backgroundColor: '#fa3e3e', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' },
        filenameDisplay: { fontWeight: 'bold', marginBottom: '1rem', color: '#606770', padding: '8px 12px', backgroundColor: '#f0f2f5', borderRadius: '6px', border: '1px solid #dddfe2' }
    };

    return (
        <div style={styles.container}>
            <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h1 style={{ ...styles.header, marginBottom: 0, textAlign: 'left' }}>Transcriptor MJ Seguro</h1>
                    <button style={styles.button} onClick={() => setIsModalOpen(true)}>Mejoras Permanentes</button>
                </div>

                <div style={styles.card}>
                    <h2>Procesar desde Google Drive</h2>
                    <p>Conecta tu Google Drive para procesar archivos (.m4a) de forma segura.</p>

                    {!isConnectedToDrive ? (
                        <button
                            onClick={handleConnectDrive}
                            style={{ ...styles.button, backgroundColor: '#4285f4' }}
                        >
                            🔗 Conectar Google Drive
                        </button>
                    ) : (
                        <>
                            <div style={{
                                backgroundColor: '#e8f5e9',
                                padding: '10px',
                                borderRadius: '6px',
                                marginBottom: '15px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>
                                <span style={{ color: '#2e7d32', fontWeight: 'bold' }}>
                                    ✓ Conectado a Google Drive
                                </span>
                                <button
                                    onClick={handleDisconnectDrive}
                                    style={{
                                        ...styles.button,
                                        backgroundColor: '#f44336',
                                        padding: '8px 16px',
                                        margin: 0
                                    }}
                                >
                                    Desconectar
                                </button>
                            </div>

                            <input
                                type="text"
                                value={driveLink}
                                onChange={(e) => setDriveLink(e.target.value)}
                                placeholder="Pega el link de Drive aquí..."
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    borderRadius: '6px',
                                    border: '1px solid #ddd',
                                    fontSize: '14px',
                                    boxSizing: 'border-box',
                                    marginBottom: '15px'
                                }}
                            />

                            <button
                                onClick={handleProcessFromDrive}
                                disabled={isDriveProcessing || !driveLink}
                                style={{
                                    ...styles.button,
                                    ...((isDriveProcessing || !driveLink) ? styles.buttonDisabled : {}),
                                    backgroundColor: '#34a853'
                                }}
                            >
                                {isDriveProcessing ? '🔄 Procesando...' : '📁 Procesar desde Drive'}
                            </button>
                        </>
                    )}
                </div>

                <div style={styles.card}>
                    <h2>1. Sube tu archivo de audio (Local)</h2>
                    <input type="file" accept="audio/*" onChange={handleFileChange} style={{ marginTop: '1rem' }} />
                    <button onClick={handleTranscribe} disabled={!file || isLoading} style={{ ...styles.button, ...(!file || isLoading ? styles.buttonDisabled : {}), display: 'block' }}>
                        {isLoading ? 'Procesando...' : 'Procesar (Transcribir + Resumir)'}
                    </button>
                </div>

                <p style={styles.status}>{status}</p>

                {transcription && (
                    <div style={styles.card}>
                        <h2>2. Transcripción</h2>
                        <textarea style={styles.textarea} value={transcription} readOnly />
                    </div>
                )}

                {generalSummary && (
                    <div style={styles.card}>
                        <h2>3. Resumen General</h2>
                        <textarea style={styles.textarea} value={generalSummary} readOnly />
                    </div>
                )}

                {businessSummary && (
                    <div style={styles.card}>
                        <h2>4. Resumen de Negocio</h2>
                        <textarea
                            style={styles.textarea}
                            value={businessSummary}
                            readOnly
                        />
                        <div style={{ marginTop: '1rem', fontSize: '0.9em', color: '#666' }}>
                            Nota: Para mejorar este resumen, añade instrucciones en "Mejoras Permanentes" y vuelve a procesar.
                        </div>
                    </div>
                )}

                {(businessSummary || transcription) && (
                    <div style={styles.card}>
                        <h2>5. Exportar</h2>
                        <button onClick={handleGenerateDocument} style={styles.button}>
                            Generar Documento .txt
                        </button>
                    </div>
                )}

                {isModalOpen && (
                    <div style={styles.modalOverlay} onClick={() => setIsModalOpen(false)}>
                        <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                            <h2>Mejoras Permanentes</h2>
                            <p>Estas instrucciones se enviarán al servidor para guiar el resumen de negocio.</p>

                            <div style={{ display: 'flex', gap: '1rem', margin: '1rem 0', borderBottom: '1px solid #eee', paddingBottom: '1rem' }}>
                                <input
                                    type="file"
                                    ref={importFileInputRef}
                                    onChange={handleImportInstructions}
                                    accept=".txt"
                                    style={{ display: 'none' }}
                                />
                                <button onClick={() => importFileInputRef.current?.click()} style={{ ...styles.button, flex: 1, backgroundColor: '#42b72a' }}>
                                    Importar desde Archivo
                                </button>
                                <button onClick={handleExportInstructions} style={{ ...styles.button, flex: 1 }}>
                                    Exportar a Archivo
                                </button>
                            </div>

                            <div style={{ margin: '1rem 0', display: 'flex' }}>
                                <input
                                    type="text"
                                    value={newInstruction}
                                    onChange={(e) => setNewInstruction(e.target.value)}
                                    placeholder="Añadir nueva instrucción permanente"
                                    style={styles.modalInput}
                                    onKeyPress={(e) => {
                                        if (e.key === 'Enter') {
                                            if (newInstruction && !globalInstructions.includes(newInstruction)) {
                                                saveGlobalInstructions([...globalInstructions, newInstruction]);
                                                setNewInstruction('');
                                            }
                                        }
                                    }}
                                />
                                <button
                                    onClick={() => {
                                        if (newInstruction && !globalInstructions.includes(newInstruction)) {
                                            saveGlobalInstructions([...globalInstructions, newInstruction]);
                                            setNewInstruction('');
                                        }
                                    }}
                                    style={{ ...styles.button, ...styles.modalButton }}
                                >
                                    Añadir
                                </button>
                            </div>
                            <div>
                                {globalInstructions.length === 0 && <p>No hay instrucciones guardadas.</p>}
                                {globalInstructions.map((inst, index) => (
                                    <div key={index} style={styles.instructionItem}>
                                        <span style={{ flex: 1, marginRight: '1rem' }}>{inst}</span>
                                        <button
                                            onClick={() => {
                                                const updated = globalInstructions.filter((_, i) => i !== index);
                                                saveGlobalInstructions(updated);
                                            }}
                                            style={styles.deleteButton}
                                        >
                                            Eliminar
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <button onClick={() => setIsModalOpen(false)} style={{ ...styles.button, marginTop: '1rem' }}>Cerrar</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default App;
