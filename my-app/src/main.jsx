import { Component, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import "ol/ol.css";
import App from './App.jsx'

class AppErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, errorMessage: '' };
    }

    static getDerivedStateFromError(error) {
        return {
            hasError: true,
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
        };
    }

    componentDidCatch(error, errorInfo) {
        console.error('Application render error:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: '24px', fontFamily: 'system-ui, sans-serif' }}>
                    <h1 style={{ margin: '0 0 12px' }}>Something went wrong</h1>
                    <p style={{ margin: '0 0 10px' }}>The app encountered a runtime error instead of loading normally.</p>
                    <p style={{ margin: 0 }}><strong>Error:</strong> {this.state.errorMessage}</p>
                </div>
            );
        }

        return this.props.children;
    }
}

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <AppErrorBoundary>
            <App />
        </AppErrorBoundary>
    </StrictMode>,
)
