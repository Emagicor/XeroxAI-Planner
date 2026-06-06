import { Component } from 'react'
import { logError } from '@/utils/logger'
import { toastError } from '@/stores/toastStore'
import Button from '@/components/ui/Button'
//Page Error Handeling
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

  handleReset = () => {
    this.setState({ error: null })
    this.props.onReset?.()
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen app-bg flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-2xl border border-red-500/30 bg-red-950/20 p-8 text-center">
            <h1 className="text-lg font-semibold text-red-200 mb-2">Something went wrong</h1>
            <p className="text-sm text-red-200/70 mb-6">
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
