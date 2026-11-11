import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo);
  }

  private handleReset = () => {
    localStorage.clear();
    sessionStorage.clear();
    window.location.reload();
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FFFDF7] text-[#181B23] flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white border-3 border-[#181B23] rounded-3xl p-6 shadow-[6px_6px_0px_#181B23] text-center">
            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl border-2 border-[#181B23] overflow-hidden bg-[#FFB5A7] shadow-[3px_3px_0px_#181B23]">
              <img
                src="/assets/gigio-rosita.jpg"
                alt="Gigio & Rosita"
                className="w-full h-full object-cover"
              />
            </div>

            <span className="inline-block bg-[#FDE68A] text-[#181B23] text-xs font-black px-3 py-1 rounded-full border-2 border-[#181B23] mb-2">
              Un pequeño tropiezo de amor 🐭❤️
            </span>

            <h2 className="font-bold text-xl mb-2 text-[#181B23]">
              ¡Ups! Hubo un detalle técnico
            </h2>

            <p className="text-xs text-[#181B23]/80 mb-6 leading-relaxed">
              Ocurrió un error al cargar los datos en este navegador. Tus recuerdos y planes están a salvo.
            </p>

            <div className="space-y-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full py-2.5 px-4 bg-[#FF6E61] text-white font-bold rounded-xl border-2 border-[#181B23] shadow-[3px_3px_0px_#181B23] hover:bg-[#FA5A4C] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none text-xs"
              >
                Recargar Página
              </button>

              <button
                type="button"
                onClick={this.handleReset}
                className="w-full py-2 px-4 bg-[#FDE68A] text-[#181B23] font-bold rounded-xl border-2 border-[#181B23] shadow-[3px_3px_0px_#181B23] hover:bg-[#FCD34D] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none text-xs"
              >
                Limpiar datos locales y reiniciar
              </button>
            </div>

            {this.state.error && (
              <details className="mt-4 text-left">
                <summary className="text-[10px] text-[#181B23]/50 cursor-pointer font-bold">
                  Detalles del error (técnico)
                </summary>
                <pre className="mt-1 p-2 bg-gray-100 rounded text-[9px] overflow-x-auto text-red-600">
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
