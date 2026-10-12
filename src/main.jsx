import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './PortalApp.jsx';
import './styles.css';
import './management.css';

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
