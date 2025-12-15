import { useEffect, useState } from 'react';
import { useCDM } from './hooks/useCDM';
// Vercel Deployment Fix

export function App() {
    const {
        transcriptions,
        loading,
        error,
        cdmConnected,
        fetchTranscriptions,
        fetchTextContent,
        updateResumen
    } = useCDM();

    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [editingResumen, setEditingResumen] = useState('');
    const [fileContent, setFileContent] = useState<string | null>(null);

    useEffect(() => {
        if (cdmConnected) {
            fetchTranscriptions();
        }
    }, [cdmConnected, fetchTranscriptions]);

    const handleViewContent = async (id: string) => {
        setSelectedId(id);
        setFileContent('Cargando contenido...');
        const content = await fetchTextContent(id);
        setFileContent(content || 'No se pudo cargar el contenido.');
    };

    const handleEditResumen = (id: string, currentResumen: string) => {
        setSelectedId(id);
        setEditingResumen(currentResumen);
        setFileContent(null); // Clear content view if switching to edit mode logic, or keep it.
        // Simple UI: Just an edit box for now.
    };

    const saveResumen = async () => {
        if (selectedId && editingResumen) {
            await updateResumen(selectedId, editingResumen);
            setSelectedId(null);
        }
    };

    return (
        <div className="app" style={{ padding: '20px', fontFamily: 'sans-serif' }}>
            <header style={{ marginBottom: '20px', borderBottom: '1px solid #ccc', paddingBottom: '10px' }}>
                <h1 style={{ margin: 0 }}>🎯 MJTranscriptorApp - CDM Viewer</h1>
                <div className="status" style={{ marginTop: '10px', color: cdmConnected ? 'green' : 'red' }}>
                    CDM Status: {cdmConnected ? '✅ Connected' : '❌ Disconnected'}
                </div>
            </header>

            {error && <div className="error" style={{ backgroundColor: '#fee', color: 'red', padding: '10px', borderRadius: '5px' }}>⚠️ {error}</div>}

            {loading && <div className="loading">Cargando...</div>}

            <main style={{ display: 'flex', gap: '20px' }}>
                <section className="transcriptions-list" style={{ flex: 1, maxHeight: '80vh', overflowY: 'auto' }}>
                    <h2>Transcripciones ({transcriptions.length})</h2>

                    {transcriptions.length === 0 ? (
                        <p>No hay transcripciones. Verifica que el CDM está activo.</p>
                    ) : (
                        <ul style={{ listStyle: 'none', padding: 0 }}>
                            {transcriptions.map(t => (
                                <li key={t.id} style={{ border: '1px solid #eee', padding: '10px', marginBottom: '10px', borderRadius: '5px', background: '#f9f9f9' }}>
                                    <div style={{ fontWeight: 'bold' }}>{t.contacto}</div>
                                    <div style={{ fontSize: '0.9em', color: '#666' }}>{t.fecha}</div>
                                    <div style={{ marginTop: '5px' }}>{t.resumen.substring(0, 100)}...</div>
                                    <div style={{ marginTop: '10px', display: 'flex', gap: '10px' }}>
                                        <button onClick={() => handleViewContent(t.id)} style={{ padding: '5px 10px', cursor: 'pointer' }}>Ver Texto</button>
                                        <button onClick={() => handleEditResumen(t.id, t.resumen)} style={{ padding: '5px 10px', cursor: 'pointer' }}>Editar Resumen</button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                <section className="details-panel" style={{ flex: 1, border: '1px solid #ddd', padding: '20px', borderRadius: '5px' }}>
                    {selectedId ? (
                        <>
                            {fileContent !== null ? (
                                <div>
                                    <h3>Contenido del Archivo ({selectedId})</h3>
                                    <pre style={{ whiteSpace: 'pre-wrap', background: '#eee', padding: '10px', borderRadius: '5px' }}>{fileContent}</pre>
                                    <button onClick={() => setSelectedId(null)}>Cerrar</button>
                                </div>
                            ) : (
                                <div>
                                    <h3>Editar Resumen ({selectedId})</h3>
                                    <textarea
                                        value={editingResumen}
                                        onChange={(e) => setEditingResumen(e.target.value)}
                                        style={{ width: '100%', height: '200px', padding: '10px' }}
                                    />
                                    <div style={{ marginTop: '10px' }}>
                                        <button onClick={saveResumen} style={{ marginRight: '10px', padding: '8px 16px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Guardar</button>
                                        <button onClick={() => setSelectedId(null)} style={{ padding: '8px 16px', background: '#ccc', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Cancelar</button>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <p>Selecciona una transcripción para ver detalles.</p>
                    )}
                </section>
            </main>
        </div>
    );
}

export default App;
