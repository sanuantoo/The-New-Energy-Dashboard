import './App.css'
import { useEffect, useState } from 'react'
import * as Papa from 'papaparse'

function App() {
    // This state stores the final sum of the "consumption" column.
    const [consumption, setConsumption] = useState(null)

    useEffect(() => {
        Papa.parse('/H1_Wh (1).csv', {
            download: true,
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true,
            complete: (results) => {
                const rows = Array.isArray(results.data) ? results.data : []

                if (rows.length === 0) {
                    setConsumption(null)
                    return
                }

                const firstRow = rows[0] || {}
                const keyName = Object.keys(firstRow).find((key) =>
                    key.toLowerCase().includes('consumption'),
                )

                if (!keyName) {
                    setConsumption(null)
                    return
                }

                const total = rows.reduce((sum, row) => {
                    const value = row?.[keyName]
                    const numberValue =
                        typeof value === 'number' ? value : parseFloat(String(value))

                    return sum + (Number.isFinite(numberValue) ? numberValue : 0)
                }, 0)

                setConsumption(total)
            },
            error: () => setConsumption(null),
        })
    }, [])

    return (
        <div className="app-root">
            <div className="app-layout">
                <aside className="consumption-grid" aria-label="Consumption">
                    <div className="consumption-title">Consumption</div>
                    <div className="consumption-value">
                        {consumption === null ? '— kWh' : `${consumption.toFixed(2)} kWh`}
                    </div>
                </aside>

                <main className="main-content">{/* Plain placeholder area for future work */}</main>
            </div>

            <button className="ai-bot-button" type="button" aria-label="Energy Bot">
                Energy Bot
            </button>
        </div>
    )
}

export default App
