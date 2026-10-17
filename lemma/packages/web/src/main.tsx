import '@fontsource-variable/red-hat-text/wght.css';
import '@fontsource-variable/red-hat-mono/wght.css';
import 'katex/dist/katex.min.css';
import './index.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { ApiFailure } from './app/api';
import { App } from './app/App';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: true,
      // A missing page or a rejected request will not get better by asking again.
      retry: (failures, error) =>
        !(error instanceof ApiFailure && error.status >= 400 && error.status < 500) && failures < 2,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
