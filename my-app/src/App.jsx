import './App.css'

function App() {
    return (
        <div className="blank-page">
            <h1 className="page-title">Energy System Monitor</h1>

            <button className="energy-bug-button" type="button" aria-label="Energy Bug">
                <span className="energy-bug-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" role="img" focusable="false">
                        <circle cx="12" cy="12" r="10" />
                        <circle className="energy-bug-eye" cx="9" cy="10" r="1.2" />
                        <circle className="energy-bug-eye" cx="15" cy="10" r="1.2" />
                        <path d="M8 14.5c1 1 2.2 1.5 4 1.5s3-.5 4-1.5" />
                    </svg>
                </span>
                <span>Energy Bug</span>
            </button>
        </div>
    )
}

export default App
