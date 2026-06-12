import { Component } from 'react'
import { logError } from '@/utils/logger'
import { toastError } from '@/stores/toastStore'
import Button from '@/components/ui/Button'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    logError('react.error_boundary', error, { componentStack: info.componentStack })
    toastError('The page hit an unexpected error. Try refreshing or uploading again.', {
      title: 'UI error',
    })
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen app-bg flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-xl border alert-error p-8 text-center shadow-[var(--shadow-md)]">
            <h1 className="text-lg font-semibold text-text mb-2">Something went wrong</h1>
            <p className="text-sm text-text-secondary mb-6">
              {this.state.error.message || 'An unexpected error occurred.'}
            </p>
            <Button onClick={() => window.location.reload()}>
              Reload page
            </Button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
