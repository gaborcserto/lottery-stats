import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { useResource } from './use-resource'

function ResourceView({
  load,
}: {
  load: (key: string, signal: AbortSignal) => Promise<string>
}) {
  const [key, setKey] = useState('first')
  const resource = useResource(key, load)
  return (
    <>
      <button onClick={() => setKey('second')}>Refresh</button>
      <button onClick={resource.retry}>Retry</button>
      <div data-testid="data">{resource.data}</div>
      <div data-testid="previous">{resource.previousData}</div>
      {resource.loading && <p role="status">Loading</p>}
      {resource.error && <p role="alert">{resource.error}</p>}
    </>
  )
}

describe('useResource refresh state', () => {
  it('reports a pending retry while retaining the current data', async () => {
    const load = vi
      .fn()
      .mockResolvedValueOnce('loaded data')
      .mockImplementation(() => new Promise<string>(() => {}))
    render(<ResourceView load={load} />)
    expect(await screen.findByText('loaded data')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(screen.getByRole('status')).toHaveTextContent('Loading')
    expect(screen.getByTestId('data')).toHaveTextContent('loaded data')
  })
  it('keeps the last result available while refreshing and after a failure', async () => {
    let rejectPending: (reason?: unknown) => void = () => {}
    const pending = new Promise<string>((_resolve, reject) => {
      rejectPending = reject
    })
    const load = vi.fn((key: string) =>
      key === 'first' ? Promise.resolve('loaded data') : pending,
    )
    render(<ResourceView load={load} />)

    expect(await screen.findByTestId('data')).toHaveTextContent('loaded data')
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByTestId('previous')).toHaveTextContent('loaded data')

    rejectPending(new Error('temporary failure'))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByTestId('previous')).toHaveTextContent('loaded data')
  })
})
