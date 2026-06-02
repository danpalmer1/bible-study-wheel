import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { SpinLockProvider } from './spin/SpinLockContext';
import App from './App';
import { initAmplifyIfNeeded } from './aws-amplify-init';
import './index.css';

initAmplifyIfNeeded().finally(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <BrowserRouter>
        <AuthProvider>
          <SpinLockProvider>
            <App />
          </SpinLockProvider>
        </AuthProvider>
      </BrowserRouter>
    </React.StrictMode>
  );
});
