import { Component, type ReactNode } from 'react'
import { ErrorState } from './StateViews.tsx'

interface ErrorBoundaryProps {
  /** Texto do título quando a área falha (ex.: "O mapa não pôde ser apresentado"). */
  title: string
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

/** Isola falhas de uma área da interface para não derrubar a aplicação inteira. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error: error instanceof Error ? error : new Error(String(error)) }
  }

  private readonly reset = () => {
    this.setState({ error: null })
  }

  override render() {
    if (this.state.error) {
      return (
        <div className="flex h-full w-full items-center justify-center p-6">
          <ErrorState title={this.props.title} description={this.state.error.message} onRetry={this.reset} />
        </div>
      )
    }
    return this.props.children
  }
}
