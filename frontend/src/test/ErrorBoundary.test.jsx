/**
 * ErrorBoundary.test.jsx — M-002
 * Tests the ErrorBoundary component renders a fallback when a child throws,
 * and renders children normally when no error occurs.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ErrorBoundary from '../components/ErrorBoundary';

// Suppress React's expected console.error noise from error boundary tests
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

// A component that always throws
function BombComponent() {
  throw new Error('Test explosion');
}

// A component that renders normally
function SafeComponent() {
  return <p>All good!</p>;
}

describe('ErrorBoundary', () => {
  it('renders children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <SafeComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('All good!')).toBeInTheDocument();
  });

  it('renders fallback UI when a child throws', () => {
    render(
      <ErrorBoundary>
        <BombComponent />
      </ErrorBoundary>
    );

    // The ErrorBoundary should catch and show its fallback, not crash the test
    expect(screen.queryByText('All good!')).not.toBeInTheDocument();
    // Should render some fallback indicator — heading or button
    const heading = screen.queryByRole('heading');
    const button  = screen.queryByRole('button');
    expect(heading || button).toBeTruthy();
  });
});
