import { Component, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import "ol/ol.css";
import App from './app/App.jsx'

// Catches render-time React errors and shows a fallback panel instead of a blank screen.
class AppErrorBoundary extends Component {
    // Initialize the component state.
    constructor(props) {
        super(props);
        // hasError determines whether an error has occurred and errorMessage stores the error description.
        this.state = { hasError: false, errorMessage: '' };
    }
    // This lifecycle method is automatically called when a child component throws an error during rendering.    
    static getDerivedStateFromError(error) {
        return {
            hasError: true,
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
        };
    }
    //logs the error details to the console for debugging purposes.
    componentDidCatch(error, errorInfo) {
        // Keep full details in the console to support debugging.
        console.error('Application render error:', error, errorInfo);
    }
    // Renders either the fallback error screen or the dashboard.
    render() {
        //Display a error message if error happend.
        if (this.state.hasError) {
            // Human-friendly fallback shown when React tree crashes.
            return (
                <div style={{ padding: '24px', fontFamily: 'system-ui, sans-serif' }}>
                    <h1 style={{ margin: '0 0 12px' }}>Something went wrong</h1>
                    <p style={{ margin: '0 0 10px' }}>The app encountered a runtime error instead of loading normally.</p>
                    <p style={{ margin: 0 }}><strong>Error:</strong> {this.state.errorMessage}</p>
                </div>
            );
        }
        // if there is no error ,render the children components normally.
        return this.props.children;
    }
}

// Create the root React application and render it into the HTML element with the id "root".
createRoot(document.getElementById('root')).render(
    //helps to identify potential problems in an application.
    <StrictMode>
        {/*Wrap the entire application inside the Error Boundary*/}
        <AppErrorBoundary>
            <App />
        </AppErrorBoundary>
    </StrictMode>,
)
